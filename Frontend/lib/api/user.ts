import { apiClient } from './client';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tag?: string;
  accountType: string;
  phoneNumber: string | null;
  phoneVerified: boolean;
  walletAddress: string;
  kycStatus: string;
  emailVerified: boolean;
  isActive?: boolean;
  diditSessionId?: string;
  createdAt: string;
}

export interface TokenBalance {
  token: string;
  symbol: string;
  balance: string;
  balanceInUSD?: string;
  decimals?: number;
}

export interface WalletDetails {
  addressId: string;
  address: string;
  balance: {
    nativeBalance: string;
    nativeBalanceInUSD?: string;
    tokens: TokenBalance[];
  };
  label?: string;
  createdAt: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  address?: object;
}

export interface SubmitKYCRequest {
  documents: Array<{
    type: 'passport' | 'drivers_license' | 'national_id';
    documentNumber: string;
    issueDate?: string;
    expiryDate?: string;
    issuingCountry?: string;
    frontImageUrl: string;
    backImageUrl?: string;
    selfieUrl?: string;
  }>;
  verificationLevel: 'basic' | 'advanced';
  additionalInfo?: object;
}

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
  /** All enabled assets for this chain (from Blockradar), with balance. */
  allAssets?: ChainWalletAsset[];
}

export interface WalletOverviewFlow {
  flowSummary: {
    totalIn: string;
    totalOut: string;
    net: string;
    txCountIn: number;
    txCountOut: number;
  };
  flowByPeriod: Array<{
    period: string;
    periodLabel: string;
    in: string;
    out: string;
    net: string;
  }>;
  flowByDay?: Array<{
    period: string;
    periodLabel: string;
    in: string;
    out: string;
    net: string;
  }>;
  cumulative?: Array<{
    period: string;
    periodLabel: string;
    cumulativeNet: string;
  }>;
  flowByType?: {
    inflow: { deposit: string; receiver_payment: string; payment_link_deposit: string };
    outflow: { withdraw: string; invoice_fund: string; user_withdrawal: string };
  };
  byChain: Array<{
    chainId: string;
    in: string;
    out: string;
    count: number;
  }>;
  recentActivity: Array<{
    id?: string;
    tx_type: string;
    tx_hash: string;
    status: string;
    amount?: string;
    chain_id?: string;
    created_at: string;
    direction: 'in' | 'out' | 'neutral';
    metadata?: Record<string, unknown>;
  }>;
}

export interface WalletOverviewResponse {
  wallets: ChainWallet[];
  flow: WalletOverviewFlow;
}

/** Per-chain wallet balance (withdrawable, from user_chain_balances). */
export interface ChainBalanceWallet {
  native: string;
  nativeUSD: string;
  tokens: Array<{ address: string; symbol: string; balance: string; balanceUSD: string; logoUrl?: string }>;
}

/** Per-chain balance locked in payment contracts (employer). */
export interface ChainBalanceInContracts {
  native: string;
  tokens: Array<{ address: string; balance: string }>;
}

export interface ConsolidatedBalanceResponse {
  wallet: Record<string, ChainBalanceWallet>;
  inContracts: Record<string, ChainBalanceInContracts>;
  /** Withdrawable balance in USD (sum of ledger wallet balances as USDC). */
  withdrawableUsd?: number;
}

export const userApi = {
  async getProfile(userId: string) {
    const response = await apiClient.get<UserProfile>(
      `/api/users/${userId}/profile`
    );
    return response;
  },

  async getWallet(userId: string) {
    const response = await apiClient.get<WalletDetails>(
      `/api/users/${userId}/wallet`
    );
    return response;
  },

  async getAllWallets(userId: string) {
    const response = await apiClient.get<ChainWallet[]>(
      `/api/users/${userId}/wallets/all`
    );
    return response;
  },

  async getWalletOverview(userId: string, params?: { periodsWeeks?: number; recentLimit?: number }) {
    const search = new URLSearchParams();
    if (params?.periodsWeeks != null) search.set('periodsWeeks', String(params.periodsWeeks));
    if (params?.recentLimit != null) search.set('recentLimit', String(params.recentLimit));
    const q = search.toString() ? `?${search.toString()}` : '';
    const response = await apiClient.get<WalletOverviewResponse>(
      `/api/users/${userId}/wallet/overview${q}`
    );
    return response;
  },

  async getChainWallet(userId: string, chainId: string) {
    const response = await apiClient.get<ChainWallet>(
      `/api/users/${userId}/wallets/${chainId}`
    );
    return response;
  },

  async getConsolidatedBalance(userId: string) {
    const response = await apiClient.get<ConsolidatedBalanceResponse>(
      `/api/users/${userId}/balance/consolidated`
    );
    return response;
  },

  async updateProfile(userId: string, data: UpdateProfileRequest) {
    const response = await apiClient.patch<UserProfile>(
      `/api/users/${userId}/profile/update`,
      data
    );
    return response;
  },

  async initiateDiditKyc(userId: string): Promise<any> {
    return apiClient.post(`/api/users/${userId}/kyc/didit-session`);
  },
};
