import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { SUPPORTED_CHAINS, ChainConfig } from '../config/chains';
import { BlockradarResponse, BlockradarChildAddress } from '../types/blockradar';
import { supabase } from '../config/supabase';

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
    label?: string
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

      const response = await this.client.post<BlockradarResponse<BlockradarChildAddress>>(
        `/v1/wallets/${chainConfig.walletId}/addresses`,
        {
          label: label || `User ${userId} - ${chainConfig.displayName}`,
          metadata: {
            userId,
            chainId: chainConfig.id,
            createdAt: new Date().toISOString(),
          },
        }
      );

      const childAddress = response.data.data;

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
    const chains = Object.values(SUPPORTED_CHAINS).filter((chain) => chain.walletId);

    logger.info('Creating multi-chain wallet setup', {
      userId,
      chainCount: chains.length,
    });

    // Check if user already has wallets
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

    // Separate EVM and non-EVM chains
    const evmChains = chains.filter((chain) => chain.isEVM);
    const nonEvmChains = chains.filter((chain) => !chain.isEVM);

    // Step 1: Create ONE primary address from Base (or first EVM chain)
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
        `${userName} - Multi-Chain EVM`
      );

      // Step 2: Store SAME address for ALL EVM-compatible chains
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

    // Step 3: Create separate addresses for non-EVM chains (Tron, Solana)
    for (const chain of nonEvmChains) {
      try {
        logger.info('Creating separate address for non-EVM chain', {
          userId,
          chain: chain.displayName,
        });

        const wallet = await this.createWalletOnChain(
          userId,
          chain,
          `${userName} - ${chain.displayName}`
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

      const chainConfig = SUPPORTED_CHAINS[chainId];
      if (!chainConfig || !chainConfig.walletId) {
        return null;
      }

      // Get address details from Blockradar (without balance - Blockradar doesn't provide balance API)
      // Balance is tracked via webhooks and stored in database
      // Return wallet from database without fetching from Blockradar
      // Balance should be tracked via webhooks and stored in database
      return {
        chainId: walletRecord.chain_id,
        chainName: walletRecord.chain_name,
        addressId: walletRecord.wallet_address_id,
        address: walletRecord.wallet_address,
        logoUrl: chainConfig.logoUrl,
        balance: {
          native: '0',
          nativeUSD: '0',
          tokens: [],
        },
      };
    } catch (error) {
      logger.error('Failed to get user wallet for chain', { error, userId, chainId });
      throw error;
    }
  }

  async getAllUserWallets(userId: string): Promise<ChainWallet[]> {
    try {
      const { data: walletRecords, error } = await supabase
        .from('user_wallets')
        .select('*')
        .eq('user_id', userId);

      if (error || !walletRecords) {
        return [];
      }

      const wallets: ChainWallet[] = [];

      for (const record of walletRecords) {
        try {
          const wallet = await this.getUserWalletForChain(userId, record.chain_id);
          if (wallet) {
            wallets.push(wallet);
          }
        } catch (error) {
          logger.error('Failed to fetch wallet for chain', {
            userId,
            chainId: record.chain_id,
            error,
          });
        }
      }

      return wallets;
    } catch (error) {
      logger.error('Failed to get all user wallets', { error, userId });
      throw error;
    }
  }
}

export const multiChainWalletService = new MultiChainWalletService();
