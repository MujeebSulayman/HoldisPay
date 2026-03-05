/**
 * Admin user wallet summary: networks from .env, user addresses from user_wallets,
 * user balance from user_chain_balances only (one list for the user, no per-wallet fetch).
 */
import { supabase } from '../config/supabase';
import { getEnabledChains, getChainConfig } from '../config/enabled-chains';

export interface NetworkRow {
  slug: string;
  displayName: string;
  walletId: string;
  logoUrl: string;
}

export interface UserChainRow {
  chainId: string;
  chainName: string;
  addressId: string;
  address: string;
}

export interface UserBalanceRow {
  chain_id: string;
  token_address: string | null;
  balance_wei: string;
}

export interface AdminUserWalletSummary {
  networks: NetworkRow[];
  userChains: UserChainRow[];
  balances: UserBalanceRow[];
}

export async function getAdminUserWalletSummary(userId: string): Promise<AdminUserWalletSummary> {
  const enabledChains = getEnabledChains();
  const networks: NetworkRow[] = enabledChains.map((c) => ({
    slug: c.slug,
    displayName: c.displayName,
    walletId: c.walletId,
    logoUrl: '',
  }));

  const [walletsRes, balancesRes] = await Promise.all([
    supabase
      .from('user_wallets')
      .select('chain_id, chain_name, wallet_address_id, wallet_address')
      .eq('user_id', userId),
    supabase
      .from('user_chain_balances')
      .select('chain_id, token_address, balance_wei')
      .eq('user_id', userId),
  ]);

  const userChains: UserChainRow[] = [];
  if (!walletsRes.error && walletsRes.data?.length) {
    for (const row of walletsRes.data) {
      const config = getChainConfig(row.chain_id);
      if (!config) continue;
      userChains.push({
        chainId: row.chain_id,
        chainName: row.chain_name ?? config.displayName,
        addressId: row.wallet_address_id,
        address: row.wallet_address,
      });
    }
  }

  const balanceRows = balancesRes.error ? [] : balancesRes.data ?? [];
  const balances: UserBalanceRow[] = balanceRows.map((r) => ({
    chain_id: r.chain_id,
    token_address: r.token_address ?? null,
    balance_wei: r.balance_wei ?? '0',
  }));

  return { networks, userChains, balances };
}
