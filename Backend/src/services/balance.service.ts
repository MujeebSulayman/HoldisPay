/**
 * User balance ledger (production).
 *
 * - Balance is stored in user_chain_balances; settlement bucket = SETTLEMENT_* in constants/addresses (single chain+token).
 * - Unit: smallest unit = 6 decimals (1 USD = 1e6). Industry standard: store in smallest unit (Stripe: cents; we: 6-decimal USD).
 * - Funds physically sit in Blockradar master wallet; child addresses are not used for this balance.
 * - Credit: only from webhook when Blockradar sends a documented USD amount (currency USD + amount, or amountUSD); see settlementUnitsFromBlockradarDeposit.
 * - Debit: on withdraw to NGN (wallet controller).
 * - Dashboard "Funds available" and Withdraw "Available" = getConsolidatedBalance().withdrawableUsd.
 */
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { cacheService } from './cache.service';
import { blockradarService } from './blockradar.service';

const NATIVE_KEY = '';

export interface ChainBalance {
  native: string;
  nativeUSD: string;
  tokens: Array<{ address: string; symbol: string; balance: string; balanceUSD: string; logoUrl?: string }>;
}

export type UserBalancesByChain = Record<string, ChainBalance>;

export class BalanceService {
  async credit(
    userId: string,
    chainId: string,
    amountWei: string,
    tokenAddress?: string | null
  ): Promise<void> {
    const key = tokenAddress?.toLowerCase()?.trim() ?? NATIVE_KEY;
    const amount = BigInt(amountWei);
    if (amount <= 0n) return;

    const { data: row } = await supabase
      .from('user_chain_balances')
      .select('id, balance_wei')
      .eq('user_id', userId)
      .eq('chain_id', chainId)
      .eq('token_address', key)
      .maybeSingle();

    const current = BigInt(row?.balance_wei ?? '0');
    const next = (current + amount).toString();

    if (row) {
      const { error } = await supabase
        .from('user_chain_balances')
        .update({ balance_wei: next, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) logger.error('Balance credit update failed', { error, userId, chainId, key });
      else await cacheService.invalidatePrefix(`wallets:${userId}`);
    } else {
      const { error } = await supabase.from('user_chain_balances').insert({
        user_id: userId,
        chain_id: chainId,
        token_address: key,
        balance_wei: next,
      });
      if (error) logger.error('Balance credit insert failed', { error, userId, chainId, key });
      else await cacheService.invalidatePrefix(`wallets:${userId}`);
    }
  }

  async debit(
    userId: string,
    chainId: string,
    amountWei: string,
    tokenAddress?: string | null
  ): Promise<void> {
    const key = tokenAddress?.toLowerCase()?.trim() ?? NATIVE_KEY;
    const amount = BigInt(amountWei);
    if (amount <= 0n) return;

    const { data: row } = await supabase
      .from('user_chain_balances')
      .select('id, balance_wei')
      .eq('user_id', userId)
      .eq('chain_id', chainId)
      .eq('token_address', key)
      .maybeSingle();

    const current = BigInt(row?.balance_wei ?? '0');
    const next = current >= amount ? current - amount : 0n;

    if (row) {
      const { error } = await supabase
        .from('user_chain_balances')
        .update({ balance_wei: next.toString(), updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) logger.error('Balance debit update failed', { error, userId, chainId, key });
      else await cacheService.invalidatePrefix(`wallets:${userId}`);
      if (current < amount) logger.warn('Balance debit underflow', { userId, chainId, key, current: current.toString(), amount: amount.toString() });
    }
  }

  /**
   * Atomic debit: only subtracts if balance >= amount (optimistic lock on balance_wei).
   * Returns true if debited, false if insufficient or no row.
   * Use this for withdrawals to avoid race double-spend.
   */
  async tryDebit(
    userId: string,
    chainId: string,
    amountWei: string,
    tokenAddress?: string | null
  ): Promise<boolean> {
    const key = tokenAddress?.toLowerCase()?.trim() ?? NATIVE_KEY;
    const amount = BigInt(amountWei);
    if (amount <= 0n) return false;

    const { data: row } = await supabase
      .from('user_chain_balances')
      .select('id, balance_wei')
      .eq('user_id', userId)
      .eq('chain_id', chainId)
      .eq('token_address', key)
      .maybeSingle();

    if (!row) return false;
    const current = BigInt(row.balance_wei ?? '0');
    if (current < amount) return false;

    const next = (current - amount).toString();
    const { data: updated, error } = await supabase
      .from('user_chain_balances')
      .update({ balance_wei: next, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('balance_wei', row.balance_wei)
      .select('id');

    if (error) {
      logger.error('Balance tryDebit update failed', { error, userId, chainId, key });
      return false;
    }
    if (!updated?.length) return false; // concurrent update, balance changed
    await cacheService.invalidatePrefix(`wallets:${userId}`);
    return true;
  }

  /**
   * Unified debit across all chains: deducts from any chain with a balance until fulfilled.
   * Returns true if fully debited, false if total balance is insufficient.
   * WARNING: This method iterates through balance rows; it's recommended to use for unified USDC systems.
   */
  async tryDebitConsolidated(userId: string, totalAmountWei: string): Promise<boolean> {
    const amountToDebit = BigInt(totalAmountWei);
    if (amountToDebit <= 0n) return false;

    // 1. Check total balance first to avoid partial debits if possible
    const { withdrawableUsd } = await this.getConsolidatedBalance(userId);
    const totalAvailableWei = BigInt(Math.round(withdrawableUsd * 1e6));
    if (totalAvailableWei < amountToDebit) return false;

    // 2. Fetch all rows with balance > 0
    const { data: rows, error } = await supabase
      .from('user_chain_balances')
      .select('id, balance_wei')
      .eq('user_id', userId)
      .gt('balance_wei', '0')
      .order('balance_wei', { ascending: false }); // Start with largest balance for efficiency

    if (error || !rows?.length) return false;

    let remaining = amountToDebit;
    const updates: Array<{ id: string; next: string; original: string }> = [];

    for (const row of rows) {
      if (remaining <= 0n) break;
      const current = BigInt(row.balance_wei);
      const deduct = current > remaining ? remaining : current;
      
      updates.push({
        id: row.id,
        next: (current - deduct).toString(),
        original: row.balance_wei
      });
      remaining -= deduct;
    }

    if (remaining > 0n) return false; // Should not happen given the check above, but safer

    // 3. Apply updates (optimistic locking)
    // Note: Since we don't have true transactions across multiple rows with maybeSingle/select in this Supabase client easily,
    // we apply them sequentially. If one fails, we might have a partial debit. 
    // In a high-concurrency system, a real Postgres transaction via RPC or a stored procedure would be better.
    // However, for this implementation, we'll use sequential optimistic updates.
    
    let success = true;
    const appliedUpdates: typeof updates = [];

    for (const update of updates) {
      const { data: result, error: updateError } = await supabase
        .from('user_chain_balances')
        .update({ balance_wei: update.next, updated_at: new Date().toISOString() })
        .eq('id', update.id)
        .eq('balance_wei', update.original)
        .select('id');

      if (updateError || !result?.length) {
        success = false;
        break;
      }
      appliedUpdates.push(update);
    }

    if (!success) {
      // Rollback applied updates on failure
      for (const applied of appliedUpdates) {
        // Simple credit back
        const { data: row } = await supabase.from('user_chain_balances').select('balance_wei').eq('id', applied.id).single();
        if (row) {
          const current = BigInt(row.balance_wei);
          const original = BigInt(applied.original);
          const next = BigInt(applied.next);
          const diff = original - next;
          await supabase.from('user_chain_balances').update({ balance_wei: (current + diff).toString() }).eq('id', applied.id);
        }
      }
      return false;
    }

    await cacheService.invalidatePrefix(`wallets:${userId}`);
    return true;
  }

  async getBalancesForUser(userId: string): Promise<UserBalancesByChain> {
    const { data: rows, error } = await supabase
      .from('user_chain_balances')
      .select('chain_id, token_address, balance_wei')
      .eq('user_id', userId)
      .gte('balance_wei', '1');

    if (error) {
      logger.error('Failed to get user balances', { error, userId });
      return {};
    }

    // Fetch all assets once to map metadata
    let allAssets: any[] = [];
    try {
      allAssets = await blockradarService.getAssets();
    } catch (e) {
      logger.warn('Failed to fetch assets for balance enrichment', { error: e });
    }

    const byChain: UserBalancesByChain = {};

    for (const r of rows || []) {
      const chainId = r.chain_id;
      if (!byChain[chainId]) {
        byChain[chainId] = { native: '0', nativeUSD: '0', tokens: [] };
      }
      const isNative = r.token_address === '' || r.token_address == null;
      const bal = r.balance_wei ?? '0';
      if (isNative) {
        byChain[chainId].native = bal;
      } else {
        const addr = r.token_address!.toLowerCase();
        const asset = allAssets.find(a => 
          (a.address || '').toLowerCase() === addr && 
          (a.blockchain?.slug || '').toLowerCase() === chainId.toLowerCase()
        );

        byChain[chainId].tokens.push({
          address: r.token_address!,
          symbol: asset?.symbol || '',
          balance: bal,
          balanceUSD: '0',
          logoUrl: asset?.logoUrl || '',
        });
      }
    }

    return byChain;
  }

  /**
   * Contract balance held in payment_contracts where user is employer (remaining_balance).
   * Identified by employer_id (user id), not wallet address. Keyed by chain then token (native = '').
   */
  async getContractBalancesForUser(userId: string): Promise<Record<string, { native: string; tokens: Array<{ address: string; balance: string }> }>> {
    const { data: contracts, error } = await supabase
      .from('payment_contracts')
      .select('chain_slug, token_address, remaining_balance')
      .eq('employer_id', userId)
      .in('status', ['ACTIVE', 'PAUSED', 'DRAFT'])
      .gte('remaining_balance', '1');

    if (error || !contracts?.length) return {};

    const byChain: Record<string, { native: string; tokens: Array<{ address: string; balance: string }> }> = {};
    for (const c of contracts) {
      const chainId = (c.chain_slug ?? 'base') as string;
      const tokenAddress = (c.token_address ?? '').trim().toLowerCase();
      const bal = c.remaining_balance ?? '0';
      if (!byChain[chainId]) byChain[chainId] = { native: '0', tokens: [] };
      if (tokenAddress === '' || tokenAddress == null) {
        const cur = BigInt(byChain[chainId].native);
        byChain[chainId].native = (cur + BigInt(bal)).toString();
      } else {
        const existing = byChain[chainId].tokens.find((t) => t.address === tokenAddress);
        if (existing) {
          existing.balance = (BigInt(existing.balance) + BigInt(bal)).toString();
        } else {
          byChain[chainId].tokens.push({ address: tokenAddress, balance: bal });
        }
      }
    }
    return byChain;
  }

  /**
   * Single source of truth for "available to withdraw".
   * wallet = ledger (user_chain_balances), not Blockradar child address balances.
   * withdrawableUsd = sum of ledger balance_wei in 6 decimals (USDC). Use for dashboard and withdraw UI.
   */
  async getConsolidatedBalance(userId: string): Promise<{
    wallet: UserBalancesByChain;
    inContracts: Record<string, { native: string; tokens: Array<{ address: string; balance: string }> }>;
    withdrawableUsd: number;
  }> {
    const [wallet, inContracts] = await Promise.all([
      this.getBalancesForUser(userId),
      this.getContractBalancesForUser(userId),
    ]);
    let totalWei = 0n;
    for (const chain of Object.values(wallet)) {
      totalWei += BigInt(chain.native ?? '0');
      for (const t of chain.tokens ?? []) {
        totalWei += BigInt(t.balance ?? '0');
      }
    }
    const withdrawableUsd = Number(totalWei) / 1e6;
    return { wallet, inContracts, withdrawableUsd };
  }

  async backfillFromTransactions(): Promise<{ usersProcessed: number; errors: number }> {
    const { data: rows, error } = await supabase
      .from('transactions')
      .select('id, user_id, chain_id, token_address, amount, tx_type, status, metadata, created_at')
      .eq('status', 'success')
      .not('user_id', 'is', null)
      .order('created_at', { ascending: true });

    if (error || !rows?.length) {
      logger.warn('Backfill: no transactions or error', { error });
      return { usersProcessed: 0, errors: 0 };
    }

    const chainFrom = (r: { chain_id?: string | null; metadata?: { chainId?: string } }) => r.chain_id || r.metadata?.chainId || 'base';
    const tokenFrom = (r: { token_address?: string | null }) => r.token_address ?? null;
    const type = (r: { tx_type: string; metadata?: { type?: string } }) => r.metadata?.type ?? r.tx_type;

    let errors = 0;
    const processed = new Set<string>();

    for (const r of rows) {
      const userId = r.user_id;
      const chainId = chainFrom(r);
      const amount = r.amount ?? '0';
      const tokenAddress = tokenFrom(r);
      if (!userId || BigInt(amount) <= 0n) continue;

      try {
        if (r.tx_type === 'deposit') {
          await this.credit(userId, chainId, amount, tokenAddress);
        } else if (r.tx_type === 'withdraw') {
          await this.debit(userId, chainId, amount, tokenAddress);
        } else if (r.tx_type === 'transfer') {
          if (type(r) === 'receiver_payment') await this.credit(userId, chainId, amount, tokenAddress);
          else if (type(r) === 'user_withdrawal') await this.debit(userId, chainId, amount, tokenAddress);
        } else if (r.tx_type === 'invoice_fund') {
          if (type(r) === 'payment_link_deposit') await this.credit(userId, chainId, amount, tokenAddress);
          else await this.debit(userId, chainId, amount, tokenAddress);
        } else if (r.tx_type === 'contract_fund' && type(r) === 'contract_funding') {
          const contractId = (r.metadata as { contractId?: string })?.contractId;
          if (contractId) {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contractId);
            const q = isUuid
              ? supabase.from('payment_contracts').select('chain_slug, token_address').eq('id', contractId).maybeSingle()
              : supabase.from('payment_contracts').select('chain_slug, token_address').eq('contract_id', contractId).maybeSingle();
            const { data: contract } = await q;
            const cChain = contract?.chain_slug ?? chainId;
            const cToken = contract?.token_address ?? tokenAddress;
            await this.debit(userId, cChain, amount, cToken);
          }
        }
        processed.add(userId);
      } catch (e) {
        errors++;
        logger.warn('Backfill tx failed', { id: r.id, userId, error: e });
      }
    }

    logger.info('Backfill from transactions done', { usersProcessed: processed.size, errors });
    return { usersProcessed: processed.size, errors };
  }
}

export const balanceService = new BalanceService();
