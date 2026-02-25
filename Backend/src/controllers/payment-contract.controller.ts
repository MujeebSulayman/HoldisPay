import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { paymentContractService } from '../services/payment-contract.service';
import { blockradarService } from '../services/blockradar.service';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { isChainEnabled } from '../config/enabled-chains';

const ONGOING_PAYMENTS_CAP = 1000;

const createContractSchemaBase = z.object({
  contractorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  contractorTag: z.string().min(1).max(64).optional(),
  paymentAmount: z.string(),
  numberOfPayments: z.number().int().positive().optional(),
  paymentInterval: z.number().int().positive(),
  startDate: z.number().int().positive(),
  releaseType: z.enum(['TIME_BASED', 'MILESTONE_BASED']),
  chainSlug: z.string(),
  assetSlug: z.string(),
  jobTitle: z.string().optional(),
  description: z.string().optional(),
  contractHash: z.string().optional(),
  contractName: z.string().optional(),
  recipientEmail: z.union([z.string().email(), z.literal('')]).optional(),
  deliverables: z.string().optional(),
  outOfScope: z.string().optional(),
  reviewPeriodDays: z.number().int().min(0).max(90).optional(),
  noticePeriodDays: z.number().int().min(0).max(365).optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  endDate: z.number().int().positive().optional(),
  ongoing: z.boolean().optional(),
  milestones: z.array(z.object({
    description: z.string().min(1),
    amount: z.string().regex(/^\d+(\.\d+)?$/),
  })).optional(),
});

const createContractSchema = createContractSchemaBase
  .refine(
    (data) => {
      const hasAddress = !!data.contractorAddress?.trim();
      const hasTag = !!data.contractorTag?.trim();
      return (hasAddress && !hasTag) || (hasTag && !hasAddress);
    },
    { message: 'Provide either recipient tag or wallet address', path: ['contractorAddress'] }
  )
  .refine(
    (data) => data.ongoing === true || (data.numberOfPayments != null && data.numberOfPayments > 0),
    { message: 'Either ongoing or numberOfPayments required', path: ['numberOfPayments'] }
  );

const updateContractSchema = createContractSchemaBase.partial();

const fundContractSchema = z.object({
  contractId: z.string(),
  amount: z.string(),
  chainSlug: z.string(),
  assetSlug: z.string(),
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

      let contractorAddress = validatedData.contractorAddress;
      if (validatedData.contractorTag) {
        const tag = validatedData.contractorTag.trim().toLowerCase().replace(/^@/, '');
        const { data: contractorUser } = await supabase
          .from('users')
          .select('wallet_address')
          .eq('tag', tag)
          .not('wallet_address', 'is', null)
          .single();
        if (!contractorUser?.wallet_address) {
          return res.status(400).json({
            error: 'Recipient not found',
            message: `No user with tag "${validatedData.contractorTag}". They need to sign up first and share their tag.`,
          });
        }
        contractorAddress = contractorUser.wallet_address;
      }
      if (!contractorAddress) {
        return res.status(400).json({ error: 'Contractor address or tag is required' });
      }

      if (!isChainEnabled(validatedData.chainSlug)) {
        return res.status(400).json({ 
          error: `Chain "${validatedData.chainSlug}" is not enabled in your configuration. Please check your .env file.`,
        });
      }

      const { data: user } = await supabase
        .from('users')
        .select('wallet_address, email')
        .eq('id', userId)
        .single();

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const startDate = new Date(validatedData.startDate * 1000);
      const paymentAmountNum = parseFloat(validatedData.paymentAmount);
      const isOngoing = validatedData.ongoing === true;
      const numberOfPayments = isOngoing ? ONGOING_PAYMENTS_CAP : (validatedData.numberOfPayments ?? 1);
      const totalAmount = isOngoing ? '0' : (paymentAmountNum * numberOfPayments).toFixed(2);

      const row: Record<string, unknown> = {
        employer_id: userId,
        employer_address: user.wallet_address,
        contractor_address: contractorAddress,
        payment_amount: validatedData.paymentAmount,
        number_of_payments: numberOfPayments,
        payment_interval: validatedData.paymentInterval.toString(),
        start_date: startDate,
        release_type: validatedData.releaseType,
        chain_slug: validatedData.chainSlug,
        asset_slug: validatedData.assetSlug,
        job_title: validatedData.jobTitle ?? null,
        description: validatedData.description ?? null,
        contract_hash: validatedData.contractHash ?? null,
        status: 'DRAFT',
        total_amount: totalAmount,
        remaining_balance: '0',
        payments_made: 0,
        contract_name: validatedData.contractName ?? null,
        recipient_email: validatedData.recipientEmail || null,
        deliverables: validatedData.deliverables ?? null,
        out_of_scope: validatedData.outOfScope ?? null,
        review_period_days: validatedData.reviewPeriodDays ?? null,
        notice_period_days: validatedData.noticePeriodDays ?? null,
        priority: validatedData.priority ?? null,
        is_ongoing: isOngoing,
      };

      if (validatedData.endDate && !isOngoing) {
        row.end_date = new Date(validatedData.endDate * 1000);
      }

      const { data: inserted, error: insertError } = await supabase
        .from('payment_contracts')
        .insert(row)
        .select('id, contract_id, status')
        .single();

      if (insertError) {
        logger.error('Insert payment contract failed', { error: insertError.message });
        return res.status(500).json({ error: 'Failed to save contract' });
      }

      if (validatedData.milestones?.length && inserted?.id) {
        await supabase.from('contract_milestones').insert(
          validatedData.milestones.map((m, i) => ({
            contract_id: inserted.id,
            milestone_id: String(i + 1),
            description: m.description,
            amount: m.amount,
          }))
        );
      }

      logger.info('Payment contract saved', { userId, id: inserted?.id, status: inserted?.status });

      return res.status(200).json({
        success: true,
        message: 'Contract saved. You can fund it from the contracts list when ready.',
        data: {
          id: inserted?.id,
          contractId: inserted?.contract_id,
          status: inserted?.status,
          instructions: 'Fund the contract from the contracts list to activate it on ' + validatedData.chainSlug,
        },
      });
    } catch (error: any) {
      logger.error('Create contract failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to create contract' });
    }
  }

  async updateContract(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const contractId = req.params.contractId;
      if (!userId || !contractId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { data: user } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('id', userId)
        .single();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { data: row } = await supabase
        .from('payment_contracts')
        .select('id, status, employer_address')
        .eq('id', contractId)
        .is('contract_id', null)
        .single();

      if (!row) return res.status(404).json({ error: 'Contract not found' });
      if (row.status !== 'DRAFT') return res.status(400).json({ error: 'Only draft contracts can be edited' });
      if ((row.employer_address || '').toLowerCase() !== (user.wallet_address || '').toLowerCase()) {
        return res.status(403).json({ error: 'Only the payer can edit this contract' });
      }

      const body = updateContractSchema.safeParse(req.body);
      if (!body.success) return res.status(400).json({ error: body.error.message || 'Invalid payload' });
      const validatedData = body.data;

      let contractorAddress: string | undefined;
      if (validatedData.contractorAddress?.trim()) {
        contractorAddress = validatedData.contractorAddress.trim();
      } else if (validatedData.contractorTag?.trim()) {
        const tag = validatedData.contractorTag.trim().toLowerCase().replace(/^@/, '');
        const { data: contractorUser } = await supabase
          .from('users')
          .select('wallet_address')
          .eq('tag', tag)
          .not('wallet_address', 'is', null)
          .single();
        if (!contractorUser?.wallet_address) {
          return res.status(400).json({
            error: 'Recipient not found',
            message: `No user with tag "${validatedData.contractorTag}". They need to sign up first and share their tag.`,
          });
        }
        contractorAddress = contractorUser.wallet_address;
      }

      if (validatedData.chainSlug && !isChainEnabled(validatedData.chainSlug)) {
        return res.status(400).json({ error: `Chain "${validatedData.chainSlug}" is not enabled` });
      }

      const updatePayload: Record<string, unknown> = {};
      if (contractorAddress != null) updatePayload.contractor_address = contractorAddress;
      if (validatedData.paymentAmount != null) updatePayload.payment_amount = validatedData.paymentAmount;
      if (validatedData.paymentInterval != null) updatePayload.payment_interval = String(validatedData.paymentInterval);
      if (validatedData.startDate != null) updatePayload.start_date = new Date(validatedData.startDate * 1000);
      if (validatedData.releaseType != null) updatePayload.release_type = validatedData.releaseType;
      if (validatedData.chainSlug != null) updatePayload.chain_slug = validatedData.chainSlug;
      if (validatedData.assetSlug != null) updatePayload.asset_slug = validatedData.assetSlug;
      if (validatedData.jobTitle !== undefined) updatePayload.job_title = validatedData.jobTitle || null;
      if (validatedData.description !== undefined) updatePayload.description = validatedData.description || null;
      if (validatedData.contractHash !== undefined) updatePayload.contract_hash = validatedData.contractHash || null;
      if (validatedData.contractName !== undefined) updatePayload.contract_name = validatedData.contractName || null;
      if (validatedData.recipientEmail !== undefined) updatePayload.recipient_email = validatedData.recipientEmail || null;
      if (validatedData.deliverables !== undefined) updatePayload.deliverables = validatedData.deliverables || null;
      if (validatedData.outOfScope !== undefined) updatePayload.out_of_scope = validatedData.outOfScope || null;
      if (validatedData.reviewPeriodDays !== undefined) updatePayload.review_period_days = validatedData.reviewPeriodDays ?? null;
      if (validatedData.noticePeriodDays !== undefined) updatePayload.notice_period_days = validatedData.noticePeriodDays ?? null;
      if (validatedData.priority !== undefined) updatePayload.priority = validatedData.priority ?? null;
      if (validatedData.ongoing !== undefined) updatePayload.is_ongoing = validatedData.ongoing;
      if (validatedData.endDate !== undefined) updatePayload.end_date = validatedData.endDate ? new Date(validatedData.endDate * 1000) : null;

      const isOngoing = validatedData.ongoing ?? false;
      if (validatedData.numberOfPayments != null || validatedData.paymentAmount != null || isOngoing) {
        const paymentAmountNum = parseFloat(validatedData.paymentAmount ?? '0');
        const numberOfPayments = isOngoing ? ONGOING_PAYMENTS_CAP : (validatedData.numberOfPayments ?? 1);
        updatePayload.number_of_payments = numberOfPayments;
        updatePayload.total_amount = isOngoing ? '0' : (paymentAmountNum * numberOfPayments).toFixed(2);
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error: updateError } = await supabase
          .from('payment_contracts')
          .update(updatePayload)
          .eq('id', contractId);
        if (updateError) {
          logger.error('Update payment contract failed', { error: updateError.message });
          return res.status(500).json({ error: 'Failed to update contract' });
        }
      }

      if (validatedData.milestones && Array.isArray(validatedData.milestones)) {
        await supabase.from('contract_milestones').delete().eq('contract_id', contractId);
        if (validatedData.milestones.length > 0) {
          await supabase.from('contract_milestones').insert(
            validatedData.milestones.map((m: { description: string; amount: string }, i: number) => ({
              contract_id: contractId,
              milestone_id: String(i + 1),
              description: m.description,
              amount: m.amount,
            }))
          );
        }
      }

      logger.info('Payment contract updated', { userId, contractId });
      return res.status(200).json({ success: true, message: 'Contract updated', data: { id: contractId } });
    } catch (error: any) {
      logger.error('Update contract failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to update contract' });
    }
  }

  async deleteContract(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const contractId = req.params.contractId;
      if (!userId || !contractId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { data: user } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('id', userId)
        .single();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { data: row } = await supabase
        .from('payment_contracts')
        .select('id, status, employer_address')
        .eq('id', contractId)
        .is('contract_id', null)
        .single();

      if (!row) return res.status(404).json({ error: 'Contract not found' });
      if (row.status !== 'DRAFT') return res.status(400).json({ error: 'Only draft contracts can be deleted' });
      if ((row.employer_address || '').toLowerCase() !== (user.wallet_address || '').toLowerCase()) {
        return res.status(403).json({ error: 'Only the payer can delete this contract' });
      }

      await supabase.from('contract_milestones').delete().eq('contract_id', contractId);
      const { error: deleteError } = await supabase.from('payment_contracts').delete().eq('id', contractId);

      if (deleteError) {
        logger.error('Delete payment contract failed', { error: deleteError.message });
        return res.status(500).json({ error: 'Failed to delete contract' });
      }

      logger.info('Payment contract deleted', { userId, contractId });
      return res.status(200).json({ success: true, message: 'Contract deleted' });
    } catch (error: any) {
      logger.error('Delete contract failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to delete contract' });
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
        asset: validatedData.assetSlug,
        chain: validatedData.chainSlug,
      });

      logger.info('Contract funding initiated', { 
        userId, 
        contractId: validatedData.contractId,
        transferId: transferResult.id,
        chainSlug: validatedData.chainSlug,
        assetSlug: validatedData.assetSlug,
      });

      return res.status(200).json({
        success: true,
        message: 'Contract funding initiated via Blockradar',
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

      const { data: user } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('id', userId)
        .single();

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userAddress = (user.wallet_address || '').toLowerCase();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contractId);

      if (isUuid) {
        const { data: row, error } = await supabase
          .from('payment_contracts')
          .select('*')
          .eq('id', contractId)
          .single();

        if (error || !row) {
          return res.status(404).json({ error: 'Contract not found' });
        }

        const emp = (row.employer_address || '').toLowerCase();
        const con = (row.contractor_address || '').toLowerCase();
        if (emp !== userAddress && con !== userAddress) {
          return res.status(403).json({ error: 'Not authorized to view this contract' });
        }

        return res.status(200).json({
          success: true,
          data: {
            contract: {
              id: row.id,
              employer: row.employer_address,
              contractor: row.contractor_address,
              paymentAmount: row.payment_amount,
              numberOfPayments: String(row.number_of_payments ?? 0),
              paymentsMade: String(row.payments_made ?? 0),
              totalAmount: row.total_amount ?? '0',
              remainingBalance: row.remaining_balance ?? '0',
              tokenAddress: row.token_address ?? '',
              startDate: row.start_date ? Math.floor(new Date(row.start_date).getTime() / 1000) : 0,
              endDate: row.end_date ? Math.floor(new Date(row.end_date).getTime() / 1000) : 0,
              nextPaymentDate: row.next_payment_date ? Math.floor(new Date(row.next_payment_date).getTime() / 1000) : 0,
              lastPaymentDate: row.last_payment_date ? Math.floor(new Date(row.last_payment_date).getTime() / 1000) : undefined,
              paymentInterval: row.payment_interval ?? '0',
              status: row.status ?? 'DRAFT',
              releaseType: row.release_type ?? 'TIME_BASED',
              jobTitle: row.job_title,
              description: row.description,
              contractHash: row.contract_hash,
              gracePeriodDays: String(row.grace_period_days ?? 0),
              createdAt: row.created_at ? Math.floor(new Date(row.created_at).getTime() / 1000) : 0,
              contractName: row.contract_name,
              recipientEmail: row.recipient_email,
              deliverables: row.deliverables,
              outOfScope: row.out_of_scope,
              reviewPeriodDays: row.review_period_days,
              noticePeriodDays: row.notice_period_days,
              priority: row.priority,
              isOngoing: row.is_ongoing === true,
              chainSlug: row.chain_slug ?? '',
              assetSlug: row.asset_slug ?? '',
            },
            userRole: emp === userAddress ? 'employer' : 'contractor',
          },
        });
      }

      const contract = await paymentContractService.getContract(BigInt(contractId));
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

      if (!user.wallet_address) {
        return res.status(200).json({
          success: true,
          data: {
            contracts: [],
            pagination: { totalEmployer: '0', totalContractor: '0', total: '0' },
          },
        });
      }

      const wallet = (user.wallet_address || '').toLowerCase();

      const [employerContractIds, contractorContractIds, { data: dbDrafts }] = await Promise.all([
        paymentContractService.getEmployerContracts(user.wallet_address as `0x${string}`),
        paymentContractService.getContractorContracts(user.wallet_address as `0x${string}`),
        supabase
          .from('payment_contracts')
          .select('id, employer_address, contractor_address, payment_amount, number_of_payments, payments_made, total_amount, remaining_balance, token_address, start_date, end_date, next_payment_date, payment_interval, status, release_type, job_title, description, created_at, is_ongoing')
          .is('contract_id', null)
          .or(`employer_address.eq.${user.wallet_address},contractor_address.eq.${user.wallet_address}`),
      ]);

      const allContractIds = [...(employerContractIds || []), ...(contractorContractIds || [])];
      const chainContracts = await Promise.all(
        allContractIds.map(id => paymentContractService.getContract(id))
      );

      const draftRows = dbDrafts || [];
      const draftContracts = draftRows.map((row: any) => ({
        id: row.id,
        employer: row.employer_address,
        contractor: row.contractor_address,
        paymentAmount: row.payment_amount,
        numberOfPayments: String(row.number_of_payments ?? 0),
        paymentsMade: String(row.payments_made ?? 0),
        totalAmount: row.total_amount ?? '0',
        remainingBalance: row.remaining_balance ?? '0',
        tokenAddress: row.token_address ?? '',
        startDate: row.start_date ? Math.floor(new Date(row.start_date).getTime() / 1000) : 0,
        endDate: row.end_date ? Math.floor(new Date(row.end_date).getTime() / 1000) : 0,
        nextPaymentDate: row.next_payment_date ? Math.floor(new Date(row.next_payment_date).getTime() / 1000) : 0,
        paymentInterval: row.payment_interval ?? '0',
        status: row.status ?? 'DRAFT',
        releaseType: row.release_type ?? 'TIME_BASED',
        jobTitle: row.job_title,
        description: row.description,
        createdAt: row.created_at ? Math.floor(new Date(row.created_at).getTime() / 1000) : 0,
        isOngoing: row.is_ongoing === true,
      }));

      const contracts = [
        ...chainContracts.map(c => ({
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
          isOngoing: Number(c.numberOfPayments) >= 1000,
        })),
        ...draftContracts.map(d => ({
          id: d.id,
          employer: d.employer,
          contractor: d.contractor,
          paymentAmount: d.paymentAmount,
          numberOfPayments: d.numberOfPayments,
          paymentsMade: d.paymentsMade,
          totalAmount: d.totalAmount,
          remainingBalance: d.remainingBalance,
          tokenAddress: d.tokenAddress,
          startDate: d.startDate,
          endDate: d.endDate,
          nextPaymentDate: d.nextPaymentDate,
          paymentInterval: d.paymentInterval,
          status: d.status,
          releaseType: d.releaseType,
          jobTitle: d.jobTitle,
          description: d.description,
          createdAt: d.createdAt,
          isOngoing: d.isOngoing,
        })),
      ];

      const employerCount = employerContractIds?.length ?? 0;
      const contractorCount = contractorContractIds?.length ?? 0;
      const draftEmployerCount = draftRows.filter((r: any) => (r.employer_address || '').toLowerCase() === wallet).length;
      const draftContractorCount = draftRows.filter((r: any) => (r.contractor_address || '').toLowerCase() === wallet).length;

      return res.status(200).json({
        success: true,
        data: {
          contracts,
          pagination: {
            totalEmployer: (employerCount + draftEmployerCount).toString(),
            totalContractor: (contractorCount + draftContractorCount).toString(),
            total: contracts.length.toString(),
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

      if (!user.wallet_address) {
        return res.status(200).json({
          success: true,
          data: { asEmployer: '0', asContractor: '0' },
        });
      }

      const [employerContractIds, contractorContractIds] = await Promise.all([
        paymentContractService.getEmployerContracts(user.wallet_address as `0x${string}`),
        paymentContractService.getContractorContracts(user.wallet_address as `0x${string}`),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          asEmployer: (employerContractIds?.length ?? 0).toString(),
          asContractor: (contractorContractIds?.length ?? 0).toString(),
        },
      });
    } catch (error: any) {
      logger.error('Get contract stats failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to get contract stats' });
    }
  }
}

export const paymentContractController = new PaymentContractController();
