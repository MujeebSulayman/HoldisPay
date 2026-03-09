import { Request, Response } from 'express';
import { userWalletService } from '../services/user-wallet.service';
import { blockradarService } from '../services/blockradar.service';
import { transactionService } from '../services/transaction.service';
import { balanceService } from '../services/balance.service';
import { monnifyService } from '../services/monnify.service';
import { getNgnRate } from '../services/rate.service';
import { logger } from '../utils/logger';
import { getChainConfig } from '../config/chains';
import { env } from '../config/env';
import { supabase } from '../config/supabase';
import { emailService } from '../services/email.service';
import { SETTLEMENT_CHAIN_SLUG, SETTLEMENT_TOKEN_ADDRESS, SETTLEMENT_TOKEN_DECIMALS } from '../constants/addresses';

/** Extract user-facing message and status from Monnify/axios error. */
function providerErrorPayload(error: unknown): { message: string; status: number } {
  const err = error as { response?: { status?: number; data?: { responseMessage?: string; message?: string; error?: string } }; message?: string };
  const status = err?.response?.status ?? 500;
  const body = err?.response?.data;
  const msg =
    (typeof body?.message === 'string' && body.message.trim()) ||
    (typeof body?.error === 'string' && body.error.trim()) ||
    (err?.message && !err.message.includes('status code') ? err.message : null) ||
    'Request failed';
  return { message: msg, status };
}

export class WalletController {
  async getSwapQuote(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { fromAssetId, toAssetId, amount, order, recipientAddress } = req.body;

      if (!fromAssetId || !toAssetId || !amount) {
        res.status(400).json({
          error: 'Missing required fields',
          message: 'fromAssetId, toAssetId, and amount are required',
        });
        return;
      }

      const quote = await userWalletService.getSwapQuoteForUser(userId, {
        fromAssetId,
        toAssetId,
        amount,
        order: order || 'RECOMMENDED',
        recipientAddress,
      });

      logger.info('Swap quote retrieved for user', {
        userId,
        fromAssetId,
        toAssetId,
        expectedAmount: quote.amount,
      });

      res.status(200).json({
        success: true,
        message: 'Swap quote retrieved',
        data: quote,
      });
    } catch (error) {
      logger.error('Get swap quote API error', { error });
      res.status(500).json({
        error: 'Failed to get swap quote',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async executeSwap(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { fromAssetId, toAssetId, amount, order, recipientAddress, reference, metadata } = req.body;

      if (!fromAssetId || !toAssetId || !amount) {
        res.status(400).json({
          error: 'Missing required fields',
          message: 'fromAssetId, toAssetId, and amount are required',
        });
        return;
      }

      const swap = await userWalletService.executeSwapForUser(userId, {
        fromAssetId,
        toAssetId,
        amount,
        order: order || 'RECOMMENDED',
        recipientAddress,
        reference: reference || `swap-${userId}-${Date.now()}`,
        metadata: {
          ...metadata,
          userId,
          initiatedAt: new Date().toISOString(),
        },
      });

      logger.info('Swap executed for user', {
        userId,
        swapId: swap.id,
        status: swap.status,
      });

      res.status(200).json({
        success: true,
        message: 'Swap initiated',
        data: swap,
      });
    } catch (error) {
      logger.error('Execute swap API error', { error });
      res.status(500).json({
        error: 'Failed to execute swap',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async estimateWithdrawalFee(req: Request, res: Response): Promise<void> {
    try {
      const { chainId, assetId, address, amount } = req.body;

      if (!chainId || !assetId || !address || !amount) {
        res.status(400).json({
          error: 'Missing required fields',
          message: 'chainId, assetId, address, and amount are required',
        });
        return;
      }

      const chainConfig = getChainConfig(chainId);
      if (!chainConfig || !chainConfig.walletId) {
        res.status(404).json({
          error: 'Chain not configured',
          message: `Chain ${chainId} is not properly configured`,
        });
        return;
      }

      const feeEstimate = await blockradarService.estimateWithdrawalFee(
        chainConfig.walletId,
        {
          assetId,
          address,
          amount,
        }
      );

      logger.info('Withdrawal fee estimated', {
        chainId,
        assetId,
        amount,
        networkFee: feeEstimate.networkFee,
      });

      res.status(200).json({
        success: true,
        message: 'Fee estimated successfully',
        data: feeEstimate,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Estimate withdrawal fee API error', { error: errorMessage });
      res.status(500).json({
        error: 'Failed to estimate fee',
        message: errorMessage,
      });
    }
  }

  async withdraw(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { chainId, assetId, address, amount, note, reference, metadata, tokenAddress: bodyTokenAddress } = req.body;

      if (!chainId || !assetId || !address || !amount || !userId) {
        res.status(400).json({
          error: 'Missing required fields',
          message: 'chainId, assetId, address, and amount are required',
        });
        return;
      }

      const chainConfig = getChainConfig(chainId);
      if (!chainConfig || !chainConfig.walletId) {
        res.status(404).json({
          error: 'Chain not configured',
          message: `Chain ${chainId} is not properly configured`,
        });
        return;
      }

      const tokenAddress = bodyTokenAddress ?? null;
      const debited = await balanceService.tryDebit(userId, chainId, String(amount), tokenAddress);
      if (!debited) {
        res.status(402).json({
          error: 'Insufficient balance',
          message: 'Your ledger balance is insufficient for this withdrawal.',
        });
        return;
      }

      let withdrawal: { id: string; hash?: string; status?: string };
      try {
        withdrawal = await blockradarService.withdraw(chainConfig.walletId, {
          assetId,
          address,
          amount,
          reference: reference || `withdrawal-${userId}-${Date.now()}`,
          note,
          metadata: {
            ...metadata,
            userId,
            type: 'user_withdrawal',
            initiatedAt: new Date().toISOString(),
          },
        });
      } catch (err) {
        await balanceService.credit(userId, chainId, String(amount), tokenAddress);
        throw err;
      }

      const txHash = withdrawal.hash || `withdraw-${withdrawal.id}`;
      await transactionService.logTransaction({
        userId,
        txType: 'withdraw',
        txHash,
        status: (withdrawal.status === 'SUCCESS' ? 'success' : 'pending') as 'pending' | 'success' | 'failed',
        amount: String(amount),
        toAddress: address,
        blockradarReference: withdrawal.id,
        chainId,
        tokenAddress: tokenAddress ?? undefined,
        metadata: { type: 'user_withdrawal', withdrawalId: withdrawal.id, balanceAlreadyDebited: true },
      });

      logger.info('Withdrawal initiated', {
        userId,
        chainId,
        withdrawalId: withdrawal.id,
        address,
        amount,
      });

      res.status(200).json({
        success: true,
        message: 'Withdrawal initiated',
        data: withdrawal,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Withdraw API error', { error: errorMessage });
      res.status(500).json({
        error: 'Failed to withdraw',
        message: errorMessage,
      });
    }
  }

  async getPaystackWithdrawQuote(req: Request, res: Response): Promise<void> {
    try {
      const amountUsdc = (req.query.amountUsdc as string)?.trim();
      const currency = ((req.query.currency as string) || 'NGN').toUpperCase();
      if (currency !== 'NGN') {
        res.status(400).json({ success: false, error: 'Only NGN is supported' });
        return;
      }
      if (!amountUsdc) {
        res.status(400).json({ success: false, error: 'amountUsdc is required' });
        return;
      }
      const amount = parseFloat(amountUsdc);
      if (Number.isNaN(amount) || amount <= 0) {
        res.status(400).json({ success: false, error: 'Invalid amount' });
        return;
      }
      let rate: number;
      try {
        rate = await getNgnRate();
      } catch (err: any) {
        const providerMessage = err?.message ?? (typeof err === 'string' ? err : 'Unknown error');
        logger.error('Paystack quote: could not fetch NGN rate (Quidax)', { error: err });
        res.status(503).json({
          success: false,
          error: 'Could not fetch NGN rate from provider',
          message: 'Unable to get current rate. Please try again later.',
          detail: providerMessage,
        });
        return;
      }
      const amountInCurrency = Math.round(amount * rate * 100) / 100;
      // Monnify might charge a flat fee or percentage based on merchant agreement.
      // Assuming a generic fee structure or 0 depending on setup.
      res.status(200).json({
        success: true,
        data: {
          amountInCurrency,
          rate,
          currency: 'NGN',
          fee: 0,
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Naira withdraw quote error', { error: msg });
      res.status(500).json({ success: false, error: msg });
    }
  }

  async withdrawNaira(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { amountUsdc, paymentMethodId } = req.body || {};
      if (!userId || !amountUsdc || !paymentMethodId) {
        res.status(400).json({
          success: false,
          error: 'amountUsdc and paymentMethodId are required',
        });
        return;
      }
      const amountNum = parseFloat(String(amountUsdc).trim());
      if (Number.isNaN(amountNum) || amountNum <= 0) {
        res.status(400).json({ success: false, error: 'Invalid amount' });
        return;
      }


      const amountWei = BigInt(Math.round(amountNum * 10 ** SETTLEMENT_TOKEN_DECIMALS));
      if (amountWei <= 0n) {
        res.status(400).json({ success: false, error: 'Amount too small' });
        return;
      }

      const { data: pm, error: pmErr } = await supabase
        .from('user_payment_methods')
        .select('account_number, bank_code, bank_name, currency')
        .eq('id', paymentMethodId)
        .eq('user_id', userId)
        .single();
      if (pmErr || !pm?.account_number || !pm?.bank_code) {
        res.status(404).json({ success: false, error: 'Payment method not found or incomplete' });
        return;
      }

      let ngnRate: number;
      try {
        ngnRate = await getNgnRate();
      } catch (err: any) {
        const providerMessage = err?.message ?? (typeof err === 'string' ? err : 'Unknown error');
        logger.error('Naira withdraw: could not fetch NGN rate (Quidax)', { error: err });
        res.status(503).json({
          success: false,
          error: 'Could not fetch NGN rate from provider',
          message: 'Unable to get current rate. Please try again later.',
          detail: providerMessage,
        });
        return;
      }

      const debited = await balanceService.tryDebit(userId, SETTLEMENT_CHAIN_SLUG, amountWei.toString(), SETTLEMENT_TOKEN_ADDRESS);
      if (!debited) {
        res.status(402).json({
          success: false,
          error: 'Insufficient balance',
          message: 'Your ledger balance is insufficient for this withdrawal.',
        });
        return;
      }

      const amountNgn = Number((amountNum * ngnRate).toFixed(2));

      let transfer: { reference: string; status: string };
      try {
        const sourceAccountNumber = env.MONNIFY_SOURCE_ACCOUNT_NUMBER || '1234567890';
        
        transfer = await monnifyService.initiateTransfer({
           amount: amountNgn,
           reference: `withdraw-${userId}-${Date.now()}`,
           narration: 'Withdrawal from Holdis',
           destinationBankCode: pm.bank_code,
           destinationAccountNumber: pm.account_number,
           currency: 'NGN',
           sourceAccountNumber,
           async: true
        });
      } catch (err) {
        await balanceService.credit(userId, SETTLEMENT_CHAIN_SLUG, amountWei.toString(), SETTLEMENT_TOKEN_ADDRESS);
        throw err;
      }

      await transactionService.logTransaction({
        userId,
        txType: 'withdraw',
        txHash: transfer.reference,
        status: (transfer.status === 'SUCCESS' ? 'success' : 'pending') as 'pending' | 'success' | 'failed',
        amount: amountWei.toString(),
        chainId: SETTLEMENT_CHAIN_SLUG,
        tokenAddress: SETTLEMENT_TOKEN_ADDRESS,
        metadata: { type: 'naira_bank_withdrawal', balanceAlreadyDebited: true, currency: 'NGN' },
      });

      res.status(200).json({
        success: true,
        data: {
          amountNgn,
        },
      });

      // Send withdrawal email notification (non-blocking)
      const accountMasked = pm.account_number.replace(/.(?=.{4})/g, '*');
      (async () => {
        try {
          const { data: user } = await supabase.from('users').select('email, first_name').eq('id', userId).single();
          if (user?.email) {
            await emailService.notifyWithdrawalInitiated(user.email, {
              firstName: user.first_name || undefined,
              amountUsdc: amountNum.toFixed(2),
              amountNgn: amountNgn.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              rate: ngnRate.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              bankName: pm.bank_name || 'N/A',
              accountNumberMasked: accountMasked,
              reference: transfer.reference,
            });
          }
        } catch (err) {
          logger.error('Failed to send withdrawal email', { error: err });
        }
      })();
    } catch (error) {
      const { message: msg, status } = providerErrorPayload(error);
      logger.error('Naira withdraw error', { error: msg, status, detail: (error as { response?: { data?: unknown } })?.response?.data });
      res.status(status).json({
        success: false,
        error: msg,
        message: msg,
      });
    }
  }

  async getAssets(_req: Request, res: Response): Promise<void> {
    try {
      const assets = await blockradarService.getAssets();

      res.status(200).json({
        success: true,
        data: assets,
      });
    } catch (error) {
      logger.error('Get assets API error', { error });
      res.status(500).json({
        error: 'Failed to get assets',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getFiatWithdrawAssets(_req: Request, res: Response): Promise<void> {
    try {
      const assets = await blockradarService.getFiatWithdrawAssets();
      res.status(200).json({ success: true, data: assets });
    } catch (error) {
      const msg = error && typeof error === 'object' && 'message' in error ? (error as { message?: string }).message : undefined;
      logger.error('Get fiat withdraw assets API error', { error: msg });
      res.status(500).json({
        error: 'Failed to get fiat assets',
        message: msg || (error instanceof Error ? error.message : 'Unknown error'),
      });
    }
  }

  async getFiatCurrencies(_req: Request, res: Response): Promise<void> {
    try {
      const rate = await getNgnRate();
      res.status(200).json({
        success: true,
        data: [{ code: 'NGN', marketRate: String(rate), decimals: 2, name: 'Nigerian Naira', shortName: 'Naira', symbol: '₦' }],
      });
    } catch (error: any) {
      const msg = error?.message ?? (error instanceof Error ? error.message : 'Unknown error');
      logger.error('Get fiat currencies API error', { error: msg });
      res.status(503).json({
        error: 'Could not fetch NGN rate from provider',
        message: 'Unable to get current rate. Please try again later.',
        detail: msg,
      });
    }
  }

  async getFiatInstitutions(req: Request, res: Response): Promise<void> {
    try {
      const currency = (req.query.currency as string) || '';
      if (!currency) {
        res.status(400).json({ error: 'Missing currency', message: 'Query parameter currency is required' });
        return;
      }
      const walletId = env.BLOCKRADAR_WALLET_ID;
      const institutions = await blockradarService.getFiatInstitutions(walletId, currency);
      res.status(200).json({ success: true, data: institutions });
    } catch (error) {
      const msg = error && typeof error === 'object' && 'message' in error ? (error as { message?: string }).message : undefined;
      logger.error('Get fiat institutions API error', { error: msg });
      res.status(500).json({
        error: 'Failed to get fiat institutions',
        message: msg || (error instanceof Error ? error.message : 'Unknown error'),
      });
    }
  }

  async getFiatRates(req: Request, res: Response): Promise<void> {
    try {
      const { currency, assetId, amount, providerId } = req.query;
      if (!currency || !assetId || amount === undefined) {
        res.status(400).json({
          error: 'Missing parameters',
          message: 'Query parameters currency, assetId, and amount are required',
        });
        return;
      }
      const walletId = env.BLOCKRADAR_WALLET_ID;
      const data = await blockradarService.getFiatRates(walletId, {
        currency: String(currency),
        assetId: String(assetId),
        amount: Number(amount),
        providerId: providerId ? String(providerId) : undefined,
      });
      res.status(200).json({ success: true, data });
    } catch (error) {
      const msg = error && typeof error === 'object' && 'message' in error ? (error as { message?: string }).message : undefined;
      logger.error('Get fiat rates API error', { error: msg });
      res.status(500).json({
        error: 'Failed to get fiat rates',
        message: msg || (error instanceof Error ? error.message : 'Unknown error'),
      });
    }
  }

  async verifyFiatAccount(req: Request, res: Response): Promise<void> {
    try {
      const { accountIdentifier, currency, institutionIdentifier } = req.body;
      if (!accountIdentifier || !currency || !institutionIdentifier) {
        res.status(400).json({
          error: 'Missing required fields',
          message: 'accountIdentifier, currency, and institutionIdentifier are required',
        });
        return;
      }
      const walletId = env.BLOCKRADAR_WALLET_ID;
      const data = await blockradarService.verifyFiatInstitutionAccount(walletId, {
        accountIdentifier,
        currency,
        institutionIdentifier,
      });
      res.status(200).json({ success: true, data });
    } catch (error) {
      const msg = error && typeof error === 'object' && 'message' in error ? (error as { message?: string }).message : undefined;
      logger.error('Verify fiat account API error', { error: msg });
      res.status(500).json({
        error: 'Failed to verify account',
        message: msg || (error instanceof Error ? error.message : 'Unknown error'),
      });
    }
  }

  async getFiatQuote(req: Request, res: Response): Promise<void> {
    try {
      const { assetId, amount, currency, accountIdentifier, institutionIdentifier } = req.body;
      if (!assetId || amount === undefined || !currency || !accountIdentifier || !institutionIdentifier) {
        res.status(400).json({
          error: 'Missing required fields',
          message: 'assetId, amount, currency, accountIdentifier, and institutionIdentifier are required',
        });
        return;
      }
      const walletId = env.BLOCKRADAR_WALLET_ID;
      const data = await blockradarService.getFiatQuote(walletId, {
        assetId,
        amount: Number(amount),
        currency,
        accountIdentifier,
        institutionIdentifier,
      });
      res.status(200).json({ success: true, data });
    } catch (error) {
      const msg = error && typeof error === 'object' && 'message' in error ? (error as { message?: string }).message : undefined;
      logger.error('Get fiat quote API error', { error: msg });
      res.status(500).json({
        error: 'Failed to get fiat quote',
        message: msg || (error instanceof Error ? error.message : 'Unknown error'),
      });
    }
  }

  async executeFiatWithdraw(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { assetId, amount, currency, accountIdentifier, institutionIdentifier, code } = req.body;
      if (!assetId || amount === undefined || !currency || !accountIdentifier || !institutionIdentifier) {
        res.status(400).json({
          error: 'Missing required fields',
          message: 'assetId, amount, currency, accountIdentifier, and institutionIdentifier are required',
        });
        return;
      }
      const walletId = env.BLOCKRADAR_WALLET_ID;
      const data = await blockradarService.executeFiatWithdraw(walletId, {
        assetId,
        amount: Number(amount),
        currency,
        accountIdentifier,
        institutionIdentifier,
        code: code ? String(code) : undefined,
      });
      const withdrawalId = data?.id ?? data?.reference;
      if (userId && withdrawalId) {
        await transactionService.logTransaction({
          userId,
          txType: 'withdraw',
          txHash: withdrawalId,
          status: 'pending',
          amount: String(amount),
          toAddress: accountIdentifier,
          blockradarReference: withdrawalId,
          chainId: 'fiat',
          metadata: { type: 'fiat_withdrawal', currency, institutionIdentifier },
        });
      }
      logger.info('Fiat withdrawal initiated', { userId, withdrawalId, currency, amount });
      res.status(200).json({ success: true, message: 'Withdrawal initiated', data });
    } catch (error) {
      const msg = error && typeof error === 'object' && 'message' in error ? (error as { message?: string }).message : undefined;
      logger.error('Execute fiat withdraw API error', { error: msg });
      res.status(500).json({
        error: 'Failed to execute fiat withdrawal',
        message: msg || (error instanceof Error ? error.message : 'Unknown error'),
      });
    }
  }

  async getChainAssets(req: Request, res: Response): Promise<void> {
    try {
      const { chainId } = req.params;

      const chainConfig = getChainConfig(chainId);
      if (!chainConfig) {
        res.status(404).json({
          error: 'Chain not found',
          message: `Chain ${chainId} is not supported`,
        });
        return;
      }

      if (!chainConfig.walletId) {
        res.status(404).json({
          error: 'Wallet not configured',
          message: `No wallet ID configured for ${chainConfig.displayName}`,
        });
        return;
      }

      const assets = await blockradarService.getWalletAssets(chainConfig.walletId);

      const formattedAssets = assets.map((asset: any) => ({
        id: asset.id,
        name: asset.name,
        symbol: asset.symbol,
        decimals: asset.decimals,
        contractAddress: asset.contractAddress,
        type: asset.type,
        logoUrl: asset.logoUrl || asset.image,
        isNative: asset.isNative || false,
      }));

      logger.info('Retrieved chain assets', {
        chainId,
        chainName: chainConfig.displayName,
        assetCount: formattedAssets.length,
      });

      res.status(200).json({
        success: true,
        data: {
          chain: {
            id: chainConfig.id,
            name: chainConfig.displayName,
            symbol: chainConfig.nativeSymbol,
            logoUrl: undefined,
          },
          assets: formattedAssets,
        },
      });
    } catch (error) {
      logger.error('Get chain assets API error', { error });
      res.status(500).json({
        error: 'Failed to get chain assets',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const walletController = new WalletController();
