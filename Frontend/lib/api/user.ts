import { apiClient } from './client';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  accountType: string;
  phoneNumber: string | null;
  phoneVerified: boolean;
  walletAddress: string;
  kycStatus: string;
  emailVerified: boolean;
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

  async getChainWallet(userId: string, chainId: string) {
    const response = await apiClient.get<ChainWallet>(
      `/api/users/${userId}/wallets/${chainId}`
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

  async submitKYC(userId: string, data: SubmitKYCRequest) {
    const response = await apiClient.post<any>(
      `/api/users/${userId}/kyc/submit`,
      data
    );
    return response;
  },
};
