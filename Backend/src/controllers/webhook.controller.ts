import { Request, Response } from 'express';
import { env } from '../config/env';
import { webhookService } from '../services/webhook.service';
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
        await webhookService.handleWebhook((req as any).body ?? req.body);
        res.status(200).json({ success: true, message: 'Webhook received' });
        return;
      }

      const rawBody = (req as any).rawBody ?? '';
      const body = (req as any).body ?? req.body ?? {};
      // Blockradar docs: PHP/Python use raw body; JS example uses JSON.stringify(req.body). Try both.
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

      await webhookService.handleWebhook((req as any).body ?? req.body);

            res.status(200).json({
        success: true,
        message: 'Webhook received',
      });
    } catch (error) {
      logger.error('Webhook processing error', { error });

                  res.status(200).json({
        success: false,
        message: 'Webhook processing failed',
      });
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
}

export const webhookController = new WebhookController();
