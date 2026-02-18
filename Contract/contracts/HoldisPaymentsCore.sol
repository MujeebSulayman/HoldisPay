// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./libraries/PaymentLibrary.sol";
import "./interfaces/IPaymentsCore.sol";

contract HoldisPaymentsCore is 
    Initializable, 
    UUPSUpgradeable, 
    AccessControlUpgradeable, 
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    IPaymentsCore
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 public constant MODULE_ROLE = keccak256("MODULE_ROLE");

    uint256 private _nextContractId;
    mapping(uint256 => PaymentContract) public contracts;
    mapping(address => uint256[]) public employerContracts;
    mapping(address => uint256[]) public contractorContracts;
    mapping(address => bool) public supportedTokens;
    address[] public supportedTokenList;
    uint256 public platformFeePercentage;
    address public feeCollector;
    uint256 public minContractAmount;
    uint256 public maxContractDuration;

    address public milestonesModule;
    address public teamModule;
    address public disputesModule;

    event ContractCreated(uint256 indexed contractId, address indexed employer, address indexed contractor, uint256 totalAmount, uint256 paymentAmount, ReleaseType releaseType);
    event ContractFunded(uint256 indexed contractId, address indexed funder, uint256 amount, uint256 totalFunded);
    event PaymentReleased(uint256 indexed contractId, address indexed recipient, uint256 amount, uint256 paymentNumber, uint256 timestamp);
    event ContractStatusChanged(uint256 indexed contractId, ContractStatus oldStatus, ContractStatus newStatus, uint256 timestamp);
    event ContractPaused(uint256 indexed contractId, address indexed pausedBy, uint256 timestamp);
    event ContractResumed(uint256 indexed contractId, address indexed resumedBy, uint256 timestamp);
    event ContractTerminated(uint256 indexed contractId, address indexed terminatedBy, string reason, uint256 refundAmount);

    modifier onlyEmployer(uint256 contractId) {
        require(contracts[contractId].employer == msg.sender, "Not employer");
        _;
    }

    modifier onlyContractor(uint256 contractId) {
        require(contracts[contractId].contractor == msg.sender, "Not contractor");
        _;
    }

    modifier onlyParty(uint256 contractId) {
        require(contracts[contractId].employer == msg.sender || contracts[contractId].contractor == msg.sender, "Not a party");
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

    function initialize(address admin, address _feeCollector) public initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        
        feeCollector = _feeCollector;
        platformFeePercentage = 200;
        minContractAmount = 1e18;
        maxContractDuration = 365 days * 5;
        _nextContractId = 1;
    }

    function setModules(address _milestones, address _team, address _disputes) external onlyRole(ADMIN_ROLE) {
        milestonesModule = _milestones;
        teamModule = _team;
        disputesModule = _disputes;
        _grantRole(MODULE_ROLE, _milestones);
        _grantRole(MODULE_ROLE, _team);
        _grantRole(MODULE_ROLE, _disputes);
    }

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
        
        uint256 totalAmount = PaymentLibrary.calculateTotalAmount(paymentAmount, startDate, endDate, frequency);

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
        newContract.gracePeriodDays = 7;

        newContract.nextPaymentDate = PaymentLibrary.calculateNextPaymentDate(startDate, paymentDay, frequency);

        employerContracts[msg.sender].push(contractId);
        contractorContracts[contractor].push(contractId);

        emit ContractCreated(contractId, msg.sender, contractor, totalAmount, paymentAmount, releaseType);

        return contractId;
    }

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

        if (pContract.status == ContractStatus.DRAFT && pContract.fundedAmount > 0) {
            pContract.status = ContractStatus.ACTIVE;
            emit ContractStatusChanged(contractId, ContractStatus.DRAFT, ContractStatus.ACTIVE, block.timestamp);
        }

        emit ContractFunded(contractId, msg.sender, amount, pContract.fundedAmount);
    }

    function processScheduledPayment(uint256 contractId) 
        external 
        whenNotPaused
        contractExists(contractId)
        nonReentrant
        returns (bool)
    {
        require(hasRole(KEEPER_ROLE, msg.sender) || contracts[contractId].contractor == msg.sender, "Not authorized");

        PaymentContract storage pContract = contracts[contractId];
        
        require(pContract.status == ContractStatus.ACTIVE, "Contract not active");
        require(pContract.releaseType == ReleaseType.AUTO_TIME_BASED, "Not auto-release");
        require(block.timestamp >= pContract.nextPaymentDate, "Not due yet");
        require(pContract.remainingBalance >= pContract.paymentAmount, "Insufficient balance");

        return _executePayment(contractId, pContract.contractor, pContract.paymentAmount);
    }

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
        require(block.timestamp >= pContract.nextPaymentDate + (pContract.gracePeriodDays * 1 days), "Grace period not over");
        require(pContract.remainingBalance >= pContract.paymentAmount, "Insufficient balance");

        return _executePayment(contractId, pContract.contractor, pContract.paymentAmount);
    }

    function _executePayment(uint256 contractId, address recipient, uint256 amount) 
        internal 
        returns (bool) 
    {
        PaymentContract storage pContract = contracts[contractId];
        
        (uint256 fee, uint256 netAmount) = PaymentLibrary.calculateFee(amount, platformFeePercentage);

        IERC20 token = IERC20(pContract.token);
        require(token.transfer(recipient, netAmount), "Payment failed");
        
        if (fee > 0) {
            require(token.transfer(feeCollector, fee), "Fee transfer failed");
        }

        pContract.remainingBalance -= amount;
        pContract.paidAmount += amount;
        pContract.lastPaymentDate = block.timestamp;
        pContract.nextPaymentDate = PaymentLibrary.calculateNextPaymentDate(pContract.nextPaymentDate, pContract.paymentDay, pContract.frequency);

        if (block.timestamp >= pContract.endDate || pContract.remainingBalance < pContract.paymentAmount) {
            pContract.status = ContractStatus.COMPLETED;
            emit ContractStatusChanged(contractId, ContractStatus.ACTIVE, ContractStatus.COMPLETED, block.timestamp);
        }

        uint256 paymentNumber = pContract.paidAmount / pContract.paymentAmount;
        emit PaymentReleased(contractId, recipient, netAmount, paymentNumber, block.timestamp);

        return true;
    }

    function pauseContract(uint256 contractId) external whenNotPaused onlyEmployer(contractId) contractExists(contractId) {
        PaymentContract storage pContract = contracts[contractId];
        require(pContract.status == ContractStatus.ACTIVE, "Not active");
        pContract.status = ContractStatus.PAUSED;
        emit ContractPaused(contractId, msg.sender, block.timestamp);
        emit ContractStatusChanged(contractId, ContractStatus.ACTIVE, ContractStatus.PAUSED, block.timestamp);
    }

    function resumeContract(uint256 contractId) external whenNotPaused onlyEmployer(contractId) contractExists(contractId) {
        PaymentContract storage pContract = contracts[contractId];
        require(pContract.status == ContractStatus.PAUSED, "Not paused");
        pContract.status = ContractStatus.ACTIVE;
        emit ContractResumed(contractId, msg.sender, block.timestamp);
        emit ContractStatusChanged(contractId, ContractStatus.PAUSED, ContractStatus.ACTIVE, block.timestamp);
    }

    function terminateContract(uint256 contractId, string memory reason) external whenNotPaused onlyParty(contractId) contractExists(contractId) nonReentrant {
        PaymentContract storage pContract = contracts[contractId];
        require(pContract.status == ContractStatus.ACTIVE || pContract.status == ContractStatus.PAUSED, "Cannot terminate");

        uint256 refundAmount = pContract.remainingBalance;
        pContract.status = ContractStatus.TERMINATED;
        pContract.remainingBalance = 0;

        if (refundAmount > 0) {
            IERC20 token = IERC20(pContract.token);
            require(token.transfer(pContract.employer, refundAmount), "Refund failed");
        }

        emit ContractTerminated(contractId, msg.sender, reason, refundAmount);
        emit ContractStatusChanged(contractId, pContract.status, ContractStatus.TERMINATED, block.timestamp);
    }

    function getContract(uint256 contractId) external view override contractExists(contractId) returns (PaymentContract memory) {
        return contracts[contractId];
    }

    function getEmployerContracts(address employer) external view returns (uint256[] memory) {
        return employerContracts[employer];
    }

    function getContractorContracts(address contractor) external view returns (uint256[] memory) {
        return contractorContracts[contractor];
    }

    function updateContractStatus(uint256 contractId, ContractStatus newStatus) external override onlyRole(MODULE_ROLE) {
        ContractStatus oldStatus = contracts[contractId].status;
        contracts[contractId].status = newStatus;
        emit ContractStatusChanged(contractId, oldStatus, newStatus, block.timestamp);
    }

    function updateContractBalance(uint256 contractId, uint256 amount, bool isDeduction) external override onlyRole(MODULE_ROLE) {
        if (isDeduction) {
            contracts[contractId].remainingBalance -= amount;
        } else {
            contracts[contractId].remainingBalance += amount;
        }
    }

    function isEmployer(uint256 contractId, address user) external view override returns (bool) {
        return contracts[contractId].employer == user;
    }

    function isContractor(uint256 contractId, address user) external view override returns (bool) {
        return contracts[contractId].contractor == user;
    }

    function isParty(uint256 contractId, address user) external view override returns (bool) {
        return contracts[contractId].employer == user || contracts[contractId].contractor == user;
    }

    function setSupportedToken(address token, bool supported) external onlyRole(ADMIN_ROLE) {
        require(token != address(0), "Invalid token");
        if (supported && !supportedTokens[token]) {
            supportedTokenList.push(token);
        }
        supportedTokens[token] = supported;
    }

    function setPlatformFee(uint256 feePercentage) external onlyRole(ADMIN_ROLE) {
        require(feePercentage <= 1000, "Fee too high");
        platformFeePercentage = feePercentage;
    }

    function setFeeCollector(address _feeCollector) external onlyRole(ADMIN_ROLE) {
        require(_feeCollector != address(0), "Invalid address");
        feeCollector = _feeCollector;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {}
}
