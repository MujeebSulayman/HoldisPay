// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IPaymentsCore {
    enum ContractStatus {
        DRAFT,
        ACTIVE,
        PAUSED,
        COMPLETED,
        TERMINATED,
        DISPUTED
    }

    enum ReleaseType {
        AUTO_TIME_BASED,
        MILESTONE_BASED,
        APPROVAL_REQUIRED
    }

    struct PaymentContract {
        uint256 id;
        address employer;
        address contractor;
        uint256 totalAmount;
        uint256 paymentAmount;
        uint256 fundedAmount;
        uint256 paidAmount;
        uint256 remainingBalance;
        address token;
        uint256 startDate;
        uint256 endDate;
        uint256 nextPaymentDate;
        uint256 lastPaymentDate;
        uint256 paymentInterval;
        ContractStatus status;
        ReleaseType releaseType;
        bool requiresApproval;
        uint256 gracePeriodDays;
        string jobTitle;
        string description;
        string contractHash;
        uint256 createdAt;
        uint256 numberOfPayments;
        uint256 paymentsMade;
        string contractName;
    }

    function getContract(uint256 contractId) external view returns (PaymentContract memory);
    function updateContractStatus(uint256 contractId, ContractStatus newStatus) external;
    function updateContractBalance(uint256 contractId, uint256 amount, bool isDeduction) external;
    function isEmployer(uint256 contractId, address user) external view returns (bool);
    function isContractor(uint256 contractId, address user) external view returns (bool);
    function isParty(uint256 contractId, address user) external view returns (bool);
}
