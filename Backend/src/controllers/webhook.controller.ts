import { Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { webhookService } from '../services/webhook.service';
import { invoiceService } from '../services/invoice.service';
import { transactionService } from '../services/transaction.service';
import { logger } from '../utils/logger';

const skipVerify = () => env.BLOCKRADAR_SKIP_WEBHOOK_VERIFY === 'true';

export class WebhookController {
  
  async handleBlockradarWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-blockradar-signature'] as string;
      if (!signature && !skipVerify()) {
        res.status(401).json({
          error: 'Missing signature',
          message: 'Webhook signature is required',
        });
        return;
      }

      if (skipVerify()) {
        const payload = (req as any).body ?? req.body;
        res.status(200).json({ success: true, message: 'Webhook received' });
        setImmediate(() => {
          webhookService.handleWebhook(payload).catch((err) => {
            logger.error('Blockradar webhook async processing failed', { error: err, event: payload?.event });
          });
        });
        return;
      }

      const rawBody = (req as any).rawBody ?? '';
      const body = (req as any).body ?? req.body ?? {};
      
      const isValid =
        webhookService.verifyWebhookSignature(rawBody, signature) ||
        (rawBody !== JSON.stringify(body) && webhookService.verifyWebhookSignature(JSON.stringify(body), signature));

      if (!isValid) {
        logger.error('Invalid webhook signature', {
          signatureLen: signature?.length,
          rawBodyLen: rawBody?.length,
          triedStringify: rawBody !== JSON.stringify(body),
        });

        res.status(401).json({
          error: 'Invalid signature',
          message: 'Webhook signature verification failed',
        });
        return;
      }

      const payload = (req as any).body ?? req.body;
      res.status(200).json({ success: true, message: 'Webhook received' });

      setImmediate(() => {
        webhookService.handleWebhook(payload).catch((err) => {
          logger.error('Blockradar webhook async processing failed', { error: err, event: payload?.event });
        });
      });
    } catch (error) {
      logger.error('Webhook processing error', { error });

      res.status(200).json({
        success: false,
        message: 'Webhook processing failed',
      });
    }
  }

  async handleMonnifyWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['monnify-signature'] as string;
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      
      const expectedSignature = crypto
        .createHmac('sha512', env.MONNIFY_SECRET_KEY || '')
        .update(rawBody, 'utf8')
        .digest('hex');

      if (signature !== expectedSignature && !skipVerify()) {
        logger.error('Invalid Monnify webhook signature', { signature, expectedSignature });
        res.status(401).json({ success: false, message: 'Invalid signature' });
        return;
      }

      const payload = req.body;
      logger.info('Received Monnify Webhook', { body: req.body, signature });
      res.status(200).json({ success: true });

      setImmediate(() => {
        const { eventType, eventData } = payload;
        
        if (eventType === 'SUCCESSFUL_DISBURSEMENT' || eventType === 'FAILED_DISBURSEMENT' || eventType === 'REVERSED_DISBURSEMENT') {
           const status = eventType === 'SUCCESSFUL_DISBURSEMENT' ? 'success' : 'failed';
           const reference = eventData.reference;
           
           if (reference) {
             webhookService.handleMonnifyDisbursementUpdate(reference, status, eventData).catch(err => {
                logger.error('Failed to handle Monnify disbursement async', { error: err, reference });
             });
           }
        }
      });

    } catch (error) {
      logger.error('Monnify Webhook processing error', { error });
      res.status(500).json({ success: false, message: 'Webhook processing failed' });
    }
  }

  async testWebhook(_req: Request, res: Response): Promise<void> {
    try {
      const testEvent = {
        event: 'custom-smart-contract.success' as const,
        data: {
          id: 'test-tx-id',
          hash: '0x1234567890abcdef',
          status: 'SUCCESS' as const,
          method: 'createInvoice',
          contractAddress: '0xContractAddress',
          blockchain: {
            name: 'ethereum',
            network: 'testnet',
          },
          reference: 'test-reference',
          metadata: {
            type: 'test',
            userId: 'test-user',
          },
        },
      };

      await webhookService.handleWebhook(testEvent);

      res.status(200).json({
        success: true,
        message: 'Test webhook processed',
        event: testEvent,
      });
    } catch (error) {
      logger.error('Test webhook error', { error });
      res.status(500).json({
        error: 'Test failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async handleDiditWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.get('X-Signature-V2');
      const timestamp = req.get('X-Timestamp');

      const skipVerify = env.DIDIT_SKIP_WEBHOOK_VERIFY === 'true'; // reuse skip flag for dev

      if (!skipVerify && (!signature || !timestamp)) {
        logger.error('Didit webhook: Missing signature or timestamp headers');
        res.status(401).json({
          error: 'Missing signature or timestamp',
          message: 'Webhook headers are missing',
        });
        return;
      }

      const jsonBody = req.body;
      logger.info('Didit webhook received', {
        webhook_type: jsonBody?.webhook_type,
        session_id: jsonBody?.session_id,
        status: jsonBody?.status,
        hasSignature: !!signature,
        hasTimestamp: !!timestamp,
        skipVerify,
      });

      if (!skipVerify) {
        const isValid = webhookService.verifyDiditSignature(jsonBody, signature!, timestamp!);

        if (!isValid) {
          logger.error('Invalid Didit webhook signature V2', { signaturePreview: signature?.substring(0, 20) });
          res.status(401).json({
            error: 'Invalid signature',
            message: 'Webhook signature verification failed',
          });
          return;
        }
      }

      res.status(200).json({ success: true, message: 'Webhook received' });

      setImmediate(() => {
        webhookService.handleDiditWebhook(jsonBody).catch((err: any) => {
          logger.error('Didit webhook async processing failed', { error: err, type: jsonBody?.type });
        });
      });
    } catch (error) {
      logger.error('Didit webhook endpoint error', { error });
      res.status(500).json({
        error: 'Failed to process webhook',
      });
    }
  }

  async handlePaycrestWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-paycrest-signature'] as string;
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      // In a real scenario, we would verify the HMAC signature here
      // const isValid = verifySignature(rawBody, signature, env.PAYCREST_API_SECRET);

      const payload = req.body;
      const { event, data } = payload;

      logger.info('Received Paycrest Webhook', { event, orderId: data?.id });

      res.status(200).json({ success: true });

      setImmediate(async () => {
        try {
          if (event === 'payment_order.settled' || event === 'payment_order.validated') {
            const orderId = data.id;
            const metadata = data.metadata || {};

            if (metadata.type === 'invoice_onramp' && metadata.invoiceId) {
              // Mark invoice as paid
              await invoiceService.updateInvoiceStatus({
                invoiceId: BigInt(metadata.invoiceId),
                status: 'paid',
                paidAt: new Date(),
                txHash: data.txHash || orderId,
                amountPaid: data.amount,
                amountPaidUsd: data.amountUSD
              });
              logger.info('Invoice marked as paid via Paycrest', { invoiceId: metadata.invoiceId });
            }

            if (metadata.type === 'withdrawal') {
              // Confirm withdrawal transaction
              await transactionService.updateTransactionByBlockradarRef(
                orderId,
                'success',
                { hash: data.txHash }
              );
              logger.info('Withdrawal confirmed via Paycrest', { orderId });
            }
          }
        } catch (err) {
          logger.error('Failed to process Paycrest webhook async', { error: err, payload });
        }
      });
    } catch (error) {
      logger.error('Paycrest Webhook processing error', { error });
      res.status(500).json({ success: false });
    }
  }
}

export const webhookController = new WebhookController();
