import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { adminController } from '../controllers/admin.controller';
import { waitlistController } from '../controllers/waitlist.controller';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

const setupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many setup attempts. Try again later.',
});

router.get('/setup/status', (req, res) => adminController.getSetupStatus(req, res));
router.post('/setup', setupLimiter, (req, res) => adminController.createFirstAdmin(req, res));

router.get('/invoices', authenticate, requireAdmin, (req, res) =>
  adminController.getAllInvoices(req, res)
);
router.get('/invoices/analytics', authenticate, requireAdmin, (req, res) =>
  adminController.getInvoiceAnalytics(req, res)
);
router.get('/invoices/failed', authenticate, requireAdmin, (req, res) =>
  adminController.getFailedInvoices(req, res)
);
router.get('/invoices/:invoiceId', authenticate, requireAdmin, (req, res) =>
  adminController.getInvoiceById(req, res)
);


router.get('/revenue/report', authenticate, requireAdmin, (req, res) => 
  adminController.getRevenueReport(req, res)
);


router.get('/revenue/forecast', authenticate, requireAdmin, (req, res) => 
  adminController.getRevenueForecast(req, res)
);


router.get('/transactions/volume', authenticate, requireAdmin, (req, res) =>
  adminController.getTransactionVolume(req, res)
);

router.get('/transactions/overview', authenticate, requireAdmin, (req, res) =>
  adminController.getTransactionsOverview(req, res)
);

router.get('/transactions', authenticate, requireAdmin, (req, res) =>
  adminController.getTransactions(req, res)
);


router.get('/users/search', authenticate, requireAdmin, (req, res) =>
  adminController.searchUsers(req, res)
);

router.get('/users/top', authenticate, requireAdmin, (req, res) =>
  adminController.getTopUsers(req, res)
);

router.get('/users/segmentation', authenticate, requireAdmin, (req, res) =>
  adminController.getUserSegmentation(req, res)
);

router.get('/users/:userId/activity', authenticate, requireAdmin, (req, res) =>
  adminController.getUserActivityLogs(req, res)
);

router.get('/users/:userId/summary', authenticate, requireAdmin, (req, res) =>
  adminController.getUserSummary(req, res)
);

router.patch('/users/:userId/status', authenticate, requireAdmin, (req, res) =>
  adminController.updateUserStatus(req, res)
);

router.post('/users/:userId/send-password-reset', authenticate, requireAdmin, (req, res) =>
  adminController.sendPasswordReset(req, res)
);

router.post('/users/kyc/bulk-update', authenticate, requireAdmin, (req, res) => 
  adminController.bulkUpdateKYC(req, res)
);


router.get('/wallets/health', authenticate, requireAdmin, (req, res) => 
  adminController.getWalletHealth(req, res)
);


router.get('/wallets/addresses', authenticate, requireAdmin, (req, res) => 
  adminController.getAllAddressesWithBalances(req, res)
);


router.get('/wallets/alerts/low-balance', authenticate, requireAdmin, (req, res) => 
  adminController.getLowBalanceAlerts(req, res)
);


router.get('/wallets/token-breakdown', authenticate, requireAdmin, (req, res) => 
  adminController.getTokenBalanceBreakdown(req, res)
);


router.get('/metrics', authenticate, requireAdmin, (req, res) => 
  adminController.getPlatformMetrics(req, res)
);

router.get('/waitlist', authenticate, requireAdmin, (req, res) =>
  waitlistController.list(req, res)
);

router.get('/contracts', authenticate, requireAdmin, (req, res) =>
  adminController.getPaymentContracts(req, res)
);
router.get('/contracts/:contractId', authenticate, requireAdmin, (req, res) =>
  adminController.getPaymentContractById(req, res)
);

router.patch('/contracts/:contractId/status', authenticate, requireAdmin, (req, res) =>
  adminController.updateContractStatus(req, res)
);

router.post('/transactions/backfill-chain-ids', authenticate, requireAdmin, (req, res) =>
  adminController.backfillChainIds(req, res)
);

router.get('/audit-log', authenticate, requireAdmin, (req, res) =>
  adminController.getAuditLog(req, res)
);

router.get('/system/health', authenticate, requireAdmin, (req, res) =>
  adminController.getSystemHealth(req, res)
);

export default router;
