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
        numberOfPayments: contract.numberOfPayments ?? 0n,
        paymentsMade: contract.paymentsMade ?? 0n,
        totalAmount: contract.totalAmount,
        remainingBalance: contract.remainingBalance,
        tokenAddress: (contract.token || contract.tokenAddress) as Address,
        startDate: contract.startDate,
        endDate: contract.endDate,
        nextPaymentDate: contract.nextPaymentDate,
        lastPaymentDate: contract.lastPaymentDate,
        paymentInterval: contract.paymentInterval,
        status: contract.status as ContractStatus,
        releaseType: contract.releaseType as ReleaseType,
        jobTitle: contract.jobTitle ?? '',
        description: contract.description ?? '',
        contractHash: contract.contractHash ?? '',
        gracePeriodDays: contract.gracePeriodDays,
        createdAt: contract.createdAt,
        contractName: contract.contractName ?? '',
      };
    } catch (error: any) {
      logger.error('Failed to get payment contract', { error: error.message, contractId });
      throw error;
    }
  }

  async getEmployerContracts(employer: Address): Promise<bigint[]> {
    try {
      const contractIds = await this.publicClient.readContract({
        address: this.coreAddress,
        abi: HoldisPaymentsCoreABI as any,
        functionName: 'getEmployerContracts',
        args: [employer],
      }) as bigint[];
      return Array.isArray(contractIds) ? contractIds : [];
    } catch (error: any) {
      
      const msg = error?.message || '';
      if (msg.includes('returned no data') || msg.includes('0x') || msg.includes('not a contract')) {
        logger.debug('No employer contracts on chain (contract empty or not deployed)', { employer });
        return [];
      }
      logger.error('Failed to get employer contracts', { error: error.message, employer });
      throw error;
    }
  }

  async getContractorContracts(contractor: Address): Promise<bigint[]> {
    try {
      const contractIds = await this.publicClient.readContract({
        address: this.coreAddress,
        abi: HoldisPaymentsCoreABI as any,
        functionName: 'getContractorContracts',
        args: [contractor],
      }) as bigint[];
      return Array.isArray(contractIds) ? contractIds : [];
    } catch (error: any) {
      
      const msg = error?.message || '';
      if (msg.includes('returned no data') || msg.includes('0x') || msg.includes('not a contract')) {
        logger.debug('No contractor contracts on chain (contract empty or not deployed)', { contractor });
        return [];
      }
      logger.error('Failed to get contractor contracts', { error: error.message, contractor });
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
    } catch (error: any) {
      logger.error('Failed to check token support', { error: error.message, token });
      throw error;
    }
  }


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
    } catch (error: any) {
      logger.error('Failed to get milestone', { error: error.message, contractId, milestoneId });
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
    } catch (error: any) {
      logger.error('Failed to get contract milestones', { error: error.message, contractId });
      throw error;
    }
  }


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
    } catch (error: any) {
      logger.error('Failed to get team members', { error: error.message, contractId });
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
    } catch (error: any) {
      logger.error('Failed to get member share', { error: error.message, contractId, member });
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
    } catch (error: any) {
      logger.error('Failed to get performance bonuses', { error: error.message, contractId });
      throw error;
    }
  }


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
    } catch (error: any) {
      logger.error('Failed to get dispute', { error: error.message, contractId, disputeId });
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
    } catch (error: any) {
      logger.error('Failed to get contract disputes', { error: error.message, contractId });
      throw error;
    }
  }


  async getBlockNumber(): Promise<bigint> {
    try {
      return await this.publicClient.getBlockNumber();
    } catch (error: any) {
      logger.error('Failed to get block number', { error: error.message });
      throw error;
    }
  }

  async getTransactionReceipt(txHash: `0x${string}`) {
    try {
      return await this.publicClient.getTransactionReceipt({ hash: txHash });
    } catch (error: any) {
      logger.error('Failed to get transaction receipt', { error: error.message, txHash });
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
    } catch (error: any) {
      logger.error('Failed to get contract logs', { error: error.message, eventName });
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
