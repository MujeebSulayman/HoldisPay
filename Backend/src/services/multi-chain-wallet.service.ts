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
  balance: {
    native: string;
    nativeUSD: string;
    tokens: Array<{
      address: string;
      symbol: string;
      balance: string;
      balanceUSD: string;
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

    logger.info('Creating wallets on all configured chains', {
      userId,
      chainCount: chains.length,
    });

    for (const chain of chains) {
      try {
        // Check if wallet already exists for this chain
        const { data: existingWallet } = await supabase
          .from('user_wallets')
          .select('wallet_address_id, wallet_address')
          .eq('user_id', userId)
          .eq('chain_id', chain.id)
          .single();

        if (existingWallet) {
          logger.info('Wallet already exists for chain, skipping', {
            userId,
            chain: chain.displayName,
          });
          wallets[chain.id] = {
            addressId: existingWallet.wallet_address_id,
            address: existingWallet.wallet_address,
          };
          continue;
        }

        const wallet = await this.createWalletOnChain(
          userId,
          chain,
          `${userName} - ${chain.displayName}`
        );
        wallets[chain.id] = wallet;

        // Store in database
        await supabase.from('user_wallets').insert({
          user_id: userId,
          chain_id: chain.id,
          chain_name: chain.displayName,
          wallet_address_id: wallet.addressId,
          wallet_address: wallet.address,
          is_primary: chain.id === 'base',
        });
      } catch (error) {
        logger.error('Failed to create wallet on chain, skipping', {
          userId,
          chain: chain.displayName,
          error,
        });
      }
    }

    logger.info('Multi-chain wallets created', {
      userId,
      successCount: Object.keys(wallets).length,
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
