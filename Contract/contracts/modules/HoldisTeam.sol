// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "../interfaces/IPaymentsCore.sol";

contract HoldisTeam is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    IPaymentsCore public paymentsContract;

    struct TeamMember {
        address wallet;
        uint256 sharePercentage;
        string role;
        bool active;
    }

    struct PerformanceBonus {
        uint256 id;
        string description;
        uint256 amount;
        string kpiHash;
        bool achieved;
        bool paid;
        uint256 achievedAt;
    }

    uint256 private _nextBonusId;
    mapping(uint256 => mapping(address => TeamMember)) public teamMembers;
    mapping(uint256 => address[]) public contractTeam;
    mapping(uint256 => mapping(uint256 => PerformanceBonus)) public bonuses;
    mapping(uint256 => uint256[]) public contractBonuses;

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

    function initialize(address admin, address _paymentsContract) public initializer {
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        
        paymentsContract = IPaymentsCore(_paymentsContract);
        _nextBonusId = 1;
    }

    function addTeamMember(
        uint256 contractId,
        address member,
        uint256 sharePercentage,
        string memory role
    )
        external
        whenNotPaused
    {
        require(paymentsContract.isEmployer(contractId, msg.sender), "Not employer");
        require(member != address(0), "Invalid address");
        require(sharePercentage > 0 && sharePercentage <= 10000, "Invalid share");
        require(!teamMembers[contractId][member].active, "Already member");

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

    function removeTeamMember(uint256 contractId, address member)
        external
        whenNotPaused
    {
        require(paymentsContract.isEmployer(contractId, msg.sender), "Not employer");
        require(teamMembers[contractId][member].active, "Not a member");

        teamMembers[contractId][member].active = false;

        emit TeamMemberRemoved(contractId, member);
    }

    function addBonus(
        uint256 contractId,
        string memory description,
        uint256 amount,
        string memory kpiHash
    )
        external
        whenNotPaused
        returns (uint256)
    {
        require(paymentsContract.isEmployer(contractId, msg.sender), "Not employer");
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

    function markBonusPaid(uint256 contractId, uint256 bonusId, address recipient)
        external
        onlyRole(ADMIN_ROLE)
    {
        PerformanceBonus storage bonus = bonuses[contractId][bonusId];
        require(!bonus.paid, "Already paid");

        bonus.achieved = true;
        bonus.paid = true;
        bonus.achievedAt = block.timestamp;

        emit BonusPaid(contractId, bonusId, recipient, bonus.amount);
    }

    function getTeamMember(uint256 contractId, address member)
        external
        view
        returns (TeamMember memory)
    {
        return teamMembers[contractId][member];
    }

    function getContractTeam(uint256 contractId)
        external
        view
        returns (address[] memory)
    {
        return contractTeam[contractId];
    }

    function getBonus(uint256 contractId, uint256 bonusId)
        external
        view
        returns (PerformanceBonus memory)
    {
        return bonuses[contractId][bonusId];
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
