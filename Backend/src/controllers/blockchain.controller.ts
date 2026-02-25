import { Request, Response } from 'express';
import { blockradarService } from '../services/blockradar.service';
import { logger } from '../utils/logger';
import {
  getEnabledChains,
  getEnabledChainSlugs,
  getWalletIdForChain,
  getWalletApiKeyForChain,
} from '../config/enabled-chains';

export class BlockchainController {
  
  async getEnabledChains(req: Request, res: Response): Promise<void> {
    try {
      const enabled = getEnabledChains();
      let blockchains: any[] = [];
      try {
        blockchains = await blockradarService.getBlockchains();
      } catch (_) {}
      const chains = enabled.map((c) => {
        const chain = blockchains.find((b: any) => (b.slug || '').toLowerCase() === c.slug.toLowerCase());
        return {
          slug: c.slug,
          displayName: c.displayName,
          logoUrl: chain?.logoUrl ?? '',
        };
      });
      res.json({ success: true, data: chains });
    } catch (error) {
      logger.error('Failed to get enabled chains', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get enabled chains',
      });
    }
  }

  async getSupportedBlockchains(req: Request, res: Response): Promise<void> {
    try {
      const allBlockchains = await blockradarService.getBlockchains();
      const enabledSlugs = getEnabledChainSlugs();
      
      
      const blockchains = allBlockchains.filter((chain: any) => 
        enabledSlugs.includes(chain.slug) && chain.isActive
      );
      
      logger.info('Returning enabled blockchains', { 
        total: allBlockchains.length, 
        enabled: blockchains.length,
        chains: blockchains.map((c: any) => c.slug),
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
      const enabledChains = getEnabledChains();

      if (chainSlug && typeof chainSlug === 'string') {
        const walletId = getWalletIdForChain(chainSlug);
        if (!walletId) {
          res.status(400).json({
            success: false,
            error: `Chain "${chainSlug}" is not enabled.`,
          });
          return;
        }
        const apiKey = getWalletApiKeyForChain(chainSlug);
        const assets = await blockradarService.getWalletAssetsFromApi(walletId, { apiKey });
        logger.info('Returning wallet assets for chain', { chainSlug, assetCount: assets.length });
        res.json({ success: true, data: assets });
        return;
      }

      const allAssets: any[] = [];
      for (const chain of enabledChains) {
        try {
          const apiKey = getWalletApiKeyForChain(chain.slug);
          const walletAssets = await blockradarService.getWalletAssetsFromApi(chain.walletId, { apiKey });
          for (const a of walletAssets) {
            allAssets.push({
              ...a,
              blockchain: a.blockchain ?? { slug: chain.slug, name: chain.displayName, id: '', symbol: '' },
            });
          }
        } catch (err) {
          logger.warn('Failed to fetch assets for chain', { chainSlug: chain.slug, error: err });
        }
      }

      logger.info('Returning wallet assets (all enabled chains)', { assetCount: allAssets.length });
      res.json({ success: true, data: allAssets });
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

      if (!enabledSlugs.includes(chainSlug)) {
        res.status(400).json({
          success: false,
          error: `Chain "${chainSlug}" is not enabled. Available chains: ${enabledSlugs.join(', ')}`,
        });
        return;
      }

      const walletId = getWalletIdForChain(chainSlug);
      if (!walletId) {
        res.status(400).json({ success: false, error: `No wallet configured for chain "${chainSlug}".` });
        return;
      }

      const chain = getEnabledChains().find((c) => c.slug === chainSlug);
      const apiKey = getWalletApiKeyForChain(chainSlug);
      const assets = await blockradarService.getWalletAssetsFromApi(walletId, { apiKey });
      const withBlockchain = assets.map((a: any) => ({
        ...a,
        blockchain: a.blockchain ?? { slug: chainSlug, name: chain?.displayName ?? chainSlug, id: '', symbol: '' },
      }));

      logger.info('Returning wallet assets for chain', { chainSlug, assetCount: withBlockchain.length });
      res.json({ success: true, data: withBlockchain });
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
