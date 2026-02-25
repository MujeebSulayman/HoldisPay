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
  slug?: string;
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

export interface EnabledChain {
  slug: string;
  displayName: string;
}

export const blockchainApi = {
  /** Chains configured in Backend .env only (no Blockradar). Use this for the network dropdown. */
  async getEnabledChains(): Promise<EnabledChain[]> {
    const response = await apiClient.get<EnabledChain[]>('/api/enabled-chains');
    const raw = response.data;
    return Array.isArray(raw) ? raw : [];
  },

  async getSupportedBlockchains(): Promise<Blockchain[]> {
    const response = await apiClient.get<Blockchain[]>('/api/blockchains');
    const raw = response.data;
    return Array.isArray(raw) ? raw : [];
  },

  async getSupportedAssets(chainSlug?: string): Promise<Asset[]> {
    const url = chainSlug
      ? `/api/assets?chainSlug=${encodeURIComponent(chainSlug)}`
      : '/api/assets';
    const response = await apiClient.get<Asset[]>(url);
    const raw = response.data;
    return Array.isArray(raw) ? raw : [];
  },

  async getAssetsByChain(chainSlug: string): Promise<Asset[]> {
    const response = await apiClient.get<Asset[]>(`/api/chains/${encodeURIComponent(chainSlug)}/assets`);
    const raw = response.data;
    return Array.isArray(raw) ? raw : [];
  },
};
