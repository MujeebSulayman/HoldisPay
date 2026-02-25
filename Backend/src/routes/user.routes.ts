import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { kycUploadController } from '../controllers/kyc-upload.controller';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware';

const router = Router();


router.post('/login', (req, res) => userController.login(req, res));


router.post('/register', (req, res) => userController.register(req, res));


router.get('/', authenticate, requireAdmin, (req, res) => userController.getAllUsers(req, res));


router.get('/:userId/profile', authenticate, (req, res) => userController.getProfile(req, res));


router.get('/:userId/wallet', authenticate, (req, res) => userController.getWallet(req, res));


router.get('/:userId/wallets/all', authenticate, (req, res) => userController.getAllWallets(req, res));


router.get('/:userId/wallet/overview', authenticate, (req, res) => userController.getWalletOverview(req, res));


router.get('/:userId/wallets/:chainId', authenticate, (req, res) => userController.getChainWallet(req, res));


router.post('/:userId/kyc/upload', authenticate, (req, res) => kycUploadController.uploadDocuments(req, res));
router.post('/:userId/kyc/submit', authenticate, (req, res) => userController.submitKYC(req, res));


router.post('/:userId/kyc/update', authenticate, requireAdmin, (req, res) => userController.updateKYC(req, res));


router.patch('/:userId/profile/update', authenticate, (req, res) => userController.updateProfile(req, res));


router.post('/:userId/wallet/fund', authenticate, requireAdmin, (req, res) => userController.fundWallet(req, res));


router.get('/:userId/transactions', authenticate, (req, res) => userController.getUserTransactions(req, res));

export default router;
