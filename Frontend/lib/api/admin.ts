import { apiClient } from './client';

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
  async getMetrics() {
    const response = await apiClient.get('/api/admin/metrics');
    return response.data;
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
    const response = await apiClient.get(url);
    return { data: (response.data as User[]) || [] };
  },

  async getUserActivity(userId: string) {
    const response = await apiClient.get(`/api/admin/users/${userId}/activity`);
    return response.data;
  },

  async getTopUsers(limit: number = 10) {
    const response = await apiClient.get(`/api/admin/users/top?limit=${limit}`);
    return response.data;
  },

  async getUserSegmentation() {
    const response = await apiClient.get('/api/admin/users/segmentation');
    return response.data;
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
    return response.data;
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
    return response.data;
  },

  async getFailedInvoices() {
    const response = await apiClient.get('/api/admin/invoices/failed');
    return response.data;
  },

  // Revenue
  async getRevenueReport(params?: {
    period?: 'daily' | 'weekly' | 'monthly';
    startDate?: string;
    endDate?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.append('period', params.period);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    
    const url = `/api/admin/revenue/report${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiClient.get(url);
    return response.data;
  },

  async getRevenueForecast(daysAhead: number = 30) {
    const response = await apiClient.get(`/api/admin/revenue/forecast?daysAhead=${daysAhead}`);
    return response.data;
  },

  // Transactions
  async getTransactionVolume() {
    const response = await apiClient.get('/api/admin/transactions/volume');
    return response.data;
  },

  async backfillChainIds(limit?: number) {
    const url = limit != null ? `/api/admin/transactions/backfill-chain-ids?limit=${limit}` : '/api/admin/transactions/backfill-chain-ids';
    const response = await apiClient.post(url);
    return response.data;
  },

  // Wallets
  async getWalletHealth() {
    const response = await apiClient.get('/api/admin/wallets/health');
    return response.data;
  },

  async getAllAddresses() {
    const response = await apiClient.get('/api/admin/wallets/addresses');
    return response.data;
  },

  async getLowBalanceAlerts(threshold?: string) {
    const url = `/api/admin/wallets/alerts/low-balance${threshold ? `?threshold=${threshold}` : ''}`;
    const response = await apiClient.get(url);
    return response.data;
  },

  async getTokenBreakdown() {
    const response = await apiClient.get('/api/admin/wallets/token-breakdown');
    return response.data;
  },

  async getWaitlist(): Promise<{ items: { id: string; email: string; name: string | null; created_at: string }[]; total: number }> {
    const response = await apiClient.get<{ items: { id: string; email: string; name: string | null; created_at: string }[]; total: number }>('/api/admin/waitlist');
    const data = response?.data ?? response;
    return {
      items: Array.isArray((data as { items?: unknown[] }).items) ? (data as { items: { id: string; email: string; name: string | null; created_at: string }[]; total: number }).items : [],
      total: typeof (data as { total?: number }).total === 'number' ? (data as { total: number }).total : 0,
    };
  },
};
