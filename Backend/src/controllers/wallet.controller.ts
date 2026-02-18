import { Request, Response } from 'express';
import { userWalletService } from '../services/user-wallet.service';
import { blockradarService } from '../services/blockradar.service';
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

  async withdraw(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { recipientAddress, amount, token, reference, metadata } = req.body;

      if (!recipientAddress || !amount) {
        res.status(400).json({
          error: 'Missing required fields',
          message: 'recipientAddress and amount are required',
        });
        return;
      }

      const withdrawal = await userWalletService.withdrawFromUser(userId, {
        recipientAddress,
        amount,
        token,
        reference: reference || `withdrawal-${userId}-${Date.now()}`,
        metadata: {
          ...metadata,
          userId,
          type: 'user_withdrawal',
          initiatedAt: new Date().toISOString(),
        },
      });

      logger.info('Withdrawal initiated for user', {
        userId,
        transferId: withdrawal.id,
        recipientAddress,
      });

      res.status(200).json({
        success: true,
        message: 'Withdrawal initiated',
        data: {
          txId: withdrawal.id,
          txHash: withdrawal.hash,
          status: withdrawal.status,
          recipientAddress,
          amount,
        },
      });
    } catch (error) {
      logger.error('Withdraw API error', { error });
      res.status(500).json({
        error: 'Failed to withdraw',
        message: error instanceof Error ? error.message : 'Unknown error',
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

      logger.info('Retrieved chain assets', {
        chainId,
        chainName: chainConfig.displayName,
        assetCount: assets.length,
      });

      res.status(200).json({
        success: true,
        data: {
          chain: {
            id: chainConfig.id,
            name: chainConfig.displayName,
            symbol: chainConfig.nativeCurrency.symbol,
          },
          assets,
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
