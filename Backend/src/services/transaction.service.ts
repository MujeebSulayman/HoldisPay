import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export type TransactionType = 
  | 'invoice_create' 
  | 'invoice_fund' 
  | 'delivery_submit' 
  | 'delivery_confirm' 
  | 'transfer';

export type TransactionStatus = 'pending' | 'success' | 'failed';

export interface LogTransactionParams {
  userId?: string;
  invoiceId?: bigint;
  txType: TransactionType;
  txHash: string;
  status: TransactionStatus;
  amount?: string;
  tokenAddress?: string;
  fromAddress?: string;
  toAddress?: string;
  blockradarReference?: string;
  metadata?: Record<string, any>;
}

export class TransactionService {
  
  async logTransaction(params: LogTransactionParams): Promise<void> {
    try {
      logger.info('Logging transaction', { 
        txHash: params.txHash, 
        txType: params.txType, 
        status: params.status 
      });

      const { error } = await supabase
        .from('transactions')
        .insert({
          user_id: params.userId,
          invoice_id: params.invoiceId?.toString(),
          tx_type: params.txType,
          tx_hash: params.txHash,
          status: params.status,
          amount: params.amount,
          token_address: params.tokenAddress?.toLowerCase(),
          from_address: params.fromAddress?.toLowerCase(),
          to_address: params.toAddress?.toLowerCase(),
          blockradar_reference: params.blockradarReference,
          metadata: params.metadata,
        });

      if (error) {
        logger.error('Failed to log transaction', { error, params });
        // Don't throw - transaction logging is not critical
      } else {
        logger.info('Transaction logged successfully', { txHash: params.txHash });
      }
    } catch (error) {
      logger.error('Failed to log transaction', { error, params });
      // Don't throw - transaction logging is not critical
    }
  }

  async updateTransactionStatus(
    txHash: string, 
    status: TransactionStatus, 
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const updateData: any = { status };
      if (metadata) {
        updateData.metadata = metadata;
      }

      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('tx_hash', txHash);

      if (error) {
        logger.error('Failed to update transaction status', { error, txHash, status });
      } else {
        logger.info('Transaction status updated', { txHash, status });
      }
    } catch (error) {
      logger.error('Failed to update transaction status', { error, txHash });
    }
  }

  async getUserTransactions(
    userId: string, 
    options?: {
      limit?: number;
      offset?: number;
      status?: string;
      txType?: string;
      chainId?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<any[]> {
    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId);

      // Apply status filter (can be comma-separated)
      if (options?.status) {
        const statuses = options.status.split(',').map(s => s.trim());
        if (statuses.length === 1) {
          query = query.eq('status', statuses[0]);
        } else {
          query = query.in('status', statuses);
        }
      }

      // Apply transaction type filter
      if (options?.txType) {
        query = query.eq('tx_type', options.txType);
      }

      // Apply date range filters
      if (options?.startDate) {
        query = query.gte('created_at', options.startDate);
      }
      if (options?.endDate) {
        query = query.lte('created_at', options.endDate);
      }

      // Apply ordering and pagination
      query = query.order('created_at', { ascending: false });
      
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to get user transactions', { error, userId });
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to get user transactions', { error, userId });
      return [];
    }
  }

  async getInvoiceTransactions(invoiceId: bigint): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('invoice_id', invoiceId.toString())
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to get invoice transactions', { error, invoiceId: invoiceId.toString() });
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to get invoice transactions', { error, invoiceId: invoiceId.toString() });
      return [];
    }
  }

  async getTransactionByHash(txHash: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('tx_hash', txHash)
        .single();

      if (error || !data) {
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get transaction', { error, txHash });
      return null;
    }
  }

  async getPendingTransactions(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Failed to get pending transactions', { error });
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to get pending transactions', { error });
      return [];
    }
  }

  async getFailedTransactions(limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to get failed transactions', { error });
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to get failed transactions', { error });
      return [];
    }
  }
}

export const transactionService = new TransactionService();
