import { Request, Response } from 'express';
import { userWalletService } from '../services/user-wallet.service';
import { blockradarService } from '../services/blockradar.service';
import { transactionService } from '../services/transaction.service';
import { logger } from '../utils/logger';
import { getChainConfig } from '../config/chains';

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
      const { chainId, assetId, address, amount, note, reference, metadata } = req.body;

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

      const withdrawal = await blockradarService.withdraw(chainConfig.walletId, {
        assetId,
        address,
        amount,
        reference: reference || `withdrawal-${userId || 'user'}-${Date.now()}`,
        note,
        metadata: {
          ...metadata,
          userId,
          type: 'user_withdrawal',
          initiatedAt: new Date().toISOString(),
        },
      });

      const txHash = withdrawal.hash || `withdraw-${withdrawal.id}`;
      await transactionService.logTransaction({
        userId: userId!,
        txType: 'withdraw',
        txHash,
        status: (withdrawal.status === 'SUCCESS' ? 'success' : 'pending') as 'pending' | 'success' | 'failed',
        amount,
        toAddress: address,
        blockradarReference: withdrawal.id,
        chainId,
        metadata: { type: 'user_withdrawal', withdrawalId: withdrawal.id },
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
            symbol: chainConfig.nativeCurrency.symbol,
            logoUrl: chainConfig.logoUrl,
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
