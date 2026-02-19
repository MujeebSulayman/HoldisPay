import { Request, Response } from 'express';
import { blockradarService } from '../services/blockradar.service';
import { logger } from '../utils/logger';

export class BlockchainController {
  async getSupportedBlockchains(req: Request, res: Response): Promise<void> {
    try {
      const blockchains = await blockradarService.getBlockchains();
      
      res.json({
        success: true,
        data: blockchains,
      });
    } catch (error) {
      logger.error('Failed to get supported blockchains', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch blockchains',
      });
    }
  }

  async getSupportedAssets(req: Request, res: Response): Promise<void> {
    try {
      const { chainSlug } = req.query;
      
      let assets = await blockradarService.getAssets();
      
      if (chainSlug) {
        assets = assets.filter((asset: any) => 
          asset.blockchain?.slug === chainSlug || 
          asset.chain?.toLowerCase() === (chainSlug as string).toLowerCase()
        );
      }
      
      res.json({
        success: true,
        data: assets,
      });
    } catch (error) {
      logger.error('Failed to get supported assets', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch assets',
      });
    }
  }

  async getAssetsByChain(req: Request, res: Response): Promise<void> {
    try {
      const { chainSlug } = req.params;
      
      const assets = await blockradarService.getAssets();
      const chainAssets = assets.filter((asset: any) => 
        asset.blockchain?.slug === chainSlug || 
        asset.chain?.toLowerCase() === chainSlug.toLowerCase()
      );
      
      res.json({
        success: true,
        data: chainAssets,
      });
    } catch (error) {
      logger.error('Failed to get assets by chain', { error, chainSlug: req.params.chainSlug });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch chain assets',
      });
    }
  }
}

export const blockchainController = new BlockchainController();
