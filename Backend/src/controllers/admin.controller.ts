import { Request, Response } from 'express';
import { adminService } from '../services/admin.service';
import { analyticsService } from '../services/analytics.service';
import { transactionService } from '../services/transaction.service';
import { logger } from '../utils/logger';
import { InvoiceStatus } from '../types/contract';

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
      const metrics = await analyticsService.getPlatformMetrics();
      const pendingInvoices = metrics.totalInvoices - metrics.completedInvoices;
      res.status(200).json({
        success: true,
        data: {
          users: {
            total: metrics.totalUsers,
            active: metrics.activeUsers,
            newThisMonth: 0,
          },
          invoices: {
            total: metrics.totalInvoices,
            completed: metrics.completedInvoices,
            pending: pendingInvoices,
            totalVolume: metrics.totalVolume,
          },
          revenue: {
            total: metrics.totalRevenue,
            thisMonth: metrics.totalRevenue,
            lastMonth: '0',
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

  async backfillChainIds(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      const result = await transactionService.backfillChainIds({ limit });
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
}

export const adminController = new AdminController();
