import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     user:
 *                       type: object
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', (req, res) => userController.login(req, res));

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: Register a new user and create child wallet
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserRegistration'
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Bad request
 */
router.post('/register', (req, res) => userController.register(req, res));

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users with wallet details (admin only)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: includeWallet
 *         schema:
 *           type: boolean
 *           default: true
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', authenticate, requireAdmin, (req, res) => userController.getAllUsers(req, res));

/**
 * @swagger
 * /api/users/{userId}/profile:
 *   get:
 *     summary: Get user profile with wallet and stats
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User profile
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/:userId/profile', authenticate, (req, res) => userController.getProfile(req, res));

/**
 * @swagger
 * /api/users/{userId}/wallet:
 *   get:
 *     summary: Get user wallet details and balance
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Wallet details
 *       401:
 *         description: Unauthorized
 */
router.get('/:userId/wallet', authenticate, (req, res) => userController.getWallet(req, res));

/**
 * @swagger
 * /api/users/{userId}/wallets/all:
 *   get:
 *     summary: Get all user wallets across chains
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: All user wallets
 */
router.get('/:userId/wallets/all', authenticate, (req, res) => userController.getAllWallets(req, res));

/**
 * @swagger
 * /api/users/{userId}/wallets/{chainId}:
 *   get:
 *     summary: Get user wallet for specific chain
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: chainId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chain wallet details
 */
router.get('/:userId/wallets/:chainId', authenticate, (req, res) => userController.getChainWallet(req, res));

/**
 * @swagger
 * /api/users/{userId}/kyc/submit:
 *   post:
 *     summary: Submit KYC documents for verification
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [documents, verificationLevel]
 *             properties:
 *               documents:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [passport, drivers_license, national_id, business_registration]
 *                     documentNumber:
 *                       type: string
 *                     issueDate:
 *                       type: string
 *                     expiryDate:
 *                       type: string
 *                     issuingCountry:
 *                       type: string
 *                     frontImageUrl:
 *                       type: string
 *                     backImageUrl:
 *                       type: string
 *                     selfieUrl:
 *                       type: string
 *               verificationLevel:
 *                 type: string
 *                 enum: [basic, advanced, business]
 *               additionalInfo:
 *                 type: object
 *     responses:
 *       200:
 *         description: KYC submitted
 *       401:
 *         description: Unauthorized
 */
router.post('/:userId/kyc/submit', authenticate, (req, res) => userController.submitKYC(req, res));

/**
 * @swagger
 * /api/users/{userId}/kyc/update:
 *   post:
 *     summary: Update KYC status (admin only)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status, reviewedBy]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, submitted, under_review, verified, rejected]
 *               rejectionReason:
 *                 type: string
 *               notes:
 *                 type: string
 *               reviewedBy:
 *                 type: string
 *     responses:
 *       200:
 *         description: KYC status updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/:userId/kyc/update', authenticate, requireAdmin, (req, res) => userController.updateKYC(req, res));

/**
 * @swagger
 * /api/users/{userId}/profile/update:
 *   patch:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               address:
 *                 type: object
 *               businessInfo:
 *                 type: object
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Unauthorized
 */
router.patch('/:userId/profile/update', authenticate, (req, res) => userController.updateProfile(req, res));

/**
 * @swagger
 * /api/users/{userId}/wallet/fund:
 *   post:
 *     summary: Fund user wallet from master wallet (admin only)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: string
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Wallet funded
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/:userId/wallet/fund', authenticate, requireAdmin, (req, res) => userController.fundWallet(req, res));

/**
 * @swagger
 * /api/users/{userId}/transactions:
 *   get:
 *     summary: Get user's transaction history with filtering
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           description: Filter by status (comma-separated for multiple, e.g. "pending,PENDING,PROCESSING")
 *       - in: query
 *         name: txType
 *         schema:
 *           type: string
 *           description: Filter by transaction type
 *       - in: query
 *         name: chainId
 *         schema:
 *           type: string
 *           description: Filter by blockchain
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *           description: Filter transactions after this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *           description: Filter transactions before this date
 *     responses:
 *       200:
 *         description: User's transaction history
 *       401:
 *         description: Unauthorized
 */
router.get('/:userId/transactions', authenticate, (req, res) => userController.getUserTransactions(req, res));

export default router;
