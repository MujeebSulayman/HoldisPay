import { contractService } from './contract.service';
import { userWalletService } from './user-wallet.service';
import { userService } from './user.service';
import { logger } from '../utils/logger';
import { Invoice, InvoiceStatus } from '../types/contract';

export interface InvoiceAnalytics {
  totalInvoices: number;
  totalVolume: string;
  totalVolumeUSD: string;
  averageInvoiceSize: string;
  completionRate: number;
  byStatus: Record<string, number>;
  byToken: Record<string, { count: number; volume: string }>;
}

export interface RevenueReport {
  period: string;
  totalRevenue: string;
  revenueUSD: string;
  transactionCount: number;
  averageFee: string;
  byToken: Record<string, string>;
}

export interface UserActivityMetrics {
  userId: string;
  email: string;
  totalInvoices: number;
  totalVolume: string;
  completedInvoices: number;
  lastActivity: string;
  walletAddress: string;
  accountType: string;
}

export interface PlatformMetrics {
  totalUsers: number;
  activeUsers: number;
  totalInvoices: number;
  completedInvoices: number;
  totalVolume: string;
  totalRevenue: string;
  averageInvoiceSize: string;
  completionRate: number;
}

export class AnalyticsService {
  
  async getInvoiceAnalytics(
    startDate?: Date,
    endDate?: Date,
    tokenAddress?: string
  ): Promise<InvoiceAnalytics> {
    try {
      const totalInvoices = await contractService.getTotalInvoices();
      const invoices: Invoice[] = [];

      for (let i = 1n; i <= totalInvoices; i++) {
        try {
          const invoice = await contractService.getInvoice(i);
          
          const invoiceDate = new Date(Number(invoice.createdAt) * 1000);
          if (startDate && invoiceDate < startDate) continue;
          if (endDate && invoiceDate > endDate) continue;
          if (tokenAddress && invoice.tokenAddress.toLowerCase() !== tokenAddress.toLowerCase()) continue;

          invoices.push(invoice);
        } catch (error) {
          logger.warn('Failed to fetch invoice', { invoiceId: i, error });
        }
      }

      let totalVolume = 0n;
      const byStatus: Record<string, number> = {};
      const byToken: Record<string, { count: number; volume: string }> = {};

      for (const invoice of invoices) {
        totalVolume += invoice.amount;

        const statusName = InvoiceStatus[invoice.status];
        byStatus[statusName] = (byStatus[statusName] || 0) + 1;

        const tokenKey = invoice.tokenAddress === '0x0000000000000000000000000000000000000000' 
          ? 'ETH' 
          : invoice.tokenAddress;

        if (!byToken[tokenKey]) {
          byToken[tokenKey] = { count: 0, volume: '0' };
        }
        byToken[tokenKey].count++;
        byToken[tokenKey].volume = (BigInt(byToken[tokenKey].volume) + invoice.amount).toString();
      }

      const completedCount = byStatus['Completed'] || 0;
      const completionRate = invoices.length > 0 
        ? (completedCount / invoices.length) * 100 
        : 0;

      const averageInvoiceSize = invoices.length > 0
        ? (totalVolume / BigInt(invoices.length)).toString()
        : '0';

      return {
        totalInvoices: invoices.length,
        totalVolume: totalVolume.toString(),
        totalVolumeUSD: '0',
        averageInvoiceSize,
        completionRate: Math.round(completionRate * 100) / 100,
        byStatus,
        byToken,
      };
    } catch (error) {
      logger.error('Failed to get invoice analytics', { error });
      throw error;
    }
  }

  async getRevenueReport(
    period: 'daily' | 'weekly' | 'monthly',
    startDate?: Date,
    endDate?: Date
  ): Promise<RevenueReport[]> {
    try {
      const totalInvoices = await contractService.getTotalInvoices();
      const invoices: Invoice[] = [];

      for (let i = 1n; i <= totalInvoices; i++) {
        try {
          const invoice = await contractService.getInvoice(i);
          if (invoice.status !== InvoiceStatus.Completed) continue;

          const completedDate = new Date(Number(invoice.completedAt) * 1000);
          if (startDate && completedDate < startDate) continue;
          if (endDate && completedDate > endDate) continue;

          invoices.push(invoice);
        } catch (error) {
          logger.warn('Failed to fetch invoice for revenue', { invoiceId: i });
        }
      }

      const platformSettings = await contractService.getPlatformSettings();
      const feePercentage = Number(platformSettings.platformFee) / 10000;

      const groupedByPeriod: Record<string, Invoice[]> = {};

      for (const invoice of invoices) {
        const date = new Date(Number(invoice.completedAt) * 1000);
        let periodKey: string;

        if (period === 'daily') {
          periodKey = date.toISOString().split('T')[0];
        } else if (period === 'weekly') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().split('T')[0];
        } else {
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        if (!groupedByPeriod[periodKey]) {
          groupedByPeriod[periodKey] = [];
        }
        groupedByPeriod[periodKey].push(invoice);
      }

      const reports: RevenueReport[] = [];

      for (const [periodKey, periodInvoices] of Object.entries(groupedByPeriod)) {
        let totalRevenue = 0n;
        const byToken: Record<string, string> = {};

        for (const invoice of periodInvoices) {
          const fee = (invoice.amount * BigInt(Math.floor(feePercentage * 10000))) / 10000n;
          totalRevenue += fee;

          const tokenKey = invoice.tokenAddress === '0x0000000000000000000000000000000000000000'
            ? 'ETH'
            : invoice.tokenAddress;

          byToken[tokenKey] = byToken[tokenKey]
            ? (BigInt(byToken[tokenKey]) + fee).toString()
            : fee.toString();
        }

        const averageFee = periodInvoices.length > 0
          ? (totalRevenue / BigInt(periodInvoices.length)).toString()
          : '0';

        reports.push({
          period: periodKey,
          totalRevenue: totalRevenue.toString(),
          revenueUSD: '0',
          transactionCount: periodInvoices.length,
          averageFee,
          byToken,
        });
      }

      return reports.sort((a, b) => b.period.localeCompare(a.period));
    } catch (error) {
      logger.error('Failed to generate revenue report', { error });
      throw error;
    }
  }

  async getTopUsersByVolume(limit: number = 10): Promise<UserActivityMetrics[]> {
    try {
      const users = await userService.getAllUsers(1000, 0);
      const userMetrics: UserActivityMetrics[] = [];

      for (const user of users) {
        try {
          const wallet = await userWalletService.getUserWallet(user.id);
          if (!wallet) continue;

          const totalInvoices = await contractService.getTotalInvoices();
          let userTotalVolume = 0n;
          let userInvoiceCount = 0;
          let userCompletedCount = 0;
          let lastActivityTimestamp = 0;

          for (let i = 1n; i <= totalInvoices; i++) {
            try {
              const invoice = await contractService.getInvoice(i);
              
              if (invoice.issuer.toLowerCase() === wallet.address.toLowerCase() ||
                  invoice.payer.toLowerCase() === wallet.address.toLowerCase() ||
                  invoice.receiver.toLowerCase() === wallet.address.toLowerCase()) {
                
                userInvoiceCount++;
                userTotalVolume += invoice.amount;
                
                if (invoice.status === InvoiceStatus.Completed) {
                  userCompletedCount++;
                }

                const invoiceTimestamp = Number(invoice.createdAt);
                if (invoiceTimestamp > lastActivityTimestamp) {
                  lastActivityTimestamp = invoiceTimestamp;
                }
              }
            } catch (error) {
              continue;
            }
          }

          if (userInvoiceCount > 0) {
            userMetrics.push({
              userId: user.id,
              email: user.email,
              totalInvoices: userInvoiceCount,
              totalVolume: userTotalVolume.toString(),
              completedInvoices: userCompletedCount,
              lastActivity: new Date(lastActivityTimestamp * 1000).toISOString(),
              walletAddress: wallet.address,
              accountType: user.accountType,
            });
          }
        } catch (error) {
          logger.warn('Failed to get metrics for user', { userId: user.id });
        }
      }

      return userMetrics
        .sort((a, b) => Number(BigInt(b.totalVolume) - BigInt(a.totalVolume)))
        .slice(0, limit);
    } catch (error) {
      logger.error('Failed to get top users by volume', { error });
      throw error;
    }
  }

  async getPlatformMetrics(): Promise<PlatformMetrics> {
    try {
      const [totalUsers, totalInvoices] = await Promise.all([
        userService.getAllUsers(10000, 0).then(users => users.length),
        contractService.getTotalInvoices(),
      ]);

      let totalVolume = 0n;
      let completedCount = 0;
      let totalRevenue = 0n;

      const platformSettings = await contractService.getPlatformSettings();
      const feePercentage = Number(platformSettings.platformFee) / 10000;

      for (let i = 1n; i <= totalInvoices; i++) {
        try {
          const invoice = await contractService.getInvoice(i);
          totalVolume += invoice.amount;
          
          if (invoice.status === InvoiceStatus.Completed) {
            completedCount++;
            const fee = (invoice.amount * BigInt(Math.floor(feePercentage * 10000))) / 10000n;
            totalRevenue += fee;
          }
        } catch (error) {
          continue;
        }
      }

      const activeUsers = await this.getActiveUsersCount(30);
      const completionRate = Number(totalInvoices) > 0
        ? (completedCount / Number(totalInvoices)) * 100
        : 0;

      const averageInvoiceSize = Number(totalInvoices) > 0
        ? (totalVolume / totalInvoices).toString()
        : '0';

      return {
        totalUsers,
        activeUsers,
        totalInvoices: Number(totalInvoices),
        completedInvoices: completedCount,
        totalVolume: totalVolume.toString(),
        totalRevenue: totalRevenue.toString(),
        averageInvoiceSize,
        completionRate: Math.round(completionRate * 100) / 100,
      };
    } catch (error) {
      logger.error('Failed to get platform metrics', { error });
      throw error;
    }
  }

  private async getActiveUsersCount(daysBack: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000);

      const users = await userService.getAllUsers(10000, 0);
      let activeCount = 0;

      for (const user of users) {
        try {
          const wallet = await userWalletService.getUserWallet(user.id);
          if (!wallet) continue;

          const totalInvoices = await contractService.getTotalInvoices();
          
          for (let i = 1n; i <= totalInvoices; i++) {
            try {
              const invoice = await contractService.getInvoice(i);
              
              if (invoice.issuer.toLowerCase() === wallet.address.toLowerCase() ||
                  invoice.payer.toLowerCase() === wallet.address.toLowerCase() ||
                  invoice.receiver.toLowerCase() === wallet.address.toLowerCase()) {
                
                if (Number(invoice.createdAt) >= cutoffTimestamp) {
                  activeCount++;
                  break;
                }
              }
            } catch (error) {
              continue;
            }
          }
        } catch (error) {
          continue;
        }
      }

      return activeCount;
    } catch (error) {
      logger.error('Failed to count active users', { error });
      return 0;
    }
  }

  async getRevenueForecast(daysAhead: number = 30): Promise<{
    projected: string;
    projectedUSD: string;
    basedOnPendingInvoices: number;
    totalPendingValue: string;
  }> {
    try {
      const totalInvoices = await contractService.getTotalInvoices();
      let pendingCount = 0;
      let totalPendingValue = 0n;

      const platformSettings = await contractService.getPlatformSettings();
      const feePercentage = Number(platformSettings.platformFee) / 10000;

      for (let i = 1n; i <= totalInvoices; i++) {
        try {
          const invoice = await contractService.getInvoice(i);
          
          if (invoice.status === InvoiceStatus.Pending || 
              invoice.status === InvoiceStatus.Funded ||
              invoice.status === InvoiceStatus.Delivered) {
            pendingCount++;
            totalPendingValue += invoice.amount;
          }
        } catch (error) {
          continue;
        }
      }

      const projectedRevenue = (totalPendingValue * BigInt(Math.floor(feePercentage * 10000))) / 10000n;

      return {
        projected: projectedRevenue.toString(),
        projectedUSD: '0',
        basedOnPendingInvoices: pendingCount,
        totalPendingValue: totalPendingValue.toString(),
      };
    } catch (error) {
      logger.error('Failed to generate revenue forecast', { error });
      throw error;
    }
  }

  async getFailedInvoices(): Promise<Array<{
    invoice: Invoice;
    reason: string;
    stuckFor: string;
  }>> {
    try {
      const totalInvoices = await contractService.getTotalInvoices();
      const failedInvoices: Array<{ invoice: Invoice; reason: string; stuckFor: string }> = [];
      const currentTime = Math.floor(Date.now() / 1000);

      const STUCK_THRESHOLD = 7 * 24 * 60 * 60; 

      for (let i = 1n; i <= totalInvoices; i++) {
        try {
          const invoice = await contractService.getInvoice(i);
          
          if (invoice.status === InvoiceStatus.Pending) {
            const timeSinceCreation = currentTime - Number(invoice.createdAt);
            if (timeSinceCreation > STUCK_THRESHOLD) {
              failedInvoices.push({
                invoice,
                reason: 'Pending for too long (7+ days)',
                stuckFor: `${Math.floor(timeSinceCreation / (24 * 60 * 60))} days`,
              });
            }
          }

          if (invoice.status === InvoiceStatus.Funded && invoice.requiresDelivery) {
            const timeSinceFunding = currentTime - Number(invoice.fundedAt);
            if (timeSinceFunding > STUCK_THRESHOLD) {
              failedInvoices.push({
                invoice,
                reason: 'Funded but no delivery (7+ days)',
                stuckFor: `${Math.floor(timeSinceFunding / (24 * 60 * 60))} days`,
              });
            }
          }

          if (invoice.status === InvoiceStatus.Delivered) {
            const timeSinceDelivery = currentTime - Number(invoice.deliveredAt);
            if (timeSinceDelivery > STUCK_THRESHOLD) {
              failedInvoices.push({
                invoice,
                reason: 'Delivered but no confirmation (7+ days)',
                stuckFor: `${Math.floor(timeSinceDelivery / (24 * 60 * 60))} days`,
              });
            }
          }
        } catch (error) {
          continue;
        }
      }

      return failedInvoices;
    } catch (error) {
      logger.error('Failed to get failed invoices', { error });
      throw error;
    }
  }

  async getTransactionVolumeByToken(): Promise<Record<string, {
    count: number;
    volume: string;
    volumeUSD: string;
    averageSize: string;
  }>> {
    try {
      const totalInvoices = await contractService.getTotalInvoices();
      const byToken: Record<string, { count: number; volume: bigint }> = {};

      for (let i = 1n; i <= totalInvoices; i++) {
        try {
          const invoice = await contractService.getInvoice(i);
          
          const tokenKey = invoice.tokenAddress === '0x0000000000000000000000000000000000000000'
            ? 'ETH'
            : invoice.tokenAddress;

          if (!byToken[tokenKey]) {
            byToken[tokenKey] = { count: 0, volume: 0n };
          }

          byToken[tokenKey].count++;
          byToken[tokenKey].volume += invoice.amount;
        } catch (error) {
          continue;
        }
      }

      const result: Record<string, any> = {};
      for (const [token, data] of Object.entries(byToken)) {
        result[token] = {
          count: data.count,
          volume: data.volume.toString(),
          volumeUSD: '0',
          averageSize: (data.volume / BigInt(data.count)).toString(),
        };
      }

      return result;
    } catch (error) {
      logger.error('Failed to get transaction volume by token', { error });
      throw error;
    }
  }
}

export const analyticsService = new AnalyticsService();
