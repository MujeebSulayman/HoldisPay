/**
 * Token logos from Trust Wallet CDN.
 * Path: blockchains/<chain>/assets/<contract_address>/logo.png
 */
const TRUST_CDN = 'https://assets-cdn.trustwallet.com/blockchains';

export const SUPPORTED_TOKENS = [
  { id: 'usdc', symbol: 'USDC', name: 'USD Coin', logo: `${TRUST_CDN}/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png` },
  { id: 'usdt', symbol: 'USDT', name: 'Tether', logo: `${TRUST_CDN}/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png` },
  { id: 'dai', symbol: 'DAI', name: 'Dai', logo: `${TRUST_CDN}/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png` },
] as const;

export function getTokenLogoUrl(symbol: string): string | undefined {
  return SUPPORTED_TOKENS.find((t) => t.symbol === symbol)?.logo;
}
