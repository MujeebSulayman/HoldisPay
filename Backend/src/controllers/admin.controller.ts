import { Request, Response } from 'express';
import { adminService } from '../services/admin.service';
import { analyticsService } from '../services/analytics.service';
import { transactionService } from '../services/transaction.service';
import { userService } from '../services/user.service';
import { logger } from '../utils/logger';
import { InvoiceStatus } from '../types/contract';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class AdminController {

  async getSetupStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = await adminService.getSetupStatus();
      res.status(200).json({ success: true, data: status });
    } catch (error) {
      logger.error('Get setup status error', { error });
      res.status(500).json({
        error: 'Setup status failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createFirstAdmin(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, firstName, lastName, setupSecret } = req.body;
      if (!email || !password || !firstName || !lastName) {
        res.status(400).json({
          error: 'Missing required fields',
          message: 'email, password, firstName, and lastName are required',
        });
        return;
      }
      const result = await adminService.createFirstAdmin({
        email: String(email).trim(),
        password: String(password),
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        setupSecret: setupSecret != null ? String(setupSecret) : undefined,
      });
      res.status(201).json({
        success: true,
        message: 'Admin account created. You can sign in now.',
        data: result,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('already exists') || msg.includes('Invalid setup secret')) {
        res.status(400).json({ error: 'Bad request', message: msg });
        return;
      }
      if (msg.includes('Admin already exists')) {
        res.status(409).json({ error: 'Conflict', message: msg });
        return;
      }
      logger.error('Create first admin error', { error });
      res.status(500).json({ error: 'Setup failed', message: msg });
    }
  }

  async getAllInvoices(req: Request, res: Response): Promise<void> {
    try {
      const {
        status,
        minAmount,
        maxAmount,
        tokenAddress,
        startDate,
        endDate,
        issuer,
        payer,
        receiver,
        requiresDelivery,
      } = req.query;

      const filters: any = {};
      if (status) filters.status = parseInt(status as string) as InvoiceStatus;
      if (minAmount) filters.minAmount = minAmount;
      if (maxAmount) filters.maxAmount = maxAmount;
      if (tokenAddress) filters.tokenAddress = tokenAddress;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (issuer) filters.issuer = issuer;
      if (payer) filters.payer = payer;
      if (receiver) filters.receiver = receiver;
      if (requiresDelivery) filters.requiresDelivery = requiresDelivery === 'true';

      const invoices = await adminService.getAllInvoices(filters);

      res.status(200).json({
        success: true,
        data: {
          invoices,
          total: invoices.length,
          filters,
        },
      });
    } catch (error) {
      logger.error('Get all invoices API error', { error });
      res.status(500).json({
        error: 'Failed to get invoices',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getInvoiceById(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = req.params;
      if (!invoiceId) {
        res.status(400).json({ error: 'Missing invoiceId' });
        return;
      }
      const invoice = await adminService.getInvoiceById(invoiceId);
      if (!invoice) {
        res.status(404).json({ error: 'Invoice not found', message: 'Invalid or unknown invoice id' });
        return;
      }
      res.status(200).json({ success: true, data: invoice });
    } catch (error) {
      logger.error('Get invoice by id API error', { error });
      res.status(500).json({
        error: 'Failed to get invoice',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getInvoiceAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, tokenAddress } = req.query;

      const analytics = await analyticsService.getInvoiceAnalytics(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        tokenAddress as string | undefined
      );

      res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      logger.error('Get invoice analytics API error', { error });
      res.status(500).json({
        error: 'Failed to get analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getFailedInvoices(req: Request, res: Response): Promise<void> {
    try {
      const failedInvoices = await analyticsService.getFailedInvoices();

      res.status(200).json({
        success: true,
        data: {
          invoices: failedInvoices,
          total: failedInvoices.length,
        },
      });
    } catch (error) {
      logger.error('Get failed invoices API error', { error });
      res.status(500).json({
        error: 'Failed to get failed invoices',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getRevenueReport(req: Request, res: Response): Promise<void> {
    try {
      const { period = 'monthly', startDate, endDate } = req.query;

      if (!['daily', 'weekly', 'monthly'].includes(period as string)) {
        res.status(400).json({
          error: 'Invalid period',
          message: 'Period must be daily, weekly, or monthly',
        });
        return;
      }

      const report = await analyticsService.getRevenueReport(
        period as 'daily' | 'weekly' | 'monthly',
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.status(200).json({
        success: true,
        data: {
          period,
          reports: report,
        },
      });
    } catch (error) {
      logger.error('Get revenue report API error', { error });
      res.status(500).json({
        error: 'Failed to get revenue report',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getTransactionVolume(req: Request, res: Response): Promise<void> {
    try {
      const volumeByToken = await analyticsService.getTransactionVolumeByToken();

      res.status(200).json({
        success: true,
        data: volumeByToken,
      });
    } catch (error) {
      logger.error('Get transaction volume API error', { error });
      res.status(500).json({
        error: 'Failed to get transaction volume',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getTransactionsOverview(req: Request, res: Response): Promise<void> {
    try {
      const overview = await transactionService.getTransactionsOverview();
      res.status(200).json({ success: true, data: overview });
    } catch (error) {
      logger.error('Get transactions overview API error', { error });
      res.status(500).json({
        error: 'Failed to get transactions overview',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getTopUsers(req: Request, res: Response): Promise<void> {
    try {
      const { limit = '10' } = req.query;

      const topUsers = await analyticsService.getTopUsersByVolume(parseInt(limit as string));

      res.status(200).json({
        success: true,
        data: {
          users: topUsers,
          limit: parseInt(limit as string),
        },
      });
    } catch (error) {
      logger.error('Get top users API error', { error });
      res.status(500).json({
        error: 'Failed to get top users',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getRevenueForecast(req: Request, res: Response): Promise<void> {
    try {
      const { daysAhead = '30' } = req.query;

      const forecast = await analyticsService.getRevenueForecast(parseInt(daysAhead as string));

      res.status(200).json({
        success: true,
        data: forecast,
      });
    } catch (error) {
      logger.error('Get revenue forecast API error', { error });
      res.status(500).json({
        error: 'Failed to get revenue forecast',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const {
        kycStatus,
        accountType,
        startDate,
        endDate,
        searchQuery,
      } = req.query;

      const filters: any = {};
      if (kycStatus) filters.kycStatus = kycStatus;
      if (accountType) filters.accountType = accountType;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (searchQuery) filters.searchQuery = searchQuery;

      const users = await adminService.getFilteredUsers(filters);

      res.status(200).json({
        success: true,
        data: {
          users,
          total: users.length,
          filters,
        },
      });
    } catch (error) {
      logger.error('Search users API error', { error });
      res.status(500).json({
        error: 'Failed to search users',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getUserActivityLogs(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const activities = await adminService.getUserActivityLogs(userId);

      res.status(200).json({
        success: true,
        data: {
          userId,
          activities,
          total: activities.length,
        },
      });
    } catch (error) {
      logger.error('Get user activity logs API error', { error });
      res.status(500).json({
        error: 'Failed to get activity logs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async bulkUpdateKYC(req: Request, res: Response): Promise<void> {
    try {
      const { userIds, status, reviewedBy } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json({
          error: 'Missing user IDs',
          message: 'userIds array is required',
        });
        return;
      }

      if (!status || !reviewedBy) {
        res.status(400).json({
          error: 'Missing required fields',
          message: 'status and reviewedBy are required',
        });
        return;
      }

      const result = await adminService.bulkUpdateKYC(userIds, status, reviewedBy);

      const adminId = (req as AuthenticatedRequest).user?.userId;
      if (adminId) {
        adminService.logAdminAction({
          adminUserId: adminId,
          action: 'kyc_bulk_update',
          targetType: 'users',
          targetId: userIds.join(','),
          details: { status, reviewedBy, successful: result.successful.length, failed: result.failed.length },
        }).catch(() => {});
      }

      res.status(200).json({
        success: true,
        message: `Updated ${result.successful.length} users successfully`,
        data: result,
      });
    } catch (error) {
      logger.error('Bulk update KYC API error', { error });
      res.status(500).json({
        error: 'Failed to bulk update KYC',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getUserSegmentation(req: Request, res: Response): Promise<void> {
    try {
      const segmentation = await adminService.getUserSegmentation();

      res.status(200).json({
        success: true,
        data: segmentation,
      });
    } catch (error) {
      logger.error('Get user segmentation API error', { error });
      res.status(500).json({
        error: 'Failed to get user segmentation',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getWalletHealth(req: Request, res: Response): Promise<void> {
    try {
      const healthStatuses = await adminService.getWalletHealthStatuses();

      const criticalIssues = healthStatuses.filter(h => h.issues.length > 0);

      res.status(200).json({
        success: true,
        data: {
          wallets: healthStatuses,
          total: healthStatuses.length,
          criticalIssues: criticalIssues.length,
        },
      });
    } catch (error) {
      logger.error('Get wallet health API error', { error });
      res.status(500).json({
        error: 'Failed to get wallet health',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getAllAddressesWithBalances(req: Request, res: Response): Promise<void> {
    try {
      const addresses = await adminService.getAllChildAddressesWithBalances();

      res.status(200).json({
        success: true,
        data: {
          addresses,
          total: addresses.length,
        },
      });
    } catch (error) {
      logger.error('Get all addresses with balances API error', { error });
      res.status(500).json({
        error: 'Failed to get addresses',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getLowBalanceAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { threshold } = req.query;

      const alerts = await adminService.getLowBalanceAlerts(threshold as string);

      res.status(200).json({
        success: true,
        data: {
          alerts,
          total: alerts.length,
        },
      });
    } catch (error) {
      logger.error('Get low balance alerts API error', { error });
      res.status(500).json({
        error: 'Failed to get alerts',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getTokenBalanceBreakdown(req: Request, res: Response): Promise<void> {
    try {
      const breakdown = await adminService.getTokenBalanceBreakdown();

      res.status(200).json({
        success: true,
        data: breakdown,
      });
    } catch (error) {
      logger.error('Get token balance breakdown API error', { error });
      res.status(500).json({
        error: 'Failed to get token breakdown',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getPlatformMetrics(req: Request, res: Response): Promise<void> {
    try {
      const now = new Date();
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const lastMonthKey = `${startOfLastMonth.getFullYear()}-${String(startOfLastMonth.getMonth() + 1).padStart(2, '0')}`;

      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfThisWeek = new Date(now);
      startOfThisWeek.setDate(now.getDate() - now.getDay());
      startOfThisWeek.setHours(0, 0, 0, 0);

      const [metrics, revenueReport, newUsersThisMonth, newUsersThisWeek, newUsersToday, contractCounts] = await Promise.all([
        analyticsService.getPlatformMetrics(),
        analyticsService.getRevenueReport('monthly').catch(() => [] as { period: string; totalRevenue: string }[]),
        userService.getCountCreatedAfter(startOfThisMonth),
        userService.getCountCreatedAfter(startOfThisWeek),
        userService.getCountCreatedAfter(startOfToday),
        adminService.getContractCounts(),
      ]);

      const byPeriod = Object.fromEntries(
        (revenueReport as { period: string; totalRevenue: string }[]).map((r) => [r.period, r.totalRevenue])
      );
      const revenueThisMonth = byPeriod[currentMonthKey] ?? '0';
      const revenueLastMonth = byPeriod[lastMonthKey] ?? '0';

      const pendingInvoices = metrics.totalInvoices - metrics.completedInvoices;
      res.status(200).json({
        success: true,
        data: {
          users: {
            total: metrics.totalUsers,
            active: metrics.activeUsers,
            newThisMonth: newUsersThisMonth,
            newThisWeek: newUsersThisWeek,
            newToday: newUsersToday,
          },
          invoices: {
            total: metrics.totalInvoices,
            completed: metrics.completedInvoices,
            pending: pendingInvoices,
            totalVolume: metrics.totalVolume,
          },
          revenue: {
            total: metrics.totalRevenue,
            thisMonth: revenueThisMonth,
            lastMonth: revenueLastMonth,
          },
          contracts: {
            total: contractCounts.total,
            active: contractCounts.active,
            completed: contractCounts.completed,
            cancelled: contractCounts.cancelled,
            disputed: contractCounts.disputed,
          },
        },
      });
    } catch (error) {
      logger.error('Get platform metrics API error', { error });
      res.status(500).json({
        error: 'Failed to get platform metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getUsersGrowthReport(req: Request, res: Response): Promise<void> {
    try {
      const periods = Math.min(24, Math.max(1, parseInt(String(req.query.periods || 12), 10) || 12));
      const reports = await userService.getUsersGrowthReport(periods);
      res.status(200).json({ success: true, data: { reports } });
    } catch (error) {
      logger.error('Get users growth report API error', { error });
      res.status(500).json({
        error: 'Failed to get users growth report',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getPaymentContractById(req: Request, res: Response): Promise<void> {
    try {
      const { contractId } = req.params;
      if (!contractId) {
        res.status(400).json({ error: 'Missing contractId' });
        return;
      }
      const contract = await adminService.getPaymentContractById(contractId);
      if (!contract) {
        res.status(404).json({ error: 'Contract not found', message: 'Invalid or unknown contract id' });
        return;
      }
      res.status(200).json({ success: true, data: contract });
    } catch (error) {
      logger.error('Get contract by id API error', { error });
      res.status(500).json({
        error: 'Failed to get contract',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getPaymentContracts(req: Request, res: Response): Promise<void> {
    try {
      const { status, employer, contractor, startDate, endDate, limit, offset } = req.query;
      const filters: any = {};
      if (status) filters.status = String(status);
      if (employer) filters.employer = String(employer);
      if (contractor) filters.contractor = String(contractor);
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (limit) filters.limit = parseInt(String(limit), 10);
      if (offset) filters.offset = parseInt(String(offset), 10);

      const result = await adminService.getPaymentContracts(filters);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error('Get payment contracts API error', { error });
      res.status(500).json({
        error: 'Failed to get payment contracts',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateContractStatus(req: Request, res: Response): Promise<void> {
    try {
      const { contractId } = req.params;
      const adminReq = req as AuthenticatedRequest;
      const adminId = adminReq.user?.userId;
      if (!adminId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!contractId) {
        res.status(400).json({ error: 'Missing contractId' });
        return;
      }
      const { status } = req.body;
      if (!status || typeof status !== 'string') {
        res.status(400).json({ error: 'Body must include status (string)' });
        return;
      }
      const result = await adminService.updateContractStatus(contractId, status);
      adminService.logAdminAction({
        adminUserId: adminId,
        action: 'contract_status_update',
        targetType: 'contract',
        targetId: contractId,
        details: { status },
      }).catch(() => {});
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error('Admin update contract status API error', { error });
      res.status(500).json({
        error: 'Failed to update contract status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async backfillChainIds(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      const result = await transactionService.backfillChainIds({ limit });
      const adminId = (req as AuthenticatedRequest).user?.userId;
      if (adminId) {
        adminService.logAdminAction({
          adminUserId: adminId,
          action: 'transactions_backfill',
          details: { limit },
        }).catch(() => {});
      }
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error('Admin backfill chain_ids failed', { error });
      res.status(500).json({
        success: false,
        error: 'Backfill failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { userId, txType, status, chainId, tokenAddress, startDate, endDate, limit, offset } = req.query;
      const result = await transactionService.getAllTransactionsForAdmin({
        userId: userId as string | undefined,
        txType: txType as string | undefined,
        status: status as string | undefined,
        chainId: chainId as string | undefined,
        tokenAddress: tokenAddress as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        limit: limit != null ? parseInt(String(limit), 10) : undefined,
        offset: offset != null ? parseInt(String(offset), 10) : undefined,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error('Get admin transactions API error', { error });
      res.status(500).json({
        error: 'Failed to get transactions',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getAuditLog(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 50;
      const offset = req.query.offset != null ? parseInt(String(req.query.offset), 10) : 0;
      const result = await adminService.getAdminAuditLog({ limit, offset });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error('Get audit log API error', { error });
      res.status(500).json({
        error: 'Failed to get audit log',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getUserSummary(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      if (!userId) {
        res.status(400).json({ error: 'Missing userId' });
        return;
      }
      const summary = await adminService.getUserSummary(userId);
      res.status(200).json({ success: true, data: summary });
    } catch (error) {
      logger.error('Get user summary API error', { error });
      res.status(500).json({
        error: 'Failed to get user summary',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async sendPasswordReset(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const adminReq = req as AuthenticatedRequest;
      const adminId = adminReq.user?.userId;
      if (!adminId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!userId) {
        res.status(400).json({ error: 'Missing userId' });
        return;
      }
      const result = await adminService.sendPasswordResetForUser(userId);
      adminService.logAdminAction({
        adminUserId: adminId,
        action: 'send_password_reset',
        targetType: 'user',
        targetId: userId,
      }).catch(() => {});
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error('Admin send password reset API error', { error });
      res.status(500).json({
        error: 'Failed to send password reset',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateUserStatus(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const adminReq = req as AuthenticatedRequest;
      const adminId = adminReq.user?.userId;
      if (!adminId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!userId) {
        res.status(400).json({ error: 'Missing userId' });
        return;
      }
      const { isActive } = req.body;
      if (typeof isActive !== 'boolean') {
        res.status(400).json({ error: 'Body must include isActive (boolean)' });
        return;
      }
      if (userId === adminId && !isActive) {
        res.status(400).json({ error: 'You cannot deactivate your own account' });
        return;
      }
      const { updated } = await adminService.setUserActiveStatus(userId, isActive);
      if (updated) {
        adminService.logAdminAction({
          adminUserId: adminId,
          action: 'user_status_update',
          targetType: 'user',
          targetId: userId,
          details: { isActive },
        }).catch(() => {});
      }
      res.status(200).json({ success: true, data: { updated } });
    } catch (error) {
      logger.error('Update user status API error', { error });
      res.status(500).json({
        error: 'Failed to update user status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getSystemHealth(req: Request, res: Response): Promise<void> {
    try {
      const { supabase } = await import('../config/supabase');
      const dbOk = await supabase.from('users').select('id').limit(1).then(({ error }) => !error);
      res.status(200).json({
        success: true,
        data: {
          database: dbOk ? 'ok' : 'error',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('System health check error', { error });
      res.status(200).json({
        success: true,
        data: { database: 'error', timestamp: new Date().toISOString() },
      });
    }
  }
}

export const adminController = new AdminController();
