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

    // @ts-ignore - Base chain type mismatch with viem
    this.publicClient = createPublicClient({
      chain,
      transport: http(env.RPC_URL),
    });
  }

  async start(): Promise<void> {
    if (this.isListening) {
      logger.warn('Event listener already running');
      return;
    }

    logger.info('Starting contract event listener');
    this.isListening = true;

    try {
      this.lastProcessedBlock = await contractService.getBlockNumber();
      logger.info('Event listener initialized', {
        startBlock: this.lastProcessedBlock.toString(),
      });

      contractService.watchBlocks(async (blockNumber) => {
        await this.processBlockEvents(this.lastProcessedBlock + 1n, blockNumber);
        this.lastProcessedBlock = blockNumber;
      });

      this.watchInvoiceCreated();
      this.watchInvoiceFunded();
      this.watchDeliverySubmitted();
      this.watchDeliveryConfirmed();
      this.watchInvoiceCompleted();
      this.watchInvoiceCancelled();

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

  private watchInvoiceCreated(): void {
    this.publicClient.watchContractEvent({
      address: this.contractAddress,
      abi: [parseAbiItem('event InvoiceCreated(uint256 indexed invoiceId, address indexed issuer, address indexed payer, address receiver, uint256 amount, address token, bool requiresDelivery, uint256 timestamp)')],
      eventName: 'InvoiceCreated',
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.handleInvoiceCreated(log);
        }
      },
    });
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

      // Get full invoice details from contract
      const invoice = await contractService.getInvoice(invoiceId);

      // Find issuer user ID by wallet address
      const issuerUser = await userService.getUserByWalletAddress(issuer);
      const issuerId = issuerUser?.id || 'unknown';

      // Store invoice in database
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

      // Log transaction (on-chain listener is Base/Base Sepolia)
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
        metadata: {
          payer,
          receiver,
          requiresDelivery,
          source: 'on_chain',
        },
      });

      logger.info('Invoice stored in database', { invoiceId: invoiceId.toString() });

      // Send email notification to payer
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

  private watchInvoiceFunded(): void {
    this.publicClient.watchContractEvent({
      address: this.contractAddress,
      abi: [parseAbiItem('event InvoiceFunded(uint256 indexed invoiceId, address indexed payer, uint256 amount, uint256 timestamp)')],
      eventName: 'InvoiceFunded',
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.handleInvoiceFunded(log);
        }
      },
    });
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

      // Update invoice status in database
      await invoiceService.updateInvoiceStatus({
        invoiceId,
        status: 'funded',
        fundedAt: new Date(),
        txHash: transactionHash,
      });

      // Log transaction (on-chain listener is Base/Base Sepolia)
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
        metadata: {
          invoiceId: invoiceId.toString(),
          source: 'on_chain',
        },
      });

      // Hold funds in custodial wallet
      await blockradarService.holdFunds({
        walletAddress: payer,
        amount: amount.toString(),
        token: invoice.tokenAddress,
        invoiceId: invoiceId.toString(),
      });

      logger.info('Invoice funding processed', { invoiceId: invoiceId.toString() });

      // Send email notification to issuer
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

  private watchDeliverySubmitted(): void {
    this.publicClient.watchContractEvent({
      address: this.contractAddress,
      abi: [parseAbiItem('event DeliverySubmitted(uint256 indexed invoiceId, address indexed issuer, string proofHash, uint256 timestamp)')],
      eventName: 'DeliverySubmitted',
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.handleDeliverySubmitted(log);
        }
      },
    });
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

      // Update invoice status in database
      await invoiceService.updateInvoiceStatus({
        invoiceId,
        status: 'delivered',
        deliveredAt: new Date(),
        txHash: transactionHash,
      });

      // Log transaction (on-chain listener is Base/Base Sepolia)
      const issuerUser = await userService.getUserByWalletAddress(issuer);
      await transactionService.logTransaction({
        userId: issuerUser?.id,
        invoiceId,
        txType: 'delivery_submit',
        txHash: transactionHash,
        status: 'success',
        fromAddress: issuer,
        chainId: 'base',
        metadata: {
          proofHash,
          source: 'on_chain',
        },
      });

      logger.info('Delivery submission processed', { invoiceId: invoiceId.toString() });

      // Send email notification to receiver
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

  private watchDeliveryConfirmed(): void {
    this.publicClient.watchContractEvent({
      address: this.contractAddress,
      abi: [parseAbiItem('event DeliveryConfirmed(uint256 indexed invoiceId, address indexed receiver, uint256 timestamp)')],
      eventName: 'DeliveryConfirmed',
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.handleDeliveryConfirmed(log);
        }
      },
    });
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

      // Log transaction (on-chain listener is Base/Base Sepolia)
      const receiverUser = await userService.getUserByWalletAddress(receiver);
      await transactionService.logTransaction({
        userId: receiverUser?.id,
        invoiceId,
        txType: 'delivery_confirm',
        txHash: transactionHash,
        status: 'success',
        fromAddress: receiver,
        chainId: 'base',
        metadata: {
          invoiceId: invoiceId.toString(),
          source: 'on_chain',
        },
      });

      logger.info('Delivery confirmation processed', { invoiceId: invoiceId.toString() });

    } catch (error) {
      logger.error('Failed to handle DeliveryConfirmed event', { error, log });
    }
  }

  private watchInvoiceCompleted(): void {
    this.publicClient.watchContractEvent({
      address: this.contractAddress,
      abi: [parseAbiItem('event InvoiceCompleted(uint256 indexed invoiceId, uint256 platformFeeCollected, uint256 timestamp)')],
      eventName: 'InvoiceCompleted',
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.handleInvoiceCompleted(log);
        }
      },
    });
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

      // Update invoice status in database
      await invoiceService.updateInvoiceStatus({
        invoiceId,
        status: 'completed',
        completedAt: new Date(),
        txHash: transactionHash,
      });

      const gasCheck = await gasManagerService.checkGasBalance();
      if (!gasCheck.hasEnough) {
        const errorMsg = `Insufficient gas balance to process invoice ${invoiceId}. Current balance: ${gasCheck.nativeBalance} ETH`;
        logger.error(errorMsg, {
          invoiceId: invoiceId.toString(),
          nativeBalance: gasCheck.nativeBalance,
          nativeBalanceInUSD: gasCheck.nativeBalanceInUSD,
        });

        throw new Error(errorMsg);
      }

      logger.info('Gas balance check passed', {
        invoiceId: invoiceId.toString(),
        nativeBalance: gasCheck.nativeBalance,
      });

      const { receiverTransfer, platformFeeTransfer } = await blockradarService.releaseFunds({
        invoiceId: invoiceId.toString(),
        toAddress: invoice.receiver,
        amount: invoice.amount.toString(),
        token: invoice.tokenAddress,
        platformFee: platformFeeCollected.toString(),
      });

      // Log fund release transactions (on-chain + Blockradar; chain = base for listener context)
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
        metadata: {
          type: 'receiver_payment',
          invoiceId: invoiceId.toString(),
          source: 'on_chain',
        },
      });

      await transactionService.logTransaction({
        invoiceId,
        txType: 'transfer',
        txHash: platformFeeTransfer.hash,
        status: 'success',
        amount: platformFeeCollected.toString(),
        tokenAddress: invoice.tokenAddress,
        toAddress: env.PLATFORM_WALLET_ADDRESS,
        blockradarReference: platformFeeTransfer.id,
        chainId: 'base',
        metadata: {
          type: 'platform_fee',
          invoiceId: invoiceId.toString(),
          source: 'on_chain',
        },
      });

      logger.info('Funds released and transactions logged', {
        invoiceId: invoiceId.toString(),
        receiverTxHash: receiverTransfer.hash,
        platformFeeTxHash: platformFeeTransfer.hash,
      });

      // Send email notifications to both issuer and receiver
      const issuerUser = await userService.getUserByWalletAddress(invoice.issuer);
      if (issuerUser) {
        const amountInEth = (Number(invoice.amount) / 1e18).toFixed(4);
        await emailService.notifyInvoiceCompleted(issuerUser.email, {
          invoiceId: invoiceId.toString(),
          amount: `${amountInEth} ETH`,
          receiver: invoice.receiver,
        });
      }

      // Reuse receiverUser from earlier
      if (receiverUser) {
        const amountInEth = (Number(invoice.amount - platformFeeCollected) / 1e18).toFixed(4);
        await emailService.notifyInvoiceCompleted(receiverUser.email, {
          invoiceId: invoiceId.toString(),
          amount: `${amountInEth} ETH`,
          receiver: invoice.receiver,
        });
      }

    } catch (error) {
      logger.error('Failed to handle InvoiceCompleted event', { error, log });
      throw error;
    }
  }

  private watchInvoiceCancelled(): void {
    this.publicClient.watchContractEvent({
      address: this.contractAddress,
      abi: [parseAbiItem('event InvoiceCancelled(uint256 indexed invoiceId, address indexed cancelledBy, string reason, uint256 timestamp)')],
      eventName: 'InvoiceCancelled',
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.handleInvoiceCancelled(log);
        }
      },
    });
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

      // Update invoice status in database
      await invoiceService.updateInvoiceStatus({
        invoiceId,
        status: 'cancelled',
        txHash: transactionHash,
      });

      // Log cancellation transaction (on-chain listener is Base)
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

      // Refund if invoice was funded
      if (invoice.status === InvoiceStatus.Cancelled && invoice.fundedAt > 0n) {
        const refundTx = await blockradarService.refundFunds(
          invoiceId.toString(),
          invoice.payer,
          invoice.amount.toString(),
          invoice.tokenAddress
        );

        // Log refund transaction (on-chain + Blockradar; chain = base)
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

      // Send email notifications to relevant parties
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
