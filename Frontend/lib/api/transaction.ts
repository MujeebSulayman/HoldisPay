import { apiClient } from './client';

export interface Transaction {
  id: string;
  user_id: string;
  invoice_id?: string;
  tx_type: 'invoice_create' | 'invoice_fund' | 'delivery_submit' | 'delivery_confirm' | 'transfer' | 'contract_fund';
  tx_hash: string;
  status: 'pending' | 'success' | 'failed';
  amount?: string;
  token_address?: string;
  from_address?: string;
  to_address?: string;
  blockradar_reference?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TransactionFilters {
  limit?: number;
  offset?: number;
  status?: string;
  txType?: string;
  chainId?: string;
  startDate?: string;
  endDate?: string;
}

export const transactionApi = {
  async getUserTransactions(userId: string, filters?: TransactionFilters) {
    const params = new URLSearchParams();
    
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.txType) params.append('txType', filters.txType);
    if (filters?.chainId) params.append('chainId', filters.chainId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const queryString = params.toString();
    const endpoint = `/api/users/${userId}/transactions${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get<Transaction[]>(endpoint);
    return response;
  },
};
