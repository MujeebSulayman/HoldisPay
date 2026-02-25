export interface ChainConfig {
  id: string;
  name: string;
  displayName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrl: string;
  blockExplorer: string;
  isTestnet: boolean;
  isEVM: boolean;
  walletId?: string;
  logoUrl: string;
  
  blockradarSlug?: string | string[];
}

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  base: {
    id: 'base',
    name: 'Base Sepolia',
    displayName: 'Base',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    isTestnet: true,
    isEVM: true,
    walletId: process.env.BLOCKRADAR_WALLET_ID_BASE || process.env.BLOCKRADAR_WALLET_ID,
    logoUrl: 'https://cryptologos.cc/logos/usd-base-coin-usdb-logo.png',
    blockradarSlug: 'base',
  },
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum Sepolia',
    displayName: 'Ethereum',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://rpc.sepolia.org',
    blockExplorer: 'https://sepolia.etherscan.io',
    isTestnet: true,
    isEVM: true,
    walletId: process.env.BLOCKRADAR_WALLET_ID_ETHEREUM,
    logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    blockradarSlug: ['ethereum', 'sepolia'],
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon Amoy',
    displayName: 'Polygon',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    blockExplorer: 'https://amoy.polygonscan.com',
    isTestnet: true,
    isEVM: true,
    walletId: process.env.BLOCKRADAR_WALLET_ID_POLYGON,
    logoUrl: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
    blockradarSlug: 'polygon',
  },
  bnb: {
    id: 'bnb',
    name: 'BNB Smart Chain Testnet',
    displayName: 'BNB Chain',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrl: 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
    blockExplorer: 'https://testnet.bscscan.com',
    isTestnet: true,
    isEVM: true,
    walletId: process.env.BLOCKRADAR_WALLET_ID_BNB,
    logoUrl: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
    blockradarSlug: 'bnb',
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum Sepolia',
    displayName: 'Arbitrum',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    blockExplorer: 'https://sepolia.arbiscan.io',
    isTestnet: true,
    isEVM: true,
    walletId: process.env.BLOCKRADAR_WALLET_ID_ARBITRUM,
    logoUrl: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
    blockradarSlug: 'arbitrum',
  },
  optimism: {
    id: 'optimism',
    name: 'Optimism Sepolia',
    displayName: 'Optimism',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://sepolia.optimism.io',
    blockExplorer: 'https://sepolia-optimism.etherscan.io',
    isTestnet: true,
    isEVM: true,
    walletId: process.env.BLOCKRADAR_WALLET_ID_OPTIMISM,
    logoUrl: 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png',
    blockradarSlug: 'optimism',
  },
  tron: {
    id: 'tron',
    name: 'Tron Nile',
    displayName: 'Tron',
    nativeCurrency: { name: 'TRX', symbol: 'TRX', decimals: 6 },
    rpcUrl: 'https://nile.trongrid.io',
    blockExplorer: 'https://nile.tronscan.org',
    isTestnet: true,
    isEVM: false,
    walletId: process.env.BLOCKRADAR_WALLET_ID_TRON,
    logoUrl: 'https://cryptologos.cc/logos/tron-trx-logo.png',
    blockradarSlug: 'tron',
  },
  solana: {
    id: 'solana',
    name: 'Solana Devnet',
    displayName: 'Solana',
    nativeCurrency: { name: 'SOL', symbol: 'SOL', decimals: 9 },
    rpcUrl: 'https://api.devnet.solana.com',
    blockExplorer: 'https://explorer.solana.com/?cluster=devnet',
    isTestnet: true,
    isEVM: false,
    walletId: process.env.BLOCKRADAR_WALLET_ID_SOLANA,
    logoUrl: 'https://cryptologos.cc/logos/solana-sol-logo.png',
    blockradarSlug: 'solana',
  },
};

export const getChainConfig = (chainId: string): ChainConfig | undefined => {
  return SUPPORTED_CHAINS[chainId];
};


export function getBlockradarApiKeyForChain(chainId: string): string {
  const keys: Record<string, string | undefined> = {
    base: process.env.BLOCKRADAR_WALLET_API_KEY_BASE,
    ethereum: process.env.BLOCKRADAR_WALLET_API_KEY_ETHEREUM,
    polygon: process.env.BLOCKRADAR_WALLET_API_KEY_POLYGON,
    bnb: process.env.BLOCKRADAR_WALLET_API_KEY_BNB,
    arbitrum: process.env.BLOCKRADAR_WALLET_API_KEY_ARBITRUM,
    optimism: process.env.BLOCKRADAR_WALLET_API_KEY_OPTIMISM,
    tron: process.env.BLOCKRADAR_WALLET_API_KEY_TRON,
    solana: process.env.BLOCKRADAR_WALLET_API_KEY_SOLANA,
  };
  return keys[chainId] ?? process.env.BLOCKRADAR_API_KEY ?? '';
}

export const getAvailableChains = (): ChainConfig[] => {
  return Object.values(SUPPORTED_CHAINS).filter(chain => chain.walletId);
};

export const getEVMChains = (): ChainConfig[] => {
  return Object.values(SUPPORTED_CHAINS).filter(chain => chain.isEVM && chain.walletId);
};
