import { apiClient } from './client';

export interface Transaction {
  id: string;
  user_id: string;
  invoice_id?: string;
  tx_type: 'invoice_create' | 'invoice_fund' | 'delivery_submit' | 'delivery_confirm' | 'transfer';
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

export const transactionApi = {
  async getUserTransactions(userId: string, limit: number = 50) {
    const response = await apiClient.get<Transaction[]>(
      `/api/users/${userId}/transactions?limit=${limit}`
    );
    return response;
  },
};
