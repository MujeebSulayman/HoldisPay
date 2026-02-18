// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../interfaces/IPaymentsCore.sol";

contract HoldisMilestones is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    IPaymentsCore public paymentsContract;

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

    uint256 private _nextMilestoneId;
    mapping(uint256 => mapping(uint256 => Milestone)) public milestones;
    mapping(uint256 => uint256[]) public contractMilestones;

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

    function initialize(address admin, address _paymentsContract) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        
        paymentsContract = IPaymentsCore(_paymentsContract);
        _nextMilestoneId = 1;
    }

    function addMilestone(
        uint256 contractId,
        string memory description,
        uint256 amount,
        uint256 dueDate
    ) 
        external
        whenNotPaused
        returns (uint256)
    {
        require(paymentsContract.isEmployer(contractId, msg.sender), "Not employer");
        IPaymentsCore.PaymentContract memory pContract = paymentsContract.getContract(contractId);
        require(pContract.releaseType == IPaymentsCore.ReleaseType.MILESTONE_BASED, "Not milestone-based");
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

    function submitMilestone(
        uint256 contractId,
        uint256 milestoneId,
        string memory proofHash
    )
        external
        whenNotPaused
    {
        require(paymentsContract.isContractor(contractId, msg.sender), "Not contractor");
        Milestone storage milestone = milestones[contractId][milestoneId];
        require(!milestone.completed, "Already submitted");
        require(milestone.amount > 0, "Milestone not found");

        milestone.completed = true;
        milestone.proofHash = proofHash;
        milestone.completedAt = block.timestamp;

        emit MilestoneSubmitted(contractId, milestoneId, proofHash, block.timestamp);
    }

    function approveMilestone(uint256 contractId, uint256 milestoneId)
        external
        whenNotPaused
        nonReentrant
    {
        require(paymentsContract.isEmployer(contractId, msg.sender), "Not employer");
        Milestone storage milestone = milestones[contractId][milestoneId];
        
        require(milestone.completed, "Not completed");
        require(!milestone.approved, "Already approved");
        require(!milestone.paid, "Already paid");

        milestone.approved = true;
        milestone.approvedAt = block.timestamp;

        emit MilestoneApproved(contractId, milestoneId, msg.sender, block.timestamp);
    }

    function markMilestonePaid(uint256 contractId, uint256 milestoneId, address recipient)
        external
        onlyRole(ADMIN_ROLE)
    {
        Milestone storage milestone = milestones[contractId][milestoneId];
        require(milestone.approved, "Not approved");
        require(!milestone.paid, "Already paid");

        milestone.paid = true;

        emit MilestonePaid(contractId, milestoneId, recipient, milestone.amount);
    }

    function getMilestone(uint256 contractId, uint256 milestoneId)
        external
        view
        returns (Milestone memory)
    {
        return milestones[contractId][milestoneId];
    }

    function getContractMilestones(uint256 contractId)
        external
        view
        returns (uint256[] memory)
    {
        return contractMilestones[contractId];
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
