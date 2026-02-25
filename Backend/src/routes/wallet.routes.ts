import { Router } from 'express';
import { walletController } from '../controllers/wallet.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();


router.get('/assets', (req, res) => walletController.getAssets(req, res));


router.get('/chains/:chainId/assets', (req, res) => walletController.getChainAssets(req, res));


router.post('/:userId/swap/quote', authenticate, (req, res) => walletController.getSwapQuote(req, res));


router.post('/:userId/swap/execute', authenticate, (req, res) => walletController.executeSwap(req, res));


router.post('/withdraw/fee-estimate', (req, res) => walletController.estimateWithdrawalFee(req, res));


router.post('/withdraw', authenticate, (req, res) => walletController.withdraw(req, res));


router.post('/:userId/withdraw', authenticate, (req, res) => walletController.withdraw(req, res));

export default router;
