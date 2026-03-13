import { Router } from 'express';
import { walletController } from '../controllers/wallet.controller';
import { authenticate, requireSelfOrAdmin } from '../middlewares/auth.middleware';

const router = Router();

const selfOrAdmin = requireSelfOrAdmin('userId');

router.get('/assets', (req, res) => walletController.getAssets(req, res));

router.get('/chains/:chainId/assets', (req, res) => walletController.getChainAssets(req, res));

router.post('/:userId/swap/quote', authenticate, selfOrAdmin, (req, res) => walletController.getSwapQuote(req, res));

router.post('/:userId/swap/execute', authenticate, selfOrAdmin, (req, res) => walletController.executeSwap(req, res));

router.get('/withdraw/naira/quote', authenticate, (req, res) => walletController.getPaystackWithdrawQuote(req, res));
router.post('/withdraw/naira', authenticate, (req, res) => walletController.withdrawNaira(req, res));

export default router;
