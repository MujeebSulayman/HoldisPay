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

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      const { data: userProfile } = await supabase.from('users').select('kyc_status').eq('id', userId).single();
      if (!userProfile || (userProfile.kyc_status !== 'verified' && userProfile.kyc_status !== 'approved')) {
        res.status(403).json({ error: 'KYC Required', message: 'You must complete KYC verification before withdrawing funds.' });
        return;
      }

      if (!amountUsdc || !paymentMethodId) {
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
      
      const { data: dbRow } = await supabase
        .from('user_chain_balances')
        .select('balance_wei')
        .eq('user_id', userId)
        .eq('chain_id', SETTLEMENT_CHAIN_SLUG)
        .eq('token_address', SETTLEMENT_TOKEN_ADDRESS.toLowerCase())
        .maybeSingle();
        
      let finalAmountWei = amountWei;
      if (dbRow?.balance_wei) {
         const availableWei = BigInt(dbRow.balance_wei);
         if (finalAmountWei > availableWei && finalAmountWei - availableWei <= 50000n) {
             finalAmountWei = availableWei;
         }
      }
      if (finalAmountWei <= 0n) {
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

      // Convert amount to units (6 decimals)
      const amountUnits = String(BigInt(Math.round(amountNum * 1e6)));
      
      const debited = await balanceService.tryDebitConsolidated(userId, amountUnits);
      if (!debited) {
        res.status(402).json({
          success: false,
          error: 'Insufficient balance',
          message: 'Your unified USDC balance is insufficient for this withdrawal.',
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
        await balanceService.credit(userId, SETTLEMENT_CHAIN_SLUG, amountUnits, SETTLEMENT_TOKEN_ADDRESS);
        throw err;
      }

      await transactionService.logTransaction({
        userId,
        txType: 'withdraw',
        txHash: transfer.reference,
        status: (transfer.status === 'SUCCESS' ? 'success' : 'pending') as 'pending' | 'success' | 'failed',
        amount: amountUnits,
        chainId: SETTLEMENT_CHAIN_SLUG,
        tokenAddress: SETTLEMENT_TOKEN_ADDRESS,
        blockradarReference: transfer.reference,
        metadata: { type: 'naira_bank_withdrawal', balanceAlreadyDebited: true, currency: 'NGN', amountUnits },
      });

      res.status(200).json({
        success: true,
        data: {
          amountNgn,
        },
      });

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
