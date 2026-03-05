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
  logoUrl?: string;
}

export interface PublicChain {
  slug: string;
  displayName: string;
  logoUrl?: string;
}

export interface PublicAsset {
  symbol: string;
  name?: string;
  logoUrl?: string;
}

export const blockchainApi = {
  /** Public: enabled chains with logoUrl (no auth). For landing/marketing. */
  async getPublicEnabledChains(): Promise<PublicChain[]> {
    const res = await apiClient.get<PublicChain[]>('/api/public/enabled-chains');
    const raw = res.data;
    return Array.isArray(raw) ? raw : [];
  },

  /** Public: supported assets (no auth). For landing. */
  async getPublicSupportedAssets(): Promise<PublicAsset[]> {
    const res = await apiClient.get<PublicAsset[]>('/api/public/assets');
    const raw = res.data;
    return Array.isArray(raw) ? raw : [];
  },

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
