import { createPublicClient, http, Address } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import {
  PaymentContract,
  ContractStatus,
  ReleaseType,
  Milestone,
  TeamMember,
  PerformanceBonus,
  Dispute,
} from '../types/payment-contract';

import HoldisPaymentsCoreABI from '../contracts/HoldisPaymentsCoreABI.json';
import HoldisMilestonesABI from '../contracts/HoldisMilestonesABI.json';
import HoldisTeamABI from '../contracts/HoldisTeamABI.json';
import HoldisDisputesABI from '../contracts/HoldisDisputesABI.json';

export class PaymentContractService {
  private publicClient: ReturnType<typeof createPublicClient>;
  private coreAddress: Address;
  private milestonesAddress: Address;
  private teamAddress: Address;
  private disputesAddress: Address;
  private chain: any;

  constructor() {
    this.coreAddress = env.HOLDIS_PAYMENTS_CORE_ADDRESS as Address;
    this.milestonesAddress = env.HOLDIS_MILESTONES_ADDRESS as Address;
    this.teamAddress = env.HOLDIS_TEAM_ADDRESS as Address;
    this.disputesAddress = env.HOLDIS_DISPUTES_ADDRESS as Address;
    this.chain = env.CHAIN_ID === 8453 ? base : baseSepolia;

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(env.RPC_URL),
    }) as any;

    logger.info('Payment contract service initialized', {
      coreAddress: this.coreAddress,
      milestonesAddress: this.milestonesAddress,
      teamAddress: this.teamAddress,
      disputesAddress: this.disputesAddress,
      chainId: env.CHAIN_ID,
    });
  }

  // ========== Core Contract Methods ==========

  async getContract(contractId: bigint): Promise<PaymentContract> {
    try {
      const contract = await this.publicClient.readContract({
        address: this.coreAddress,
        abi: HoldisPaymentsCoreABI as any,
        functionName: 'getContract',
        args: [contractId],
      }) as any;

      return {
        id: contract.id,
        employer: contract.employer,
        contractor: contract.contractor,
        paymentAmount: contract.paymentAmount,
        numberOfPayments: contract.numberOfPayments,
        paymentsMade: contract.paymentsMade,
        totalAmount: contract.totalAmount,
        remainingBalance: contract.remainingBalance,
        tokenAddress: contract.tokenAddress,
        startDate: contract.startDate,
        endDate: contract.endDate,
        nextPaymentDate: contract.nextPaymentDate,
        lastPaymentDate: contract.lastPaymentDate,
        paymentInterval: contract.paymentInterval,
        status: contract.status as ContractStatus,
        releaseType: contract.releaseType as ReleaseType,
        jobTitle: contract.jobTitle,
        description: contract.description,
        contractHash: contract.contractHash,
        gracePeriodDays: contract.gracePeriodDays,
        createdAt: contract.createdAt,
      };
    } catch (error) {
      logger.error('Failed to get payment contract', { error, contractId });
      throw error;
    }
  }

  async getEmployerContracts(
    employer: Address,
    offset: bigint = 0n,
    limit: bigint = 20n
  ): Promise<{ contractIds: bigint[]; total: bigint }> {
    try {
      const result = await this.publicClient.readContract({
        address: this.coreAddress,
        abi: HoldisPaymentsCoreABI as any,
        functionName: 'getEmployerContracts',
        args: [employer, offset, limit],
      }) as any;
      return { contractIds: result[0], total: result[1] };
    } catch (error) {
      logger.error('Failed to get employer contracts', { error, employer });
      throw error;
    }
  }

  async getContractorContracts(
    contractor: Address,
    offset: bigint = 0n,
    limit: bigint = 20n
  ): Promise<{ contractIds: bigint[]; total: bigint }> {
    try {
      const result = await this.publicClient.readContract({
        address: this.coreAddress,
        abi: HoldisPaymentsCoreABI as any,
        functionName: 'getContractorContracts',
        args: [contractor, offset, limit],
      }) as any;
      return { contractIds: result[0], total: result[1] };
    } catch (error) {
      logger.error('Failed to get contractor contracts', { error, contractor });
      throw error;
    }
  }

  async getTotalContracts(): Promise<bigint> {
    try {
      const total = await this.publicClient.readContract({
        address: this.coreAddress,
        abi: HoldisPaymentsCoreABI as any,
        functionName: 'getTotalContracts',
      }) as bigint;
      return total;
    } catch (error) {
      logger.error('Failed to get total contracts', { error });
      throw error;
    }
  }

  async isTokenSupported(token: Address): Promise<boolean> {
    try {
      const supported = await this.publicClient.readContract({
        address: this.coreAddress,
        abi: HoldisPaymentsCoreABI as any,
        functionName: 'supportedTokens',
        args: [token],
      }) as boolean;
      return supported;
    } catch (error) {
      logger.error('Failed to check token support', { error, token });
      throw error;
    }
  }

  // ========== Milestones Module Methods ==========

  async getMilestone(contractId: bigint, milestoneId: bigint): Promise<Milestone> {
    try {
      const milestone = await this.publicClient.readContract({
        address: this.milestonesAddress,
        abi: HoldisMilestonesABI as any,
        functionName: 'getMilestone',
        args: [contractId, milestoneId],
      }) as any;

      return {
        id: milestone.id,
        description: milestone.description,
        amount: milestone.amount,
        isCompleted: milestone.isCompleted,
        isApproved: milestone.isApproved,
        proofHash: milestone.proofHash,
      };
    } catch (error) {
      logger.error('Failed to get milestone', { error, contractId, milestoneId });
      throw error;
    }
  }

  async getContractMilestones(contractId: bigint): Promise<Milestone[]> {
    try {
      const milestones = await this.publicClient.readContract({
        address: this.milestonesAddress,
        abi: HoldisMilestonesABI as any,
        functionName: 'getContractMilestones',
        args: [contractId],
      }) as any[];

      return milestones.map((m: any) => ({
        id: m.id,
        description: m.description,
        amount: m.amount,
        isCompleted: m.isCompleted,
        isApproved: m.isApproved,
        proofHash: m.proofHash,
      }));
    } catch (error) {
      logger.error('Failed to get contract milestones', { error, contractId });
      throw error;
    }
  }

  // ========== Team Module Methods ==========

  async getTeamMembers(contractId: bigint): Promise<TeamMember[]> {
    try {
      const members = await this.publicClient.readContract({
        address: this.teamAddress,
        abi: HoldisTeamABI as any,
        functionName: 'getTeamMembers',
        args: [contractId],
      }) as any[];

      return members.map((m: any) => ({
        memberAddress: m.memberAddress,
        sharePercentage: m.sharePercentage,
        isActive: m.isActive,
      }));
    } catch (error) {
      logger.error('Failed to get team members', { error, contractId });
      throw error;
    }
  }

  async getMemberShare(contractId: bigint, member: Address): Promise<bigint> {
    try {
      const share = await this.publicClient.readContract({
        address: this.teamAddress,
        abi: HoldisTeamABI as any,
        functionName: 'getMemberShare',
        args: [contractId, member],
      }) as bigint;
      return share;
    } catch (error) {
      logger.error('Failed to get member share', { error, contractId, member });
      throw error;
    }
  }

  async getPerformanceBonuses(contractId: bigint): Promise<PerformanceBonus[]> {
    try {
      const bonuses = await this.publicClient.readContract({
        address: this.teamAddress,
        abi: HoldisTeamABI as any,
        functionName: 'getContractBonuses',
        args: [contractId],
      }) as any[];

      return bonuses.map((b: any) => ({
        id: b.id,
        amount: b.amount,
        reason: b.reason,
        isClaimed: b.isClaimed,
      }));
    } catch (error) {
      logger.error('Failed to get performance bonuses', { error, contractId });
      throw error;
    }
  }

  // ========== Disputes Module Methods ==========

  async getDispute(contractId: bigint, disputeId: bigint): Promise<Dispute> {
    try {
      const dispute = await this.publicClient.readContract({
        address: this.disputesAddress,
        abi: HoldisDisputesABI as any,
        functionName: 'getDispute',
        args: [contractId, disputeId],
      }) as any;

      return {
        id: dispute.id,
        raisedBy: dispute.raisedBy,
        reason: dispute.reason,
        isResolved: dispute.isResolved,
      };
    } catch (error) {
      logger.error('Failed to get dispute', { error, contractId, disputeId });
      throw error;
    }
  }

  async getContractDisputes(contractId: bigint): Promise<Dispute[]> {
    try {
      const disputes = await this.publicClient.readContract({
        address: this.disputesAddress,
        abi: HoldisDisputesABI as any,
        functionName: 'getContractDisputes',
        args: [contractId],
      }) as any[];

      return disputes.map((d: any) => ({
        id: d.id,
        raisedBy: d.raisedBy,
        reason: d.reason,
        isResolved: d.isResolved,
      }));
    } catch (error) {
      logger.error('Failed to get contract disputes', { error, contractId });
      throw error;
    }
  }

  // ========== Utility Methods ==========

  async getBlockNumber(): Promise<bigint> {
    try {
      return await this.publicClient.getBlockNumber();
    } catch (error) {
      logger.error('Failed to get block number', { error });
      throw error;
    }
  }

  async getTransactionReceipt(txHash: `0x${string}`) {
    try {
      return await this.publicClient.getTransactionReceipt({ hash: txHash });
    } catch (error) {
      logger.error('Failed to get transaction receipt', { error, txHash });
      throw error;
    }
  }

  async getLogs(
    contractAddress: Address,
    abi: any,
    eventName: string,
    fromBlock?: bigint,
    toBlock?: bigint
  ) {
    try {
      const eventAbi = abi.find((item: any) => item.type === 'event' && item.name === eventName);
      if (!eventAbi || eventAbi.type !== 'event') {
        throw new Error(`Event ${eventName} not found in ABI`);
      }

      const logs = await this.publicClient.getLogs({
        address: contractAddress,
        event: eventAbi as any,
        fromBlock: fromBlock || 'earliest',
        toBlock: toBlock || 'latest',
      });
      return logs;
    } catch (error) {
      logger.error('Failed to get contract logs', { error, eventName });
      throw error;
    }
  }

  watchBlocks(callback: (blockNumber: bigint) => void) {
    return this.publicClient.watchBlockNumber({
      onBlockNumber: callback,
      poll: true,
      pollingInterval: 12_000,
    });
  }
}

export const paymentContractService = new PaymentContractService();
