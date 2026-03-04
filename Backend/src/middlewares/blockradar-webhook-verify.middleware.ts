import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { webhookService } from '../services/webhook.service';
import { logger } from '../utils/logger';

/**
 * Verifies x-blockradar-signature for webhook routes that use parsed JSON body
 * (e.g. /blockradar/transfer, /blockradar/contract, /blockradar/payment-link).
 * Use only after express.json() so req.body is set.
 */
export function verifyBlockradarSignature(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (env.BLOCKRADAR_SKIP_WEBHOOK_VERIFY === 'true') {
    next();
    return;
  }
  const signature = req.headers['x-blockradar-signature'] as string;
  if (!signature) {
    res.status(401).json({
      error: 'Missing signature',
      message: 'Webhook signature is required',
    });
    return;
  }
  const payload = typeof req.body === 'object' && req.body !== null
    ? JSON.stringify(req.body)
    : '';
  const isValid = webhookService.verifyWebhookSignature(payload, signature);
  if (!isValid) {
    logger.error('Invalid webhook signature on sub-route', {
      path: req.path,
      signatureLen: signature?.length,
    });
    res.status(401).json({
      error: 'Invalid signature',
      message: 'Webhook signature verification failed',
    });
    return;
  }
  next();
}
