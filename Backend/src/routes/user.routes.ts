import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { kycUploadController } from '../controllers/kyc-upload.controller';
import { paymentMethodController } from '../controllers/payment-method.controller';
import { authenticate, requireAdmin, requireSelfOrAdmin } from '../middlewares/auth.middleware';

const router = Router();

const selfOrAdmin = requireSelfOrAdmin('userId');

router.post('/login', (req, res) => userController.login(req, res));

router.post('/register', (req, res) => userController.register(req, res));

router.get('/', authenticate, requireAdmin, (req, res) => userController.getAllUsers(req, res));

router.get('/check-username', (req, res) => userController.checkUsername(req, res));

router.get('/:userId/profile', authenticate, selfOrAdmin, (req, res) => userController.getProfile(req, res));

router.get('/:userId/wallet', authenticate, selfOrAdmin, (req, res) => userController.getWallet(req, res));

router.get('/:userId/wallets/all', authenticate, selfOrAdmin, (req, res) => userController.getAllWallets(req, res));

router.get('/:userId/wallet/overview', authenticate, selfOrAdmin, (req, res) => userController.getWalletOverview(req, res));

router.get('/:userId/balance/consolidated', authenticate, selfOrAdmin, (req, res) => userController.getConsolidatedBalance(req, res));

router.get('/:userId/wallets/:chainId', authenticate, selfOrAdmin, (req, res) => userController.getChainWallet(req, res));

router.post('/:userId/kyc/upload', authenticate, selfOrAdmin, (req, res) => kycUploadController.uploadDocuments(req, res));
router.post('/:userId/kyc/submit', authenticate, selfOrAdmin, (req, res) => userController.submitKYC(req, res));

router.post('/:userId/kyc/update', authenticate, requireAdmin, (req, res) => userController.updateKYC(req, res));

router.patch('/:userId/profile/update', authenticate, selfOrAdmin, (req, res) => userController.updateProfile(req, res));

router.post('/:userId/wallet/fund', authenticate, requireAdmin, (req, res) => userController.fundWallet(req, res));

router.get('/:userId/transactions', authenticate, selfOrAdmin, (req, res) => userController.getUserTransactions(req, res));

router.get('/:userId/payment-methods', authenticate, selfOrAdmin, (req, res) => paymentMethodController.list(req, res));
router.post('/:userId/payment-methods', authenticate, selfOrAdmin, (req, res) => paymentMethodController.add(req, res));
router.patch('/:userId/payment-methods/:id/default', authenticate, selfOrAdmin, (req, res) => paymentMethodController.setDefault(req, res));
router.delete('/:userId/payment-methods/:id', authenticate, selfOrAdmin, (req, res) => paymentMethodController.remove(req, res));

export default router;
