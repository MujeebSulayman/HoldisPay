import { env } from './env';


export interface EnabledChain {
  slug: string;
  walletId: string;
  displayName: string;
}


export function getEnabledChains(): EnabledChain[] {
  const chains: EnabledChain[] = [];

  
  const chainMappings = [
    { envKey: 'BLOCKRADAR_WALLET_ID_BASE', slug: 'base', displayName: 'Base' },
    { envKey: 'BLOCKRADAR_WALLET_ID_ETHEREUM', slug: 'ethereum', displayName: 'Ethereum' },
    { envKey: 'BLOCKRADAR_WALLET_ID_POLYGON', slug: 'polygon', displayName: 'Polygon' },
    { envKey: 'BLOCKRADAR_WALLET_ID_BNB', slug: 'bnb-smart-chain', displayName: 'BNB Smart Chain' },
    { envKey: 'BLOCKRADAR_WALLET_ID_ARBITRUM', slug: 'arbitrum', displayName: 'Arbitrum' },
    { envKey: 'BLOCKRADAR_WALLET_ID_OPTIMISM', slug: 'optimism', displayName: 'Optimism' },
    { envKey: 'BLOCKRADAR_WALLET_ID_TRON', slug: 'tron', displayName: 'Tron' },
    { envKey: 'BLOCKRADAR_WALLET_ID_SOLANA', slug: 'solana', displayName: 'Solana' },
  ];

  for (const mapping of chainMappings) {
    const walletId = process.env[mapping.envKey];
    if (walletId && walletId.trim() !== '') {
      chains.push({
        slug: mapping.slug,
        walletId: walletId,
        displayName: mapping.displayName,
      });
    }
  }

  return chains;
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
