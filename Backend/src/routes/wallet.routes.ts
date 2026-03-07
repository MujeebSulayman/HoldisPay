import { Router } from 'express';
import { walletController } from '../controllers/wallet.controller';
import { authenticate, requireSelfOrAdmin } from '../middlewares/auth.middleware';

const router = Router();

const selfOrAdmin = requireSelfOrAdmin('userId');

router.get('/assets', (req, res) => walletController.getAssets(req, res));

router.get('/chains/:chainId/assets', (req, res) => walletController.getChainAssets(req, res));

router.post('/:userId/swap/quote', authenticate, selfOrAdmin, (req, res) => walletController.getSwapQuote(req, res));

router.post('/:userId/swap/execute', authenticate, selfOrAdmin, (req, res) => walletController.executeSwap(req, res));

router.post('/withdraw/fee-estimate', (req, res) => walletController.estimateWithdrawalFee(req, res));

router.get('/withdraw/paystack/quote', authenticate, (req, res) => walletController.getPaystackWithdrawQuote(req, res));
router.post('/withdraw/paystack', authenticate, (req, res) => walletController.withdrawPaystack(req, res));
router.post('/withdraw/paystack/finalize', authenticate, (req, res) => walletController.finalizePaystackWithdraw(req, res));

router.post('/withdraw', authenticate, (req, res) => walletController.withdraw(req, res));

router.post('/:userId/withdraw', authenticate, selfOrAdmin, (req, res) => walletController.withdraw(req, res));

export default router;
