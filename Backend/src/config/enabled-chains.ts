export interface EnabledChain {
  slug: string;
  walletId: string;
  displayName: string;
}

/** Minimal chain config derived from env (no hardcoded chain list). */
export interface ChainConfig {
  id: string;
  displayName: string;
  walletId: string;
  isEVM: boolean;
}

const CHAIN_MAPPINGS: Array<{ envKey: string; slug: string; displayName: string; isEVM?: boolean }> = [
  { envKey: 'BLOCKRADAR_WALLET_ID_BASE', slug: 'base', displayName: 'Base', isEVM: true },
  { envKey: 'BLOCKRADAR_WALLET_ID_ETHEREUM', slug: 'ethereum', displayName: 'Ethereum', isEVM: true },
  { envKey: 'BLOCKRADAR_WALLET_ID_POLYGON', slug: 'polygon', displayName: 'Polygon', isEVM: true },
  { envKey: 'BLOCKRADAR_WALLET_ID_BNB', slug: 'bnb-smart-chain', displayName: 'BNB Smart Chain', isEVM: true },
  { envKey: 'BLOCKRADAR_WALLET_ID_ARBITRUM', slug: 'arbitrum', displayName: 'Arbitrum', isEVM: true },
  { envKey: 'BLOCKRADAR_WALLET_ID_OPTIMISM', slug: 'optimism', displayName: 'Optimism', isEVM: true },
  { envKey: 'BLOCKRADAR_WALLET_ID_TRON', slug: 'tron', displayName: 'Tron', isEVM: false },
  { envKey: 'BLOCKRADAR_WALLET_ID_SOLANA', slug: 'solana', displayName: 'Solana', isEVM: false },
];

export function getEnabledChains(): EnabledChain[] {
  const chains: EnabledChain[] = [];
  for (const m of CHAIN_MAPPINGS) {
    const walletId = process.env[m.envKey];
    if (walletId && walletId.trim() !== '') {
      chains.push({ slug: m.slug, walletId, displayName: m.displayName });
    }
  }
  return chains;
}

export function getChainConfig(chainSlug: string): ChainConfig | undefined {
  const m = CHAIN_MAPPINGS.find((x) => x.slug === chainSlug);
  if (!m) return undefined;
  const walletId = process.env[m.envKey];
  if (!walletId || walletId.trim() === '') return undefined;
  return {
    id: m.slug,
    displayName: m.displayName,
    walletId,
    isEVM: m.isEVM !== false,
  };
}

export function getAvailableChains(): ChainConfig[] {
  return CHAIN_MAPPINGS.filter((m) => {
    const w = process.env[m.envKey];
    return w && w.trim() !== '';
  }).map((m) => ({
    id: m.slug,
    displayName: m.displayName,
    walletId: process.env[m.envKey]!,
    isEVM: m.isEVM !== false,
  }));
}

export function getEVMChains(): ChainConfig[] {
  return getAvailableChains().filter((c) => c.isEVM);
}


export function isChainEnabled(chainSlug: string): boolean {
  const enabledChains = getEnabledChains();
  return enabledChains.some(chain => chain.slug === chainSlug);
}


export function getWalletIdForChain(chainSlug: string): string | null {
  const enabledChains = getEnabledChains();
  const chain = enabledChains.find(c => c.slug === chainSlug);
  return chain ? chain.walletId : null;
}


export function getEnabledChainSlugs(): string[] {
  return getEnabledChains().map(chain => chain.slug);
}


const WALLET_API_KEY_KEYS: Record<string, string> = {
  base: 'BLOCKRADAR_WALLET_API_KEY_BASE',
  ethereum: 'BLOCKRADAR_WALLET_API_KEY_ETHEREUM',
  polygon: 'BLOCKRADAR_WALLET_API_KEY_POLYGON',
  'bnb-smart-chain': 'BLOCKRADAR_WALLET_API_KEY_BNB',
  arbitrum: 'BLOCKRADAR_WALLET_API_KEY_ARBITRUM',
  optimism: 'BLOCKRADAR_WALLET_API_KEY_OPTIMISM',
  tron: 'BLOCKRADAR_WALLET_API_KEY_TRON',
  solana: 'BLOCKRADAR_WALLET_API_KEY_SOLANA',
};


export function getWalletApiKeyForChain(chainSlug: string): string | undefined {
  const envKey = WALLET_API_KEY_KEYS[chainSlug.toLowerCase()];
  const key = envKey ? process.env[envKey] : undefined;
  if (key && key.trim() !== '') return key.trim();
  return process.env.BLOCKRADAR_API_KEY;
}
