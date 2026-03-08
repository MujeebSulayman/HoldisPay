import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { supabase } from '../config/supabase';
import { transactionService } from '../services/transaction.service';
import { userService } from '../services/user.service';
import { webhookService } from '../services/webhook.service';

function getChainSlugFromData(data: any): string | undefined {
  const b = data?.blockchain;
  if (b?.slug) return String(b.slug).toLowerCase().trim();
  if (b?.name) return String(b.name).toLowerCase().replace(/\s+/g, '');
  if (b?.network) return String(b.network).toLowerCase().trim();
  if (data?.chainId != null) {
    const m: Record<number, string> = { 11155111: 'ethereum', 84532: 'base', 43113: 'avalanche', 80002: 'polygon', 97: 'bnb' };
    return m[Number(data.chainId)] ?? String(data.chainId).toLowerCase();
  }
  if (data?.chain) return String(data.chain).toLowerCase().trim();
  return undefined;
}

export class BlockradarWebhookController {
  async handleTransferWebhook(req: Request, res: Response) {
    try {
      const event = req.body;

      const eventType = event.type ?? event.event;
      logger.info('Received Blockradar transfer webhook', {
        eventType,
        transferId: event.data?.id,
        status: event.data?.status,
      });

      if (eventType === 'transfer.completed' || eventType === 'transfer.success' || eventType === 'withdraw.success') {
        await this.handleTransferCompleted(event.data);
      } else if (eventType === 'transfer.failed' || eventType === 'withdraw.failed') {
        await this.handleTransferFailed(event.data);
      }

      res.status(200).json({ success: true });
    } catch (error: any) {
      logger.error('Failed to handle transfer webhook', { error: error.message });
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  async handleContractWebhook(req: Request, res: Response) {
    try {
      const event = req.body;

      logger.info('Received Blockradar contract webhook', {
        eventType: event.type,
        contractCall: event.data?.functionName,
      });

      if (event.type === 'contract.write.completed') {
        await this.handleContractWriteCompleted(event.data);
      } else if (event.type === 'contract.write.failed') {
        await this.handleContractWriteFailed(event.data);
      }

      res.status(200).json({ success: true });
    } catch (error: any) {
      logger.error('Failed to handle contract webhook', { error: error.message });
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  async handlePaymentLinkWebhook(req: Request, res: Response) {
    try {
      const event = req.body;

      logger.info('Received Blockradar payment link webhook', {
        eventType: event.type,
        linkId: event.data?.linkId,
        amount: event.data?.amount,
      });

      if (event.type === 'payment_link.paid') {
        await this.handlePaymentLinkPaid(event.data);
      }

      res.status(200).json({ success: true });
    } catch (error: any) {
      logger.error('Failed to handle payment link webhook', { error: error.message });
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  private async logContractFundTransaction(params: {
    contractId: string;
    amount: string;
    txHash: string;
    chainId?: string;
    senderAddress?: string;
    blockradarReference?: string;
    amountUSD?: string;
  }): Promise<void> {
    const { contractId, amount, txHash, chainId, senderAddress, blockradarReference, amountUSD } = params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contractId);
    const contractSelect = isUuid
      ? supabase.from('payment_contracts').select('employer_address').eq('id', contractId)
      : supabase.from('payment_contracts').select('employer_address').eq('contract_id', contractId);
    const { data: contractRow } = await contractSelect.maybeSingle();
    const employerAddress = contractRow?.employer_address;
    if (!employerAddress) return;
    const employerUser = await userService.getUserByWalletAddress(employerAddress);
    if (!employerUser?.id) return;
    await transactionService.logTransaction({
      userId: employerUser.id,
      txType: 'contract_fund',
      txHash,
      status: 'success',
      amount,
      fromAddress: senderAddress,
      blockradarReference: blockradarReference ?? undefined,
      chainId: chainId ?? undefined,
      metadata: {
        type: 'contract_funding',
        contractId,
        ...(amountUSD != null ? { amountUSD } : {}),
      },
    });
  }

  private async handleTransferCompleted(data: any) {
    try {
      const metadata = data.metadata || {};
      
      if (metadata.type === 'contract_funding') {
        const contractId = metadata.contractId;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contractId);
        const selectQ = isUuid
          ? supabase.from('payment_contracts').select('remaining_balance, status').eq('id', contractId).single()
          : supabase.from('payment_contracts').select('remaining_balance, status').eq('contract_id', contractId).single();
        const { data: row } = await selectQ;
        const current = BigInt(row?.remaining_balance ?? '0');
        const addAmount = BigInt(data.amount ?? '0');
        const updatePayload: Record<string, unknown> = {
          remaining_balance: (current + addAmount).toString(),
          updated_at: new Date().toISOString(),
        };
        if (isUuid && row?.status === 'DRAFT') updatePayload.status = 'ACTIVE';
        const query = isUuid
          ? supabase.from('payment_contracts').update(updatePayload).eq('id', contractId)
          : supabase.from('payment_contracts').update(updatePayload).eq('contract_id', contractId);
        await query;

        const txHash = data.hash || data.txHash || data.id || `contract-fund-transfer-${contractId}-${Date.now()}`;
        const chainId = getChainSlugFromData(data);
        await this.logContractFundTransaction({
          contractId,
          amount: data.amount ?? '0',
          txHash,
          chainId,
          senderAddress: data.senderAddress ?? data.fromAddress ?? data.from,
          blockradarReference: data.id,
          amountUSD: data.amountUSD,
        });

        logger.info('Contract funded via transfer', { contractId, amount: data.amount });
      }

      if (metadata.type === 'contract_payment') {
        const contractId = metadata.contractId;
        const paymentNumber = metadata.paymentNumber;
        const amountStr = data.amount ?? '0';

        await supabase.from('contract_payments').insert({
          contract_id: contractId,
          payment_number: paymentNumber,
          amount: amountStr,
          paid_at: new Date(),
          tx_hash: data.hash,
        });

        const { data: pcRow } = await supabase
          .from('payment_contracts')
          .select('remaining_balance')
          .eq('contract_id', contractId)
          .maybeSingle();
        const current = BigInt(pcRow?.remaining_balance ?? '0');
        const released = BigInt(amountStr);
        const nextRemaining = current >= released ? current - released : 0n;

        await supabase
          .from('payment_contracts')
          .update({
            remaining_balance: nextRemaining.toString(),
            payments_made: paymentNumber,
            last_payment_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('contract_id', contractId);

        logger.info('Contract payment completed', { contractId, paymentNumber });
      }
    } catch (error) {
      logger.error('Failed to handle transfer completed', { error, data });
    }
  }

  private async handleTransferFailed(data: any) {
    try {
      const metadata = data.metadata || {};
      
      logger.warn('Transfer failed', {
        type: metadata.type,
        contractId: metadata.contractId,
        error: data.error,
      });
    } catch (error) {
      logger.error('Failed to handle transfer failed', { error, data });
    }
  }

  private async handleContractWriteCompleted(data: any) {
    try {
      logger.info('Contract write completed', {
        functionName: data.functionName,
        txHash: data.hash,
      });
    } catch (error) {
      logger.error('Failed to handle contract write completed', { error, data });
    }
  }

  private async handleContractWriteFailed(data: any) {
    try {
      logger.warn('Contract write failed', {
        functionName: data.functionName,
        error: data.error,
      });
    } catch (error) {
      logger.error('Failed to handle contract write failed', { error, data });
    }
  }

  private async handlePaymentLinkPaid(data: any) {
    try {
      const metadata = typeof data.metadata === 'string' ? JSON.parse(data.metadata || '{}') : (data.metadata || {});
      const paymentLinkId = data.linkId ?? data.paymentLinkId ?? data.paymentLink?.id;

      if (metadata.type === 'contract_funding') {
        const contractId = metadata.contractId;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contractId);
        const selectQ = isUuid
          ? supabase.from('payment_contracts').select('remaining_balance, status').eq('id', contractId).single()
          : supabase.from('payment_contracts').select('remaining_balance, status').eq('contract_id', contractId).single();
        const { data: row } = await selectQ;
        const current = BigInt(row?.remaining_balance ?? '0');
        const addAmount = BigInt(data.amount ?? '0');
        const updatePayload: Record<string, unknown> = {
          remaining_balance: (current + addAmount).toString(),
          updated_at: new Date().toISOString(),
        };
        if (isUuid && row?.status === 'DRAFT') updatePayload.status = 'ACTIVE';
        const query = isUuid
          ? supabase.from('payment_contracts').update(updatePayload).eq('id', contractId)
          : supabase.from('payment_contracts').update(updatePayload).eq('contract_id', contractId);
        await query;

        const txHash = data.hash ?? data.txHash ?? data.id ?? `contract-fund-link-${contractId}-${Date.now()}`;
        const chainId = getChainSlugFromData(data);
        await this.logContractFundTransaction({
          contractId,
          amount: data.amount ?? '0',
          txHash,
          chainId,
          senderAddress: data.senderAddress ?? data.fromAddress ?? data.sender,
          blockradarReference: data.id,
          amountUSD: data.amountUSD,
        });

        logger.info('Contract funded via payment link', { contractId, amount: data.amount });
        return;
      }

      if (paymentLinkId) {
        await webhookService.processInvoicePaymentLinkPaid(paymentLinkId, data);
      }
    } catch (error) {
      logger.error('Failed to handle payment link paid', { error, data });
    }
  }
}

export const blockradarWebhookController = new BlockradarWebhookController();
