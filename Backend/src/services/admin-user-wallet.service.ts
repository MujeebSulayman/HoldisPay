/**
 * Admin user wallet summary: networks from .env, assets from Blockradar master wallets,
 * user addresses and balances from DB + Blockradar. No legacy multi-chain-wallet aggregation.
 */
import { supabase } from '../config/supabase';
import { getEnabledChains, getChainConfig, getWalletApiKeyForChain } from '../config/enabled-chains';
import { blockradarService } from './blockradar.service';
import { logger } from '../utils/logger';

export interface NetworkRow {
  slug: string;
  displayName: string;
  walletId: string;
  logoUrl: string;
}

export interface AssetRow {
  id: string;
  symbol: string;
  name: string;
  logoUrl: string;
  address: string | null;
  decimals: number;
}

export interface UserChainRow {
  chainId: string;
  chainName: string;
  addressId: string;
  address: string;
}

export interface BalanceTokenRow {
  symbol: string;
  balance: string;
  balanceUSD: string;
  logoUrl?: string;
}

export interface ChainBalancesRow {
  nativeSymbol: string;
  nativeBalance: string;
  nativeBalanceUSD: string;
  nativeLogoUrl?: string;
  tokens: BalanceTokenRow[];
}

export interface AdminUserWalletSummary {
  networks: NetworkRow[];
  assetsByChain: Record<string, AssetRow[]>;
  userChains: UserChainRow[];
  balancesByChain: Record<string, ChainBalancesRow>;
}

export async function getAdminUserWalletSummary(userId: string): Promise<AdminUserWalletSummary> {
  const enabledChains = getEnabledChains();
  if (enabledChains.length === 0) {
    return { networks: [], assetsByChain: {}, userChains: [], balancesByChain: {} };
  }

  let blockchains: any[] = [];
  try {
    blockchains = await blockradarService.getBlockchains();
  } catch (e) {
    logger.warn('Blockradar getBlockchains failed for admin wallet summary', { error: e });
  }

  const networks: NetworkRow[] = enabledChains.map((c) => {
    const chain = blockchains.find((b: any) => (b.slug || '').toLowerCase() === c.slug.toLowerCase());
    return {
      slug: c.slug,
      displayName: c.displayName,
      walletId: c.walletId,
      logoUrl: chain?.logoUrl ?? '',
    };
  });

  const assetsByChain: Record<string, AssetRow[]> = {};
  await Promise.all(
    enabledChains.map(async (c) => {
      try {
        const apiKey = getWalletApiKeyForChain(c.slug);
        const assets = await blockradarService.getWalletAssetsFromApi(c.walletId, { apiKey });
        assetsByChain[c.slug] = assets.map((a: any) => ({
          id: a.id ?? '',
          symbol: a.symbol ?? '',
          name: a.name ?? a.symbol ?? '',
          logoUrl: a.logoUrl ?? '',
          address: a.address ?? null,
          decimals: a.decimals ?? 18,
        }));
      } catch (e) {
        logger.warn('Failed to fetch wallet assets for chain', { chainSlug: c.slug, error: e });
        assetsByChain[c.slug] = [];
      }
    })
  );

  const { data: userWalletRows, error: uwError } = await supabase
    .from('user_wallets')
    .select('chain_id, chain_name, wallet_address_id, wallet_address')
    .eq('user_id', userId);

  const userChains: UserChainRow[] = [];
  const balancesByChain: Record<string, ChainBalancesRow> = {};

  if (uwError || !userWalletRows?.length) {
    return { networks, assetsByChain, userChains, balancesByChain };
  }

  for (const row of userWalletRows) {
    const chainSlug = row.chain_id;
    const chainConfig = getChainConfig(chainSlug);
    if (!chainConfig) continue;

    userChains.push({
      chainId: chainSlug,
      chainName: row.chain_name ?? chainConfig.displayName,
      addressId: row.wallet_address_id,
      address: row.wallet_address,
    });

    try {
      const apiKey = getWalletApiKeyForChain(chainSlug);
      const bal = await blockradarService.getAddressBalances(
        chainConfig.walletId,
        row.wallet_address_id,
        { apiKey, chainSlug }
      );
      const nativeSymbol = bal.nativeSymbol ?? chainConfig.nativeSymbol ?? 'ETH';
      const tokens: BalanceTokenRow[] = [
        {
          symbol: nativeSymbol,
          balance: bal.native,
          balanceUSD: bal.nativeUSD,
          logoUrl: bal.nativeLogoUrl,
        },
        ...bal.tokens.map((t) => ({
          symbol: t.symbol,
          balance: t.balance,
          balanceUSD: t.balanceUSD,
          logoUrl: t.logoUrl,
        })),
      ];
      balancesByChain[chainSlug] = {
        nativeSymbol,
        nativeBalance: bal.native,
        nativeBalanceUSD: bal.nativeUSD,
        nativeLogoUrl: bal.nativeLogoUrl,
        tokens,
      };
    } catch (e) {
      logger.warn('Failed to fetch balances for user chain', { userId, chainSlug, error: e });
      balancesByChain[chainSlug] = {
        nativeSymbol: chainConfig.nativeSymbol ?? 'ETH',
        nativeBalance: '0',
        nativeBalanceUSD: '0',
        tokens: [],
      };
    }
  }

  return { networks, assetsByChain, userChains, balancesByChain };
}
