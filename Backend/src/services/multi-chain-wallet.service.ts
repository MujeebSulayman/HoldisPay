import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { getAvailableChains, getChainConfig, getBlockradarApiKeyForChain, ChainConfig } from '../config/chains';
import { BlockradarResponse, BlockradarChildAddress } from '../types/blockradar';
import { supabase } from '../config/supabase';
import { cacheService, cacheKeys } from './cache.service';
import { blockradarService } from './blockradar.service';
import { balanceService } from './balance.service';

export interface ChainWalletAsset {
  symbol: string;
  name?: string;
  address?: string | null;
  logoUrl?: string;
  balance: string;
  balanceUSD: string;
  isNative?: boolean;
}

export interface ChainWallet {
  chainId: string;
  chainName: string;
  addressId: string;
  address: string;
  logoUrl: string;
  balance: {
    native: string;
    nativeUSD: string;
    tokens: Array<{
      address: string;
      symbol: string;
      balance: string;
      balanceUSD: string;
      logoUrl?: string;
    }>;
  };
  /** All enabled assets for this chain (from Blockradar wallet assets), with balance from child address. */
  allAssets?: ChainWalletAsset[];
}

export class MultiChainWalletService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: env.BLOCKRADAR_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.BLOCKRADAR_API_KEY,
      },
      timeout: 30000,
    });
  }

  async createWalletOnChain(
    userId: string,
    chainConfig: ChainConfig,
    label?: string,
    options?: { apiKey?: string }
  ): Promise<{ addressId: string; address: string }> {
    try {
      if (!chainConfig.walletId) {
        throw new Error(`No wallet ID configured for ${chainConfig.displayName}`);
      }

      logger.info('Creating child address on chain', {
        userId,
        chain: chainConfig.displayName,
        walletId: chainConfig.walletId,
      });

      const headers = options?.apiKey ? { 'x-api-key': options.apiKey } : undefined;
      const response = await this.client.post<BlockradarResponse<BlockradarChildAddress>>(
        `/v1/wallets/${chainConfig.walletId}/addresses`,
        {
          name: label || `User ${userId} - ${chainConfig.displayName}`,
          label: label || `User ${userId} - ${chainConfig.displayName}`,
          disableAutoSweep: true,
          metadata: {
            userId,
            chainId: chainConfig.id,
            createdAt: new Date().toISOString(),
          },
        },
        headers ? { headers } : undefined
      );

      const childAddress = response.data.data;

      try {
        await blockradarService.updateAddress(
          chainConfig.walletId,
          childAddress.id,
          { disableAutoSweep: true },
          options?.apiKey ? { apiKey: options.apiKey } : undefined
        );
        logger.info('Address updated: disableAutoSweep set', { addressId: childAddress.id, chain: chainConfig.displayName });
      } catch (e) {
        logger.warn('Address update (disableAutoSweep) failed, create may have set it', { addressId: childAddress.id, error: e });
      }

      try {
        await blockradarService.disableAutoSettlementForAddress(
          chainConfig.walletId,
          childAddress.id,
          options?.apiKey ? { apiKey: options.apiKey } : undefined
        );
      } catch (e) {
        logger.warn('disableAutoSettlementForAddress failed', { addressId: childAddress.id, error: e });
      }

      logger.info('Child address created on chain', {
        userId,
        chain: chainConfig.displayName,
        addressId: childAddress.id,
        address: childAddress.address,
      });

      return {
        addressId: childAddress.id,
        address: childAddress.address,
      };
    } catch (error) {
      logger.error('Failed to create wallet on chain', {
        error,
        userId,
        chain: chainConfig.displayName,
      });
      throw error;
    }
  }

  async createWalletsOnAllChains(
    userId: string,
    userName: string
  ): Promise<Record<string, { addressId: string; address: string }>> {
    const wallets: Record<string, { addressId: string; address: string }> = {};
    const chains = getAvailableChains();

    logger.info('Creating multi-chain wallet setup', {
      userId,
      chainCount: chains.length,
    });

    
    const { data: existingWallets } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId);

    if (existingWallets && existingWallets.length > 0) {
      logger.info('User already has wallets configured', { userId, count: existingWallets.length });
      existingWallets.forEach((wallet) => {
        wallets[wallet.chain_id] = {
          addressId: wallet.wallet_address_id,
          address: wallet.wallet_address,
        };
      });
      return wallets;
    }

    
    const evmChains = chains.filter((c) => c.isEVM);
    const nonEvmChains = chains.filter((c) => !c.isEVM);

    const primaryChain = evmChains.find((c) => c.id === 'base') || evmChains[0];
    
    if (!primaryChain) {
      throw new Error('No EVM-compatible chains configured');
    }

    let primaryAddress: { addressId: string; address: string };

    try {
      logger.info('Creating primary EVM address (shared across all EVM chains)', {
        userId,
        primaryChain: primaryChain.displayName,
      });

      primaryAddress = await this.createWalletOnChain(
        userId,
        primaryChain,
        `${userName} - Multi-Chain EVM`,
        { apiKey: getBlockradarApiKeyForChain(primaryChain.id) }
      );

      
      for (const chain of evmChains) {
        wallets[chain.id] = primaryAddress;

        await supabase.from('user_wallets').insert({
          user_id: userId,
          chain_id: chain.id,
          chain_name: chain.displayName,
          wallet_address_id: primaryAddress.addressId,
          wallet_address: primaryAddress.address,
          is_primary: chain.id === primaryChain.id,
        });
      }

      logger.info('EVM address created and linked to all EVM chains', {
        userId,
        address: primaryAddress.address,
        evmChainCount: evmChains.length,
      });
    } catch (error) {
      logger.error('Failed to create primary EVM address', { error, userId });
      throw error;
    }

    
    for (const chain of nonEvmChains) {
      try {
        logger.info('Creating separate address for non-EVM chain', {
          userId,
          chain: chain.displayName,
        });

        const wallet = await this.createWalletOnChain(
          userId,
          chain,
          `${userName} - ${chain.displayName}`,
          { apiKey: getBlockradarApiKeyForChain(chain.id) }
        );
        wallets[chain.id] = wallet;

        await supabase.from('user_wallets').insert({
          user_id: userId,
          chain_id: chain.id,
          chain_name: chain.displayName,
          wallet_address_id: wallet.addressId,
          wallet_address: wallet.address,
          is_primary: false,
        });

        logger.info('Non-EVM address created', {
          userId,
          chain: chain.displayName,
          address: wallet.address,
        });
      } catch (error) {
        logger.error('Failed to create non-EVM wallet, skipping', {
          userId,
          chain: chain.displayName,
          error,
        });
      }
    }

    logger.info('Multi-chain wallet setup complete', {
      userId,
      evmAddress: primaryAddress.address,
      evmChains: evmChains.map((c) => c.id),
      nonEvmChains: nonEvmChains.map((c) => c.id),
      totalChains: Object.keys(wallets).length,
    });

    cacheService.del(cacheKeys.userWallets(userId));
    return wallets;
  }

  async getUserWalletForChain(
    userId: string,
    chainId: string
  ): Promise<ChainWallet | null> {
    try {
      const { data: walletRecord, error } = await supabase
        .from('user_wallets')
        .select('*')
        .eq('user_id', userId)
        .eq('chain_id', chainId)
        .single();

      if (error || !walletRecord) {
        return null;
      }

      const chainConfig = getChainConfig(chainId);
      if (!chainConfig) return null;

      let chainLogoUrl = '';
      try {
        const blockchains = await blockradarService.getBlockchains();
        const chain = blockchains.find((b: any) => (b.slug || '').toLowerCase() === chainId.toLowerCase());
        if (chain?.logoUrl) chainLogoUrl = chain.logoUrl;
      } catch (_) {}

      let balance = { native: '0', nativeUSD: '0', tokens: [] as Array<{ address: string; symbol: string; balance: string; balanceUSD: string; logoUrl?: string }> };
      let allAssets: ChainWalletAsset[] = [];
      const nativeSymbol = 'ETH';

      if (chainConfig.walletId && walletRecord.wallet_address_id) {
        try {
          const isEVM = chainConfig.isEVM;
          const baseChain = getChainConfig('base');
          const balanceWalletId = isEVM && baseChain?.walletId ? baseChain.walletId : chainConfig.walletId;
          const balanceAddressId = walletRecord.wallet_address_id;
          const balanceApiKey = getBlockradarApiKeyForChain(isEVM && baseChain ? 'base' : chainId);
          const chainSlug = chainId;
          const [raw, walletAssets] = await Promise.all([
            blockradarService.getAddressBalances(balanceWalletId!, balanceAddressId, {
              apiKey: balanceApiKey || undefined,
              chainSlug,
            }),
            blockradarService.getWalletAssetsFromApi(chainConfig.walletId, { apiKey: balanceApiKey || undefined }).catch(() => []),
          ]);
          balance = {
            native: raw.native,
            nativeUSD: raw.nativeUSD,
            tokens: raw.tokens,
          };
          const balanceByKey = new Map<string, { balance: string; balanceUSD: string; logoUrl?: string }>();
          for (const t of raw.tokens) {
            const addr = (t.address || '').toLowerCase();
            const sym = (t.symbol || '').toLowerCase();
            const entry = { balance: t.balance, balanceUSD: t.balanceUSD, logoUrl: t.logoUrl };
            if (addr) balanceByKey.set(`a:${addr}`, entry);
            if (sym && !balanceByKey.has(`s:${sym}`)) balanceByKey.set(`s:${sym}`, entry);
          }
          allAssets = [
            { symbol: nativeSymbol, name: 'Native', balance: raw.native, balanceUSD: raw.nativeUSD, isNative: true },
            ...walletAssets.map((a: any) => {
              const addr = (a.address || '').toLowerCase();
              const sym = (a.symbol ?? '').toLowerCase();
              const bal = (addr && balanceByKey.get(`a:${addr}`)) ?? (sym && balanceByKey.get(`s:${sym}`)) ?? null;
              return {
                symbol: a.symbol ?? '',
                name: a.name,
                address: a.address ?? null,
                logoUrl: (bal?.logoUrl || a.logoUrl) ?? '',
                balance: bal?.balance ?? '0',
                balanceUSD: bal?.balanceUSD ?? '0',
                isNative: false,
              };
            }),
          ];
        } catch (e) {
          logger.debug('Balance fetch skipped for chain', { chainId, error: e });
        }
      }

      return {
        chainId: walletRecord.chain_id,
        chainName: walletRecord.chain_name,
        addressId: walletRecord.wallet_address_id,
        address: walletRecord.wallet_address,
        logoUrl: chainLogoUrl,
        balance,
        allAssets: allAssets.length > 0 ? allAssets : undefined,
      };
    } catch (error) {
      logger.error('Failed to get user wallet for chain', { error, userId, chainId });
      throw error;
    }
  }

  async getAllUserWallets(userId: string): Promise<ChainWallet[]> {
    const key = cacheKeys.userWallets(userId);
    const cached = cacheService.get<ChainWallet[]>(key);
    if (cached !== undefined) return cached;
    try {
      let { data: walletRecords, error } = await supabase
        .from('user_wallets')
        .select('*')
        .eq('user_id', userId);

      
      if (!error && (!walletRecords || walletRecords.length === 0)) {
        const { data: userRow } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('id', userId)
          .single();
        const userName = userRow
          ? [userRow.first_name, userRow.last_name].filter(Boolean).join(' ') || 'User'
          : 'User';
        try {
          await this.createWalletsOnAllChains(userId, userName);
          const next = await supabase
            .from('user_wallets')
            .select('*')
            .eq('user_id', userId);
          walletRecords = next.data ?? [];
          error = next.error;
        } catch (initErr) {
          logger.warn('Lazy wallet init failed', { userId, error: initErr });
          cacheService.set(key, [], 5_000);
          return [];
        }
      }

      if (error || !walletRecords || walletRecords.length === 0) {
        cacheService.set(key, [], 5_000);
        return [];
      }

      const wallets: ChainWallet[] = [];

      for (const record of walletRecords) {
        try {
          const wallet = await this.getUserWalletForChain(userId, record.chain_id);
          if (wallet) {
            wallets.push(wallet);
          }
        } catch (err) {
          logger.error('Failed to fetch wallet for chain', {
            userId,
            chainId: record.chain_id,
            error: err,
          });
        }
      }

      cacheService.set(key, wallets, 30_000);
      return wallets;
    } catch (error) {
      logger.error('Failed to get all user wallets', { error, userId });
      throw error;
    }
  }


  async getAllUserWalletsFromDb(userId: string): Promise<ChainWallet[]> {
    
    let { data: walletRecords, error } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId);

    if (error || !walletRecords?.length) {
      return [];
    }

    const dbBalances = await balanceService.getBalancesForUser(userId);
    const wallets: ChainWallet[] = walletRecords.map((r) => {
      const chainConfig = getChainConfig(r.chain_id);
      const bal = dbBalances[r.chain_id] ?? { native: '0', nativeUSD: '0', tokens: [] };
      const nativeSym = 'ETH';
      return {
        chainId: r.chain_id,
        chainName: r.chain_name ?? chainConfig?.displayName ?? r.chain_id,
        addressId: r.wallet_address_id,
        address: r.wallet_address,
        logoUrl: '',
        balance: {
          native: bal.native,
          nativeUSD: bal.nativeUSD,
          tokens: bal.tokens.map((t) => ({ ...t, symbol: t.symbol || nativeSym })),
        },
      };
    });

    return wallets;
  }
}

export const multiChainWalletService = new MultiChainWalletService();
