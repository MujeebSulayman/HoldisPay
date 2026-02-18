import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/admin/invoices:
 *   get:
 *     summary: Get all invoices with optional filters
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: integer
 *           enum: [0, 1, 2, 3, 4]
 *       - in: query
 *         name: minAmount
 *         schema:
 *           type: string
 *       - in: query
 *         name: maxAmount
 *         schema:
 *           type: string
 *       - in: query
 *         name: tokenAddress
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: issuer
 *         schema:
 *           type: string
 *       - in: query
 *         name: payer
 *         schema:
 *           type: string
 *       - in: query
 *         name: receiver
 *         schema:
 *           type: string
 *       - in: query
 *         name: requiresDelivery
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of invoices
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/invoices', authenticate, requireAdmin, (req, res) => 
  adminController.getAllInvoices(req, res)
);

/**
 * @swagger
 * /api/admin/invoices/analytics:
 *   get:
 *     summary: Get invoice analytics (volume, completion rate, etc.)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: tokenAddress
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice analytics
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/invoices/analytics', authenticate, requireAdmin, (req, res) => 
  adminController.getInvoiceAnalytics(req, res)
);

/**
 * @swagger
 * /api/admin/invoices/failed:
 *   get:
 *     summary: Get failed or stuck invoices
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of failed invoices
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/invoices/failed', authenticate, requireAdmin, (req, res) => 
  adminController.getFailedInvoices(req, res)
);

/**
 * @swagger
 * /api/admin/revenue/report:
 *   get:
 *     summary: Get revenue report by period
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: monthly
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Revenue report
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/revenue/report', authenticate, requireAdmin, (req, res) => 
  adminController.getRevenueReport(req, res)
);

/**
 * @swagger
 * /api/admin/revenue/forecast:
 *   get:
 *     summary: Get revenue forecast based on pending invoices
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: daysAhead
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Revenue forecast
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/revenue/forecast', authenticate, requireAdmin, (req, res) => 
  adminController.getRevenueForecast(req, res)
);

/**
 * @swagger
 * /api/admin/transactions/volume:
 *   get:
 *     summary: Get transaction volume metrics by token
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Transaction volume by token
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/transactions/volume', authenticate, requireAdmin, (req, res) => 
  adminController.getTransactionVolume(req, res)
);

/**
 * @swagger
 * /api/admin/users/search:
 *   get:
 *     summary: Search and filter users
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: kycStatus
 *         schema:
 *           type: string
 *       - in: query
 *         name: accountType
 *         schema:
 *           type: string
 *           enum: [individual, business]
 *       - in: query
 *         name: searchQuery
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Filtered users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/users/search', authenticate, requireAdmin, (req, res) => 
  adminController.searchUsers(req, res)
);

/**
 * @swagger
 * /api/admin/users/{userId}/activity:
 *   get:
 *     summary: Get user activity logs
 *     tags: [Admin]
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
 *         description: User activity logs
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/users/:userId/activity', authenticate, requireAdmin, (req, res) => 
  adminController.getUserActivityLogs(req, res)
);

/**
 * @swagger
 * /api/admin/users/top:
 *   get:
 *     summary: Get top users by transaction volume
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Top users by volume
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/users/top', authenticate, requireAdmin, (req, res) => 
  adminController.getTopUsers(req, res)
);

/**
 * @swagger
 * /api/admin/users/segmentation:
 *   get:
 *     summary: Get user segmentation (active, inactive, high-value, at-risk)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User segmentation
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/users/segmentation', authenticate, requireAdmin, (req, res) => 
  adminController.getUserSegmentation(req, res)
);

/**
 * @swagger
 * /api/admin/users/kyc/bulk-update:
 *   post:
 *     summary: Bulk update KYC status for multiple users
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userIds, status, reviewedBy]
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               status:
 *                 type: string
 *                 enum: [pending, submitted, under_review, verified, rejected]
 *               reviewedBy:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bulk update result
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/users/kyc/bulk-update', authenticate, requireAdmin, (req, res) => 
  adminController.bulkUpdateKYC(req, res)
);

/**
 * @swagger
 * /api/admin/wallets/health:
 *   get:
 *     summary: Get wallet health monitoring status
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet health statuses
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/wallets/health', authenticate, requireAdmin, (req, res) => 
  adminController.getWalletHealth(req, res)
);

/**
 * @swagger
 * /api/admin/wallets/addresses:
 *   get:
 *     summary: List all child addresses with balances
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All addresses with balances
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/wallets/addresses', authenticate, requireAdmin, (req, res) => 
  adminController.getAllAddressesWithBalances(req, res)
);

/**
 * @swagger
 * /api/admin/wallets/alerts/low-balance:
 *   get:
 *     summary: Get low balance alerts
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: string
 *           default: '1000000000000000'
 *     responses:
 *       200:
 *         description: Low balance alerts
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/wallets/alerts/low-balance', authenticate, requireAdmin, (req, res) => 
  adminController.getLowBalanceAlerts(req, res)
);

/**
 * @swagger
 * /api/admin/wallets/token-breakdown:
 *   get:
 *     summary: Get token balance breakdown across all users
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Token balance breakdown
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/wallets/token-breakdown', authenticate, requireAdmin, (req, res) => 
  adminController.getTokenBalanceBreakdown(req, res)
);

/**
 * @swagger
 * /api/admin/metrics:
 *   get:
 *     summary: Get overall platform metrics
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Platform metrics
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/metrics', authenticate, requireAdmin, (req, res) => 
  adminController.getPlatformMetrics(req, res)
);

export default router;
