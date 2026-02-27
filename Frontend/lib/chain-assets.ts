/**
 * Chain logos from Trust Wallet CDN.
 * Slugs match Trust Wallet assets repo: https://github.com/trustwallet/assets/tree/master/blockchains
 */
const TRUST_CDN = 'https://assets-cdn.trustwallet.com/blockchains';

export const SUPPORTED_NETWORKS = [
  { id: 'ethereum', name: 'Ethereum', logo: `${TRUST_CDN}/ethereum/info/logo.png` },
  { id: 'base', name: 'Base', logo: `${TRUST_CDN}/base/info/logo.png` },
  { id: 'polygon', name: 'Polygon', logo: `${TRUST_CDN}/polygon/info/logo.png` },
  { id: 'arbitrum', name: 'Arbitrum', logo: `${TRUST_CDN}/arbitrum/info/logo.png` },
  { id: 'optimism', name: 'Optimism', logo: `${TRUST_CDN}/optimism/info/logo.png` },
  { id: 'smartchain', name: 'BNB Chain', logo: `${TRUST_CDN}/smartchain/info/logo.png` },
  { id: 'tron', name: 'Tron', logo: `${TRUST_CDN}/tron/info/logo.png` },
  { id: 'solana', name: 'Solana', logo: `${TRUST_CDN}/solana/info/logo.png` },
] as const;

export function getChainLogoUrl(chainId: string): string | undefined {
  return SUPPORTED_NETWORKS.find((c) => c.id === chainId)?.logo;
}
