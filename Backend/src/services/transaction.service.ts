import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { blockradarService } from './blockradar.service';
import { cacheService, cacheKeys } from './cache.service';
import { balanceService } from './balance.service';

export type TransactionType =
  | 'invoice_create'
  | 'invoice_fund'
  | 'delivery_submit'
  | 'delivery_confirm'
  | 'transfer'
  | 'deposit'
  | 'withdraw'
  | 'contract_fund';

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
        if (params.status === 'success' && params.userId && params.chainId && params.amount) {
          this.applyBalanceImpact(params).catch((e) => logger.warn('Balance impact failed', { error: e, txHash: params.txHash }));
        }
      }
      if (params.userId) cacheService.invalidatePrefix(`tx:user:${params.userId}`);
    } catch (error) {
      logger.error('Failed to log transaction', { error, params });
      
    }
  }

  private async applyBalanceImpact(params: LogTransactionParams): Promise<void> {
    const type = params.metadata?.type;
    if (params.txType === 'deposit') {
      await balanceService.credit(params.userId!, params.chainId!, params.amount!, params.tokenAddress);
      return;
    }
    if (params.txType === 'withdraw') {
      await balanceService.debit(params.userId!, params.chainId!, params.amount!, params.tokenAddress);
      return;
    }
    if (params.txType === 'transfer') {
      if (type === 'receiver_payment') await balanceService.credit(params.userId!, params.chainId!, params.amount!, params.tokenAddress);
      else if (type === 'user_withdrawal') await balanceService.debit(params.userId!, params.chainId!, params.amount!, params.tokenAddress);
      return;
    }
    if (params.txType === 'invoice_fund') {
      if (type === 'payment_link_deposit') await balanceService.credit(params.userId!, params.chainId!, params.amount!, params.tokenAddress);
      else if (params.userId) await balanceService.debit(params.userId, params.chainId!, params.amount!, params.tokenAddress);
      return;
    }
    if (params.txType === 'contract_fund' && type === 'contract_funding' && params.userId && params.chainId && params.amount) {
      const contractId = params.metadata?.contractId;
      if (contractId) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contractId);
        const q = isUuid
          ? supabase.from('payment_contracts').select('chain_slug, token_address').eq('id', contractId).maybeSingle()
          : supabase.from('payment_contracts').select('chain_slug, token_address').eq('contract_id', contractId).maybeSingle();
        const { data: contract } = await q;
        const chainId = params.chainId ?? contract?.chain_slug ?? 'base';
        const tokenAddress = params.tokenAddress ?? contract?.token_address ?? undefined;
        await balanceService.debit(params.userId, chainId, params.amount, tokenAddress);
      } else {
        logger.warn('contract_fund missing contractId in metadata', { txHash: params.txHash });
      }
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
    const optsKey = options ? JSON.stringify(options) : '';
    const cacheKey = cacheKeys.userTransactions(userId, optsKey);
    const cached = cacheService.get<any[]>(cacheKey);
    if (cached !== undefined) return cached;

    try {
      const limit = options?.limit ?? 50;
      const offset = options?.offset ?? 0;

      
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
      const result = sorted.slice(offset, offset + limit);
      cacheService.set(cacheKey, result, 60_000);
      return result;
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

  /** Admin: list all platform transactions with optional filters. */
  async getAllTransactionsForAdmin(filters?: {
    userId?: string;
    txType?: string;
    status?: string;
    chainId?: string;
    tokenAddress?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ transactions: any[]; total: number }> {
    try {
      const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 200);
      const offset = Math.max(filters?.offset ?? 0, 0);

      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' });

      if (filters?.userId) query = query.eq('user_id', filters.userId);
      if (filters?.txType) query = query.eq('tx_type', filters.txType);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.chainId) query = query.eq('chain_id', filters.chainId);
      if (filters?.tokenAddress) query = query.ilike('token_address', filters.tokenAddress.toLowerCase());
      if (filters?.startDate) query = query.gte('created_at', filters.startDate);
      if (filters?.endDate) query = query.lte('created_at', filters.endDate);

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Failed to get admin transactions list', { error });
        return { transactions: [], total: 0 };
      }

      return {
        transactions: data || [],
        total: count ?? (data?.length ?? 0),
      };
    } catch (error) {
      logger.error('Failed to get admin transactions', { error });
      return { transactions: [], total: 0 };
    }
  }

  /** Admin: transaction overview – total count, success/failed, volume by chain. */
  async getTransactionsOverview(): Promise<{
    total: number;
    success: number;
    failed: number;
    volumeByChain: Record<string, { volume: string; count: number }>;
    volumeLast30Days: string;
  }> {
    try {
      const { count: total, error: totalErr } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true });
      if (totalErr) throw totalErr;

      const { count: success, error: successErr } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'success');
      if (successErr) throw successErr;

      const { count: failed, error: failedErr } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed');
      if (failedErr) throw failedErr;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const iso = thirtyDaysAgo.toISOString();

      const { data: rows, error: listErr } = await supabase
        .from('transactions')
        .select('chain_id, amount, created_at')
        .eq('status', 'success')
        .gte('created_at', iso);
      if (listErr) throw listErr;

      const volumeByChain: Record<string, { volume: string; count: number }> = {};
      let volumeLast30 = 0n;
      for (const r of rows || []) {
        const chain = r.chain_id ?? 'unknown';
        if (!volumeByChain[chain]) volumeByChain[chain] = { volume: '0', count: 0 };
        volumeByChain[chain].count += 1;
        const amt = BigInt(r.amount ?? 0);
        volumeByChain[chain].volume = (BigInt(volumeByChain[chain].volume) + amt).toString();
        volumeLast30 += amt;
      }

      return {
        total: total ?? 0,
        success: success ?? 0,
        failed: failed ?? 0,
        volumeByChain,
        volumeLast30Days: volumeLast30.toString(),
      };
    } catch (error) {
      logger.error('Failed to get transactions overview', { error });
      return {
        total: 0,
        success: 0,
        failed: 0,
        volumeByChain: {},
        volumeLast30Days: '0',
      };
    }
  }

  /** Admin: transaction count per month for the last N months. */
  async getTransactionsCountByPeriod(periodsCount: number = 12): Promise<Array<{ period: string; count: number }>> {
    const reports: Array<{ period: string; count: number }> = [];
    const now = new Date();
    for (let i = periodsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const periodKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      try {
        const { count, error } = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', start.toISOString())
          .lt('created_at', end.toISOString());
        if (error) {
          logger.warn('Transactions by period: period failed', { period: periodKey, error: error.message });
          reports.push({ period: periodKey, count: 0 });
        } else {
          reports.push({ period: periodKey, count: count ?? 0 });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn('Transactions by period: request failed', { period: periodKey, error: msg });
        reports.push({ period: periodKey, count: 0 });
      }
    }
    return reports;
  }

  async getWalletOverviewFlow(
    userId: string,
    options?: { periodsWeeks?: number; recentLimit?: number }
  ): Promise<{
    flowSummary: { totalIn: string; totalOut: string; net: string; txCountIn: number; txCountOut: number };
    flowByPeriod: Array<{ period: string; periodLabel: string; in: string; out: string; net: string }>;
    flowByDay: Array<{ period: string; periodLabel: string; in: string; out: string; net: string }>;
    cumulative: Array<{ period: string; periodLabel: string; cumulativeNet: string }>;
    flowByType: {
      inflow: { deposit: string; receiver_payment: string; payment_link_deposit: string };
      outflow: { withdraw: string; invoice_fund: string; user_withdrawal: string };
    };
    byChain: Array<{ chainId: string; in: string; out: string; count: number }>;
    recentActivity: any[];
  }> {
    const periodsWeeks = options?.periodsWeeks ?? 12;
    const recentLimit = options?.recentLimit ?? 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodsWeeks * 7);

    const allForUser = await this.getUserTransactions(userId, {
      limit: 2000,
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
    });

    const isInflow = (tx: any): boolean => {
      if (tx.status !== 'success') return false;
      if (tx.tx_type === 'deposit') return true;
      if (tx.tx_type === 'transfer' && tx.metadata?.type === 'receiver_payment') return true;
      if (tx.tx_type === 'invoice_fund' && tx.metadata?.type === 'payment_link_deposit') return true;
      return false;
    };
    const isOutflow = (tx: any): boolean => {
      if (tx.tx_type === 'withdraw') return true;
      if (tx.tx_type === 'invoice_fund' && tx.metadata?.type !== 'payment_link_deposit') return true;
      if (tx.tx_type === 'transfer' && tx.metadata?.type === 'user_withdrawal') return true;
      return false;
    };

    const toWei = (s: string | null | undefined): bigint => (s ? BigInt(s) : 0n);

    let totalIn = 0n;
    let totalOut = 0n;
    let txCountIn = 0;
    let txCountOut = 0;

    const periodBuckets: Record<string, { in: bigint; out: bigint }> = {};
    const dayBuckets: Record<string, { in: bigint; out: bigint }> = {};
    const chainBuckets: Record<string, { in: bigint; out: bigint; count: number }> = {};
    const typeIn: Record<string, bigint> = { deposit: 0n, receiver_payment: 0n, payment_link_deposit: 0n };
    const typeOut: Record<string, bigint> = { withdraw: 0n, invoice_fund: 0n, user_withdrawal: 0n };

    const getPeriodKey = (date: Date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      return weekStart.toISOString().slice(0, 10);
    };
    const getDayKey = (date: Date) => new Date(date).toISOString().slice(0, 10);

    const inflowType = (tx: any): keyof typeof typeIn | null => {
      if (tx.tx_type === 'deposit') return 'deposit';
      if (tx.tx_type === 'transfer' && tx.metadata?.type === 'receiver_payment') return 'receiver_payment';
      if (tx.tx_type === 'invoice_fund' && tx.metadata?.type === 'payment_link_deposit') return 'payment_link_deposit';
      return null;
    };
    const outflowType = (tx: any): keyof typeof typeOut | null => {
      if (tx.tx_type === 'withdraw') return 'withdraw';
      if (tx.tx_type === 'invoice_fund' && tx.metadata?.type !== 'payment_link_deposit') return 'invoice_fund';
      if (tx.tx_type === 'transfer' && tx.metadata?.type === 'user_withdrawal') return 'user_withdrawal';
      return null;
    };

    for (const tx of allForUser) {
      const amount = toWei(tx.amount);
      const chainId = tx.chain_id || tx.metadata?.chainId || 'unknown';

      if (isInflow(tx)) {
        totalIn += amount;
        txCountIn++;
        const it = inflowType(tx);
        if (it) typeIn[it] += amount;
        const pk = getPeriodKey(new Date(tx.created_at));
        const dk = getDayKey(new Date(tx.created_at));
        if (!periodBuckets[pk]) periodBuckets[pk] = { in: 0n, out: 0n };
        periodBuckets[pk].in += amount;
        if (!dayBuckets[dk]) dayBuckets[dk] = { in: 0n, out: 0n };
        dayBuckets[dk].in += amount;
        if (!chainBuckets[chainId]) chainBuckets[chainId] = { in: 0n, out: 0n, count: 0 };
        chainBuckets[chainId].in += amount;
        chainBuckets[chainId].count++;
      } else if (isOutflow(tx)) {
        totalOut += amount;
        txCountOut++;
        const ot = outflowType(tx);
        if (ot) typeOut[ot] += amount;
        const pk = getPeriodKey(new Date(tx.created_at));
        const dk = getDayKey(new Date(tx.created_at));
        if (!periodBuckets[pk]) periodBuckets[pk] = { in: 0n, out: 0n };
        periodBuckets[pk].out += amount;
        if (!dayBuckets[dk]) dayBuckets[dk] = { in: 0n, out: 0n };
        dayBuckets[dk].out += amount;
        if (!chainBuckets[chainId]) chainBuckets[chainId] = { in: 0n, out: 0n, count: 0 };
        chainBuckets[chainId].out += amount;
        chainBuckets[chainId].count++;
      }
    }

    const flowByPeriod = Object.entries(periodBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, { in: inVal, out: outVal }]) => ({
        period,
        periodLabel: new Date(period).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
        in: inVal.toString(),
        out: outVal.toString(),
        net: (inVal - outVal).toString(),
      }));

    const flowByDay = Object.entries(dayBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([period, { in: inVal, out: outVal }]) => ({
        period,
        periodLabel: new Date(period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        in: inVal.toString(),
        out: outVal.toString(),
        net: (inVal - outVal).toString(),
      }));

    let running = 0n;
    const cumulative = flowByPeriod.map((p) => {
      running += BigInt(p.net);
      return { period: p.period, periodLabel: p.periodLabel, cumulativeNet: running.toString() };
    });

    const byChain = Object.entries(chainBuckets).map(([chainId, v]) => ({
      chainId,
      in: v.in.toString(),
      out: v.out.toString(),
      count: v.count,
    }));

    const recentActivity = allForUser
      .slice(0, recentLimit)
      .map((tx) => ({
        ...tx,
        direction: isInflow(tx) ? 'in' : isOutflow(tx) ? 'out' : 'neutral',
        amount: tx.amount,
      }));

    return {
      flowSummary: {
        totalIn: totalIn.toString(),
        totalOut: totalOut.toString(),
        net: (totalIn - totalOut).toString(),
        txCountIn,
        txCountOut,
      },
      flowByPeriod,
      flowByDay,
      cumulative,
      flowByType: {
        inflow: {
          deposit: typeIn.deposit.toString(),
          receiver_payment: typeIn.receiver_payment.toString(),
          payment_link_deposit: typeIn.payment_link_deposit.toString(),
        },
        outflow: {
          withdraw: typeOut.withdraw.toString(),
          invoice_fund: typeOut.invoice_fund.toString(),
          user_withdrawal: typeOut.user_withdrawal.toString(),
        },
      },
      byChain,
      recentActivity,
    };
  }

  
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
