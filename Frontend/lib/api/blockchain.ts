import { apiClient } from './client';

export interface Blockchain {
  id: string;
  name: string;
  slug: string;
  symbol: string;
  logoUrl: string;
  isActive: boolean;
  isEvmCompatible: boolean;
  isL2: boolean;
  tokenStandard: string | null;
  derivationPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  name: string;
  symbol: string;
  slug: string;
  logoUrl: string;
  isActive: boolean;
  decimals: number;
  contractAddress?: string;
  blockchain: {
    id: string;
    name: string;
    slug: string;
    symbol: string;
  };
  createdAt: string;
  updatedAt: string;
}

export const blockchainApi = {
  async getSupportedBlockchains(): Promise<Blockchain[]> {
    const response = await apiClient.get<{ success: boolean; data: Blockchain[] }>(
      '/api/blockchains'
    );
    return response.data?.data || [];
  },

  async getSupportedAssets(chainSlug?: string): Promise<Asset[]> {
    const url = chainSlug 
      ? `/api/assets?chainSlug=${chainSlug}`
      : '/api/assets';
    
    const response = await apiClient.get<{ success: boolean; data: Asset[] }>(url);
    return response.data?.data || [];
  },

  async getAssetsByChain(chainSlug: string): Promise<Asset[]> {
    const response = await apiClient.get<{ success: boolean; data: Asset[] }>(
      `/api/chains/${chainSlug}/assets`
    );
    return response.data?.data || [];
  },
};
