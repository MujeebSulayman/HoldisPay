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
  chainId: string;
  assetId: string;
  address: string;
  amount: string;
  note?: string;
  reference?: string;
  metadata?: any;
}

export interface WithdrawResponse {
  id: string;
  hash: string;
  status: string;
  amount: string;
  recipientAddress: string;
  reference?: string;
  note?: string;
  metadata?: any;
  createdAt: string;
}

export interface FeeEstimateRequest {
  chainId: string;
  assetId: string;
  address: string;
  amount: string;
}

export interface FeeEstimateResponse {
  networkFee: string;
  networkFeeInUSD: string;
  transactionFee: string;
  nativeBalance: string;
  nativeBalanceInUSD: string;
  estimatedArrivalTime: number;
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

  async estimateWithdrawalFee(data: FeeEstimateRequest) {
    const response = await apiClient.post<FeeEstimateResponse>(
      '/api/wallet/withdraw/fee-estimate',
      data
    );
    return response;
  },

  async withdraw(data: WithdrawRequest) {
    const response = await apiClient.post<WithdrawResponse>(
      '/api/wallet/withdraw',
      data
    );
    return response;
  },

  /** Quote for Paystack (to local bank): USDC amount → NGN. */
  async getPaystackWithdrawQuote(amountUsdc: string) {
    const response = await apiClient.get<{ amountNgn: number; rate: number; currency: string }>(
      `/api/wallet/withdraw/paystack/quote?amountUsdc=${encodeURIComponent(amountUsdc)}`
    );
    return response;
  },

  /** Withdraw to local bank via Paystack. */
  async withdrawPaystack(data: { amountUsdc: string; paymentMethodId: string }) {
    const response = await apiClient.post<{
      success: boolean;
      transferCode?: string;
      amountNgn?: number;
      requiresOtp?: boolean;
    }>('/api/wallet/withdraw/paystack', data);
    return response;
  },

  /** Finalize Paystack transfer when OTP is required. */
  async finalizePaystackWithdraw(data: { transferCode: string; otp: string }) {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/wallet/withdraw/paystack/finalize',
      data
    );
    return response;
  },
};
