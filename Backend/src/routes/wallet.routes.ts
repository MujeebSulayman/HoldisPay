import { Router } from 'express';
import { walletController } from '../controllers/wallet.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/wallets/assets:
 *   get:
 *     summary: Get all supported assets for swapping
 *     tags: [Wallets]
 *     responses:
 *       200:
 *         description: List of supported assets
 */
router.get('/assets', (req, res) => walletController.getAssets(req, res));

/**
 * @swagger
 * /api/wallets/chains/{chainId}/assets:
 *   get:
 *     summary: Get enabled assets for a specific chain
 *     tags: [Wallets]
 *     parameters:
 *       - in: path
 *         name: chainId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of enabled assets for the chain
 */
router.get('/chains/:chainId/assets', (req, res) => walletController.getChainAssets(req, res));

/**
 * @swagger
 * /api/wallets/{userId}/swap/quote:
 *   post:
 *     summary: Get swap quote (estimate)
 *     tags: [Wallets]
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
 *             required: [fromAssetId, toAssetId, amount]
 *             properties:
 *               fromAssetId:
 *                 type: string
 *                 example: asset_usdc_base_mainnet
 *               toAssetId:
 *                 type: string
 *                 example: asset_usdt_base_mainnet
 *               amount:
 *                 type: string
 *                 example: "100"
 *               order:
 *                 type: string
 *                 enum: [FASTEST, CHEAPEST, RECOMMENDED, NO_SLIPPAGE]
 *               recipientAddress:
 *                 type: string
 *     responses:
 *       200:
 *         description: Swap quote
 *       401:
 *         description: Unauthorized
 */
router.post('/:userId/swap/quote', authenticate, (req, res) => walletController.getSwapQuote(req, res));

/**
 * @swagger
 * /api/wallets/{userId}/swap/execute:
 *   post:
 *     summary: Execute asset swap or bridge
 *     tags: [Wallets]
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
 *             required: [fromAssetId, toAssetId, amount]
 *             properties:
 *               fromAssetId:
 *                 type: string
 *               toAssetId:
 *                 type: string
 *               amount:
 *                 type: string
 *               order:
 *                 type: string
 *                 enum: [FASTEST, CHEAPEST, RECOMMENDED, NO_SLIPPAGE]
 *               recipientAddress:
 *                 type: string
 *               reference:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Swap initiated
 *       401:
 *         description: Unauthorized
 */
router.post('/:userId/swap/execute', authenticate, (req, res) => walletController.executeSwap(req, res));

/**
 * @swagger
 * /api/wallets/{userId}/withdraw:
 *   post:
 *     summary: Withdraw funds to external wallet
 *     tags: [Wallets]
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
 *             required: [recipientAddress, amount]
 *             properties:
 *               recipientAddress:
 *                 type: string
 *                 example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *               amount:
 *                 type: string
 *                 example: "100"
 *               token:
 *                 type: string
 *                 example: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
 *                 description: ERC20 token address (omit for native token)
 *               reference:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Withdrawal initiated
 *       401:
 *         description: Unauthorized
 */
router.post('/:userId/withdraw', authenticate, (req, res) => walletController.withdraw(req, res));

export default router;
