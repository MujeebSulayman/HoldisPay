import { createPublicClient, http, parseAbiItem, Log, Address } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { contractService } from './contract.service';
import { blockradarService } from './blockradar.service';
import { gasManagerService } from './gas-manager.service';
import { invoiceService } from './invoice.service';
import { transactionService } from './transaction.service';
import { userService } from './user.service';
import { emailService } from './email.service';
import { InvoiceStatus } from '../types/contract';

export class EventListenerService {
  private publicClient: ReturnType<typeof createPublicClient>;
  private contractAddress: Address;
  private isListening: boolean = false;
  private lastProcessedBlock: bigint = 0n;

  constructor() {
    this.contractAddress = env.HOLDIS_CONTRACT_ADDRESS as Address;
    const chain = env.CHAIN_ID === 8453 ? base : baseSepolia;

    
    this.publicClient = createPublicClient({
      chain,
      transport: http(env.RPC_URL),
    }) as ReturnType<typeof createPublicClient>;
  }

  async start(): Promise<void> {
    if (this.isListening) {
      logger.warn('Event listener already running');
      return;
    }

    logger.info('Starting contract event listener');
    this.isListening = true;

    try {
      const { syncService } = await import('./sync.service');
      const savedBlock = await syncService.getLastProcessedBlock();
      const currentBlock = await contractService.getBlockNumber();
      
      // If we have a saved block, start from there, otherwise start from current - 100 as safety
      this.lastProcessedBlock = savedBlock > 0n ? savedBlock : currentBlock - 100n;

      logger.info('Event listener initialized', {
        startBlock: this.lastProcessedBlock.toString(),
        currentBlock: currentBlock.toString(),
      });

      // Unified processing loop
      contractService.watchBlocks(async (blockNumber) => {
        if (!this.isListening) return;
        
        const fromBlock = this.lastProcessedBlock + 1n;
        const toBlock = blockNumber;

        if (fromBlock <= toBlock) {
          await this.processBlockEvents(fromBlock, toBlock);
          this.lastProcessedBlock = toBlock;
          await syncService.updateLastProcessedBlock(toBlock);
        }
      });

    } catch (error) {
      logger.error('Failed to start event listener', { error });
      this.isListening = false;
      throw error;
    }
  }

  stop(): void {
    this.isListening = false;
    logger.info('Event listener stopped');
  }

  private async processBlockEvents(fromBlock: bigint, toBlock: bigint): Promise<void> {
    if (fromBlock > toBlock) return;

    try {
      logger.debug('Processing block events', {
        fromBlock: fromBlock.toString(),
        toBlock: toBlock.toString(),
      });

      const events = [
        'InvoiceCreated',
        'InvoiceFunded',
        'DeliverySubmitted',
        'DeliveryConfirmed',
        'InvoiceCompleted',
        'InvoiceCancelled',
      ];

      for (const eventName of events) {
        const logs = await contractService.getLogs(eventName, fromBlock, toBlock);

        for (const log of logs) {
          await this.processEvent(eventName, log);
        }
      }
    } catch (error) {
      logger.error('Failed to process block events', { error, fromBlock, toBlock });
    }
  }

  private async processEvent(eventName: string, log: Log): Promise<void> {
    try {
      logger.info('Processing event', {
        eventName,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
      });

      switch (eventName) {
        case 'InvoiceCreated':
          await this.handleInvoiceCreated(log);
          break;
        case 'InvoiceFunded':
          await this.handleInvoiceFunded(log);
          break;
        case 'DeliverySubmitted':
          await this.handleDeliverySubmitted(log);
          break;
        case 'DeliveryConfirmed':
          await this.handleDeliveryConfirmed(log);
          break;
        case 'InvoiceCompleted':
          await this.handleInvoiceCompleted(log);
          break;
        case 'InvoiceCancelled':
          await this.handleInvoiceCancelled(log);
          break;
      }
    } catch (error) {
      logger.error('Failed to process event', { error, eventName, log });
    }
  }

  private async handleInvoiceCreated(log: Log): Promise<void> {
    try {
      const { args, transactionHash } = log as any;
      const { invoiceId, issuer, payer, receiver, amount, token, requiresDelivery } = args;

      logger.info('Invoice created', {
        invoiceId: invoiceId.toString(),
        issuer,
        payer,
        receiver,
        amount: amount.toString(),
        token,
        requiresDelivery,
        txHash: transactionHash,
      });

      const invoice = await contractService.getInvoice(invoiceId);
      const issuerUser = await userService.getUserByWalletAddress(issuer);
      const issuerId = issuerUser?.id || 'unknown';

      await invoiceService.createInvoice({
        invoiceId,
        issuerId,
        payerAddress: payer,
        receiverAddress: receiver,
        amount: amount.toString(),
        tokenAddress: token,
        requiresDelivery,
        description: invoice.description,
        attachmentHash: invoice.attachmentHash,
        txHash: transactionHash,
      });

      await transactionService.logTransaction({
        userId: issuerId !== 'unknown' ? issuerId : undefined,
        invoiceId,
        txType: 'invoice_create',
        txHash: transactionHash,
        status: 'success',
        amount: amount.toString(),
        tokenAddress: token,
        fromAddress: issuer,
        chainId: 'base',
        metadata: { payer, receiver, requiresDelivery, source: 'on_chain' },
      });

      if (issuerUser) {
        const amountInEth = (Number(amount) / 1e18).toFixed(4);
        await emailService.notifyInvoiceCreated(issuerUser.email, {
          invoiceId: invoiceId.toString(),
          amount: `${amountInEth} ETH`,
          description: invoice.description,
        });
      }
    } catch (error) {
      logger.error('Failed to handle InvoiceCreated event', { error, log });
    }
  }

  private async handleInvoiceFunded(log: Log): Promise<void> {
    try {
      const { args, transactionHash } = log as any;
      const { invoiceId, payer, amount } = args;

      logger.info('Invoice funded', {
        invoiceId: invoiceId.toString(),
        payer,
        amount: amount.toString(),
        txHash: transactionHash,
      });

      const invoice = await contractService.getInvoice(invoiceId);

      await invoiceService.updateInvoiceStatus({
        invoiceId,
        status: 'funded',
        fundedAt: new Date(),
        txHash: transactionHash,
      });

      const payerUser = await userService.getUserByWalletAddress(payer);
      await transactionService.logTransaction({
        userId: payerUser?.id,
        invoiceId,
        txType: 'invoice_fund',
        txHash: transactionHash,
        status: 'success',
        amount: amount.toString(),
        tokenAddress: invoice.tokenAddress,
        fromAddress: payer,
        chainId: 'base',
        metadata: { invoiceId: invoiceId.toString(), source: 'on_chain' },
      });

      await blockradarService.holdFunds({
        walletAddress: payer,
        amount: amount.toString(),
        token: invoice.tokenAddress,
        invoiceId: invoiceId.toString(),
      });

      const issuerUser = await userService.getUserByWalletAddress(invoice.issuer);
      if (issuerUser) {
        const amountInEth = (Number(amount) / 1e18).toFixed(4);
        await emailService.notifyInvoiceFunded(issuerUser.email, {
          invoiceId: invoiceId.toString(),
          amount: `${amountInEth} ETH`,
          payer: payer,
        });
      }
    } catch (error) {
      logger.error('Failed to handle InvoiceFunded event', { error, log });
    }
  }

  private async handleDeliverySubmitted(log: Log): Promise<void> {
    try {
      const { args, transactionHash } = log as any;
      const { invoiceId, issuer, proofHash } = args;

      logger.info('Delivery submitted', {
        invoiceId: invoiceId.toString(),
        issuer,
        proofHash,
        txHash: transactionHash,
      });

      await invoiceService.updateInvoiceStatus({
        invoiceId,
        status: 'delivered',
        deliveredAt: new Date(),
        txHash: transactionHash,
      });

      const issuerUser = await userService.getUserByWalletAddress(issuer);
      await transactionService.logTransaction({
        userId: issuerUser?.id,
        invoiceId,
        txType: 'delivery_submit',
        txHash: transactionHash,
        status: 'success',
        fromAddress: issuer,
        chainId: 'base',
        metadata: { proofHash, source: 'on_chain' },
      });

      const invoice = await contractService.getInvoice(invoiceId);
      const receiverUser = await userService.getUserByWalletAddress(invoice.receiver);
      if (receiverUser) {
        await emailService.notifyDeliverySubmitted(receiverUser.email, {
          invoiceId: invoiceId.toString(),
          issuer: issuer,
        });
      }
    } catch (error) {
      logger.error('Failed to handle DeliverySubmitted event', { error, log });
    }
  }

  private async handleDeliveryConfirmed(log: Log): Promise<void> {
    try {
      const { args, transactionHash } = log as any;
      const { invoiceId, receiver } = args;

      logger.info('Delivery confirmed', {
        invoiceId: invoiceId.toString(),
        receiver,
        txHash: transactionHash,
      });

      const receiverUser = await userService.getUserByWalletAddress(receiver);
      await transactionService.logTransaction({
        userId: receiverUser?.id,
        invoiceId,
        txType: 'delivery_confirm',
        txHash: transactionHash,
        status: 'success',
        fromAddress: receiver,
        chainId: 'base',
        metadata: { invoiceId: invoiceId.toString(), source: 'on_chain' },
      });
    } catch (error) {
      logger.error('Failed to handle DeliveryConfirmed event', { error, log });
    }
  }

  private async handleInvoiceCompleted(log: Log): Promise<void> {
    try {
      const { args, transactionHash } = log as any;
      const { invoiceId, platformFeeCollected } = args;

      logger.info('Invoice completed', {
        invoiceId: invoiceId.toString(),
        platformFeeCollected: platformFeeCollected.toString(),
        txHash: transactionHash,
      });

      const invoice = await contractService.getInvoice(invoiceId);

      await invoiceService.updateInvoiceStatus({
        invoiceId,
        status: 'completed',
        completedAt: new Date(),
        txHash: transactionHash,
      });

      const gasCheck = await gasManagerService.checkGasBalance();
      if (!gasCheck.hasEnough) {
        throw new Error(`Insufficient gas balance to process invoice ${invoiceId}`);
      }

      const { receiverTransfer, platformFeeTransfer } = await blockradarService.releaseFunds({
        invoiceId: invoiceId.toString(),
        toAddress: invoice.receiver,
        amount: invoice.amount.toString(),
        token: invoice.tokenAddress,
        platformFee: platformFeeCollected.toString(),
      });

      const receiverUser = await userService.getUserByWalletAddress(invoice.receiver);
      await transactionService.logTransaction({
        userId: receiverUser?.id,
        invoiceId,
        txType: 'transfer',
        txHash: receiverTransfer.hash,
        status: 'success',
        amount: (invoice.amount - platformFeeCollected).toString(),
        tokenAddress: invoice.tokenAddress,
        toAddress: invoice.receiver,
        blockradarReference: receiverTransfer.id,
        chainId: 'base',
        metadata: { type: 'receiver_payment', invoiceId: invoiceId.toString(), source: 'on_chain' },
      });

      const issuerUser = await userService.getUserByWalletAddress(invoice.issuer);
      if (issuerUser) {
        await emailService.notifyInvoiceCompleted(issuerUser.email, {
          invoiceId: invoiceId.toString(),
          amount: `${(Number(invoice.amount) / 1e18).toFixed(4)} ETH`,
          receiver: invoice.receiver,
        });
      }
    } catch (error) {
      logger.error('Failed to handle InvoiceCompleted event', { error, log });
    }
  }

  private async handleInvoiceCancelled(log: Log): Promise<void> {
    try {
      const { args, transactionHash } = log as any;
      const { invoiceId, cancelledBy, reason } = args;

      logger.info('Invoice cancelled', {
        invoiceId: invoiceId.toString(),
        cancelledBy,
        reason,
        txHash: transactionHash,
      });

      const invoice = await contractService.getInvoice(invoiceId);

      
      await invoiceService.updateInvoiceStatus({
        invoiceId,
        status: 'cancelled',
        txHash: transactionHash,
      });

      
      const cancelledByUser = await userService.getUserByWalletAddress(cancelledBy);
      await transactionService.logTransaction({
        userId: cancelledByUser?.id,
        invoiceId,
        txType: 'invoice_fund',
        txHash: transactionHash,
        status: 'failed',
        fromAddress: cancelledBy,
        chainId: 'base',
        metadata: {
          reason,
          cancelledBy,
          source: 'on_chain',
        },
      });

      
      if (invoice.status === InvoiceStatus.Cancelled && invoice.fundedAt > 0n) {
        const refundTx = await blockradarService.refundFunds(
          invoiceId.toString(),
          invoice.payer,
          invoice.amount.toString(),
          invoice.tokenAddress
        );

        
        const payerUser = await userService.getUserByWalletAddress(invoice.payer);
        await transactionService.logTransaction({
          userId: payerUser?.id,
          invoiceId,
          txType: 'transfer',
          txHash: refundTx.hash,
          status: 'success',
          amount: invoice.amount.toString(),
          tokenAddress: invoice.tokenAddress,
          toAddress: invoice.payer,
          blockradarReference: refundTx.id,
          chainId: 'base',
          metadata: {
            type: 'refund',
            reason,
            source: 'on_chain',
          },
        });

        logger.info('Refund processed', { 
          invoiceId: invoiceId.toString(),
          refundTxHash: refundTx.hash,
        });
      }

      
      const issuerUser = await userService.getUserByWalletAddress(invoice.issuer);
      if (issuerUser) {
        await emailService.notifyInvoiceCancelled(issuerUser.email, {
          invoiceId: invoiceId.toString(),
          reason: reason,
        });
      }

      const payerUser = await userService.getUserByWalletAddress(invoice.payer);
      if (payerUser) {
        await emailService.notifyInvoiceCancelled(payerUser.email, {
          invoiceId: invoiceId.toString(),
          reason: reason,
        });
      }

    } catch (error) {
      logger.error('Failed to handle InvoiceCancelled event', { error, log });
    }
  }

  getStatus(): { isListening: boolean; lastProcessedBlock: string } {
    return {
      isListening: this.isListening,
      lastProcessedBlock: this.lastProcessedBlock.toString(),
    };
  }
}

export const eventListenerService = new EventListenerService();
