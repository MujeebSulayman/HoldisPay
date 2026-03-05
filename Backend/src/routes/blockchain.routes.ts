import { Router } from 'express';
import { blockchainController } from '../controllers/blockchain.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

/** Public: enabled chains with logoUrl (for landing/marketing). */
router.get('/public/enabled-chains', (req, res) =>
  blockchainController.getEnabledChains(req, res)
);

router.get('/enabled-chains', authenticate, (req, res) =>
  blockchainController.getEnabledChains(req, res)
);

router.get('/blockchains', authenticate, (req, res) =>
  blockchainController.getSupportedBlockchains(req, res)
);

router.get('/assets', authenticate, (req, res) => 
  blockchainController.getSupportedAssets(req, res)
);

router.get('/chains/:chainSlug/assets', authenticate, (req, res) =>
  blockchainController.getAssetsByChain(req, res)
);

/** Public: supported assets (all or by chain) for landing. */
router.get('/public/assets', (req, res) =>
  blockchainController.getSupportedAssets(req, res)
);

export default router;
