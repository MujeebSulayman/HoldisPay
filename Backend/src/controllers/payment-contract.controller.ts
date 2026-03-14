import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { paymentContractService } from '../services/payment-contract.service';
import { blockradarService } from '../services/blockradar.service';
import { supabase } from '../config/supabase';
import { userService } from '../services/user.service';
import { emailService } from '../services/email.service';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { isChainEnabled } from '../config/enabled-chains';
import type { WorkSubmission } from '../types/work-submission';

const CONTRACT_ATTACHMENTS_BUCKET = 'contract-attachments';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_CONTRACT = 10;
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
];

const ONGOING_PAYMENTS_CAP = 1000;

const createContractSchemaBase = z.object({
  contractorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  contractorTag: z.string().min(1).max(64).optional(),
  paymentAmount: z.string(),
  numberOfPayments: z.number().int().positive().optional().default(1),
  paymentInterval: z.number().int().min(0).optional().default(1),
  startDate: z.number().int().positive(),
  releaseType: z.enum(['PROJECT_BASED', 'TIME_BASED']).optional().default('PROJECT_BASED'),
  chainSlug: z.string(),
  assetSlug: z.string(),
  jobTitle: z.string().optional(),
  description: z.string().optional(),
  contractHash: z.string().optional(),
  contractName: z.string().optional(),
  deliverables: z.string().optional(),
  endDate: z.number().int().positive().optional(),
  ongoing: z.boolean().optional(),
  recurrenceFrequency: z.enum(['NONE', 'BI_WEEKLY', 'MONTHLY', 'CUSTOM']).optional().default('NONE'),
  recurrenceCustomDays: z.number().int().positive().optional(),
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
    (data) => data.ongoing === true || (data.numberOfPayments != null && data.numberOfPayments > 0) || true,
    { message: 'Either ongoing or numberOfPayments required', path: ['numberOfPayments'] }
  );

const updateContractSchema = createContractSchemaBase.partial();

const fundContractSchema = z.object({
  contractId: z.string(),
  amount: z.string(),
  chainSlug: z.string(),
  assetSlug: z.string(),
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
        deliverables: validatedData.deliverables ?? null,
        is_ongoing: isOngoing,
        is_recurring: validatedData.recurrenceFrequency !== 'NONE',
        recurrence_frequency: validatedData.recurrenceFrequency,
        recurrence_custom_days: validatedData.recurrenceCustomDays ?? null,
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
        const cause = (insertError as any)?.cause?.message ?? (insertError as any)?.cause?.code;
        logger.error('Insert payment contract failed', {
          error: insertError.message,
          code: insertError.code,
          cause: cause || (insertError as any)?.cause,
        });
        const isNetworkError = /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network/i.test(insertError.message || '') || cause;
        return res.status(500).json({
          error: isNetworkError
            ? 'Cannot reach database. Check your connection and SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.'
            : 'Failed to save contract',
        });
      }

      logger.info('Payment contract saved', { userId, id: inserted?.id, status: inserted?.status });

      const contractIdForEmail = inserted?.contract_id ?? inserted?.id ?? '';
      const contractName = validatedData.contractName || validatedData.jobTitle || undefined;
      const amountStr = validatedData.paymentAmount ? `$${validatedData.paymentAmount}` : undefined;
      setImmediate(async () => {
        try {
          const [employerUser, contractorUser] = await Promise.all([
            userService.getUserById(userId),
            userService.getUserByWalletAddress(contractorAddress),
          ]);
          if (employerUser?.email) {
            await emailService.notifyContractCreated(employerUser.email, {
              contractId: String(contractIdForEmail),
              role: 'employer',
              contractName,
              amount: amountStr,
            });
          }
          if (contractorUser?.email && contractorUser.id !== userId) {
            await emailService.notifyContractCreated(contractorUser.email, {
              contractId: String(contractIdForEmail),
              role: 'contractor',
              contractName,
              amount: amountStr,
            });
          }
        } catch (err) {
          logger.error('Failed to send contract-created emails', { err, contractId: contractIdForEmail });
        }
      });

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
      if (validatedData.deliverables !== undefined) updatePayload.deliverables = validatedData.deliverables || null;
      if (validatedData.ongoing !== undefined) updatePayload.is_ongoing = validatedData.ongoing;
      if (validatedData.endDate !== undefined) updatePayload.end_date = validatedData.endDate ? new Date(validatedData.endDate * 1000) : null;
      if (validatedData.recurrenceFrequency !== undefined) {
        updatePayload.is_recurring = validatedData.recurrenceFrequency !== 'NONE';
        updatePayload.recurrence_frequency = validatedData.recurrenceFrequency;
      }
      if (validatedData.recurrenceCustomDays !== undefined) updatePayload.recurrence_custom_days = validatedData.recurrenceCustomDays;

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

  async createContractFundingLink(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { contractId } = req.params;
      const body = req.body as { amount?: string };
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contractId);
      if (!isUuid) {
        return res.status(400).json({ error: 'Contract ID must be a UUID' });
      }

      const { data: user } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('id', userId)
        .single();

      if (!user?.wallet_address) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { data: row, error } = await supabase
        .from('payment_contracts')
        .select('id, employer_address, status, total_amount, job_title')
        .eq('id', contractId)
        .single();

      if (error || !row) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      if ((row.employer_address || '').toLowerCase() !== user.wallet_address.toLowerCase()) {
        return res.status(403).json({ error: 'Only the payer can fund this contract' });
      }

      if (row.status !== 'DRAFT') {
        return res.status(400).json({ error: 'Only draft contracts can be funded' });
      }

      const amount = (body?.amount && body.amount.trim() !== '') ? body.amount.trim() : (row.total_amount || '0');
      if (!amount || amount === '0') {
        return res.status(400).json({ error: 'Contract has no amount to fund' });
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const paymentLink = await blockradarService.createPaymentLink({
        name: `Fund contract: ${row.job_title || 'Payment contract'}`,
        description: `Fund payment contract ${contractId.slice(0, 8)}...`,
        amount,
        redirectUrl: `${frontendUrl}/dashboard/contracts?fund=success`,
        successMessage: 'Contract funded. You can return to your contracts.',
        metadata: {
          type: 'contract_funding',
          contractId: row.id,
        },
        paymentLimit: 1,
      });

      logger.info('Contract funding link created', {
        userId,
        contractId: row.id,
        paymentLinkId: paymentLink.id,
      });

      return res.status(200).json({
        success: true,
        data: {
          paymentLinkUrl: paymentLink.url,
          paymentLinkId: paymentLink.id,
        },
      });
    } catch (error: any) {
      logger.error('Create contract funding link failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to create funding link' });
    }
  }

  async validateContractorTag(req: AuthenticatedRequest, res: Response) {
    try {
      const tag = (req.query.tag as string)?.trim()?.toLowerCase()?.replace(/^@/, '');
      if (!tag) {
        return res.status(400).json({ exists: false, error: 'Tag is required' });
      }
      const { data: contractorUser } = await supabase
        .from('users')
        .select('wallet_address, first_name, last_name, tag')
        .eq('tag', tag)
        .not('wallet_address', 'is', null)
        .maybeSingle();
      if (!contractorUser?.wallet_address) {
        return res.status(200).json({ exists: false });
      }
      const displayName = [contractorUser.first_name, contractorUser.last_name].filter(Boolean).join(' ').trim() || contractorUser.tag || undefined;
      return res.status(200).json({ exists: true, displayName: displayName || undefined });
    } catch (err) {
      logger.error('validateContractorTag failed', { error: err });
      return res.status(500).json({ exists: false, error: 'Validation failed' });
    }
  }

  async uploadAttachment(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { contractId } = req.params;
      if (!userId || !contractId) return res.status(401).json({ error: 'Unauthorized' });

      const file = (req as any).file;
      if (!file || !file.buffer) return res.status(400).json({ error: 'No file uploaded' });
      if (file.size > MAX_FILE_SIZE_BYTES) return res.status(400).json({ error: 'File too large (max 10MB)' });
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return res.status(400).json({ error: 'File type not allowed. Use PDF, DOC, DOCX, PNG, JPG, WEBP, or TXT.' });
      }

      const ctx = await PaymentContractController.getContractRowAndRole(contractId, userId);
      if (!ctx) return res.status(404).json({ error: 'Contract not found or not authorized' });
      if (!ctx.isEmployer) return res.status(403).json({ error: 'Only the employer can upload attachments' });
      if (ctx.row.status !== 'DRAFT') return res.status(400).json({ error: 'Attachments can only be added to draft contracts' });

      const { count } = await supabase
        .from('contract_attachments')
        .select('*', { count: 'exact', head: true })
        .eq('contract_id', contractId);
      if ((count ?? 0) >= MAX_ATTACHMENTS_PER_CONTRACT) {
        return res.status(400).json({ error: `Maximum ${MAX_ATTACHMENTS_PER_CONTRACT} attachments per contract` });
      }

      const safeName = (file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
      const storagePath = `${contractId}/${Date.now()}-${safeName}`;

      let uploadErr = (await supabase.storage.from(CONTRACT_ATTACHMENTS_BUCKET).upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      })).error;
      if (uploadErr?.message?.includes('Bucket not found')) {
        await supabase.storage.createBucket(CONTRACT_ATTACHMENTS_BUCKET, { public: false });
        uploadErr = (await supabase.storage.from(CONTRACT_ATTACHMENTS_BUCKET).upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false })).error;
      }
      if (uploadErr) {
        logger.error('Contract attachment upload failed', { error: uploadErr.message });
        return res.status(500).json({ error: uploadErr.message || 'Upload failed' });
      }

      const label = (req.body && (req as any).body.label) ? String((req as any).body.label).trim().slice(0, 200) : null;
      const { data: inserted, error: insertError } = await supabase
        .from('contract_attachments')
        .insert({
          contract_id: contractId,
          uploaded_by: userId,
          file_name: file.originalname || 'file',
          storage_path: storagePath,
          label: label || null,
          file_size: file.size,
          mime_type: file.mimetype,
        })
        .select('id, file_name, label, file_size, mime_type, created_at')
        .single();

      if (insertError) {
        logger.error('Contract attachment insert failed', { error: insertError.message });
        await supabase.storage.from(CONTRACT_ATTACHMENTS_BUCKET).remove([storagePath]);
        return res.status(500).json({ error: 'Failed to save attachment' });
      }

      return res.status(200).json({
        success: true,
        data: {
          id: inserted.id,
          fileName: inserted.file_name,
          label: inserted.label,
          fileSize: inserted.file_size,
          mimeType: inserted.mime_type,
          createdAt: inserted.created_at,
        },
      });
    } catch (err: any) {
      logger.error('Upload attachment failed', { error: err?.message });
      return res.status(500).json({ error: err?.message || 'Upload failed' });
    }
  }

  async listAttachments(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { contractId } = req.params;
      if (!userId || !contractId) return res.status(401).json({ error: 'Unauthorized' });

      const ctx = await PaymentContractController.getContractRowAndRole(contractId, userId);
      if (!ctx) return res.status(404).json({ error: 'Contract not found or not authorized' });

      const { data: rows, error } = await supabase
        .from('contract_attachments')
        .select('id, file_name, label, file_size, mime_type, created_at')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: true });

      if (error) return res.status(500).json({ error: 'Failed to list attachments' });
      return res.status(200).json({ success: true, data: { attachments: rows || [] } });
    } catch (err: any) {
      logger.error('List attachments failed', { error: err?.message });
      return res.status(500).json({ error: err?.message || 'Failed to list' });
    }
  }

  async getAttachmentDownloadUrl(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { contractId, attachmentId } = req.params;
      if (!userId || !contractId || !attachmentId) return res.status(401).json({ error: 'Unauthorized' });

      const ctx = await PaymentContractController.getContractRowAndRole(contractId, userId);
      if (!ctx) return res.status(404).json({ error: 'Contract not found or not authorized' });

      const { data: att, error: attErr } = await supabase
        .from('contract_attachments')
        .select('storage_path')
        .eq('id', attachmentId)
        .eq('contract_id', contractId)
        .single();

      if (attErr || !att) return res.status(404).json({ error: 'Attachment not found' });

      const { data: signed } = await supabase.storage.from(CONTRACT_ATTACHMENTS_BUCKET).createSignedUrl(att.storage_path, 3600);
      if (!signed?.signedUrl) return res.status(500).json({ error: 'Failed to generate download link' });
      return res.status(200).json({ success: true, data: { url: signed.signedUrl } });
    } catch (err: any) {
      logger.error('Get attachment URL failed', { error: err?.message });
      return res.status(500).json({ error: err?.message || 'Failed' });
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
      const isAdmin = (req.user?.accountType ?? '') === 'admin';
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
        if (!isAdmin && emp !== userAddress && con !== userAddress) {
          return res.status(403).json({ error: 'Not authorized to view this contract' });
        }

        const addresses = [row.employer_address, row.contractor_address].filter(Boolean);
        const { data: usersList } = await supabase
          .from('users')
          .select('wallet_address, first_name, last_name, tag')
          .in('wallet_address', addresses);
        const addressToName: Record<string, string> = {};
        (usersList || []).forEach((u: any) => {
          const addr = (u.wallet_address || '').toLowerCase();
          const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
          addressToName[addr] = name || u.tag || addr;
        });

        const { data: workRow } = await supabase
          .from('contract_work_submissions')
          .select('id, comment, submitted_at, status, reviewed_at, reviewed_by, reviewer_comment, released_at')
          .eq('contract_id', contractId)
          .maybeSingle();

        const { data: attachmentRows } = await supabase
          .from('contract_attachments')
          .select('id, file_name, label, file_size, mime_type, created_at')
          .eq('contract_id', contractId)
          .order('created_at', { ascending: true });

        const workSubmission: WorkSubmission | null = workRow
          ? {
              id: workRow.id,
              contractId,
              comment: workRow.comment ?? null,
              submittedAt: workRow.submitted_at,
              status: workRow.status,
              reviewedAt: workRow.reviewed_at ?? null,
              reviewedBy: workRow.reviewed_by ?? null,
              reviewerComment: workRow.reviewer_comment ?? null,
              releasedAt: workRow.released_at ?? null,
            }
          : null;

        return res.status(200).json({
          success: true,
          data: {
            contract: {
              id: row.id,
              employer: row.employer_address,
              contractor: row.contractor_address,
              employerDisplayName: addressToName[emp] ?? null,
              contractorDisplayName: addressToName[con] ?? null,
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
              releaseType: (row.release_type as 'PROJECT_BASED' | 'TIME_BASED') ?? 'PROJECT_BASED',
              jobTitle: row.job_title,
              description: row.description,
              contractHash: row.contract_hash,
              gracePeriodDays: String(row.grace_period_days ?? 0),
              createdAt: row.created_at ? Math.floor(new Date(row.created_at).getTime() / 1000) : 0,
              contractName: row.contract_name,
              deliverables: row.deliverables,
              isOngoing: row.is_ongoing === true,
              chainSlug: row.chain_slug ?? '',
              assetSlug: row.asset_slug ?? '',
            },
            workSubmission,
            attachments: (attachmentRows || []).map((a: any) => ({
              id: a.id,
              fileName: a.file_name,
              label: a.label,
              fileSize: a.file_size,
              mimeType: a.mime_type,
              createdAt: a.created_at,
            })),
            userRole: isAdmin ? 'admin' : (emp === userAddress ? 'employer' : 'contractor'),
          },
        });
      }

      const contract = await paymentContractService.getContract(BigInt(contractId));
      const isEmployer = contract.employer.toLowerCase() === userAddress;
      const isContractor = contract.contractor.toLowerCase() === userAddress;

      if (!isAdmin && !isEmployer && !isContractor) {
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
            releaseType: (contract as any).releaseType ?? 'PROJECT_BASED',
            jobTitle: contract.jobTitle,
            description: contract.description,
            contractHash: contract.contractHash,
            gracePeriodDays: contract.gracePeriodDays.toString(),
            createdAt: Number(contract.createdAt),
          },
          workSubmission: null,
          userRole: isAdmin ? 'admin' : (isEmployer ? 'employer' : 'contractor'),
        },
      });
    } catch (error: any) {
      logger.error('Get contract failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to get contract' });
    }
  }

  private static async getContractRowAndRole(
    contractId: string,
    userId: string
  ): Promise<{ row: any; userAddress: string; isEmployer: boolean; isContractor: boolean } | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contractId);
    if (!isUuid) return null;
    const { data: user } = await supabase.from('users').select('wallet_address, account_type').eq('id', userId).single();
    if (!user) return null;
    const { data: row } = await supabase.from('payment_contracts').select('*').eq('id', contractId).single();
    if (!row) return null;
    const userAddress = ((user.wallet_address as string) || '').toLowerCase();
    const emp = (row.employer_address || '').toLowerCase();
    const con = (row.contractor_address || '').toLowerCase();
    const isAdmin = (user.account_type as string) === 'admin';
    if (!isAdmin && emp !== userAddress && con !== userAddress) return null;
    return {
      row,
      userAddress,
      isEmployer: isAdmin ? false : emp === userAddress,
      isContractor: isAdmin ? false : con === userAddress,
    };
  }

  async submitWork(req: AuthenticatedRequest, res: Response) {
    try {
      const { contractId } = req.params;
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const body = z.object({ comment: z.string().max(10000).optional() }).parse(req.body || {});
      const ctx = await PaymentContractController.getContractRowAndRole(contractId, userId);
      if (!ctx) return res.status(404).json({ error: 'Contract not found or not authorized' });
      if (!ctx.isContractor) return res.status(403).json({ error: 'Only the contractor can submit work' });
      if (ctx.row.status !== 'ACTIVE') return res.status(400).json({ error: 'Contract must be active to submit work' });

      const { error: upsertError } = await supabase.from('contract_work_submissions').upsert(
        {
          contract_id: contractId,
          comment: body.comment?.trim() || null,
          submitted_at: new Date().toISOString(),
          status: 'pending',
          reviewed_at: null,
          reviewed_by: null,
          reviewer_comment: null,
          released_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'contract_id' }
      );
      if (upsertError) {
        logger.error('Submit work failed', { error: upsertError.message });
        return res.status(500).json({ error: 'Failed to submit work' });
      }
      logger.info('Work submitted', { contractId, userId });
      return res.status(200).json({ success: true, message: 'Work submitted for approval' });
    } catch (error: any) {
      if (error.name === 'ZodError') return res.status(400).json({ error: error.message || 'Invalid body' });
      logger.error('Submit work failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to submit work' });
    }
  }

  async approveWork(req: AuthenticatedRequest, res: Response) {
    try {
      const { contractId } = req.params;
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const body = z
        .object({ approved: z.boolean(), comment: z.string().max(5000).optional() })
        .parse(req.body || {});
      const ctx = await PaymentContractController.getContractRowAndRole(contractId, userId);
      if (!ctx) return res.status(404).json({ error: 'Contract not found or not authorized' });
      if (!ctx.isEmployer) return res.status(403).json({ error: 'Only the employer can approve or reject work' });

      const { data: sub } = await supabase
        .from('contract_work_submissions')
        .select('id, status')
        .eq('contract_id', contractId)
        .single();
      if (!sub) return res.status(400).json({ error: 'No work submitted yet' });
      if (sub.status !== 'pending') return res.status(400).json({ error: 'Work has already been reviewed' });

      const { data: user } = await supabase.from('users').select('wallet_address').eq('id', userId).single();
      const reviewedBy = user?.wallet_address || null;

      const { error: updateError } = await supabase
        .from('contract_work_submissions')
        .update({
          status: body.approved ? 'approved' : 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewedBy,
          reviewer_comment: body.comment?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('contract_id', contractId);
      if (updateError) {
        logger.error('Approve work failed', { error: updateError.message });
        return res.status(500).json({ error: 'Failed to update' });
      }
      logger.info('Work reviewed', { contractId, approved: body.approved });
      return res.status(200).json({
        success: true,
        message: body.approved ? 'Work approved' : 'Work rejected',
        data: { approved: body.approved },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') return res.status(400).json({ error: error.message || 'Invalid body' });
      logger.error('Approve work failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to approve work' });
    }
  }

  async releasePayment(req: AuthenticatedRequest, res: Response) {
    try {
      const { contractId } = req.params;
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const ctx = await PaymentContractController.getContractRowAndRole(contractId, userId);
      if (!ctx) return res.status(404).json({ error: 'Contract not found or not authorized' });
      if (!ctx.isEmployer) return res.status(403).json({ error: 'Only the employer can release payment' });

      const { data: sub } = await supabase
        .from('contract_work_submissions')
        .select('id, status, released_at')
        .eq('contract_id', contractId)
        .single();
      if (!sub) return res.status(400).json({ error: 'No work submission found' });
      if (sub.status !== 'approved') return res.status(400).json({ error: 'Work must be approved before releasing payment' });
      if (sub.released_at) return res.status(400).json({ error: 'Payment has already been released' });

      const { error: updateError } = await supabase
        .from('contract_work_submissions')
        .update({
          released_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('contract_id', contractId);
      if (updateError) {
        logger.error('Release payment failed', { error: updateError.message });
        return res.status(500).json({ error: 'Failed to release' });
      }

      logger.info('Payment release recorded', { contractId });
      return res.status(200).json({
        success: true,
        message: 'Payment release recorded. The contractor can now claim the payment.',
        data: { releasedAt: new Date().toISOString() },
      });
    } catch (error: any) {
      logger.error('Release payment failed', { error: error.message });
      return res.status(400).json({ error: error.message || 'Failed to release payment' });
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
          .select('id, employer_address, contractor_address, payment_amount, number_of_payments, payments_made, total_amount, remaining_balance, token_address, start_date, end_date, next_payment_date, payment_interval, status, release_type, job_title, description, created_at, is_ongoing, chain_slug, asset_slug')
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
        releaseType: (row.release_type as 'PROJECT_BASED' | 'TIME_BASED') ?? 'PROJECT_BASED',
        jobTitle: row.job_title,
        description: row.description,
        createdAt: row.created_at ? Math.floor(new Date(row.created_at).getTime() / 1000) : 0,
        isOngoing: row.is_ongoing === true,
        chainSlug: row.chain_slug ?? '',
        assetSlug: row.asset_slug ?? '',
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
          chainSlug: (c as any).chainSlug ?? '',
          assetSlug: (c as any).assetSlug ?? '',
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

      const uniqueAddresses = [...new Set(contracts.flatMap((c: any) => [c.employer, c.contractor]).filter(Boolean))];
      const { data: usersList } = await supabase
        .from('users')
        .select('wallet_address, first_name, last_name, tag')
        .in('wallet_address', uniqueAddresses);
      const addressToName: Record<string, string> = {};
      (usersList || []).forEach((u: any) => {
        const addr = (u.wallet_address || '').toLowerCase();
        const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
        addressToName[addr] = name || u.tag || addr;
      });

      const contractsWithNames = contracts.map((c: any) => ({
        ...c,
        employerDisplayName: addressToName[(c.employer || '').toLowerCase()] ?? null,
        contractorDisplayName: addressToName[(c.contractor || '').toLowerCase()] ?? null,
      }));

      const employerCount = employerContractIds?.length ?? 0;
      const contractorCount = contractorContractIds?.length ?? 0;
      const draftEmployerCount = draftRows.filter((r: any) => (r.employer_address || '').toLowerCase() === wallet).length;
      const draftContractorCount = draftRows.filter((r: any) => (r.contractor_address || '').toLowerCase() === wallet).length;

      return res.status(200).json({
        success: true,
        data: {
          contracts: contractsWithNames,
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
