// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IPaymentsCore.sol";

contract HoldisDisputes is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    IPaymentsCore public paymentsContract;

    enum DisputeStatus {
        NONE,
        RAISED,
        UNDER_REVIEW,
        RESOLVED
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

    uint256 private _nextDisputeId;
    mapping(uint256 => Dispute) public disputes;

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

    function initialize(address admin, address _paymentsContract) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        
        paymentsContract = IPaymentsCore(_paymentsContract);
        _nextDisputeId = 1;
    }

    function raiseDispute(
        uint256 contractId,
        string memory reason,
        string memory evidenceHash
    )
        external
        whenNotPaused
        returns (uint256)
    {
        require(paymentsContract.isParty(contractId, msg.sender), "Not a party");
        IPaymentsCore.PaymentContract memory pContract = paymentsContract.getContract(contractId);
        require(pContract.status == IPaymentsCore.ContractStatus.ACTIVE, "Contract not active");
        require(disputes[contractId].status == DisputeStatus.NONE, "Dispute already exists");

        uint256 disputeId = _nextDisputeId++;

        Dispute storage dispute = disputes[contractId];
        dispute.id = disputeId;
        dispute.raisedBy = msg.sender;
        dispute.reason = reason;
        dispute.evidenceHash = evidenceHash;
        dispute.status = DisputeStatus.RAISED;
        dispute.raisedAt = block.timestamp;

        paymentsContract.updateContractStatus(contractId, IPaymentsCore.ContractStatus.DISPUTED);

        emit DisputeRaised(contractId, disputeId, msg.sender, reason);

        return disputeId;
    }

    function resolveDispute(
        uint256 contractId,
        string memory resolution,
        bool /* favorEmployer */,
        uint256 /* employerAmount */,
        uint256 /* contractorAmount */
    )
        external
        whenNotPaused
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        IPaymentsCore.PaymentContract memory pContract = paymentsContract.getContract(contractId);
        Dispute storage dispute = disputes[contractId];
        
        require(pContract.status == IPaymentsCore.ContractStatus.DISPUTED, "Not disputed");
        require(dispute.status == DisputeStatus.RAISED || dispute.status == DisputeStatus.UNDER_REVIEW, "Invalid dispute status");

        dispute.status = DisputeStatus.RESOLVED;
        dispute.resolution = resolution;
        dispute.resolvedBy = msg.sender;
        dispute.resolvedAt = block.timestamp;

        paymentsContract.updateContractStatus(contractId, IPaymentsCore.ContractStatus.TERMINATED);

        emit DisputeResolved(contractId, dispute.id, msg.sender, resolution);
    }

    function getDispute(uint256 contractId)
        external
        view
        returns (Dispute memory)
    {
        return disputes[contractId];
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
