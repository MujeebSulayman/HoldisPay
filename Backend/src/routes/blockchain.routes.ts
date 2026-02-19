import { Router } from 'express';
import { blockchainController } from '../controllers/blockchain.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.get('/blockchains', authenticate, (req, res) => 
  blockchainController.getSupportedBlockchains(req, res)
);

router.get('/assets', authenticate, (req, res) => 
  blockchainController.getSupportedAssets(req, res)
);

router.get('/chains/:chainSlug/assets', authenticate, (req, res) => 
  blockchainController.getAssetsByChain(req, res)
);

export default router;
