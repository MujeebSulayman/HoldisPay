import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { supabase } from '../config/supabase';

export class BlockradarWebhookController {
  async handleTransferWebhook(req: Request, res: Response) {
    try {
      const event = req.body;

      logger.info('Received Blockradar transfer webhook', {
        eventType: event.type,
        transferId: event.data?.id,
        status: event.data?.status,
      });

      if (event.type === 'transfer.completed') {
        await this.handleTransferCompleted(event.data);
      } else if (event.type === 'transfer.failed') {
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

  private async handleTransferCompleted(data: any) {
    try {
      const metadata = data.metadata || {};
      
      if (metadata.type === 'contract_funding') {
        const contractId = metadata.contractId;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contractId);
        const updatePayload: Record<string, unknown> = {
          remaining_balance: data.amount,
          updated_at: new Date().toISOString(),
        };
        if (isUuid) {
          const { data: row } = await supabase.from('payment_contracts').select('status').eq('id', contractId).single();
          if (row?.status === 'DRAFT') {
            updatePayload.status = 'ACTIVE';
          }
        }
        const query = isUuid
          ? supabase.from('payment_contracts').update(updatePayload).eq('id', contractId)
          : supabase.from('payment_contracts').update(updatePayload).eq('contract_id', contractId);
        await query;

        logger.info('Contract funded via transfer', { contractId, amount: data.amount });
      }

      if (metadata.type === 'contract_payment') {
        const contractId = metadata.contractId;
        const paymentNumber = metadata.paymentNumber;

        await supabase.from('contract_payments').insert({
          contract_id: contractId,
          payment_number: paymentNumber,
          amount: data.amount,
          paid_at: new Date(),
          tx_hash: data.hash,
        });

        await supabase
          .from('payment_contracts')
          .update({
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
      
      if (metadata.type === 'contract_funding') {
        const contractId = metadata.contractId;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contractId);
        const updatePayload: Record<string, unknown> = {
          remaining_balance: data.amount,
          updated_at: new Date().toISOString(),
        };
        if (isUuid) {
          const { data: row } = await supabase.from('payment_contracts').select('status').eq('id', contractId).single();
          if (row?.status === 'DRAFT') {
            updatePayload.status = 'ACTIVE';
          }
        }
        const query = isUuid
          ? supabase.from('payment_contracts').update(updatePayload).eq('id', contractId)
          : supabase.from('payment_contracts').update(updatePayload).eq('contract_id', contractId);
        await query;

        logger.info('Contract funded via payment link', { contractId, amount: data.amount });
      }
    } catch (error) {
      logger.error('Failed to handle payment link paid', { error, data });
    }
  }
}

export const blockradarWebhookController = new BlockradarWebhookController();
