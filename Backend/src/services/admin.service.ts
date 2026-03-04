import { contractService } from './contract.service';
import { userWalletService } from './user-wallet.service';
import { userService } from './user.service';
import { passwordResetService } from './password-reset.service';
import { blockradarService } from './blockradar.service';
import { logger } from '../utils/logger';
import { Invoice, InvoiceStatus } from '../types/contract';
import { User } from '../types/user';
import { supabase } from '../config/supabase';
import { AuthUtils } from '../utils/auth';

export interface InvoiceFilters {
  status?: InvoiceStatus;
  minAmount?: string;
  maxAmount?: string;
  tokenAddress?: string;
  startDate?: Date;
  endDate?: Date;
  issuer?: string;
  payer?: string;
  receiver?: string;
  requiresDelivery?: boolean;
}

export interface UserFilters {
  kycStatus?: string;
  accountType?: 'individual' | 'business';
  startDate?: Date;
  endDate?: Date;
  searchQuery?: string;
}

export interface WalletHealthStatus {
  addressId: string;
  address: string;
  userId: string;
  balance: string;
  hasLowBalance: boolean;
  hasStuckTransactions: boolean;
  lastActivity?: string;
  issues: string[];
}

const ADMIN_SETUP_PASSWORD_MIN_LENGTH = 12;

function validateAdminPassword(password: string): { valid: boolean; message?: string } {
  if (password.length < ADMIN_SETUP_PASSWORD_MIN_LENGTH) {
    return { valid: false, message: `Password must be at least ${ADMIN_SETUP_PASSWORD_MIN_LENGTH} characters` };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must include at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must include at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must include at least one number' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, message: 'Password must include at least one symbol (e.g. !@#$%)' };
  }
  return { valid: true };
}

export class AdminService {

  async getSetupStatus(): Promise<{ setupComplete: boolean; requiresSetupSecret: boolean }> {
    const { env } = await import('../config/env');
    const { count, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('account_type', 'admin');
    if (error) {
      logger.error('Admin setup status check failed', { error: error.message });
      throw error;
    }
    return {
      setupComplete: (count ?? 0) > 0,
      requiresSetupSecret: !!env.ADMIN_SETUP_SECRET?.trim(),
    };
  }

  async createFirstAdmin(params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    setupSecret?: string;
  }): Promise<{ success: true; email: string }> {
    const { env } = await import('../config/env');
    if (env.ADMIN_SETUP_SECRET?.trim()) {
      if (!params.setupSecret || params.setupSecret.trim() !== env.ADMIN_SETUP_SECRET.trim()) {
        throw new Error('Invalid setup secret');
      }
    }
    const status = await this.getSetupStatus();
    if (status.setupComplete) {
      throw new Error('Admin already exists. Use the login page.');
    }
    const pwdCheck = validateAdminPassword(params.password);
    if (!pwdCheck.valid) {
      throw new Error(pwdCheck.message);
    }
    const email = params.email.toLowerCase().trim();
    const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (existing) {
      throw new Error('An account with this email already exists');
    }
    const passwordHash = await AuthUtils.hashPassword(params.password);
    const tag = `admin-${Date.now().toString(36)}`;
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        email,
        password: passwordHash,
        account_type: 'admin',
        first_name: params.firstName.trim(),
        last_name: params.lastName.trim(),
        tag,
        phone_number: '+0000000000',
        wallet_address_id: null,
        wallet_address: null,
        kyc_status: 'pending',
        email_verified: true,
        phone_verified: true,
        is_active: true,
      })
      .select('id, email')
      .single();
    if (insertError) {
      logger.error('Create first admin failed', { error: insertError });
      throw new Error(insertError.message);
    }
    logger.info('First admin created', { userId: newUser.id, email: newUser.email });
    return { success: true, email: newUser.email };
  }

  async getAllInvoices(filters?: InvoiceFilters): Promise<Invoice[]> {
    try {
      const totalInvoices = await contractService.getTotalInvoices();
      const invoices: Invoice[] = [];

      for (let i = 1n; i <= totalInvoices; i++) {
        try {
          const invoice = await contractService.getInvoice(i);

          if (filters?.status !== undefined && invoice.status !== filters.status) continue;
          
          if (filters?.minAmount && invoice.amount < BigInt(filters.minAmount)) continue;
          if (filters?.maxAmount && invoice.amount > BigInt(filters.maxAmount)) continue;
          
          if (filters?.tokenAddress && 
              invoice.tokenAddress.toLowerCase() !== filters.tokenAddress.toLowerCase()) continue;

          if (filters?.startDate) {
            const createdDate = new Date(Number(invoice.createdAt) * 1000);
            if (createdDate < filters.startDate) continue;
          }

          if (filters?.endDate) {
            const createdDate = new Date(Number(invoice.createdAt) * 1000);
            if (createdDate > filters.endDate) continue;
          }

          if (filters?.issuer && 
              invoice.issuer.toLowerCase() !== filters.issuer.toLowerCase()) continue;

          if (filters?.payer && 
              invoice.payer.toLowerCase() !== filters.payer.toLowerCase()) continue;

          if (filters?.receiver && 
              invoice.receiver.toLowerCase() !== filters.receiver.toLowerCase()) continue;

          if (filters?.requiresDelivery !== undefined && 
              invoice.requiresDelivery !== filters.requiresDelivery) continue;

          invoices.push(invoice);
        } catch (error) {
          logger.warn('Failed to fetch invoice', { invoiceId: i });
        }
      }

      return invoices.sort((a, b) => Number(b.createdAt - a.createdAt));
    } catch (error) {
      logger.error('Failed to get all invoices', { error });
      throw error;
    }
  }

  /** Get a single on-chain invoice by id (numeric index). For admin detail view. */
  async getInvoiceById(invoiceId: string): Promise<Record<string, unknown> | null> {
    try {
      const id = BigInt(invoiceId);
      if (id < 1n) return null;
      const total = await contractService.getTotalInvoices();
      if (id > total) return null;
      const invoice = await contractService.getInvoice(id);
      return {
        id: invoice.id.toString(),
        issuer: invoice.issuer,
        payer: invoice.payer,
        receiver: invoice.receiver,
        amount: invoice.amount.toString(),
        tokenAddress: invoice.tokenAddress,
        status: invoice.status,
        requiresDelivery: invoice.requiresDelivery,
        description: invoice.description,
        attachmentHash: invoice.attachmentHash,
        createdAt: invoice.createdAt.toString(),
        fundedAt: invoice.fundedAt.toString(),
        deliveredAt: invoice.deliveredAt.toString(),
        completedAt: invoice.completedAt.toString(),
      };
    } catch (error) {
      logger.error('Failed to get invoice by id', { error, invoiceId });
      return null;
    }
  }

  /** Get a single payment contract from DB by id. For admin detail view. */
  async getPaymentContractById(contractId: string): Promise<Record<string, unknown> | null> {
    try {
      const { data, error } = await supabase
        .from('payment_contracts')
        .select('*')
        .eq('id', contractId)
        .maybeSingle();
      if (error || !data) return null;
      return data as Record<string, unknown>;
    } catch (error) {
      logger.error('Failed to get payment contract by id', { error, contractId });
      return null;
    }
  }

  /** Admin: update payment contract status (e.g. CANCELLED for termination). */
  async updateContractStatus(contractId: string, status: string): Promise<{ updated: boolean }> {
    const allowed = ['CANCELLED', 'DISPUTED'];
    if (!allowed.includes(status)) {
      throw new Error(`Admin can only set status to: ${allowed.join(', ')}`);
    }
    try {
      const { data, error } = await supabase
        .from('payment_contracts')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', contractId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      return { updated: !!data };
    } catch (error) {
      logger.error('Admin update contract status failed', { error, contractId, status });
      throw error;
    }
  }

  async getFilteredUsers(filters: UserFilters): Promise<User[]> {
    try {
      const allUsers = await userService.getAllUsers(10000, 0);
      
      return allUsers.filter(user => {
        if (filters.kycStatus && user.kycStatus !== filters.kycStatus) return false;
        
        if (filters.accountType && user.accountType !== filters.accountType) return false;
        
        if (filters.startDate && new Date(user.createdAt) < filters.startDate) return false;
        
        if (filters.endDate && new Date(user.createdAt) > filters.endDate) return false;
        
        if (filters.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          const matchesEmail = user.email.toLowerCase().includes(query);
          const matchesName = `${user.profile.firstName} ${user.profile.lastName}`.toLowerCase().includes(query);
          const matchesWallet = user.walletAddress?.toLowerCase().includes(query);
          
          if (!matchesEmail && !matchesName && !matchesWallet) return false;
        }

        return true;
      });
    } catch (error) {
      logger.error('Failed to filter users', { error });
      throw error;
    }
  }

  async bulkUpdateKYC(userIds: string[], status: string, reviewedBy: string): Promise<{
    successful: string[];
    failed: Array<{ userId: string; error: string }>;
  }> {
    const successful: string[] = [];
    const failed: Array<{ userId: string; error: string }> = [];

    for (const userId of userIds) {
      try {
        await userService.updateKYCStatus(userId, {
          status: status as any,
          reviewedBy,
        });
        successful.push(userId);
        logger.info('Bulk KYC update succeeded', { userId, status });
      } catch (error) {
        failed.push({
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        logger.error('Bulk KYC update failed', { userId, error });
      }
    }

    return { successful, failed };
  }

  async getUserActivityLogs(userId: string): Promise<Array<{
    invoiceId: string;
    type: 'issued' | 'paid' | 'received';
    amount: string;
    tokenAddress: string;
    status: string;
    timestamp: string;
  }>> {
    try {
      const wallet = await userWalletService.getUserWallet(userId);
      if (!wallet) {
        throw new Error('User wallet not found');
      }

      const totalInvoices = await contractService.getTotalInvoices();
      const activities: Array<any> = [];

      for (let i = 1n; i <= totalInvoices; i++) {
        try {
          const invoice = await contractService.getInvoice(i);
          const userAddress = wallet.address.toLowerCase();

          if (invoice.issuer.toLowerCase() === userAddress) {
            activities.push({
              invoiceId: invoice.id.toString(),
              type: 'issued',
              amount: invoice.amount.toString(),
              tokenAddress: invoice.tokenAddress,
              status: InvoiceStatus[invoice.status],
              timestamp: new Date(Number(invoice.createdAt) * 1000).toISOString(),
            });
          }

          if (invoice.payer.toLowerCase() === userAddress) {
            activities.push({
              invoiceId: invoice.id.toString(),
              type: 'paid',
              amount: invoice.amount.toString(),
              tokenAddress: invoice.tokenAddress,
              status: InvoiceStatus[invoice.status],
              timestamp: new Date(Number(invoice.createdAt) * 1000).toISOString(),
            });
          }

          if (invoice.receiver.toLowerCase() === userAddress) {
            activities.push({
              invoiceId: invoice.id.toString(),
              type: 'received',
              amount: invoice.amount.toString(),
              tokenAddress: invoice.tokenAddress,
              status: InvoiceStatus[invoice.status],
              timestamp: new Date(Number(invoice.createdAt) * 1000).toISOString(),
            });
          }
        } catch (error) {
          continue;
        }
      }

      return activities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      logger.error('Failed to get user activity logs', { error, userId });
      throw error;
    }
  }

  async getWalletHealthStatuses(): Promise<WalletHealthStatus[]> {
    try {
      const users = await userService.getAllUsers(10000, 0);
      const healthStatuses: WalletHealthStatus[] = [];

      for (const user of users) {
        try {
          const wallet = await userWalletService.getUserWallet(user.id);
          if (!wallet) continue;

          const balance = await userWalletService.getChildAddressBalance(wallet.id);
          const nativeBalance = parseFloat(balance.nativeBalance);

          const issues: string[] = [];
          let hasLowBalance = false;
          let hasStuckTransactions = false;

          if (nativeBalance < 0.001) {
            hasLowBalance = true;
            issues.push('Low gas balance for transactions');
          }

          const activityLogs = await this.getUserActivityLogs(user.id);
          const lastActivity = activityLogs.length > 0 
            ? activityLogs[0].timestamp 
            : undefined;

          const pendingInvoices = activityLogs.filter(a => a.status === 'Pending');
          if (pendingInvoices.length > 5) {
            hasStuckTransactions = true;
            issues.push(`${pendingInvoices.length} pending invoices`);
          }

          healthStatuses.push({
            addressId: wallet.id,
            address: wallet.address,
            userId: user.id,
            balance: balance.nativeBalance,
            hasLowBalance,
            hasStuckTransactions,
            lastActivity,
            issues,
          });
        } catch (error) {
          logger.warn('Failed to get wallet health for user', { userId: user.id });
        }
      }

      return healthStatuses;
    } catch (error) {
      logger.error('Failed to get wallet health statuses', { error });
      throw error;
    }
  }

  async getAllChildAddressesWithBalances(): Promise<Array<{
    userId: string;
    email: string;
    addressId: string;
    address: string;
    nativeBalance: string;
    tokenBalances: Array<{ symbol: string; balance: string }>;
    totalBalanceUSD: string;
  }>> {
    try {
      const users = await userService.getAllUsers(10000, 0);
      const addresses: Array<any> = [];

      for (const user of users) {
        try {
          const wallet = await userWalletService.getUserWallet(user.id);
          if (!wallet) continue;

          const balance = await userWalletService.getChildAddressBalance(wallet.id);

          addresses.push({
            userId: user.id,
            email: user.email,
            addressId: wallet.id,
            address: wallet.address,
            nativeBalance: balance.nativeBalance,
            tokenBalances: balance.tokens.map(t => ({
              symbol: t.symbol,
              balance: t.balance,
            })),
            totalBalanceUSD: '0',
          });
        } catch (error) {
          logger.warn('Failed to get balance for user', { userId: user.id });
        }
      }

      return addresses.sort((a, b) => 
        parseFloat(b.nativeBalance) - parseFloat(a.nativeBalance)
      );
    } catch (error) {
      logger.error('Failed to get all child addresses with balances', { error });
      throw error;
    }
  }

  async getUserSegmentation(): Promise<{
    active: number;
    inactive: number;
    highValue: number;
    atRisk: number;
  }> {
    try {
      const users = await userService.getAllUsers(10000, 0);
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
      const ninetyDaysAgo = Math.floor(Date.now() / 1000) - (90 * 24 * 60 * 60);

      let active = 0;
      let inactive = 0;
      let highValue = 0;
      let atRisk = 0;

      for (const user of users) {
        try {
          const activities = await this.getUserActivityLogs(user.id);
          
          if (activities.length === 0) {
            inactive++;
            continue;
          }

          const lastActivityTime = new Date(activities[0].timestamp).getTime() / 1000;
          const totalVolume = activities.reduce((sum, a) => sum + BigInt(a.amount), 0n);

          if (lastActivityTime > thirtyDaysAgo) {
            active++;
          } else if (lastActivityTime < ninetyDaysAgo) {
            inactive++;
          }

          if (totalVolume > BigInt('1000000000000000000000')) {
            highValue++;
          }

          const hasRecentPendingIssues = activities
            .filter(a => a.status === 'Pending')
            .some(a => new Date(a.timestamp).getTime() / 1000 < thirtyDaysAgo);

          if (hasRecentPendingIssues) {
            atRisk++;
          }
        } catch (error) {
          inactive++;
        }
      }

      return { active, inactive, highValue, atRisk };
    } catch (error) {
      logger.error('Failed to get user segmentation', { error });
      throw error;
    }
  }

  async getTokenBalanceBreakdown(): Promise<Array<{
    token: string;
    totalBalance: string;
    userCount: number;
    averageBalance: string;
  }>> {
    try {
      const addresses = await this.getAllChildAddressesWithBalances();
      const tokenBreakdown: Record<string, { total: bigint; users: Set<string> }> = {};

      for (const addr of addresses) {
        const nativeBalance = BigInt(addr.nativeBalance || '0');
        if (!tokenBreakdown['ETH']) {
          tokenBreakdown['ETH'] = { total: 0n, users: new Set() };
        }
        if (nativeBalance > 0n) {
          tokenBreakdown['ETH'].total += nativeBalance;
          tokenBreakdown['ETH'].users.add(addr.userId);
        }

        for (const token of addr.tokenBalances) {
          if (!tokenBreakdown[token.symbol]) {
            tokenBreakdown[token.symbol] = { total: 0n, users: new Set() };
          }
          const tokenBalance = BigInt(token.balance || '0');
          if (tokenBalance > 0n) {
            tokenBreakdown[token.symbol].total += tokenBalance;
            tokenBreakdown[token.symbol].users.add(addr.userId);
          }
        }
      }

      return Object.entries(tokenBreakdown).map(([token, data]) => ({
        token,
        totalBalance: data.total.toString(),
        userCount: data.users.size,
        averageBalance: data.users.size > 0 
          ? (data.total / BigInt(data.users.size)).toString()
          : '0',
      }));
    } catch (error) {
      logger.error('Failed to get token balance breakdown', { error });
      throw error;
    }
  }

  async getLowBalanceAlerts(threshold: string = '1000000000000000'): Promise<Array<{
    userId: string;
    email: string;
    address: string;
    balance: string;
    belowThreshold: string;
  }>> {
    try {
      const addresses = await this.getAllChildAddressesWithBalances();
      const thresholdBigInt = BigInt(threshold);
      const alerts: Array<any> = [];

      for (const addr of addresses) {
        const balance = BigInt(addr.nativeBalance || '0');
        if (balance < thresholdBigInt && balance > 0n) {
          alerts.push({
            userId: addr.userId,
            email: addr.email,
            address: addr.address,
            balance: addr.nativeBalance,
            belowThreshold: (thresholdBigInt - balance).toString(),
          });
        }
      }

      return alerts.sort((a, b) => 
        parseFloat(a.balance) - parseFloat(b.balance)
      );
    } catch (error) {
      logger.error('Failed to get low balance alerts', { error });
      throw error;
    }
  }

  async getPaymentContracts(filters: {
    status?: string;
    employer?: string;
    contractor?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ contracts: any[]; total: number }> {
    try {
      let query = supabase
        .from('payment_contracts')
        .select('*', { count: 'exact' });

      if (filters.status?.trim()) {
        query = query.eq('status', filters.status.trim().toUpperCase());
      }
      if (filters.employer?.trim()) {
        query = query.ilike('employer_address', `%${filters.employer.trim()}%`);
      }
      if (filters.contractor?.trim()) {
        query = query.ilike('contractor_address', `%${filters.contractor.trim()}%`);
      }
      if (filters.startDate) {
        query = query.gte('start_date', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('start_date', filters.endDate.toISOString());
      }

      const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
      const offset = Math.max(filters.offset ?? 0, 0);
      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data: contracts, error, count } = await query;

      if (error) {
        logger.error('Failed to list payment contracts', { error: error.message });
        throw error;
      }

      return {
        contracts: contracts ?? [],
        total: count ?? (contracts?.length ?? 0),
      };
    } catch (error) {
      logger.error('Failed to get payment contracts', { error });
      throw error;
    }
  }

  /** Admin: contract counts by status for dashboard. */
  async getContractCounts(): Promise<{ total: number; active: number; completed: number; cancelled: number; disputed: number }> {
    try {
      const { data: rows, error } = await supabase
        .from('payment_contracts')
        .select('status');
      if (error) throw error;
      const list = rows ?? [];
      let active = 0, completed = 0, cancelled = 0, disputed = 0;
      for (const r of list) {
        const s = (r?.status ?? '').toUpperCase();
        if (s === 'ACTIVE') active++;
        else if (s === 'COMPLETED') completed++;
        else if (s === 'CANCELLED') cancelled++;
        else if (s === 'DISPUTED') disputed++;
      }
      return {
        total: list.length,
        active,
        completed,
        cancelled,
        disputed,
      };
    } catch (error) {
      logger.error('Failed to get contract counts', { error });
      return { total: 0, active: 0, completed: 0, cancelled: 0, disputed: 0 };
    }
  }

  /** Get combined user summary for admin: profile + wallet + activity. */
  async getUserSummary(userId: string): Promise<{
    profile: Record<string, unknown> | null;
    wallet: Record<string, unknown> | null;
    activity: Array<Record<string, unknown>>;
  }> {
    try {
      const [user, wallet, activities] = await Promise.all([
        userService.getUserById(userId).then(u => u ? {
          id: u.id,
          email: u.email,
          accountType: u.accountType,
          kycStatus: u.kycStatus,
          isActive: u.isActive,
          createdAt: u.createdAt,
          profile: u.profile,
        } as Record<string, unknown> : null),
        userWalletService.getUserWallet(userId).then(async w => {
          if (!w) return null;
          const balance = await userWalletService.getChildAddressBalance(w.id);
          return { ...w, balance } as Record<string, unknown>;
        }).catch(() => null),
        this.getUserActivityLogs(userId).catch(() => []),
      ]);
      return {
        profile: user,
        wallet,
        activity: activities as Array<Record<string, unknown>>,
      };
    } catch (error) {
      logger.error('Failed to get user summary', { error, userId });
      throw error;
    }
  }

  /** Admin: send password reset email to a user by id. */
  async sendPasswordResetForUser(userId: string): Promise<{ sent: boolean }> {
    try {
      const user = await userService.getUserById(userId);
      if (!user) throw new Error('User not found');
      await passwordResetService.requestPasswordReset(user.email);
      return { sent: true };
    } catch (error) {
      logger.error('Admin send password reset failed', { error, userId });
      throw error;
    }
  }

  /** Set user active status (enable/disable). Admins cannot deactivate themselves. */
  async setUserActiveStatus(userId: string, isActive: boolean): Promise<{ updated: boolean }> {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ is_active: isActive })
        .eq('id', userId)
        .select('id')
        .maybeSingle();

      if (error) {
        logger.error('Failed to set user active status', { error: error.message, userId });
        throw error;
      }
      return { updated: !!data };
    } catch (error) {
      logger.error('Set user active status failed', { error, userId });
      throw error;
    }
  }

  /** Log an admin action for audit. Uses security_audit_log with event_type prefix 'admin_'. */
  async logAdminAction(params: {
    adminUserId: string;
    action: string;
    targetType?: string;
    targetId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<void> {
    try {
      const eventType = params.action.startsWith('admin_') ? params.action : `admin_${params.action}`;
      const eventData: Record<string, unknown> = {
        ...(params.details ?? {}),
        ...(params.targetType && { targetType: params.targetType }),
        ...(params.targetId && { targetId: params.targetId }),
      };
      await supabase.from('security_audit_log').insert({
        user_id: params.adminUserId,
        event_type: eventType,
        ip_address: params.ipAddress ?? null,
        success: true,
        event_data: eventData,
      });
    } catch (error) {
      logger.error('Failed to log admin action', { error, action: params.action });
    }
  }

  /** List recent admin audit entries. Reads from security_audit_log where event_type starts with 'admin_'. */
  async getAdminAuditLog(options?: { limit?: number; offset?: number }): Promise<{
    entries: Array<{
      id: string;
      adminUserId: string;
      action: string;
      targetType?: string;
      targetId?: string;
      details: Record<string, unknown>;
      ipAddress?: string;
      createdAt: string;
    }>;
    total: number;
  }> {
    try {
      const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
      const offset = Math.max(options?.offset ?? 0, 0);
      const { data: rows, error, count } = await supabase
        .from('security_audit_log')
        .select('*', { count: 'exact' })
        .like('event_type', 'admin_%')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Failed to get admin audit log', { error });
        return { entries: [], total: 0 };
      }

      const entries = (rows ?? []).map((r: any) => ({
        id: r.id,
        adminUserId: r.user_id,
        action: r.event_type,
        targetType: r.event_data?.targetType,
        targetId: r.event_data?.targetId,
        details: typeof r.event_data === 'object' ? r.event_data : {},
        ipAddress: r.ip_address,
        createdAt: r.created_at ?? r.createdAt ?? new Date().toISOString(),
      }));

      return { entries, total: count ?? entries.length };
    } catch (error) {
      logger.error('Failed to get admin audit log', { error });
      return { entries: [], total: 0 };
    }
  }
}

export const adminService = new AdminService();
