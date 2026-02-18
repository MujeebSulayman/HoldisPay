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
  walletId?: string; // Blockradar master wallet ID (UUID from dashboard) - for internal API use only
  icon: string;
}

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  base: {
    id: 'base',
    name: 'Base Sepolia',
    displayName: 'Base',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrl: 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    isTestnet: true,
    isEVM: true,
    walletId: process.env.BLOCKRADAR_WALLET_ID_BASE || process.env.BLOCKRADAR_WALLET_ID,
    icon: '⚡',
  },
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum Sepolia',
    displayName: 'Ethereum',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrl: 'https://rpc.sepolia.org',
    blockExplorer: 'https://sepolia.etherscan.io',
    isTestnet: true,
    isEVM: true,
    walletId: process.env.BLOCKRADAR_WALLET_ID_ETHEREUM,
    icon: '⟠',
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon Amoy',
    displayName: 'Polygon',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    blockExplorer: 'https://amoy.polygonscan.com',
    isTestnet: true,
    isEVM: true,
    walletId: process.env.BLOCKRADAR_WALLET_ID_POLYGON,
    icon: '🔷',
  },
  bnb: {
    id: 'bnb',
    name: 'BNB Smart Chain Testnet',
    displayName: 'BNB Chain',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
    rpcUrl: 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
    blockExplorer: 'https://testnet.bscscan.com',
    isTestnet: true,
    isEVM: true,
    walletId: process.env.BLOCKRADAR_WALLET_ID_BNB,
    icon: '🟡',
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum Sepolia',
    displayName: 'Arbitrum',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    blockExplorer: 'https://sepolia.arbiscan.io',
    isTestnet: true,
    isEVM: true,
    walletId: process.env.BLOCKRADAR_WALLET_ID_ARBITRUM,
    icon: '🔵',
  },
  optimism: {
    id: 'optimism',
    name: 'Optimism Sepolia',
    displayName: 'Optimism',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrl: 'https://sepolia.optimism.io',
    blockExplorer: 'https://sepolia-optimism.etherscan.io',
    isTestnet: true,
    isEVM: true,
    walletId: process.env.BLOCKRADAR_WALLET_ID_OPTIMISM,
    icon: '🔴',
  },
  tron: {
    id: 'tron',
    name: 'Tron Nile',
    displayName: 'Tron',
    nativeCurrency: {
      name: 'TRX',
      symbol: 'TRX',
      decimals: 6,
    },
    rpcUrl: 'https://nile.trongrid.io',
    blockExplorer: 'https://nile.tronscan.org',
    isTestnet: true,
    isEVM: false,
    walletId: process.env.BLOCKRADAR_WALLET_ID_TRON,
    icon: '🔺',
  },
  solana: {
    id: 'solana',
    name: 'Solana Devnet',
    displayName: 'Solana',
    nativeCurrency: {
      name: 'SOL',
      symbol: 'SOL',
      decimals: 9,
    },
    rpcUrl: 'https://api.devnet.solana.com',
    blockExplorer: 'https://explorer.solana.com/?cluster=devnet',
    isTestnet: true,
    isEVM: false,
    walletId: process.env.BLOCKRADAR_WALLET_ID_SOLANA,
    icon: '🟣',
  },
};

export const getChainConfig = (chainId: string): ChainConfig | undefined => {
  return SUPPORTED_CHAINS[chainId];
};

export const getAvailableChains = (): ChainConfig[] => {
  return Object.values(SUPPORTED_CHAINS).filter(chain => chain.walletId);
};

export const getEVMChains = (): ChainConfig[] => {
  return Object.values(SUPPORTED_CHAINS).filter(chain => chain.isEVM && chain.walletId);
};
