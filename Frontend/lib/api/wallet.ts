import { apiClient } from './client';

export interface TokenBalance {
  token: string;
  symbol: string;
  balance: string;
  balanceInUSD: string;
  decimals: number;
}

export interface WalletBalance {
  nativeBalance: string;
  nativeBalanceInUSD: string;
  tokens: TokenBalance[];
}

export interface Asset {
  id: string;
  name: string;
  symbol: string;
  chainId: number;
  decimals: number;
  address: string;
  logoUrl?: string;
}

export interface WithdrawRequest {
  recipientAddress: string;
  amount: string;
  token?: string;
  reference?: string;
}

export interface WithdrawResponse {
  txId: string;
  txHash: string;
  status: string;
  recipientAddress: string;
  amount: string;
}

export interface ChainAssets {
  chain: {
    id: string;
    name: string;
    symbol: string;
  };
  assets: Asset[];
}

export const walletApi = {
  async getBalance(userId: string) {
    const response = await apiClient.get<WalletBalance>(
      `/api/users/${userId}/wallet`
    );
    return response;
  },

  async getAssets() {
    const response = await apiClient.get<Asset[]>('/api/wallets/assets');
    return response;
  },

  async getChainAssets(chainId: string) {
    const response = await apiClient.get<ChainAssets>(
      `/api/wallets/chains/${chainId}/assets`
    );
    return response;
  },

  async withdraw(userId: string, data: WithdrawRequest) {
    const response = await apiClient.post<WithdrawResponse>(
      `/api/wallets/${userId}/withdraw`,
      data
    );
    return response;
  },
};
