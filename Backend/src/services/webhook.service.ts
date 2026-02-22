import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { blockradarService } from './blockradar.service';
import { invoiceService } from './invoice.service';
import { transactionService } from './transaction.service';
import { contractService } from './contract.service';
import { userService } from './user.service';
import { emailService } from './email.service';

export interface BlockradarWebhookEvent {
  event: 'custom-smart-contract.success' | 'custom-smart-contract.failed' | 'transfer.success' | 'transfer.failed' | 'deposit.success' | 'deposit.failed' | 'swap.success' | 'swap.failed';
  data: {
    id: string;
    hash?: string;
    status: 'SUCCESS' | 'FAILED' | 'PENDING';
    method?: string;
    contractAddress?: string;
    blockchain?: {
      name: string;
      network: string;
    };
    reference?: string;
    metadata?: Record<string, unknown>;
    error?: string;
    amount?: string;
    amountUSD?: string;
    senderAddress?: string;
    recipientAddress?: string;
    tokenAddress?: string;
    paymentLink?: {
      id: string;
      name: string;
      slug: string;
      metadata?: Record<string, any>;
    };
    type?: 'SWAP' | 'BRIDGE';
    fromAsset?: {
      symbol: string;
      amount: string;
      blockchain: string;
      hash?: string;
    };
    toAsset?: {
      symbol: string;
      amount: string;
      blockchain: string;
      hash?: string;
    };
    completedAt?: string;
  };
}

export class WebhookService {
  
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', env.BLOCKRADAR_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      logger.error('Webhook signature verification failed', { error });
      return false;
    }
  }

  async handleWebhook(event: BlockradarWebhookEvent): Promise<void> {
    try {
      logger.info('Processing Blockradar webhook', {
        event: event.event,
        txHash: event.data.hash,
        status: event.data.status,
        reference: event.data.reference,
      });

      switch (event.event) {
        case 'custom-smart-contract.success':
          await this.handleContractSuccess(event);
          break;

        case 'custom-smart-contract.failed':
          await this.handleContractFailure(event);
          break;

        case 'transfer.success':
          await this.handleTransferSuccess(event);
          break;

        case 'transfer.failed':
          await this.handleTransferFailure(event);
          break;

        case 'deposit.success':
          await this.handleDepositSuccess(event);
          break;

        case 'deposit.failed':
          await this.handleDepositFailure(event);
          break;

        case 'swap.success':
          await this.handleSwapSuccess(event);
          break;

        case 'swap.failed':
          await this.handleSwapFailure(event);
          break;

        default:
          logger.warn('Unknown webhook event type', { event: event.event });
      }
    } catch (error) {
      logger.error('Failed to process webhook', { error, event });
      throw error;
    }
  }

  private async handleContractSuccess(event: BlockradarWebhookEvent): Promise<void> {
    const { reference, metadata, method } = event.data;

        if (metadata?.type) {
      switch (metadata.type) {
        case 'invoice_creation':
          await this.handleInvoiceCreationSuccess(event);
          break;

        case 'invoice_funding':
          await this.handleInvoiceFundingSuccess(event);
          break;

        case 'delivery_submission':
          await this.handleDeliverySubmissionSuccess(event);
          break;

        case 'delivery_confirmation':
          await this.handleDeliveryConfirmationSuccess(event);
          break;

        default:
          logger.info('Contract operation successful', { method, reference });
      }
    }

          }

  private async handleContractFailure(event: BlockradarWebhookEvent): Promise<void> {
    const { reference, metadata, error } = event.data;

    logger.error('Contract operation failed', {
      reference,
      error,
      metadata,
    });

        if (metadata?.retryable) {
      await this.scheduleRetry(event);
    }
  }

  private async handleInvoiceCreationSuccess(event: BlockradarWebhookEvent): Promise<void> {
    const { hash, metadata } = event.data;

    logger.info('Invoice created successfully', {
      txHash: hash,
      userId: metadata?.userId,
      invoiceId: metadata?.invoiceId,
    });

    if (metadata?.invoiceId && metadata?.userId) {
      try {
        // Update transaction status
        await transactionService.updateTransactionStatus(
          hash || '',
          'success',
          { blockradarReference: event.data.id }
        );

        logger.info('Invoice creation transaction updated', {
          invoiceId: metadata.invoiceId,
          txHash: hash,
        });
      } catch (error) {
        logger.error('Failed to update invoice creation transaction', { error, metadata });
      }
    }
  }

  private async handleInvoiceFundingSuccess(event: BlockradarWebhookEvent): Promise<void> {
    const { hash, metadata } = event.data;

    logger.info('Invoice funded successfully', {
      txHash: hash,
      invoiceId: metadata?.invoiceId,
    });

    if (metadata?.invoiceId && hash) {
      try {
        // Update transaction status
        await transactionService.updateTransactionStatus(
          hash,
          'success',
          { blockradarReference: event.data.id }
        );

        logger.info('Invoice funding transaction updated', {
          invoiceId: metadata.invoiceId,
          txHash: hash,
        });
      } catch (error) {
        logger.error('Failed to update invoice funding transaction', { error, metadata });
      }
    }
  }

  private async handleDeliverySubmissionSuccess(event: BlockradarWebhookEvent): Promise<void> {
    const { hash, metadata } = event.data;

    logger.info('Delivery submitted successfully', {
      txHash: hash,
      invoiceId: metadata?.invoiceId,
    });

    if (metadata?.invoiceId && hash) {
      try {
        // Update transaction status
        await transactionService.updateTransactionStatus(
          hash,
          'success',
          { blockradarReference: event.data.id }
        );

        logger.info('Delivery submission transaction updated', {
          invoiceId: metadata.invoiceId,
          txHash: hash,
        });
      } catch (error) {
        logger.error('Failed to update delivery submission transaction', { error, metadata });
      }
    }
  }

  private async handleDeliveryConfirmationSuccess(event: BlockradarWebhookEvent): Promise<void> {
    const { hash, metadata } = event.data;

    logger.info('Delivery confirmed successfully', {
      txHash: hash,
      invoiceId: metadata?.invoiceId,
    });

    if (metadata?.invoiceId && hash) {
      try {
        // Update transaction status
        await transactionService.updateTransactionStatus(
          hash,
          'success',
          { blockradarReference: event.data.id }
        );

        logger.info('Delivery confirmation transaction updated', {
          invoiceId: metadata.invoiceId,
          txHash: hash,
        });
      } catch (error) {
        logger.error('Failed to update delivery confirmation transaction', { error, metadata });
      }
    }
  }

  private async handleTransferSuccess(event: BlockradarWebhookEvent): Promise<void> {
    const { reference, metadata, hash } = event.data;

    logger.info('Transfer successful', {
      txHash: hash,
      reference,
      metadata,
    });

        if (metadata?.type === 'fund_release') {
      await this.handleFundReleaseSuccess(event);
    }
  }

  private async handleTransferFailure(event: BlockradarWebhookEvent): Promise<void> {
    const { reference, error, metadata, hash } = event.data;

    logger.error('Transfer failed', {
      reference,
      error,
      metadata,
      hash,
    });

    if (hash) {
      try {
        // Update transaction status to failed
        await transactionService.updateTransactionStatus(
          hash,
          'failed',
          { error, blockradarReference: event.data.id }
        );

        logger.info('Transfer failure recorded', { txHash: hash });
      } catch (updateError) {
        logger.error('Failed to update failed transfer', { error: updateError, hash });
      }
    }
  }

  private async handleFundReleaseSuccess(event: BlockradarWebhookEvent): Promise<void> {
    const { hash, metadata } = event.data;

    logger.info('Funds released successfully', {
      txHash: hash,
      invoiceId: metadata?.invoiceId,
      receiver: metadata?.receiver,
    });

    if (hash) {
      try {
        // Update transaction status
        await transactionService.updateTransactionStatus(
          hash,
          'success',
          { blockradarReference: event.data.id }
        );

        logger.info('Fund release transaction updated', {
          invoiceId: metadata?.invoiceId,
          txHash: hash,
        });
      } catch (error) {
        logger.error('Failed to update fund release transaction', { error, metadata });
      }
    }
  }

  private async scheduleRetry(event: BlockradarWebhookEvent): Promise<void> {
    logger.info('Scheduling retry for failed operation', {
      reference: event.data.reference,
    });

                              }

  private async handleDepositSuccess(event: BlockradarWebhookEvent): Promise<void> {
    const { hash, reference, amount, amountUSD, paymentLink, metadata, senderAddress } = event.data;

    logger.info('Payment link deposit received', {
      txHash: hash,
      reference,
      amount,
      amountUSD,
      paymentLinkId: paymentLink?.id,
      paymentLinkMetadata: paymentLink?.metadata,
      senderAddress,
    });

    const invoiceReference = paymentLink?.metadata?.invoiceReference || metadata?.invoiceReference;

    if (!invoiceReference) {
      logger.warn('Deposit success webhook missing invoice reference', { event });
      return;
    }

    logger.info('Auto-funding invoice from payment link', {
      invoiceReference,
      amount: amountUSD,
      txHash: hash,
    });

    try {
      const invoiceId = BigInt(invoiceReference);
      
      // Get invoice details
      const invoice = await contractService.getInvoice(invoiceId);
      const txHash = hash || reference || `payment-link-${event.data.id}`;

      // Payment link deposit = payment received; update DB so invoice shows as paid (no on-chain InvoiceFunded for this path)
      await invoiceService.updateInvoiceStatus({
        invoiceId,
        status: 'paid',
        paidAt: new Date(),
        txHash,
      });

      // Log the deposit transaction
      await transactionService.logTransaction({
        invoiceId,
        txType: 'invoice_fund',
        txHash,
        status: 'success',
        amount: amount,
        tokenAddress: invoice.tokenAddress,
        fromAddress: senderAddress,
        blockradarReference: event.data.id,
        metadata: {
          type: 'payment_link_deposit',
          paymentLinkId: paymentLink?.id,
          amountUSD,
        },
      });

      logger.info('Payment link deposit processed', {
        invoiceId: invoiceId.toString(),
        txHash: hash,
      });

      // Send email notification to invoice issuer
      const issuerUser = await userService.getUserByWalletAddress(invoice.issuer);
      if (issuerUser) {
        await emailService.notifyDepositReceived(issuerUser.email, {
          amount: `${(Number(amount) / 1e18).toFixed(4)} ${invoice.tokenAddress === '0x0000000000000000000000000000000000000000' ? 'ETH' : 'Tokens'}`,
          amountUSD: amountUSD,
          token: invoice.tokenAddress === '0x0000000000000000000000000000000000000000' ? 'ETH' : 'Token',
        });
      }

    } catch (error) {
      logger.error('Failed to process payment link deposit', { 
        error, 
        invoiceReference,
        event,
      });
    }
  }

  private async handleDepositFailure(event: BlockradarWebhookEvent): Promise<void> {
    const { hash, reference, error, paymentLink } = event.data;

    logger.error('Payment link deposit failed', {
      txHash: hash,
      reference,
      error,
      paymentLinkId: paymentLink?.id,
    });

  }

  private async handleSwapSuccess(event: BlockradarWebhookEvent): Promise<void> {
    const { id, fromAsset, toAsset, reference, metadata, type, completedAt } = event.data;

    logger.info('Swap completed successfully', {
      swapId: id,
      type,
      fromAsset: `${fromAsset?.amount} ${fromAsset?.symbol} on ${fromAsset?.blockchain}`,
      toAsset: `${toAsset?.amount} ${toAsset?.symbol} on ${toAsset?.blockchain}`,
      reference,
      completedAt,
    });

    if (metadata?.userId && typeof metadata.userId === 'string') {
      try {
        // Log swap transaction
        await transactionService.logTransaction({
          userId: metadata.userId,
          txType: 'transfer',
          txHash: fromAsset?.hash || toAsset?.hash || reference || `swap-${id}`,
          status: 'success',
          amount: toAsset?.amount,
          fromAddress: fromAsset?.blockchain,
          toAddress: toAsset?.blockchain,
          blockradarReference: id,
          metadata: {
            type: 'swap',
            swapType: type,
            fromAsset: {
              symbol: fromAsset?.symbol,
              amount: fromAsset?.amount,
              blockchain: fromAsset?.blockchain,
            },
            toAsset: {
              symbol: toAsset?.symbol,
              amount: toAsset?.amount,
              blockchain: toAsset?.blockchain,
            },
            completedAt,
          },
        });

        logger.info('Swap transaction logged', {
          userId: metadata.userId,
          swapId: id,
        });
      } catch (error) {
        logger.error('Failed to log swap transaction', { error, metadata });
      }
    }
  }

  private async handleSwapFailure(event: BlockradarWebhookEvent): Promise<void> {
    const { id, reference, error, metadata, fromAsset, toAsset } = event.data;

    logger.error('Swap failed', {
      swapId: id,
      reference,
      error,
      fromAsset: `${fromAsset?.symbol} on ${fromAsset?.blockchain}`,
      toAsset: `${toAsset?.symbol} on ${toAsset?.blockchain}`,
    });

    if (metadata?.userId) {
      logger.error('Swap failed for user', {
        userId: metadata.userId,
        swapId: id,
        error,
      });
    }

  }

  async getTransactionStatus(txId: string): Promise<any> {
    try {
      return await blockradarService.getTransactionStatus(txId);
    } catch (error) {
      logger.error('Failed to get transaction status', { error, txId });
      throw error;
    }
  }
}

export const webhookService = new WebhookService();
