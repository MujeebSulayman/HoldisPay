import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { adminController } from '../controllers/admin.controller';
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


router.get('/revenue/report', authenticate, requireAdmin, (req, res) => 
  adminController.getRevenueReport(req, res)
);


router.get('/revenue/forecast', authenticate, requireAdmin, (req, res) => 
  adminController.getRevenueForecast(req, res)
);


router.get('/transactions/volume', authenticate, requireAdmin, (req, res) => 
  adminController.getTransactionVolume(req, res)
);


router.get('/users/search', authenticate, requireAdmin, (req, res) => 
  adminController.searchUsers(req, res)
);


router.get('/users/:userId/activity', authenticate, requireAdmin, (req, res) => 
  adminController.getUserActivityLogs(req, res)
);


router.get('/users/top', authenticate, requireAdmin, (req, res) => 
  adminController.getTopUsers(req, res)
);


router.get('/users/segmentation', authenticate, requireAdmin, (req, res) => 
  adminController.getUserSegmentation(req, res)
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
  adminController.getWaitlist(req, res)
);

router.post('/transactions/backfill-chain-ids', authenticate, requireAdmin, (req, res) =>
  adminController.backfillChainIds(req, res)
);

export default router;
