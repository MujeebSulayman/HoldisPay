import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { blockradarService } from './blockradar.service';

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
  /** Chain slug for display (e.g. 'base', 'ethereum'). Stored in metadata.chainId */
  chainId?: string;
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

      const metadata: Record<string, any> = { ...(params.metadata || {}) };
      if (params.chainId) metadata.chainId = params.chainId;

      const row = {
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
        chain_id: params.chainId || null,
        metadata: Object.keys(metadata).length ? metadata : undefined,
      };

      const { error } = await supabase
        .from('transactions')
        .upsert(row, { onConflict: 'tx_hash', ignoreDuplicates: true });

      if (error) {
        if (error.code === '23505') {
          logger.debug('Transaction already exists (duplicate tx_hash), skipping', { txHash: params.txHash });
        } else {
          logger.error('Failed to log transaction', { error, params });
        }
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
      const limit = options?.limit ?? 50;
      const offset = options?.offset ?? 0;

      // 1) Transactions with user_id = userId
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId);

      if (options?.status) {
        const statuses = options.status.split(',').map((s) => s.trim());
        if (statuses.length === 1) query = query.eq('status', statuses[0]);
        else query = query.in('status', statuses);
      }
      if (options?.txType) query = query.eq('tx_type', options.txType);
      if (options?.startDate) query = query.gte('created_at', options.startDate);
      if (options?.endDate) query = query.lte('created_at', options.endDate);

      const { data: byUser, error: errUser } = await query.order('created_at', { ascending: false });

      if (errUser) {
        logger.error('Failed to get user transactions (by user_id)', { error: errUser, userId });
        return [];
      }

      // 2) Invoice IDs where this user is issuer, payer, or receiver
      const { data: userRow } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('id', userId)
        .maybeSingle();
      const { data: walletRows } = await supabase
        .from('user_wallets')
        .select('wallet_address')
        .eq('user_id', userId);
      const addresses = new Set<string>();
      if (userRow?.wallet_address) addresses.add(userRow.wallet_address.toLowerCase());
      (walletRows || []).forEach((r) => r.wallet_address && addresses.add(r.wallet_address.toLowerCase()));

      let invoiceIds: string[] = [];
      if (addresses.size > 0) {
        const { data: invoicesByIssuer } = await supabase
          .from('invoices')
          .select('invoice_id')
          .eq('issuer_id', userId);
        const { data: invoicesByPayer } = await supabase
          .from('invoices')
          .select('invoice_id')
          .in('payer_address', [...addresses]);
        const { data: invoicesByReceiver } = await supabase
          .from('invoices')
          .select('invoice_id')
          .in('receiver_address', [...addresses]);
        const ids = new Set<string>();
        (invoicesByIssuer || []).forEach((r) => r.invoice_id != null && ids.add(String(r.invoice_id)));
        (invoicesByPayer || []).forEach((r) => r.invoice_id != null && ids.add(String(r.invoice_id)));
        (invoicesByReceiver || []).forEach((r) => r.invoice_id != null && ids.add(String(r.invoice_id)));
        invoiceIds = [...ids];
      } else {
        const { data: invoicesByIssuer } = await supabase
          .from('invoices')
          .select('invoice_id')
          .eq('issuer_id', userId);
        invoiceIds = (invoicesByIssuer || []).map((r) => String(r.invoice_id)).filter(Boolean);
      }

      // 3) Transactions with user_id null but invoice_id in user's invoices
      let byInvoice: any[] = [];
      if (invoiceIds.length > 0) {
        let q = supabase
          .from('transactions')
          .select('*')
          .is('user_id', null)
          .in('invoice_id', invoiceIds);
        if (options?.status) {
          const statuses = options.status.split(',').map((s) => s.trim());
          if (statuses.length === 1) q = q.eq('status', statuses[0]);
          else q = q.in('status', statuses);
        }
        if (options?.txType) q = q.eq('tx_type', options.txType);
        if (options?.startDate) q = q.gte('created_at', options.startDate);
        if (options?.endDate) q = q.lte('created_at', options.endDate);
        const { data } = await q.order('created_at', { ascending: false });
        byInvoice = data || [];
      }

      const combined = [...(byUser || []), ...byInvoice];
      const seenId = new Set<string>();
      const deduped = combined.filter((row) => {
        if (seenId.has(row.id)) return false;
        seenId.add(row.id);
        return true;
      });

      // 4) Pending invoices (awaiting payment) with no successful tx yet — show as pending
      if (!options?.status || options.status.split(',').map((s) => s.trim()).includes('pending')) {
        const { data: successTxInvoiceIds } = await supabase
          .from('transactions')
          .select('invoice_id')
          .eq('status', 'success')
          .not('invoice_id', 'is', null);
        const paidInvoiceIds = new Set((successTxInvoiceIds || []).map((r) => String(r.invoice_id)));

        const { data: byIssuer } = await supabase
          .from('invoices')
          .select('id, invoice_id, issuer_id, amount, created_at, description')
          .eq('status', 'pending')
          .eq('issuer_id', userId);
        let pendingInvoices: any[] = byIssuer || [];
        if (addresses.size > 0) {
          const addrList = [...addresses];
          const { data: byPayer } = await supabase
            .from('invoices')
            .select('id, invoice_id, issuer_id, amount, created_at, description')
            .eq('status', 'pending')
            .in('payer_address', addrList);
          const { data: byReceiver } = await supabase
            .from('invoices')
            .select('id, invoice_id, issuer_id, amount, created_at, description')
            .eq('status', 'pending')
            .in('receiver_address', addrList);
          const byInvId = new Map<string, any>();
          [...pendingInvoices, ...(byPayer || []), ...(byReceiver || [])].forEach((inv) => byInvId.set(String(inv.invoice_id), inv));
          pendingInvoices = [...byInvId.values()];
        }

        for (const inv of pendingInvoices || []) {
          if (paidInvoiceIds.has(String(inv.invoice_id))) continue;
          const synthetic: any = {
            id: `pending-invoice-${inv.invoice_id}`,
            user_id: userId,
            invoice_id: inv.invoice_id,
            tx_type: 'invoice_fund',
            tx_hash: '',
            status: 'pending',
            amount: inv.amount,
            token_address: null,
            from_address: null,
            to_address: null,
            blockradar_reference: null,
            chain_id: null,
            metadata: { source: 'pending_invoice', description: inv.description },
            created_at: inv.created_at,
            updated_at: inv.created_at,
          };
          deduped.push(synthetic);
        }
      }

      const sorted = deduped.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      return sorted.slice(offset, offset + limit);
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
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get transaction', { error, txHash });
      return null;
    }
  }

  /** Returns true if a transaction with this tx_hash and invoice_id already exists (avoids duplicate log from duplicate webhooks). */
  async existsByTxHashAndInvoice(txHash: string, invoiceId: bigint): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id')
        .eq('tx_hash', txHash)
        .eq('invoice_id', invoiceId.toString())
        .limit(1)
        .maybeSingle();

      return !error && !!data;
    } catch (error) {
      return false;
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

  /** Extract chain slug from Blockradar transaction details. */
  private static chainSlugFromDetails(details: { blockchain?: { slug?: string; name?: string }; chainId?: number } | null): string | null {
    if (!details) return null;
    const b = details.blockchain;
    if (b?.slug) return b.slug.toLowerCase().trim();
    if (b?.name) return b.name.toLowerCase().replace(/\s+/g, '');
    if (details.chainId != null) {
      const m: Record<number, string> = { 11155111: 'ethereum', 84532: 'base', 43113: 'avalanche', 80002: 'polygon', 97: 'bnb', 8453: 'base', 1: 'ethereum' };
      return m[details.chainId] ?? null;
    }
    return null;
  }

  /**
   * Backfill chain_id for rows that have blockradar_reference but null chain_id.
   * Calls Blockradar GET transaction and updates our row. Returns number of rows updated.
   */
  async backfillChainIds(options?: { limit?: number }): Promise<{ updated: number; failed: number }> {
    const limit = options?.limit ?? 100;
    let updated = 0;
    let failed = 0;
    try {
      const { data: rows, error } = await supabase
        .from('transactions')
        .select('id, blockradar_reference')
        .not('blockradar_reference', 'is', null)
        .is('chain_id', null)
        .limit(limit);

      if (error || !rows?.length) {
        return { updated: 0, failed: 0 };
      }

      for (const row of rows) {
        const ref = row.blockradar_reference as string;
        const details = await blockradarService.getTransactionDetails(ref);
        const slug = TransactionService.chainSlugFromDetails(details);
        if (!slug) {
          logger.debug('Backfill: no chain from Blockradar', { id: row.id, blockradar_reference: ref });
          failed++;
          continue;
        }
        const { error: updateErr } = await supabase
          .from('transactions')
          .update({ chain_id: slug })
          .eq('id', row.id);
        if (updateErr) {
          logger.warn('Backfill chain_id update failed', { id: row.id, slug, error: updateErr });
          failed++;
        } else {
          updated++;
        }
        // Avoid rate limiting Blockradar
        await new Promise((r) => setTimeout(r, 250));
      }

      if (updated) logger.info('Backfill chain_id completed', { updated, failed, total: rows.length });
      return { updated, failed };
    } catch (err) {
      logger.error('Backfill chain_id error', { error: err });
      return { updated, failed };
    }
  }
}

export const transactionService = new TransactionService();
