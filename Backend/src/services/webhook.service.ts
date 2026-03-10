import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { supabase } from '../config/supabase';
import { SETTLEMENT_CHAIN_SLUG, SETTLEMENT_TOKEN_ADDRESS, SETTLEMENT_TOKEN_DECIMALS } from '../constants/addresses';
import { blockradarService } from './blockradar.service';
import { invoiceService } from './invoice.service';
import { transactionService } from './transaction.service';
import { userService } from './user.service';
import { emailService } from './email.service';
import { balanceService } from './balance.service';


export interface BlockradarWebhookEvent {
  event: 'custom-smart-contract.success' | 'custom-smart-contract.failed' | 'transfer.success' | 'transfer.failed' | 'withdraw.success' | 'withdraw.failed' | 'deposit.success' | 'deposit.failed' | 'deposit.swept.success' | 'deposit.swept.failed' | 'gateway-deposit.success' | 'gateway-deposit.failed' | 'swap.success' | 'swap.failed';
  data: {
    id: string;
    hash?: string;
    status: 'SUCCESS' | 'FAILED' | 'PENDING';
    method?: string;
    contractAddress?: string;
    blockchain?: {
      id?: string;
      name: string;
      network?: string;

      slug?: string;
    };
    reference?: string;
    metadata?: Record<string, unknown>;
    error?: string;
    amount?: string;
    amountPaid?: string;
    amountUSD?: string;
    currency?: string;
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


  private getWebhookVerificationKeys(): string[] {
    const fromMulti =
      env.BLOCKRADAR_WALLET_API_KEYS?.split(/[,\n]+/)
        .map((k) => k.trim())
        .filter((k) => k.length > 0) ?? [];
    const fromPerChain = [
      env.BLOCKRADAR_WALLET_API_KEY_ETHEREUM,
      env.BLOCKRADAR_WALLET_API_KEY_POLYGON,
      env.BLOCKRADAR_WALLET_API_KEY_BNB,
      env.BLOCKRADAR_WALLET_API_KEY_ARBITRUM,
      env.BLOCKRADAR_WALLET_API_KEY_OPTIMISM,
      env.BLOCKRADAR_WALLET_API_KEY_TRON,
      env.BLOCKRADAR_WALLET_API_KEY_SOLANA,
    ].filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
    const keys: string[] = [
      env.BLOCKRADAR_WEBHOOK_SECRET,
      env.BLOCKRADAR_WALLET_API_KEY,
      ...fromPerChain.map((k) => k.trim()),
      ...fromMulti,
      env.BLOCKRADAR_API_KEY,
    ]
      .filter((k): k is string => typeof k === 'string' && k.length > 0)
      .map((k) => k.trim());
    const seen = new Set<string>();
    const deduped = keys.filter((k) => {
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (env.LOG_LEVEL === 'debug' && deduped.length > 0) {
      logger.debug('Webhook verification keys loaded', { count: deduped.length });
    }
    return deduped;
  }


  getWebhookVerificationKeyCount(): number {
    return this.getWebhookVerificationKeys().length;
  }


  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const received = (signature || '').replace(/^sha512=/, '').trim();
      if (!/^[0-9a-fA-F]+$/.test(received)) {
        logger.warn('Webhook signature not hex', { receivedLen: received.length });
        return false;
      }
      const receivedBuf = Buffer.from(received, 'hex');
      const keys = this.getWebhookVerificationKeys();
      if (keys.length === 0) return false;

      for (const secret of keys) {
        const expected = crypto
          .createHmac('sha512', secret)
          .update(payload, 'utf8')
          .digest('hex');
        const expectedBuf = Buffer.from(expected, 'hex');
        if (expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
          return true;
        }
      }
      return false;
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
        case 'withdraw.success':
          await this.handleTransferSuccess(event);
          break;

        case 'transfer.failed':
        case 'withdraw.failed':
          await this.handleTransferFailure(event);
          break;

        case 'deposit.success':
        case 'deposit.swept.success':
        case 'gateway-deposit.success':
          await this.handleDepositSuccess(event);
          break;

        case 'deposit.failed':
        case 'deposit.swept.failed':
        case 'gateway-deposit.failed':
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

    // Handle crypto withdrawal completion
    if (metadata?.type === 'user_withdrawal' && event.data.id) {
      try {
        const updated = await transactionService.updateTransactionByBlockradarRef(
          event.data.id,
          'success',
          { hash: hash ?? undefined, metadata: { completedAt: event.data.completedAt || new Date().toISOString() } }
        );
        if (updated) {
          logger.info('Crypto withdrawal transaction marked successful', { withdrawalId: event.data.id, hash });
        } else {
          logger.warn('Could not find crypto withdrawal transaction to update', { withdrawalId: event.data.id });
        }
      } catch (err) {
        logger.error('Failed to update crypto withdrawal success', { error: err, withdrawalId: event.data.id });
      }
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

    // Handle crypto withdrawal failure: look up by blockradar reference and refund
    if (metadata?.type === 'user_withdrawal' && event.data.id) {
      try {
        const updated = await transactionService.updateTransactionByBlockradarRef(
          event.data.id,
          'failed',
          { metadata: { error: error || 'Withdrawal failed', failedAt: new Date().toISOString() } }
        );
        if (updated) {
          logger.info('Crypto withdrawal transaction marked failed', { withdrawalId: event.data.id });
          // Refund the user's ledger balance
          const userId = metadata.userId as string | undefined;
          const amount = event.data.amount;
          const chainSlug = this.getChainSlug(event.data);
          if (userId && amount && chainSlug) {
            const tokenAddr = (event.data.tokenAddress ?? null) as string | null;
            await balanceService.credit(userId, chainSlug, amount, tokenAddr);
            logger.info('Refunded user balance after failed crypto withdrawal', { userId, chainSlug, amount });
          }
        }
      } catch (err) {
        logger.error('Failed to handle crypto withdrawal failure', { error: err, withdrawalId: event.data.id });
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


  private async handleContractFundingPaymentLink(params: {
    contractId: string;
    amount: string;
    txHash?: string;
    chainId?: string;
    senderAddress?: string;
    blockradarReference?: string;
    amountUSD?: string;
  }): Promise<void> {
    const { contractId, amount, txHash, chainId, senderAddress, blockradarReference, amountUSD } = params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contractId);
    const selectQuery = isUuid
      ? supabase.from('payment_contracts').select('remaining_balance, status').eq('id', contractId).single()
      : supabase.from('payment_contracts').select('remaining_balance, status').eq('contract_id', contractId).single();
    const { data: row } = await selectQuery;
    const current = BigInt(row?.remaining_balance ?? '0');
    const updatePayload: Record<string, unknown> = {
      remaining_balance: (current + BigInt(amount)).toString(),
      updated_at: new Date().toISOString(),
    };
    if (isUuid && row?.status === 'DRAFT') {
      updatePayload.status = 'ACTIVE';
    }
    const query = isUuid
      ? supabase.from('payment_contracts').update(updatePayload).eq('id', contractId)
      : supabase.from('payment_contracts').update(updatePayload).eq('contract_id', contractId);
    await query;

    const refForTx = txHash || blockradarReference || `contract-fund-${contractId}-${Date.now()}`;
    const contractSelect = isUuid
      ? supabase.from('payment_contracts').select('employer_address').eq('id', contractId)
      : supabase.from('payment_contracts').select('employer_address').eq('contract_id', contractId);
    const { data: contractRow } = await contractSelect.maybeSingle();
    const employerAddress = contractRow?.employer_address;
    if (employerAddress) {
      const employerUser = await userService.getUserByWalletAddress(employerAddress);
      if (employerUser?.id) {
        await transactionService.logTransaction({
          userId: employerUser.id,
          txType: 'contract_fund',
          txHash: refForTx,
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
    }
    logger.info('Contract funded via payment link (deposit webhook)', { contractId, amount });
  }

  /** Chain slug from payload only (blockchain.slug / name / network). No hardcoded id→slug map. */
  private getChainSlug(data: { blockchain?: { slug?: string; name?: string; network?: string } }): string | undefined {
    const b = data.blockchain;
    if (b?.slug) return b.slug.toLowerCase().trim();
    if (b?.name) return b.name.toLowerCase().replace(/\s+/g, '');
    if (b?.network) return b.network.toLowerCase().trim();
    return undefined;
  }


  /**
   * Called when payment_link.paid webhook is received (blockradar-webhook.controller).
   * Credits issuer ledger, marks invoice paid, sends email. Uses same rules as deposit.success path.
   */
  async processInvoicePaymentLinkPaid(paymentLinkId: string, data: Record<string, unknown>): Promise<void> {
    const invoice = await invoiceService.getInvoiceByPaymentLinkId(paymentLinkId);
    if (!invoice) {
      logger.warn('processInvoicePaymentLinkPaid: no invoice found for payment link', {
        paymentLinkId,
        linkId: (data as any).linkId,
        paymentLinkIdFromData: (data as any).paymentLinkId,
      });
      return;
    }
    const alreadyCredited = await transactionService.hasSuccessfulInvoiceFundForInvoice(BigInt(invoice.invoice_id));
    if (alreadyCredited) {
      logger.info('Invoice already credited (idempotent skip)', { invoiceId: invoice.invoice_id, paymentLinkId });
      return;
    }
    const d = data as BlockradarWebhookEvent['data'];
    const amountWei = this.settlementUnitsFromBlockradarDeposit(d);
    if (!amountWei || BigInt(amountWei) <= 0n) {
      logger.warn('Payment link paid: no USD amount in payload; skipping credit', {
        invoiceId: invoice.invoice_id,
        paymentLinkId,
        currency: d.currency,
        amount: d.amount,
        amountUSD: d.amountUSD,
      });
      return;
    }
    const userId = invoice.issuer_id;
    if (!userId || typeof userId !== 'string') {
      logger.error('Payment link paid: invoice has no issuer_id', { invoiceId: invoice.invoice_id });
      return;
    }
    const txHash = (d.hash ?? d.reference ?? `payment-link-${d.id ?? paymentLinkId}`) as string;
    await invoiceService.updateInvoiceStatus({
      invoiceId: BigInt(invoice.invoice_id),
      status: 'paid',
      paidAt: new Date(),
      txHash,
      amountPaid: amountWei,
      amountPaidUsd: typeof d.amountUSD === 'string' ? d.amountUSD : undefined,
    });
    await transactionService.logTransaction({
      userId,
      invoiceId: BigInt(invoice.invoice_id),
      txType: 'invoice_fund',
      txHash,
      status: 'success',
      amount: amountWei,
      tokenAddress: SETTLEMENT_TOKEN_ADDRESS,
      fromAddress: typeof d.senderAddress === 'string' ? d.senderAddress : undefined,
      blockradarReference: typeof d.id === 'string' ? d.id : undefined,
      chainId: SETTLEMENT_CHAIN_SLUG,
      metadata: { type: 'payment_link_deposit', paymentLinkId, amountUSD: d.amountUSD },
    });
    const issuerUser = await userService.getUserById(userId);
    if (issuerUser) {
      await emailService.notifyInvoicePaid(issuerUser.email, {
        invoiceId: String(invoice.invoice_id),
        amount: typeof d.amountUSD === 'string' ? d.amountUSD : typeof d.amount === 'string' ? d.amount : amountWei,
        customerName: invoice.customer_name ?? undefined,
      });
    }
    logger.info('Invoice payment link paid processed', { invoiceId: invoice.invoice_id, paymentLinkId, amountWei });
  }

  private settlementUnitsFromBlockradarDeposit(d: BlockradarWebhookEvent['data']): string | null {
    const { amountUSD, amount, amountPaid, currency } = d;
    const decimals = SETTLEMENT_TOKEN_DECIMALS;
    let usdAmount: number | null = null;
    if (amountUSD != null && amountUSD !== '') {
      const n = parseFloat(String(amountUSD));
      if (Number.isFinite(n) && n >= 0) usdAmount = n;
    }
    if (usdAmount == null && currency === 'USD') {
      const raw = amountPaid ?? amount;
      if (raw != null && raw !== '') {
        const n = parseFloat(String(raw));
        if (Number.isFinite(n) && n >= 0) usdAmount = n;
      }
    }
    const maxUsd = 1e9;
    if (usdAmount == null && (amount ?? amountPaid) != null && (amount ?? amountPaid) !== '') {
      const n = parseFloat(String(amountPaid ?? amount));
      if (Number.isFinite(n) && n >= 0 && n <= maxUsd) usdAmount = n;
    }
    if (usdAmount == null || usdAmount <= 0) return null;
    if (usdAmount > maxUsd) return null;
    return String(BigInt(Math.round(usdAmount * 10 ** decimals)));
  }

  private async handleDepositSuccess(event: BlockradarWebhookEvent): Promise<void> {
    const d = event.data as Record<string, unknown>;
    const paymentLinkObj = (d.paymentLink ?? d.payment_link) as
      | { id?: string; slug?: string; metadata?: unknown }
      | undefined;
    const paymentLinkId = paymentLinkObj?.id ?? paymentLinkObj?.slug;
    const hash = d.hash as string | undefined;
    const reference = d.reference as string | undefined;
    const amount = d.amount as string | undefined;
    const amountUSD = d.amountUSD as string | undefined;
    const senderAddress = d.senderAddress as string | undefined;
    const recipientAddress = d.recipientAddress as string | undefined;

    logger.info('Deposit success webhook', {
      txHash: hash,
      reference,
      amount,
      amountUSD,
      paymentLinkId,
      paymentLinkObjId: paymentLinkObj?.id,
      paymentLinkObjSlug: paymentLinkObj?.slug,
      senderAddress,
      recipientAddress,
      chain: this.getChainSlug(d as BlockradarWebhookEvent['data']),
    });

    if (!paymentLinkId) {
      // We do not credit ledger for deposits without a payment link. All settlement is payment-link → master wallet; we only credit when we have a payment link (invoice or contract funding).
      logger.info('Deposit success has no payment link; skipping (settlement is payment-link only)', {
        txHash: hash,
        reference,
        recipientAddress,
      });
      return;
    }

    try {
      const invoice = await invoiceService.getInvoiceByPaymentLinkId(paymentLinkId);
      if (invoice) {
        await this.processInvoicePaymentLinkPaid(paymentLinkId, d as Record<string, unknown>);
        return;
      }

      const metadata =
        paymentLinkObj?.metadata ??
        (typeof d.metadata === 'string' ? JSON.parse((d.metadata as string) || '{}') : d.metadata) ??
        {};
      const meta = (metadata as { type?: string; contractId?: string }) ?? {};
      if (meta.type === 'contract_funding' && meta.contractId) {
        await this.handleContractFundingPaymentLink({
          contractId: meta.contractId,
          amount: amount ?? '0',
          txHash: hash ?? reference,
          chainId: this.getChainSlug(d as BlockradarWebhookEvent['data']),
          senderAddress,
          blockradarReference: d.id as string | undefined,
          amountUSD,
        });
        return;
      }
      try {
        const link = await blockradarService.getPaymentLink(paymentLinkId);
        const linkMeta = typeof link?.metadata === 'string' ? JSON.parse(link?.metadata || '{}') : link?.metadata || {};
        if (linkMeta.type === 'contract_funding' && linkMeta.contractId) {
          await this.handleContractFundingPaymentLink({
            contractId: linkMeta.contractId,
            amount: amount ?? '0',
            txHash: hash ?? reference,
            chainId: this.getChainSlug(d as BlockradarWebhookEvent['data']),
            senderAddress,
            blockradarReference: d.id as string | undefined,
            amountUSD,
          });
          return;
        }
      } catch (e) {
        logger.debug('Could not resolve payment link for contract funding', { paymentLinkId, error: e });
      }
      logger.warn('No invoice found for payment link', { paymentLinkId });
    } catch (error) {
      logger.error('Failed to process payment link deposit', { error, paymentLinkId, event });
    }
  }

  private async handleDepositFailure(event: BlockradarWebhookEvent): Promise<void> {
    const d = event.data;
    const { hash, reference, error, paymentLink, senderAddress } = d;

    logger.error('Payment link deposit failed', {
      txHash: hash,
      reference,
      error,
      paymentLinkId: paymentLink?.id,
    });

    const paymentLinkId = paymentLink?.id;
    if (paymentLinkId && (hash || reference)) {
      try {
        const invoice = await invoiceService.getInvoiceByPaymentLinkId(paymentLinkId);
        if (invoice) {
          const senderUser = senderAddress ? await userService.getUserByWalletAddress(senderAddress) : null;
          const userId = senderUser?.id ?? invoice.issuer_id;
          const chainId = this.getChainSlug(d);
          await transactionService.logTransaction({
            userId: typeof userId === 'string' ? userId : undefined,
            invoiceId: BigInt(invoice.invoice_id),
            txType: 'invoice_fund',
            txHash: hash || reference || `failed-${d.id}`,
            status: 'failed',
            amount: invoice.amount,
            fromAddress: senderAddress,
            blockradarReference: d.id,
            chainId: chainId ?? undefined,
            metadata: { type: 'payment_link_deposit_failed', paymentLinkId, error },
          });
        }
      } catch (e) {
        logger.error('Failed to log deposit failure transaction', { error: e, paymentLinkId });
      }
    }
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
        const chainId = toAsset?.blockchain || fromAsset?.blockchain;
        const chainSlug = chainId ? String(chainId).toLowerCase().replace(/\s+/g, '') : undefined;
        await transactionService.logTransaction({
          userId: metadata.userId,
          txType: 'transfer',
          txHash: fromAsset?.hash || toAsset?.hash || reference || `swap-${id}`,
          status: 'success',
          amount: toAsset?.amount,
          fromAddress: fromAsset?.blockchain,
          toAddress: toAsset?.blockchain,
          blockradarReference: id,
          chainId: chainSlug,
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

  async handleMonnifyDisbursementUpdate(reference: string, status: 'success' | 'failed', eventData: any): Promise<void> {
    try {
      logger.info('Handling Monnify disbursement update', { reference, status });
      
      const tx = await transactionService.getTransactionByHash(reference);
      if (!tx) {
        logger.warn('Monnify webhook: Transaction not found for reference', { reference });
        return;
      }

      if (tx.status === status) {
         logger.info('Monnify webhook: Transaction already in target status', { reference, status });
         return;
      }

      const updateMeta = {
         ...tx.metadata,
         monnifyEventData: eventData,
         error: status === 'failed' ? eventData.failureReason || 'Disbursement failed' : undefined,
      };

      await transactionService.updateTransactionStatus(reference, status, updateMeta);

      if (status === 'failed' && tx.user_id && tx.amount && tx.chain_id) {
         logger.info('Monnify webhook: Refund user for failed withdrawal', { userId: tx.user_id, amount: tx.amount });
         // Monnify withdrawal failed, we must reverse the initial tryDebit
         await balanceService.credit(tx.user_id, tx.chain_id, tx.amount, tx.token_address);
      }
    } catch (error) {
      logger.error('Failed to handle Monnify disbursement update', { error, reference });
      throw error;
    }
  }

  verifyDiditSignature(payload: string, signature: string, timestamp: string): boolean {
    if (!env.DIDIT_WEBHOOK_SECRET) {
      logger.error('Didit webhook secret is not configured');
      return false;
    }

    try {
      const timeDelta = Math.abs(Date.now() - parseInt(timestamp, 10));
      // Optionally reject if timestamp is older than 5 minutes
      if (timeDelta > 5 * 60 * 1000) {
        logger.error('Didit webhook timestamp is too old', { timestamp });
        return false;
      }

      const signedPayload = `${timestamp}.${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', env.DIDIT_WEBHOOK_SECRET)
        .update(signedPayload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      logger.error('Error verifying Didit webhook signature', { error });
      return false;
    }
  }

  async handleDiditWebhook(payload: any): Promise<void> {
    try {
      logger.info('Received Didit webhook', { type: payload.type, sessionId: payload.data?.session_id });
      
      const { type, data } = payload;
      if (!data || !data.session_id) {
        logger.warn('Invalid Didit webhook payload', { payload });
        return;
      }
      
      const sessionId = data.session_id;

      let nextStatus: 'pending' | 'submitted' | 'under_review' | 'verified' | 'rejected' | null = null;
      let reason: string | undefined = undefined;

      switch (type) {
        case 'session.approved':
          nextStatus = 'verified';
          break;
        case 'session.declined':
          nextStatus = 'rejected';
          reason = data.declined_reason || 'Verification declined by Didit';
          break;
        case 'session.expired':
          // Optionally, handle expiration by resetting status, etc.
          // Or just leave it as is so the user tries again
          logger.info('Didit session expired', { sessionId });
          return;
        case 'session.reviewed':
          // Manual review happened
          nextStatus = data.status === 'Approved' ? 'verified' : 'rejected';
          break;
        default:
          logger.debug('Ignoring unhandled Didit webhook type', { type });
          return;
      }

      if (nextStatus) {
        // Find the user with this session ID
        const { data: user, error } = await supabase
          .from('users')
          .select('id, first_name')
          .eq('didit_session_id', sessionId)
          .single();

        if (error || !user) {
          logger.error('User not found for Didit session ID', { sessionId, error });
          return;
        }

        const userId = user.id;

        await userService.updateKYCStatus(userId, {
          status: nextStatus as any,
          rejectionReason: reason,
          reviewedBy: 'Didit_Webhook',
        });

        logger.info(`Updated user KYC status via Didit webhook`, { userId, nextStatus });
        const firstName = user.first_name || 'User';

        if (nextStatus === 'verified') {
           emailService.sendVerificationSuccessEmail(userId, { firstName }).catch((e: any) => 
             logger.error('Failed to send verification success email', { error: e })
           );
        } else if (nextStatus === 'rejected') {
           const failureReason = reason || 'Document checks failed';
           emailService.sendVerificationFailedEmail(userId, { firstName, reason: failureReason }).catch((e: any) => 
             logger.error('Failed to send verification failed email', { error: e })
           );
        }
      }
    } catch (error) {
      logger.error('Error handling Didit webhook payload', { error });
      throw error; // Let controller catch it
    }
  }
}

export const webhookService = new WebhookService();
