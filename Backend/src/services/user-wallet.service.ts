import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { SUPPORTED_CHAINS } from '../config/chains';
import { logger } from '../utils/logger';
import { supabase } from '../config/supabase';
import {
  BlockradarResponse,
  BlockradarChildAddress,
  ContractReadRequest,
  ContractWriteRequest,
  ContractWriteResponse,
  TransferRequest,
  TransferResponse,
} from '../types/blockradar';

export interface CreateUserWalletRequest {
  userId: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface UserWalletInfo {
  userId: string;
  addressId: string;
  address: string;
  balance: string;
  label?: string;
  createdAt: Date;
}

export class UserWalletService {
  private client: AxiosInstance;
  private walletId: string;

  constructor() {
    this.walletId = SUPPORTED_CHAINS.base?.walletId || env.BLOCKRADAR_WALLET_ID;
    this.client = axios.create({
      baseURL: env.BLOCKRADAR_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.BLOCKRADAR_API_KEY,
      },
      timeout: 30000,
    });
  }

  async createUserWallet(request: CreateUserWalletRequest): Promise<UserWalletInfo> {
    try {
      logger.info('Creating child address for user', {
        userId: request.userId,
        label: request.label,
      });

      const response = await this.client.post<BlockradarResponse<BlockradarChildAddress>>(
        `/v1/wallets/${this.walletId}/addresses`,
        {
          name: request.label || `User ${request.userId}`,
          label: request.label || `User ${request.userId}`,
          disableAutoSweep: true,
          metadata: {
            userId: request.userId,
            createdAt: new Date().toISOString(),
            ...request.metadata,
          },
        }
      );

      const childAddress = response.data.data;

      try {
        const { blockradarService } = await import('./blockradar.service');
        await blockradarService.updateAddress(
          this.walletId,
          childAddress.id,
          { disableAutoSweep: true },
          { apiKey: env.BLOCKRADAR_API_KEY }
        );
        logger.info('Address updated: disableAutoSweep set', { addressId: childAddress.id });
      } catch (e) {
        logger.warn('Address update (disableAutoSweep) failed', { addressId: childAddress.id, error: e });
      }

      try {
        const { blockradarService } = await import('./blockradar.service');
        await blockradarService.disableAutoSettlementForAddress(this.walletId, childAddress.id, {
          apiKey: env.BLOCKRADAR_API_KEY,
        });
      } catch (e) {
        logger.warn('disableAutoSettlementForAddress failed', { addressId: childAddress.id, error: e });
      }

      logger.info('Child address created successfully', {
        userId: request.userId,
        addressId: childAddress.id,
        address: childAddress.address,
      });

            const userWallet: UserWalletInfo = {
        userId: request.userId,
        addressId: childAddress.id,
        address: childAddress.address,
        balance: childAddress.balance,
        label: childAddress.label,
        createdAt: new Date(childAddress.createdAt),
      };

      return userWallet;
    } catch (error) {
      logger.error('Failed to create user wallet', { error, request });
      throw error;
    }
  }

  async getUserWallet(userId: string): Promise<BlockradarChildAddress | null> {
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('wallet_address_id')
        .eq('id', userId)
        .maybeSingle();
      if (userRow?.wallet_address_id) {
        const response = await this.client.get<BlockradarResponse<BlockradarChildAddress>>(
          `/v1/wallets/${this.walletId}/addresses/${userRow.wallet_address_id}`
        );
        const addr = response.data?.data ?? response.data;
        return addr || null;
      }
      const response = await this.client.get<BlockradarResponse<BlockradarChildAddress[]>>(
        `/v1/wallets/${this.walletId}/addresses`
      );
      const addresses = response.data?.data ?? response.data ?? [];
      const list = Array.isArray(addresses) ? addresses : [];
      const userAddress = list.find((addr: any) => addr.metadata?.userId === userId);
      return userAddress || null;
    } catch (error) {
      logger.error('Failed to get user wallet', { error, userId });
      throw error;
    }
  }

  async getChildAddressBalance(addressId: string): Promise<{
    nativeBalance: string;
    tokens: Array<{ token: string; balance: string; symbol: string }>;
  }> {
    try {
      const response = await this.client.get<BlockradarResponse<any>>(
        `/v1/wallets/${this.walletId}/addresses/${addressId}/balance`
      );

      return response.data.data;
    } catch (error) {
      logger.error('Failed to get child address balance', { error, addressId });
      throw error;
    }
  }

  async transferFromUserWallet(
    addressId: string,
    request: TransferRequest
  ): Promise<TransferResponse> {
    try {
      logger.info('Transfer from child address', {
        addressId,
        to: request.to,
        amount: request.amount,
      });

      const response = await this.client.post<BlockradarResponse<TransferResponse>>(
        `/v1/wallets/${this.walletId}/addresses/${addressId}/transfer`,
        request
      );

      logger.info('Transfer initiated from child address', {
        addressId,
        txHash: response.data.data.hash,
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to transfer from child address', { error, addressId, request });
      throw error;
    }
  }

  async transferToChild(
    userId: string,
    params: { amount: string; tokenAddress?: string; reference?: string }
  ): Promise<TransferResponse> {
    const wallet = await this.getUserWallet(userId);
    if (!wallet) throw new Error('User wallet not found');
    const { blockradarService } = await import('./blockradar.service');
    return blockradarService.transfer({
      to: wallet.address,
      amount: params.amount,
      token: params.tokenAddress,
      reference: params.reference || `to-child-${userId}-${Date.now()}`,
    });
  }

  async readContractFromChildAddress<T = unknown>(
    addressId: string,
    request: ContractReadRequest
  ): Promise<T> {
    try {
      const response = await this.client.post<BlockradarResponse<T>>(
        `/v1/wallets/${this.walletId}/addresses/${addressId}/contracts/read`,
        request
      );
      return response.data.data;
    } catch (error) {
      logger.error('Failed to read contract from child address', { error, addressId });
      throw error;
    }
  }

  async writeContractFromChildAddress(
    addressId: string,
    request: ContractWriteRequest
  ): Promise<ContractWriteResponse> {
    try {
      logger.info('Writing contract from child address', {
        addressId,
        method: request.method,
        contract: request.address,
      });

      const response = await this.client.post<BlockradarResponse<ContractWriteResponse>>(
        `/v1/wallets/${this.walletId}/addresses/${addressId}/contracts/write`,
        request
      );

      logger.info('Contract write initiated from child address', {
        addressId,
        txHash: response.data.data.hash,
        status: response.data.data.status,
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to write contract from child address', { error, addressId });
      throw error;
    }
  }

  async estimateNetworkFeeForChildAddress(
    addressId: string,
    request: ContractReadRequest
  ): Promise<any> {
    try {
      const response = await this.client.post<BlockradarResponse<any>>(
        `/v1/wallets/${this.walletId}/addresses/${addressId}/contracts/network-fee`,
        request
      );
      return response.data.data;
    } catch (error) {
      logger.error('Failed to estimate network fee for child address', { error, addressId });
      throw error;
    }
  }

  async listAllChildAddresses(): Promise<BlockradarChildAddress[]> {
    try {
      const response = await this.client.get<BlockradarResponse<BlockradarChildAddress[]>>(
        `/v1/wallets/${this.walletId}/addresses`
      );

      logger.info('Listed child addresses', {
        count: response.data.data.length,
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to list child addresses', { error });
      throw error;
    }
  }

  async getChildAddress(addressId: string): Promise<BlockradarChildAddress> {
    try {
      const response = await this.client.get<BlockradarResponse<BlockradarChildAddress>>(
        `/v1/wallets/${this.walletId}/addresses/${addressId}`
      );

      return response.data.data;
    } catch (error) {
      logger.error('Failed to get child address', { error, addressId });
      throw error;
    }
  }

  async fundUserWallet(
    addressId: string,
    amount: string,
    token?: string
  ): Promise<TransferResponse> {
    try {
      logger.info('Funding user wallet from master', {
        addressId,
        amount,
        token,
      });

            const childAddress = await this.getChildAddress(addressId);

            const response = await this.client.post<BlockradarResponse<TransferResponse>>(
        `/v1/wallets/${this.walletId}/transfer`,
        {
          to: childAddress.address,
          amount,
          token,
          reference: `onboarding-${addressId}`,
          metadata: {
            type: 'user_onboarding',
            addressId,
          },
        }
      );

      logger.info('User wallet funded successfully', {
        addressId,
        txHash: response.data.data.hash,
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to fund user wallet', { error, addressId });
      throw error;
    }
  }

  async userHasWallet(userId: string): Promise<boolean> {
    try {
      const wallet = await this.getUserWallet(userId);
      return wallet !== null;
    } catch (error) {
      logger.error('Failed to check if user has wallet', { error, userId });
      return false;
    }
  }

  async getOrCreateUserWallet(request: CreateUserWalletRequest): Promise<UserWalletInfo> {
    try {
            const existing = await this.getUserWallet(request.userId);
      
      if (existing) {
        logger.info('User already has wallet', {
          userId: request.userId,
          address: existing.address,
        });

        return {
          userId: request.userId,
          addressId: existing.id,
          address: existing.address,
          balance: existing.balance,
          label: existing.label,
          createdAt: new Date(existing.createdAt),
        };
      }

            return await this.createUserWallet(request);
    } catch (error) {
      logger.error('Failed to get or create user wallet', { error, request });
      throw error;
    }
  }

  async getSwapQuoteForUser(userId: string, request: any): Promise<any> {
    try {
      const wallet = await this.getUserWallet(userId);
      if (!wallet) {
        throw new Error('User wallet not found');
      }

      logger.info('Getting swap quote for user', { userId, request });

      const response = await this.client.post<any>(
        `/v1/wallets/${this.walletId}/addresses/${wallet.id}/swaps/quote`,
        request
      );

      return response.data.data;
    } catch (error) {
      logger.error('Failed to get swap quote for user', { error, userId });
      throw error;
    }
  }

  async executeSwapForUser(userId: string, request: any): Promise<any> {
    try {
      const wallet = await this.getUserWallet(userId);
      if (!wallet) {
        throw new Error('User wallet not found');
      }

      logger.info('Executing swap for user', { userId, request });

      const response = await this.client.post<any>(
        `/v1/wallets/${this.walletId}/addresses/${wallet.id}/swaps/execute`,
        request
      );

      logger.info('Swap executed for user', {
        userId,
        swapId: response.data.data.id,
        status: response.data.data.status,
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to execute swap for user', { error, userId });
      throw error;
    }
  }

  async withdrawFromUser(userId: string, request: any): Promise<any> {
    try {
      const wallet = await this.getUserWallet(userId);
      if (!wallet) {
        throw new Error('User wallet not found');
      }

      logger.info('Withdrawing from user wallet', {
        userId,
        recipientAddress: request.recipientAddress,
        amount: request.amount,
      });

      const response = await this.client.post<any>(
        `/v1/wallets/${this.walletId}/addresses/${wallet.id}/transfers`,
        {
          recipientAddress: request.recipientAddress,
          amount: request.amount,
          token: request.token,
          reference: request.reference,
          metadata: request.metadata,
        }
      );

      logger.info('Withdrawal initiated', {
        userId,
        transferId: response.data.data.id,
        hash: response.data.data.hash,
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to withdraw from user wallet', { error, userId });
      throw error;
    }
  }
}

export const userWalletService = new UserWalletService();
