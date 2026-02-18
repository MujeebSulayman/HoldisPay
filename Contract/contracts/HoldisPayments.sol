// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title HoldisPayments - Recurring Payment Contracts System
 * @notice Manages employment/contractor agreements with automatic recurring payments
 * @dev Supports time-based and milestone-based payment releases
 */
contract HoldisPayments is 
    Initializable, 
    UUPSUpgradeable, 
    AccessControlUpgradeable, 
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    // ============ Enums ============
    
    enum ContractStatus {
        DRAFT,           // Created but not funded
        ACTIVE,          // Funded and running
        PAUSED,          // Temporarily stopped
        COMPLETED,       // Finished successfully
        TERMINATED,      // Ended early
        DISPUTED         // Under dispute
    }

    enum ReleaseType {
        AUTO_TIME_BASED,      // Release automatically on schedule
        MILESTONE_BASED,      // Release on milestone completion
        APPROVAL_REQUIRED     // Requires employer approval
    }

    enum PaymentFrequency {
        WEEKLY,
        BI_WEEKLY,
        MONTHLY,
        QUARTERLY,
        CUSTOM
    }

    enum DisputeStatus {
        NONE,
        RAISED,
        UNDER_REVIEW,
        RESOLVED
    }

    // ============ Structs ============

    struct PaymentContract {
        uint256 id;
        address employer;
        address contractor;
        
        // Financial
        uint256 totalAmount;
        uint256 paymentAmount;        // Per period
        uint256 fundedAmount;
        uint256 paidAmount;
        uint256 remainingBalance;
        address token;
        
        // Timing
        uint256 startDate;
        uint256 endDate;
        uint256 nextPaymentDate;
        uint256 lastPaymentDate;
        uint256 paymentDay;           // Day of month/week
        PaymentFrequency frequency;
        
        // Configuration
        ContractStatus status;
        ReleaseType releaseType;
        bool requiresApproval;
        uint256 gracePeriodDays;
        
        // Metadata
        string jobTitle;
        string description;
        string contractHash;          // IPFS link
        uint256 createdAt;
    }

    struct Milestone {
        uint256 id;
        string description;
        uint256 amount;
        uint256 dueDate;
        bool completed;
        bool approved;
        bool paid;
        string proofHash;
        uint256 completedAt;
        uint256 approvedAt;
    }

    struct TeamMember {
        address wallet;
        uint256 sharePercentage;      // Basis points (10000 = 100%)
        string role;
        bool active;
    }

    struct Dispute {
        uint256 id;
        address raisedBy;
        string reason;
        string evidenceHash;
        DisputeStatus status;
        string resolution;
        address resolvedBy;
        uint256 raisedAt;
        uint256 resolvedAt;
    }

    struct PerformanceBonus {
        uint256 id;
        string description;
        uint256 amount;
        string kpiHash;               // KPI criteria
        bool achieved;
        bool paid;
        uint256 achievedAt;
    }

    // ============ State Variables ============

    uint256 private _nextContractId;
    uint256 private _nextMilestoneId;
    uint256 private _nextDisputeId;
    uint256 private _nextBonusId;

    // Contract ID => PaymentContract
    mapping(uint256 => PaymentContract) public contracts;
    
    // Contract ID => Milestone ID => Milestone
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(uint256 => uint256[]) public contractMilestones;
    
    // Contract ID => Team Member Address => TeamMember
    mapping(uint256 => mapping(address => TeamMember)) public teamMembers;
    mapping(uint256 => address[]) public contractTeam;
    
    // Contract ID => Dispute
    mapping(uint256 => Dispute) public disputes;
    
    // Contract ID => Bonus ID => PerformanceBonus
    mapping(uint256 => mapping(uint256 => PerformanceBonus)) public bonuses;
    mapping(uint256 => uint256[]) public contractBonuses;

    // User tracking
    mapping(address => uint256[]) public employerContracts;
    mapping(address => uint256[]) public contractorContracts;

    // Supported tokens
    mapping(address => bool) public supportedTokens;
    address[] public supportedTokenList;

    // Platform settings
    uint256 public platformFeePercentage; // Basis points (100 = 1%)
    address public feeCollector;
    uint256 public minContractAmount;
    uint256 public maxContractDuration;

    // ============ Events ============

    event ContractCreated(
        uint256 indexed contractId,
        address indexed employer,
        address indexed contractor,
        uint256 totalAmount,
        uint256 paymentAmount,
        ReleaseType releaseType
    );

    event ContractFunded(
        uint256 indexed contractId,
        address indexed funder,
        uint256 amount,
        uint256 totalFunded
    );

    event PaymentReleased(
        uint256 indexed contractId,
        address indexed recipient,
        uint256 amount,
        uint256 paymentNumber,
        uint256 timestamp
    );

    event MilestoneCreated(
        uint256 indexed contractId,
        uint256 indexed milestoneId,
        string description,
        uint256 amount,
        uint256 dueDate
    );

    event MilestoneSubmitted(
        uint256 indexed contractId,
        uint256 indexed milestoneId,
        string proofHash,
        uint256 timestamp
    );

    event MilestoneApproved(
        uint256 indexed contractId,
        uint256 indexed milestoneId,
        address indexed approver,
        uint256 timestamp
    );

    event MilestonePaid(
        uint256 indexed contractId,
        uint256 indexed milestoneId,
        address recipient,
        uint256 amount
    );

    event ContractStatusChanged(
        uint256 indexed contractId,
        ContractStatus oldStatus,
        ContractStatus newStatus,
        uint256 timestamp
    );

    event ContractPaused(
        uint256 indexed contractId,
        address indexed pausedBy,
        uint256 timestamp
    );

    event ContractResumed(
        uint256 indexed contractId,
        address indexed resumedBy,
        uint256 timestamp
    );

    event ContractTerminated(
        uint256 indexed contractId,
        address indexed terminatedBy,
        string reason,
        uint256 refundAmount
    );

    event DisputeRaised(
        uint256 indexed contractId,
        uint256 indexed disputeId,
        address indexed raisedBy,
        string reason
    );

    event DisputeResolved(
        uint256 indexed contractId,
        uint256 indexed disputeId,
        address indexed resolvedBy,
        string resolution
    );

    event BonusAdded(
        uint256 indexed contractId,
        uint256 indexed bonusId,
        uint256 amount,
        string description
    );

    event BonusPaid(
        uint256 indexed contractId,
        uint256 indexed bonusId,
        address recipient,
        uint256 amount
    );

    event TeamMemberAdded(
        uint256 indexed contractId,
        address indexed member,
        uint256 sharePercentage,
        string role
    );

    event TeamMemberRemoved(
        uint256 indexed contractId,
        address indexed member
    );

    // ============ Modifiers ============

    modifier onlyEmployer(uint256 contractId) {
        require(contracts[contractId].employer == msg.sender, "Not employer");
        _;
    }

    modifier onlyContractor(uint256 contractId) {
        require(contracts[contractId].contractor == msg.sender, "Not contractor");
        _;
    }

    modifier onlyParty(uint256 contractId) {
        require(
            contracts[contractId].employer == msg.sender || 
            contracts[contractId].contractor == msg.sender,
            "Not a party"
        );
        _;
    }

    modifier contractExists(uint256 contractId) {
        require(contracts[contractId].employer != address(0), "Contract not found");
        _;
    }

    modifier contractActive(uint256 contractId) {
        require(contracts[contractId].status == ContractStatus.ACTIVE, "Contract not active");
        _;
    }

    // ============ Initialize ============

    function initialize(address admin, address _feeCollector) public initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        
        feeCollector = _feeCollector;
        platformFeePercentage = 200; // 2%
        minContractAmount = 1e18; // 1 token
        maxContractDuration = 365 days * 5; // 5 years
        
        _nextContractId = 1;
        _nextMilestoneId = 1;
        _nextDisputeId = 1;
        _nextBonusId = 1;
    }

    // ============ Contract Creation ============

    /**
     * @notice Create a new payment contract
     */
    function createContract(
        address contractor,
        uint256 paymentAmount,
        uint256 startDate,
        uint256 endDate,
        uint256 paymentDay,
        PaymentFrequency frequency,
        ReleaseType releaseType,
        address token,
        string memory jobTitle,
        string memory description,
        string memory contractHash
    ) external whenNotPaused returns (uint256) {
        require(contractor != address(0), "Invalid contractor");
        require(contractor != msg.sender, "Cannot contract yourself");
        require(paymentAmount >= minContractAmount, "Amount too low");
        require(supportedTokens[token], "Token not supported");
        require(startDate >= block.timestamp, "Invalid start date");
        require(endDate > startDate, "Invalid end date");
        require(endDate <= startDate + maxContractDuration, "Duration too long");

        uint256 contractId = _nextContractId++;
        
        uint256 totalAmount = _calculateTotalAmount(
            paymentAmount,
            startDate,
            endDate,
            frequency
        );

        PaymentContract storage newContract = contracts[contractId];
        newContract.id = contractId;
        newContract.employer = msg.sender;
        newContract.contractor = contractor;
        newContract.totalAmount = totalAmount;
        newContract.paymentAmount = paymentAmount;
        newContract.token = token;
        newContract.startDate = startDate;
        newContract.endDate = endDate;
        newContract.paymentDay = paymentDay;
        newContract.frequency = frequency;
        newContract.releaseType = releaseType;
        newContract.status = ContractStatus.DRAFT;
        newContract.jobTitle = jobTitle;
        newContract.description = description;
        newContract.contractHash = contractHash;
        newContract.createdAt = block.timestamp;
        newContract.gracePeriodDays = 7; // Default 7 days grace

        // Set next payment date
        newContract.nextPaymentDate = _calculateNextPaymentDate(
            startDate,
            paymentDay,
            frequency
        );

        employerContracts[msg.sender].push(contractId);
        contractorContracts[contractor].push(contractId);

        emit ContractCreated(
            contractId,
            msg.sender,
            contractor,
            totalAmount,
            paymentAmount,
            releaseType
        );

        return contractId;
    }

    /**
     * @notice Fund a contract (can be partial or full)
     */
    function fundContract(uint256 contractId, uint256 amount) 
        external 
        whenNotPaused 
        onlyEmployer(contractId)
        contractExists(contractId)
        nonReentrant 
    {
        PaymentContract storage pContract = contracts[contractId];
        require(pContract.status == ContractStatus.DRAFT || pContract.status == ContractStatus.ACTIVE, "Cannot fund");
        require(amount > 0, "Invalid amount");

        IERC20 token = IERC20(pContract.token);
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        pContract.fundedAmount += amount;
        pContract.remainingBalance += amount;

        // Activate if fully or partially funded
        if (pContract.status == ContractStatus.DRAFT && pContract.fundedAmount > 0) {
            pContract.status = ContractStatus.ACTIVE;
            emit ContractStatusChanged(contractId, ContractStatus.DRAFT, ContractStatus.ACTIVE, block.timestamp);
        }

        emit ContractFunded(contractId, msg.sender, amount, pContract.fundedAmount);
    }

    // ============ Payment Processing ============

    /**
     * @notice Process scheduled payments (called by Keeper/Automation)
     */
    function processScheduledPayment(uint256 contractId) 
        external 
        whenNotPaused
        contractExists(contractId)
        nonReentrant
        returns (bool)
    {
        require(
            hasRole(KEEPER_ROLE, msg.sender) || 
            contracts[contractId].contractor == msg.sender,
            "Not authorized"
        );

        PaymentContract storage pContract = contracts[contractId];
        
        require(pContract.status == ContractStatus.ACTIVE, "Contract not active");
        require(pContract.releaseType == ReleaseType.AUTO_TIME_BASED, "Not auto-release");
        require(block.timestamp >= pContract.nextPaymentDate, "Not due yet");
        require(pContract.remainingBalance >= pContract.paymentAmount, "Insufficient balance");

        return _executePayment(contractId, pContract.contractor, pContract.paymentAmount);
    }

    /**
     * @notice Contractor claims payment manually
     */
    function claimPayment(uint256 contractId)
        external
        whenNotPaused
        contractExists(contractId)
        onlyContractor(contractId)
        nonReentrant
        returns (bool)
    {
        PaymentContract storage pContract = contracts[contractId];
        
        require(pContract.status == ContractStatus.ACTIVE, "Contract not active");
        require(
            block.timestamp >= pContract.nextPaymentDate + (pContract.gracePeriodDays * 1 days),
            "Grace period not over"
        );
        require(pContract.remainingBalance >= pContract.paymentAmount, "Insufficient balance");

        return _executePayment(contractId, pContract.contractor, pContract.paymentAmount);
    }

    /**
     * @notice Internal function to execute payment
     */
    function _executePayment(uint256 contractId, address recipient, uint256 amount) 
        internal 
        returns (bool) 
    {
        PaymentContract storage pContract = contracts[contractId];
        
        // Calculate platform fee
        uint256 fee = (amount * platformFeePercentage) / 10000;
        uint256 netAmount = amount - fee;

        // Transfer payment
        IERC20 token = IERC20(pContract.token);
        require(token.transfer(recipient, netAmount), "Payment failed");
        
        if (fee > 0) {
            require(token.transfer(feeCollector, fee), "Fee transfer failed");
        }

        // Update contract state
        pContract.remainingBalance -= amount;
        pContract.paidAmount += amount;
        pContract.lastPaymentDate = block.timestamp;
        pContract.nextPaymentDate = _calculateNextPaymentDate(
            pContract.nextPaymentDate,
            pContract.paymentDay,
            pContract.frequency
        );

        // Check if contract completed
        if (block.timestamp >= pContract.endDate || pContract.remainingBalance < pContract.paymentAmount) {
            pContract.status = ContractStatus.COMPLETED;
            emit ContractStatusChanged(contractId, ContractStatus.ACTIVE, ContractStatus.COMPLETED, block.timestamp);
        }

        uint256 paymentNumber = pContract.paidAmount / pContract.paymentAmount;
        emit PaymentReleased(contractId, recipient, netAmount, paymentNumber, block.timestamp);

        return true;
    }

    // ============ Milestone Management ============

    /**
     * @notice Add milestone to contract
     */
    function addMilestone(
        uint256 contractId,
        string memory description,
        uint256 amount,
        uint256 dueDate
    ) 
        external
        whenNotPaused
        onlyEmployer(contractId)
        contractExists(contractId)
        returns (uint256)
    {
        require(contracts[contractId].releaseType == ReleaseType.MILESTONE_BASED, "Not milestone-based");
        require(amount > 0, "Invalid amount");
        require(dueDate > block.timestamp, "Invalid due date");

        uint256 milestoneId = _nextMilestoneId++;

        Milestone storage milestone = milestones[contractId][milestoneId];
        milestone.id = milestoneId;
        milestone.description = description;
        milestone.amount = amount;
        milestone.dueDate = dueDate;

        contractMilestones[contractId].push(milestoneId);

        emit MilestoneCreated(contractId, milestoneId, description, amount, dueDate);

        return milestoneId;
    }

    /**
     * @notice Submit milestone completion
     */
    function submitMilestone(
        uint256 contractId,
        uint256 milestoneId,
        string memory proofHash
    )
        external
        whenNotPaused
        onlyContractor(contractId)
        contractExists(contractId)
    {
        Milestone storage milestone = milestones[contractId][milestoneId];
        require(!milestone.completed, "Already submitted");
        require(milestone.amount > 0, "Milestone not found");

        milestone.completed = true;
        milestone.proofHash = proofHash;
        milestone.completedAt = block.timestamp;

        emit MilestoneSubmitted(contractId, milestoneId, proofHash, block.timestamp);
    }

    /**
     * @notice Approve milestone
     */
    function approveMilestone(uint256 contractId, uint256 milestoneId)
        external
        whenNotPaused
        onlyEmployer(contractId)
        contractExists(contractId)
        nonReentrant
    {
        Milestone storage milestone = milestones[contractId][milestoneId];
        PaymentContract storage pContract = contracts[contractId];
        
        require(milestone.completed, "Not completed");
        require(!milestone.approved, "Already approved");
        require(!milestone.paid, "Already paid");
        require(pContract.remainingBalance >= milestone.amount, "Insufficient balance");

        milestone.approved = true;
        milestone.approvedAt = block.timestamp;

        emit MilestoneApproved(contractId, milestoneId, msg.sender, block.timestamp);

        // Auto-pay
        _executeMilestonePayment(contractId, milestoneId);
    }

    function _executeMilestonePayment(uint256 contractId, uint256 milestoneId) internal {
        Milestone storage milestone = milestones[contractId][milestoneId];
        PaymentContract storage pContract = contracts[contractId];
        
        require(milestone.approved, "Not approved");
        require(!milestone.paid, "Already paid");

        milestone.paid = true;
        
        _executePayment(contractId, pContract.contractor, milestone.amount);

        emit MilestonePaid(contractId, milestoneId, pContract.contractor, milestone.amount);
    }

    // ============ Contract Management ============

    /**
     * @notice Pause contract
     */
    function pauseContract(uint256 contractId)
        external
        whenNotPaused
        onlyEmployer(contractId)
        contractExists(contractId)
    {
        PaymentContract storage pContract = contracts[contractId];
        require(pContract.status == ContractStatus.ACTIVE, "Not active");

        pContract.status = ContractStatus.PAUSED;

        emit ContractPaused(contractId, msg.sender, block.timestamp);
        emit ContractStatusChanged(contractId, ContractStatus.ACTIVE, ContractStatus.PAUSED, block.timestamp);
    }

    /**
     * @notice Resume contract
     */
    function resumeContract(uint256 contractId)
        external
        whenNotPaused
        onlyEmployer(contractId)
        contractExists(contractId)
    {
        PaymentContract storage pContract = contracts[contractId];
        require(pContract.status == ContractStatus.PAUSED, "Not paused");

        pContract.status = ContractStatus.ACTIVE;

        emit ContractResumed(contractId, msg.sender, block.timestamp);
        emit ContractStatusChanged(contractId, ContractStatus.PAUSED, ContractStatus.ACTIVE, block.timestamp);
    }

    /**
     * @notice Terminate contract early
     */
    function terminateContract(uint256 contractId, string memory reason)
        external
        whenNotPaused
        onlyParty(contractId)
        contractExists(contractId)
        nonReentrant
    {
        PaymentContract storage pContract = contracts[contractId];
        require(
            pContract.status == ContractStatus.ACTIVE || 
            pContract.status == ContractStatus.PAUSED,
            "Cannot terminate"
        );

        uint256 refundAmount = pContract.remainingBalance;
        pContract.status = ContractStatus.TERMINATED;
        pContract.remainingBalance = 0;

        // Refund remaining balance to employer
        if (refundAmount > 0) {
            IERC20 token = IERC20(pContract.token);
            require(token.transfer(pContract.employer, refundAmount), "Refund failed");
        }

        emit ContractTerminated(contractId, msg.sender, reason, refundAmount);
        emit ContractStatusChanged(
            contractId, 
            pContract.status, 
            ContractStatus.TERMINATED, 
            block.timestamp
        );
    }

    // ============ Dispute Management ============

    /**
     * @notice Raise a dispute
     */
    function raiseDispute(
        uint256 contractId,
        string memory reason,
        string memory evidenceHash
    )
        external
        whenNotPaused
        onlyParty(contractId)
        contractExists(contractId)
        returns (uint256)
    {
        PaymentContract storage pContract = contracts[contractId];
        require(pContract.status == ContractStatus.ACTIVE, "Contract not active");
        require(disputes[contractId].status == DisputeStatus.NONE, "Dispute already exists");

        uint256 disputeId = _nextDisputeId++;

        Dispute storage dispute = disputes[contractId];
        dispute.id = disputeId;
        dispute.raisedBy = msg.sender;
        dispute.reason = reason;
        dispute.evidenceHash = evidenceHash;
        dispute.status = DisputeStatus.RAISED;
        dispute.raisedAt = block.timestamp;

        pContract.status = ContractStatus.DISPUTED;

        emit DisputeRaised(contractId, disputeId, msg.sender, reason);
        emit ContractStatusChanged(contractId, ContractStatus.ACTIVE, ContractStatus.DISPUTED, block.timestamp);

        return disputeId;
    }

    /**
     * @notice Resolve dispute (admin only)
     */
    function resolveDispute(
        uint256 contractId,
        string memory resolution,
        bool favorEmployer,
        uint256 employerAmount,
        uint256 contractorAmount
    )
        external
        whenNotPaused
        onlyRole(ADMIN_ROLE)
        contractExists(contractId)
        nonReentrant
    {
        PaymentContract storage pContract = contracts[contractId];
        Dispute storage dispute = disputes[contractId];
        
        require(pContract.status == ContractStatus.DISPUTED, "Not disputed");
        require(dispute.status == DisputeStatus.RAISED || dispute.status == DisputeStatus.UNDER_REVIEW, "Invalid dispute status");

        IERC20 token = IERC20(pContract.token);

        // Distribute funds based on resolution
        if (employerAmount > 0 && employerAmount <= pContract.remainingBalance) {
            require(token.transfer(pContract.employer, employerAmount), "Employer transfer failed");
            pContract.remainingBalance -= employerAmount;
        }

        if (contractorAmount > 0 && contractorAmount <= pContract.remainingBalance) {
            require(token.transfer(pContract.contractor, contractorAmount), "Contractor transfer failed");
            pContract.remainingBalance -= contractorAmount;
        }

        dispute.status = DisputeStatus.RESOLVED;
        dispute.resolution = resolution;
        dispute.resolvedBy = msg.sender;
        dispute.resolvedAt = block.timestamp;

        pContract.status = ContractStatus.TERMINATED;

        emit DisputeResolved(contractId, dispute.id, msg.sender, resolution);
        emit ContractStatusChanged(contractId, ContractStatus.DISPUTED, ContractStatus.TERMINATED, block.timestamp);
    }

    // ============ Performance Bonuses ============

    /**
     * @notice Add performance bonus
     */
    function addBonus(
        uint256 contractId,
        string memory description,
        uint256 amount,
        string memory kpiHash
    )
        external
        whenNotPaused
        onlyEmployer(contractId)
        contractExists(contractId)
        returns (uint256)
    {
        require(amount > 0, "Invalid amount");

        uint256 bonusId = _nextBonusId++;

        PerformanceBonus storage bonus = bonuses[contractId][bonusId];
        bonus.id = bonusId;
        bonus.description = description;
        bonus.amount = amount;
        bonus.kpiHash = kpiHash;

        contractBonuses[contractId].push(bonusId);

        emit BonusAdded(contractId, bonusId, amount, description);

        return bonusId;
    }

    /**
     * @notice Pay performance bonus
     */
    function payBonus(uint256 contractId, uint256 bonusId)
        external
        whenNotPaused
        onlyEmployer(contractId)
        contractExists(contractId)
        nonReentrant
    {
        PaymentContract storage pContract = contracts[contractId];
        PerformanceBonus storage bonus = bonuses[contractId][bonusId];
        
        require(!bonus.paid, "Already paid");
        require(pContract.remainingBalance >= bonus.amount, "Insufficient balance");

        bonus.achieved = true;
        bonus.paid = true;
        bonus.achievedAt = block.timestamp;

        _executePayment(contractId, pContract.contractor, bonus.amount);

        emit BonusPaid(contractId, bonusId, pContract.contractor, bonus.amount);
    }

    // ============ Team Contracts ============

    /**
     * @notice Add team member to contract
     */
    function addTeamMember(
        uint256 contractId,
        address member,
        uint256 sharePercentage,
        string memory role
    )
        external
        whenNotPaused
        onlyEmployer(contractId)
        contractExists(contractId)
    {
        require(member != address(0), "Invalid address");
        require(sharePercentage > 0 && sharePercentage <= 10000, "Invalid share");
        require(!teamMembers[contractId][member].active, "Already member");

        // Verify total shares don't exceed 100%
        uint256 totalShares = sharePercentage;
        address[] storage team = contractTeam[contractId];
        for (uint256 i = 0; i < team.length; i++) {
            if (teamMembers[contractId][team[i]].active) {
                totalShares += teamMembers[contractId][team[i]].sharePercentage;
            }
        }
        require(totalShares <= 10000, "Exceeds 100%");

        TeamMember storage teamMember = teamMembers[contractId][member];
        teamMember.wallet = member;
        teamMember.sharePercentage = sharePercentage;
        teamMember.role = role;
        teamMember.active = true;

        contractTeam[contractId].push(member);

        emit TeamMemberAdded(contractId, member, sharePercentage, role);
    }

    /**
     * @notice Remove team member
     */
    function removeTeamMember(uint256 contractId, address member)
        external
        whenNotPaused
        onlyEmployer(contractId)
        contractExists(contractId)
    {
        require(teamMembers[contractId][member].active, "Not a member");

        teamMembers[contractId][member].active = false;

        emit TeamMemberRemoved(contractId, member);
    }

    // ============ View Functions ============

    function getContract(uint256 contractId) 
        external 
        view 
        contractExists(contractId)
        returns (PaymentContract memory) 
    {
        return contracts[contractId];
    }

    function getContractMilestones(uint256 contractId)
        external
        view
        contractExists(contractId)
        returns (uint256[] memory)
    {
        return contractMilestones[contractId];
    }

    function getMilestone(uint256 contractId, uint256 milestoneId)
        external
        view
        contractExists(contractId)
        returns (Milestone memory)
    {
        return milestones[contractId][milestoneId];
    }

    function getEmployerContracts(address employer) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return employerContracts[employer];
    }

    function getContractorContracts(address contractor) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return contractorContracts[contractor];
    }

    function getContractTeam(uint256 contractId)
        external
        view
        contractExists(contractId)
        returns (address[] memory)
    {
        return contractTeam[contractId];
    }

    function getTeamMember(uint256 contractId, address member)
        external
        view
        contractExists(contractId)
        returns (TeamMember memory)
    {
        return teamMembers[contractId][member];
    }

    // ============ Admin Functions ============

    function setSupportedToken(address token, bool supported) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(token != address(0), "Invalid token");
        
        if (supported && !supportedTokens[token]) {
            supportedTokenList.push(token);
        }
        
        supportedTokens[token] = supported;
    }

    function setPlatformFee(uint256 feePercentage) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(feePercentage <= 1000, "Fee too high"); // Max 10%
        platformFeePercentage = feePercentage;
    }

    function setFeeCollector(address _feeCollector) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(_feeCollector != address(0), "Invalid address");
        feeCollector = _feeCollector;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ============ Internal Helpers ============

    function _calculateTotalAmount(
        uint256 paymentAmount,
        uint256 startDate,
        uint256 endDate,
        PaymentFrequency frequency
    ) internal pure returns (uint256) {
        uint256 duration = endDate - startDate;
        uint256 periods;

        if (frequency == PaymentFrequency.WEEKLY) {
            periods = duration / 7 days;
        } else if (frequency == PaymentFrequency.BI_WEEKLY) {
            periods = duration / 14 days;
        } else if (frequency == PaymentFrequency.MONTHLY) {
            periods = duration / 30 days;
        } else if (frequency == PaymentFrequency.QUARTERLY) {
            periods = duration / 90 days;
        } else {
            periods = 1;
        }

        return paymentAmount * (periods + 1);
    }

    function _calculateNextPaymentDate(
        uint256 currentDate,
        uint256 paymentDay,
        PaymentFrequency frequency
    ) internal pure returns (uint256) {
        if (frequency == PaymentFrequency.WEEKLY) {
            return currentDate + 7 days;
        } else if (frequency == PaymentFrequency.BI_WEEKLY) {
            return currentDate + 14 days;
        } else if (frequency == PaymentFrequency.MONTHLY) {
            return currentDate + 30 days;
        } else if (frequency == PaymentFrequency.QUARTERLY) {
            return currentDate + 90 days;
        }
        return currentDate;
    }

    // ============ UUPS Upgrade ============

    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyRole(ADMIN_ROLE) 
    {}
}
