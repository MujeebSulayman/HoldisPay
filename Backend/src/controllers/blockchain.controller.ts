import { Request, Response } from 'express';
import { blockradarService } from '../services/blockradar.service';
import { logger } from '../utils/logger';
import { getEnabledChainSlugs } from '../config/enabled-chains';

export class BlockchainController {
  async getSupportedBlockchains(req: Request, res: Response): Promise<void> {
    try {
      const allBlockchains = await blockradarService.getBlockchains();
      const enabledSlugs = getEnabledChainSlugs();
      
      // Filter to only show chains configured in .env
      const blockchains = allBlockchains.filter(chain => 
        enabledSlugs.includes(chain.slug) && chain.isActive
      );
      
      logger.info('Returning enabled blockchains', { 
        total: allBlockchains.length, 
        enabled: blockchains.length,
        chains: blockchains.map(c => c.slug),
      });
      
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
      const enabledSlugs = getEnabledChainSlugs();
      
      let assets = await blockradarService.getAssets();
      
      // Filter to only show assets for enabled chains
      assets = assets.filter((asset: any) => {
        const assetChainSlug = asset.blockchain?.slug || asset.chain?.toLowerCase();
        return assetChainSlug && enabledSlugs.includes(assetChainSlug) && asset.isActive;
      });
      
      if (chainSlug) {
        assets = assets.filter((asset: any) => 
          asset.blockchain?.slug === chainSlug || 
          asset.chain?.toLowerCase() === (chainSlug as string).toLowerCase()
        );
      }
      
      logger.info('Returning enabled assets', { 
        chainSlug: chainSlug || 'all',
        assetCount: assets.length,
      });
      
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
      const enabledSlugs = getEnabledChainSlugs();
      
      // Validate that the requested chain is enabled
      if (!enabledSlugs.includes(chainSlug)) {
        return res.status(400).json({
          success: false,
          error: `Chain "${chainSlug}" is not enabled. Available chains: ${enabledSlugs.join(', ')}`,
        });
      }
      
      const assets = await blockradarService.getAssets();
      const chainAssets = assets.filter((asset: any) => 
        (asset.blockchain?.slug === chainSlug || 
        asset.chain?.toLowerCase() === chainSlug.toLowerCase()) &&
        asset.isActive
      );
      
      logger.info('Returning assets for chain', { 
        chainSlug,
        assetCount: chainAssets.length,
      });
      
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
