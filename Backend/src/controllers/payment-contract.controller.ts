import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { paymentContractService } from '../services/payment-contract.service';
import { blockradarService } from '../services/blockradar.service';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { z } from 'zod';

const createContractSchema = z.object({
  contractorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  paymentAmount: z.string(),
  numberOfPayments: z.number().int().positive(),
  paymentInterval: z.number().int().positive(),
  startDate: z.number().int().positive(),
  releaseType: z.enum(['TIME_BASED', 'MILESTONE_BASED']),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  jobTitle: z.string().optional(),
  description: z.string().optional(),
  contractHash: z.string().optional(),
});

const fundContractSchema = z.object({
  contractId: z.string(),
  amount: z.string(),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const submitMilestoneSchema = z.object({
  contractId: z.string(),
  milestoneId: z.string(),
  proofHash: z.string(),
});

export class PaymentContractController {
  async createContract(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const validatedData = createContractSchema.parse(req.body);

      const { data: user } = await supabase
        .from('users')
        .select('wallet_address, email')
        .eq('id', userId)
        .single();

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const contractData = {
        employer_address: user.wallet_address,
        contractor_address: validatedData.contractorAddress,
        payment_amount: validatedData.paymentAmount,
        number_of_payments: validatedData.numberOfPayments,
        payment_interval: validatedData.paymentInterval.toString(),
        start_date: new Date(validatedData.startDate * 1000),
        release_type: validatedData.releaseType,
        token_address: validatedData.tokenAddress,
        job_title: validatedData.jobTitle,
        description: validatedData.description,
        contract_hash: validatedData.contractHash,
        status: 'ACTIVE',
      };

      logger.info('Creating payment contract', { userId, contractData });

      return res.status(200).json({
        success: true,
        message: 'Contract creation initiated',
        data: {
          contractData,
          instructions: 'Sign and submit transaction from your wallet',
        },
      });
    } catch (error: any) {
      logger.error('Create contract failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to create contract' });
    }
  }

  async fundContract(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const validatedData = fundContractSchema.parse(req.body);

      const { data: user } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('id', userId)
        .single();

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const contract = await paymentContractService.getContract(BigInt(validatedData.contractId));

      if (contract.employer.toLowerCase() !== user.wallet_address.toLowerCase()) {
        return res.status(403).json({ error: 'Only employer can fund contract' });
      }

      const transferResult = await blockradarService.transferFunds({
        to: contract.employer,
        amount: validatedData.amount,
        asset: validatedData.tokenAddress,
        chain: 'BASE',
      });

      logger.info('Contract funding initiated', { 
        userId, 
        contractId: validatedData.contractId,
        transferId: transferResult.id,
      });

      return res.status(200).json({
        success: true,
        message: 'Contract funding initiated',
        data: {
          transferId: transferResult.id,
          contractId: validatedData.contractId,
        },
      });
    } catch (error: any) {
      logger.error('Fund contract failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to fund contract' });
    }
  }

  async getContract(req: AuthenticatedRequest, res: Response) {
    try {
      const { contractId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const contract = await paymentContractService.getContract(BigInt(contractId));

      const { data: user } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('id', userId)
        .single();

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userAddress = user.wallet_address.toLowerCase();
      const isEmployer = contract.employer.toLowerCase() === userAddress;
      const isContractor = contract.contractor.toLowerCase() === userAddress;

      if (!isEmployer && !isContractor) {
        return res.status(403).json({ error: 'Not authorized to view this contract' });
      }

      return res.status(200).json({
        success: true,
        data: {
          contract: {
            id: contract.id.toString(),
            employer: contract.employer,
            contractor: contract.contractor,
            paymentAmount: contract.paymentAmount.toString(),
            numberOfPayments: contract.numberOfPayments.toString(),
            paymentsMade: contract.paymentsMade.toString(),
            totalAmount: contract.totalAmount.toString(),
            remainingBalance: contract.remainingBalance.toString(),
            tokenAddress: contract.tokenAddress,
            startDate: Number(contract.startDate),
            endDate: Number(contract.endDate),
            nextPaymentDate: Number(contract.nextPaymentDate),
            lastPaymentDate: Number(contract.lastPaymentDate),
            paymentInterval: contract.paymentInterval.toString(),
            status: contract.status,
            releaseType: contract.releaseType,
            jobTitle: contract.jobTitle,
            description: contract.description,
            contractHash: contract.contractHash,
            gracePeriodDays: contract.gracePeriodDays.toString(),
            createdAt: Number(contract.createdAt),
          },
          userRole: isEmployer ? 'employer' : 'contractor',
        },
      });
    } catch (error: any) {
      logger.error('Get contract failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to get contract' });
    }
  }

  async getUserContracts(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { data: user } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('id', userId)
        .single();

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const offset = BigInt(req.query.offset as string || '0');
      const limit = BigInt(req.query.limit as string || '20');

      const [employerContracts, contractorContracts] = await Promise.all([
        paymentContractService.getEmployerContracts(user.wallet_address as `0x${string}`, offset, limit),
        paymentContractService.getContractorContracts(user.wallet_address as `0x${string}`, offset, limit),
      ]);

      const allContractIds = [
        ...employerContracts.contractIds,
        ...contractorContracts.contractIds,
      ];

      const contracts = await Promise.all(
        allContractIds.map(id => paymentContractService.getContract(id))
      );

      return res.status(200).json({
        success: true,
        data: {
          contracts: contracts.map(c => ({
            id: c.id.toString(),
            employer: c.employer,
            contractor: c.contractor,
            paymentAmount: c.paymentAmount.toString(),
            numberOfPayments: c.numberOfPayments.toString(),
            paymentsMade: c.paymentsMade.toString(),
            totalAmount: c.totalAmount.toString(),
            remainingBalance: c.remainingBalance.toString(),
            tokenAddress: c.tokenAddress,
            startDate: Number(c.startDate),
            endDate: Number(c.endDate),
            nextPaymentDate: Number(c.nextPaymentDate),
            paymentInterval: c.paymentInterval.toString(),
            status: c.status,
            releaseType: c.releaseType,
            jobTitle: c.jobTitle,
            description: c.description,
            createdAt: Number(c.createdAt),
          })),
          pagination: {
            totalEmployer: employerContracts.total.toString(),
            totalContractor: contractorContracts.total.toString(),
            offset: offset.toString(),
            limit: limit.toString(),
          },
        },
      });
    } catch (error: any) {
      logger.error('Get user contracts failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to get contracts' });
    }
  }

  async claimPayment(req: AuthenticatedRequest, res: Response) {
    try {
      const { contractId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const contract = await paymentContractService.getContract(BigInt(contractId));

      const { data: user } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('id', userId)
        .single();

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (contract.contractor.toLowerCase() !== user.wallet_address.toLowerCase()) {
        return res.status(403).json({ error: 'Only contractor can claim payment' });
      }

      return res.status(200).json({
        success: true,
        message: 'Payment claim initiated',
        data: {
          contractId,
          instructions: 'Sign transaction from your wallet to claim payment',
        },
      });
    } catch (error: any) {
      logger.error('Claim payment failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to claim payment' });
    }
  }

  async getMilestones(req: AuthenticatedRequest, res: Response) {
    try {
      const { contractId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const milestones = await paymentContractService.getContractMilestones(BigInt(contractId));

      return res.status(200).json({
        success: true,
        data: {
          milestones: milestones.map(m => ({
            id: m.id.toString(),
            description: m.description,
            amount: m.amount.toString(),
            isCompleted: m.isCompleted,
            isApproved: m.isApproved,
            proofHash: m.proofHash,
          })),
        },
      });
    } catch (error: any) {
      logger.error('Get milestones failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to get milestones' });
    }
  }

  async submitMilestone(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const validatedData = submitMilestoneSchema.parse(req.body);

      const contract = await paymentContractService.getContract(BigInt(validatedData.contractId));

      const { data: user } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('id', userId)
        .single();

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (contract.contractor.toLowerCase() !== user.wallet_address.toLowerCase()) {
        return res.status(403).json({ error: 'Only contractor can submit milestone' });
      }

      return res.status(200).json({
        success: true,
        message: 'Milestone submission initiated',
        data: {
          contractId: validatedData.contractId,
          milestoneId: validatedData.milestoneId,
          instructions: 'Sign transaction from your wallet to submit milestone',
        },
      });
    } catch (error: any) {
      logger.error('Submit milestone failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to submit milestone' });
    }
  }

  async getTeamMembers(req: AuthenticatedRequest, res: Response) {
    try {
      const { contractId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const teamMembers = await paymentContractService.getTeamMembers(BigInt(contractId));

      return res.status(200).json({
        success: true,
        data: {
          teamMembers: teamMembers.map(m => ({
            memberAddress: m.memberAddress,
            sharePercentage: m.sharePercentage.toString(),
            isActive: m.isActive,
          })),
        },
      });
    } catch (error: any) {
      logger.error('Get team members failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to get team members' });
    }
  }

  async getDisputes(req: AuthenticatedRequest, res: Response) {
    try {
      const { contractId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const disputes = await paymentContractService.getContractDisputes(BigInt(contractId));

      return res.status(200).json({
        success: true,
        data: {
          disputes: disputes.map(d => ({
            id: d.id.toString(),
            raisedBy: d.raisedBy,
            reason: d.reason,
            isResolved: d.isResolved,
          })),
        },
      });
    } catch (error: any) {
      logger.error('Get disputes failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to get disputes' });
    }
  }

  async getSupportedTokens(req: AuthenticatedRequest, res: Response) {
    try {
      const tokens = await blockradarService.getSupportedAssets();

      return res.status(200).json({
        success: true,
        data: {
          tokens: tokens.map(token => ({
            symbol: token.symbol,
            address: token.address,
            name: token.name,
            decimals: token.decimals,
            chain: token.chain,
          })),
        },
      });
    } catch (error: any) {
      logger.error('Get supported tokens failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to get supported tokens' });
    }
  }

  async getContractStats(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { data: user } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('id', userId)
        .single();

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const [employerContracts, contractorContracts, totalContracts] = await Promise.all([
        paymentContractService.getEmployerContracts(user.wallet_address as `0x${string}`, 0n, 1000n),
        paymentContractService.getContractorContracts(user.wallet_address as `0x${string}`, 0n, 1000n),
        paymentContractService.getTotalContracts(),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          asEmployer: employerContracts.total.toString(),
          asContractor: contractorContracts.total.toString(),
          totalPlatform: totalContracts.toString(),
        },
      });
    } catch (error: any) {
      logger.error('Get contract stats failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to get contract stats' });
    }
  }
}

export const paymentContractController = new PaymentContractController();
