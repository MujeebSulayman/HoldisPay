import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { cacheService } from './cache.service';

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
      else cacheService.invalidatePrefix(`wallets:${userId}`);
    } else {
      const { error } = await supabase.from('user_chain_balances').insert({
        user_id: userId,
        chain_id: chainId,
        token_address: key,
        balance_wei: next,
      });
      if (error) logger.error('Balance credit insert failed', { error, userId, chainId, key });
      else cacheService.invalidatePrefix(`wallets:${userId}`);
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
      else cacheService.invalidatePrefix(`wallets:${userId}`);
      if (current < amount) logger.warn('Balance debit underflow', { userId, chainId, key, current: current.toString(), amount: amount.toString() });
    }
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
        byChain[chainId].tokens.push({
          address: r.token_address!,
          symbol: '',
          balance: bal,
          balanceUSD: '0',
        });
      }
    }

    return byChain;
  }

  /**
   * Backfill user_chain_balances from transactions (run once after migration).
   * Applies credits/debits in chronological order so balances match history.
   */
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
