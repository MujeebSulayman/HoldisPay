import { apiClient } from './client';

export interface AdminUserWalletSummary {
  networks: { slug: string; displayName: string; walletId: string; logoUrl: string }[];
  userChains: { chainId: string; chainName: string; addressId: string; address: string }[];
  balances: { chain_id: string; token_address: string | null; balance_wei: string }[];
}

export interface AdminUserOverview {
  balance: { withdrawableChains: number; lockedChains: number };
  contracts: { asEmployer: number; asContractor: number; activeAsEmployer: number; activeAsContractor: number };
  invoices: { issued: number; paying: number; receiving: number; pending: number; paid: number };
}

export async function getAdminSetupStatus(): Promise<{ setupComplete: boolean; requiresSetupSecret: boolean }> {
  const res = await apiClient.get<{ setupComplete: boolean; requiresSetupSecret?: boolean }>('/api/admin/setup/status');
  const data = res && typeof res === 'object' && 'data' in res ? (res as { data?: { setupComplete?: boolean; requiresSetupSecret?: boolean } }).data : undefined;
  if (data && typeof data.setupComplete === 'boolean') {
    return {
      setupComplete: data.setupComplete,
      requiresSetupSecret: data.requiresSetupSecret === true,
    };
  }
  return { setupComplete: true, requiresSetupSecret: false };
}

export async function createFirstAdmin(params: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  setupSecret?: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await apiClient.post<{ success: boolean; message?: string; error?: string }>('/api/admin/setup', params);
  if (res && typeof res === 'object' && res.success) {
    return { success: true, message: res.message };
  }
  return { success: false, error: (res as { error?: string })?.error ?? (res as { message?: string })?.message ?? 'Setup failed' };
}

interface User {
  id: string;
  email: string;
  accountType: string;
  profile: {
    firstName: string;
    lastName: string;
  };
  kycStatus: string;
  isActive: boolean;
  createdAt: string;
}

export const adminApi = {
  // Dashboard
  async getMetrics(): Promise<{
    users: { total: number; active: number; newThisMonth: number; newThisWeek?: number; newToday?: number };
    invoices: { total: number; completed: number; pending: number; totalVolume: string };
    revenue: { total: string; thisMonth: string; lastMonth: string };
    contracts?: { total: number; active: number; completed: number; cancelled: number; disputed: number };
  } | null> {
    const response = await apiClient.get<{ data?: { users?: unknown; invoices?: unknown; revenue?: unknown; contracts?: unknown } }>('/api/admin/metrics');
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load metrics');
    }
    const data = (response as { data?: unknown }).data;
    if (!data || typeof data !== 'object') return null;
    const d = data as { users?: unknown; invoices?: unknown; revenue?: unknown; contracts?: unknown };
    const u = (d.users as { total?: number; active?: number; newThisMonth?: number; newThisWeek?: number; newToday?: number }) ?? {};
    const inv = (d.invoices as { total?: number; completed?: number; pending?: number; totalVolume?: string }) ?? {};
    const rev = (d.revenue as { total?: string; thisMonth?: string; lastMonth?: string }) ?? {};
    return {
      users: { total: u.total ?? 0, active: u.active ?? 0, newThisMonth: u.newThisMonth ?? 0, newThisWeek: u.newThisWeek, newToday: u.newToday },
      invoices: { total: inv.total ?? 0, completed: inv.completed ?? 0, pending: inv.pending ?? 0, totalVolume: inv.totalVolume ?? '0' },
      revenue: { total: rev.total ?? '0', thisMonth: rev.thisMonth ?? '0', lastMonth: rev.lastMonth ?? '0' },
      contracts: d.contracts as { total: number; active: number; completed: number; cancelled: number; disputed: number } | undefined,
    };
  },

  async getTransactionsOverview(): Promise<{
    total: number;
    success: number;
    failed: number;
    volumeByChain: Record<string, { volume: string; count: number }>;
    volumeLast30Days: string;
  }> {
    const response = await apiClient.get('/api/admin/transactions/overview');
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load transactions overview');
    }
    const data = (response as { data?: unknown })?.data;
    return (data as { total: number; success: number; failed: number; volumeByChain: Record<string, { volume: string; count: number }>; volumeLast30Days: string }) ?? {
      total: 0, success: 0, failed: 0, volumeByChain: {}, volumeLast30Days: '0',
    };
  },

  // Users
  async searchUsers(params?: {
    kycStatus?: string;
    accountType?: string;
    searchQuery?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ data: User[] }> {
    const queryParams = new URLSearchParams();
    if (params?.kycStatus) queryParams.append('kycStatus', params.kycStatus);
    if (params?.accountType) queryParams.append('accountType', params.accountType);
    if (params?.searchQuery) queryParams.append('searchQuery', params.searchQuery);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    
    const url = `/api/admin/users/search${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiClient.get<{ users?: User[] }>(url);
    if (response && response.success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to search users');
    }
    const payload = (response as { data?: { users?: User[] } })?.data;
    return { data: Array.isArray(payload?.users) ? payload.users : [] };
  },

  async getUserActivity(userId: string) {
    const response = await apiClient.get(`/api/admin/users/${userId}/activity`);
    if (response && response.success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load activity');
    }
    const data = (response as { data?: { activities?: unknown[] } })?.data;
    return data ?? { activities: [] };
  },

  async getUserOverview(userId: string) {
    const response = await apiClient.get<AdminUserOverview>(`/api/admin/users/${userId}/overview`);
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load user overview');
    }
    return (response as { data?: AdminUserOverview }).data ?? null;
  },

  async getTopUsers(limit: number = 10) {
    const response = await apiClient.get(`/api/admin/users/top?limit=${limit}`);
    if (response && response.success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load top users');
    }
    return (response as { data?: unknown })?.data ?? { users: [] };
  },

  async getUsersGrowthReport(params?: { periods?: number }): Promise<{ reports: Array<{ period: string; count: number }> }> {
    const periods = params?.periods ?? 12;
    const response = await apiClient.get(`/api/admin/users/growth-report?periods=${periods}`);
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load users growth report');
    }
    const data = (response as { data?: { reports?: Array<{ period: string; count: number }> } })?.data;
    const reports = Array.isArray(data?.reports) ? data.reports : [];
    return { reports };
  },

  async getTransactionsReport(params?: { periods?: number }): Promise<{ reports: Array<{ period: string; count: number }> }> {
    const periods = params?.periods ?? 12;
    const response = await apiClient.get(`/api/admin/transactions/report?periods=${periods}`);
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load transactions report');
    }
    const data = (response as { data?: { reports?: Array<{ period: string; count: number }> } })?.data;
    const reports = Array.isArray(data?.reports) ? data.reports : [];
    return { reports };
  },

  async getContractsReport(params?: { periods?: number }): Promise<{ reports: Array<{ period: string; count: number }> }> {
    const periods = params?.periods ?? 12;
    const response = await apiClient.get(`/api/admin/contracts/report?periods=${periods}`);
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load contracts report');
    }
    const data = (response as { data?: { reports?: Array<{ period: string; count: number }> } })?.data;
    const reports = Array.isArray(data?.reports) ? data.reports : [];
    return { reports };
  },

  async getWaitlistReport(params?: { periods?: number }): Promise<{ reports: Array<{ period: string; count: number }> }> {
    const periods = params?.periods ?? 12;
    const response = await apiClient.get(`/api/admin/waitlist/report?periods=${periods}`);
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load waitlist report');
    }
    const data = (response as { data?: { reports?: Array<{ period: string; count: number }> } })?.data;
    const reports = Array.isArray(data?.reports) ? data.reports : [];
    return { reports };
  },

  async getUserSegmentation() {
    const response = await apiClient.get('/api/admin/users/segmentation');
    if (response && response.success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load segmentation');
    }
    return (response as { data?: unknown })?.data ?? null;
  },

  async bulkUpdateKYC(data: {
    userIds: string[];
    status: string;
    reviewedBy: string;
  }) {
    const response = await apiClient.post('/api/admin/users/kyc/bulk-update', data);
    return response.data;
  },

  // Invoices
  async getAllInvoices(params?: {
    status?: number;
    minAmount?: string;
    maxAmount?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.status !== undefined) queryParams.append('status', params.status.toString());
    if (params?.minAmount) queryParams.append('minAmount', params.minAmount);
    if (params?.maxAmount) queryParams.append('maxAmount', params.maxAmount);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    
    const url = `/api/admin/invoices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiClient.get(url);
    if (response && response.success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load invoices');
    }
    return (response as { data?: { invoices?: unknown[]; total?: number } })?.data ?? { invoices: [], total: 0 };
  },

  async getInvoiceAnalytics(params?: {
    startDate?: string;
    endDate?: string;
    tokenAddress?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.tokenAddress) queryParams.append('tokenAddress', params.tokenAddress);
    
    const url = `/api/admin/invoices/analytics${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiClient.get(url);
    if (response && response.success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load invoice analytics');
    }
    return (response as { data?: unknown })?.data ?? null;
  },

  async getFailedInvoices() {
    const response = await apiClient.get('/api/admin/invoices/failed');
    if (response && response.success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load failed invoices');
    }
    return (response as { data?: { invoices?: unknown[]; total?: number } })?.data ?? { invoices: [], total: 0 };
  },

  async getInvoiceById(invoiceId: string): Promise<Record<string, unknown> | null> {
    const response = await apiClient.get(`/api/admin/invoices/${encodeURIComponent(invoiceId)}`);
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load invoice');
    }
    return ((response as { data?: unknown }).data ?? null) as Record<string, unknown> | null;
  },

  // Revenue
  async getRevenueReport(params?: {
    period?: 'daily' | 'weekly' | 'monthly';
    startDate?: string;
    endDate?: string;
  }): Promise<{ reports: Array<{ period: string; totalRevenue: string; transactionCount?: number }> }> {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.append('period', params.period);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    
    const url = `/api/admin/revenue/report${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiClient.get(url);
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load revenue report');
    }
    const data = (response as { data?: { period?: string; reports?: unknown[] } })?.data;
    const reports = Array.isArray(data?.reports) ? data.reports : [];
    return { reports: reports as Array<{ period: string; totalRevenue: string; transactionCount?: number }> };
  },

  async getRevenueForecast(daysAhead: number = 30) {
    const response = await apiClient.get(`/api/admin/revenue/forecast?daysAhead=${daysAhead}`);
    if (response && response.success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load revenue forecast');
    }
    return (response as { data?: unknown })?.data ?? null;
  },

  // Transactions
  async getTransactionVolume() {
    const response = await apiClient.get('/api/admin/transactions/volume');
    if (response && response.success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load transaction volume');
    }
    return (response as { data?: Record<string, { volume?: string; count?: number }> })?.data ?? {};
  },

  async getTransactions(params?: {
    userId?: string;
    txType?: string;
    status?: string;
    chainId?: string;
    tokenAddress?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ transactions: Record<string, unknown>[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.userId) queryParams.append('userId', params.userId);
    if (params?.txType) queryParams.append('txType', params.txType);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.chainId) queryParams.append('chainId', params.chainId);
    if (params?.tokenAddress) queryParams.append('tokenAddress', params.tokenAddress);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.limit != null) queryParams.append('limit', String(params.limit));
    if (params?.offset != null) queryParams.append('offset', String(params.offset));
    const url = `/api/admin/transactions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiClient.get(url);
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load transactions');
    }
    const data = (response as { data?: { transactions?: unknown[]; total?: number } })?.data ?? {};
    return {
      transactions: Array.isArray(data.transactions) ? data.transactions as Record<string, unknown>[] : [],
      total: typeof data.total === 'number' ? data.total : 0,
    };
  },

  async backfillChainIds(limit?: number) {
    const url = limit != null ? `/api/admin/transactions/backfill-chain-ids?limit=${limit}` : '/api/admin/transactions/backfill-chain-ids';
    const response = await apiClient.post(url);
    if (response && response.success === false) {
      throw new Error((response as { error?: string }).error ?? 'Backfill failed');
    }
    return (response as { data?: unknown; message?: string })?.data ?? response;
  },

  // Wallets
  async getWalletHealth() {
    const response = await apiClient.get('/api/admin/wallets/health');
    if (response && response.success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load wallet health');
    }
    const data = (response as { data?: { wallets?: unknown[]; total?: number; criticalIssues?: number } })?.data;
    return data ?? { wallets: [], total: 0, criticalIssues: 0 };
  },

  async getAllAddresses() {
    const response = await apiClient.get('/api/admin/wallets/addresses');
    if (response && response.success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load addresses');
    }
    const data = (response as { data?: { addresses?: unknown[]; total?: number } })?.data;
    return data ?? { addresses: [], total: 0 };
  },

  async getLowBalanceAlerts(threshold?: string) {
    const url = `/api/admin/wallets/alerts/low-balance${threshold ? `?threshold=${threshold}` : ''}`;
    const response = await apiClient.get(url);
    if (response && response.success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load alerts');
    }
    const data = (response as { data?: { alerts?: unknown[]; total?: number } })?.data;
    return data ?? { alerts: [], total: 0 };
  },

  async getTokenBreakdown() {
    const response = await apiClient.get('/api/admin/wallets/token-breakdown');
    if (response && response.success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load token breakdown');
    }
    const data = (response as { data?: unknown })?.data;
    return Array.isArray(data) ? data : [];
  },

  async getWaitlist(): Promise<{ items: { id: string; email: string; name: string | null; created_at: string }[]; total: number }> {
    const response = await apiClient.get<{ items?: unknown[]; total?: number }>('/api/admin/waitlist');
    const data = (response as { data?: { items?: unknown[]; total?: number } })?.data ?? response;
    return {
      items: Array.isArray((data as { items?: unknown[] }).items) ? (data as { items: { id: string; email: string; name: string | null; created_at: string }[] }).items : [],
      total: typeof (data as { total?: number }).total === 'number' ? (data as { total: number }).total : 0,
    };
  },

  // Payment contracts (admin list)
  async getContracts(params?: {
    status?: string;
    employer?: string;
    contractor?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ contracts: Record<string, unknown>[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.employer) queryParams.append('employer', params.employer);
    if (params?.contractor) queryParams.append('contractor', params.contractor);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.limit != null) queryParams.append('limit', String(params.limit));
    if (params?.offset != null) queryParams.append('offset', String(params.offset));
    const url = `/api/admin/contracts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiClient.get<{ data?: { contracts?: unknown[]; total?: number } }>(url);
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load contracts');
    }
    const payload = (response as { data?: { contracts?: unknown[]; total?: number } })?.data ?? response;
    return {
      contracts: Array.isArray((payload as { contracts?: unknown[] }).contracts) ? (payload as { contracts: Record<string, unknown>[] }).contracts : [],
      total: typeof (payload as { total?: number }).total === 'number' ? (payload as { total: number }).total : 0,
    };
  },

  async getContractById(contractId: string): Promise<Record<string, unknown> | null> {
    const response = await apiClient.get(`/api/admin/contracts/${encodeURIComponent(contractId)}`);
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load contract');
    }
    return ((response as { data?: unknown }).data ?? null) as Record<string, unknown> | null;
  },

  async updateUserKYC(userId: string, data: { status: string; rejectionReason?: string; notes?: string; reviewedBy: string }) {
    const response = await apiClient.post(`/api/users/${userId}/kyc/update`, data);
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? (response as { message?: string }).message ?? 'KYC update failed');
    }
    return response;
  },

  async getUserSummary(userId: string): Promise<{ profile: unknown; wallet: unknown; activity: unknown[] }> {
    const response = await apiClient.get(`/api/admin/users/${userId}/summary`);
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load user summary');
    }
    const data = (response as { data?: { profile?: unknown; wallet?: unknown; activity?: unknown[] } })?.data ?? {};
    return {
      profile: data.profile ?? null,
      wallet: data.wallet ?? null,
      activity: Array.isArray(data.activity) ? data.activity : [],
    };
  },

  /** Networks from .env, master wallet assets per chain, user addresses + balances from Blockradar. */
  async getUserWalletSummary(userId: string): Promise<AdminUserWalletSummary> {
    const response = await apiClient.get<{ data?: AdminUserWalletSummary }>(`/api/admin/users/${userId}/wallet-summary`);
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load wallet summary');
    }
    const data = (response as { data?: AdminUserWalletSummary })?.data;
    return data ?? { networks: [], assetsByChain: {}, userChains: [], balancesByChain: {} };
  },

  async updateUserStatus(userId: string, isActive: boolean): Promise<{ updated: boolean }> {
    const response = await apiClient.patch<{ updated: boolean }>(`/api/admin/users/${userId}/status`, { isActive });
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to update user status');
    }
    return { updated: ((response as { data?: { updated?: boolean } })?.data?.updated) ?? false };
  },

  async deleteUser(userId: string): Promise<{ deleted: boolean }> {
    const response = await apiClient.delete<{ success?: boolean; data?: { deleted?: boolean }; error?: string }>(`/api/admin/users/${userId}`);
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to delete user');
    }
    return { deleted: ((response as { data?: { deleted?: boolean } })?.data?.deleted) ?? false };
  },

  async sendPasswordReset(userId: string): Promise<{ sent: boolean }> {
    const response = await apiClient.post(`/api/admin/users/${userId}/send-password-reset`, {});
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to send password reset');
    }
    return { sent: ((response as { data?: { sent?: boolean } })?.data?.sent) ?? true };
  },

  async updateContractStatus(contractId: string, status: string): Promise<{ updated: boolean }> {
    const response = await apiClient.patch(`/api/admin/contracts/${contractId}/status`, { status });
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to update contract status');
    }
    return { updated: ((response as { data?: { updated?: boolean } })?.data?.updated) ?? false };
  },

  async deleteContract(contractId: string): Promise<{ deleted: boolean }> {
    const response = await apiClient.delete<{ success?: boolean; data?: { deleted?: boolean }; error?: string }>(`/api/admin/contracts/${contractId}`);
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to delete contract');
    }
    return { deleted: ((response as { data?: { deleted?: boolean } })?.data?.deleted) ?? false };
  },

  async getAuditLog(params?: { limit?: number; offset?: number }): Promise<{ entries: Array<Record<string, unknown>>; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.limit != null) queryParams.append('limit', String(params.limit));
    if (params?.offset != null) queryParams.append('offset', String(params.offset));
    const url = `/api/admin/audit-log${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiClient.get(url);
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load audit log');
    }
    const data = (response as { data?: { entries?: unknown[]; total?: number } })?.data ?? {};
    return {
      entries: Array.isArray(data.entries) ? data.entries as Record<string, unknown>[] : [],
      total: typeof data.total === 'number' ? data.total : 0,
    };
  },

  async getSystemHealth(): Promise<{ database: string; timestamp: string }> {
    const response = await apiClient.get('/api/admin/system/health');
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? 'Failed to load health');
    }
    const data = (response as { data?: { database?: string; timestamp?: string } })?.data ?? {};
    return { database: data.database ?? 'unknown', timestamp: data.timestamp ?? '' };
  },

  async fundUserWallet(userId: string, data: { amount: string; token?: string }) {
    const response = await apiClient.post(`/api/users/${userId}/wallet/fund`, data);
    if (response && (response as { success?: boolean }).success === false) {
      throw new Error((response as { error?: string }).error ?? (response as { message?: string }).message ?? 'Fund failed');
    }
    return response;
  },
};
