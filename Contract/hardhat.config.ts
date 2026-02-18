import 'dotenv/config';
import { defineConfig } from 'hardhat/config';
import hardhatVerify from '@nomicfoundation/hardhat-verify';
import hardhatToolboxViem from '@nomicfoundation/hardhat-toolbox-viem';

const sepoliaRpcUrl = process.env.BASE_SEPOLIA_RPC_URL;
const sepoliaPrivateKey = process.env.BASE_SEPOLIA_PRIVATE_KEY;
const baseRpcUrl = process.env.BASE_RPC_URL;
const basePrivateKey = process.env.BASE_PRIVATE_KEY;

if (!sepoliaRpcUrl || !sepoliaPrivateKey) {
  console.warn('Warning: BASE_SEPOLIA_RPC_URL or BASE_SEPOLIA_PRIVATE_KEY not set in .env');
}

export default defineConfig({
  plugins: [hardhatVerify, hardhatToolboxViem],
  solidity: {
    profiles: {
      default: {
        version: '0.8.30',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
          viaIR: true,
        },
      },
      production: {
        version: '0.8.30',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
    },
  },
  networks: {
    hardhat: {
      type: 'edr-simulated',
    },
    sepoliaBase: {
      type: 'http',
      url: sepoliaRpcUrl || '',
      accounts: sepoliaPrivateKey ? [sepoliaPrivateKey] : [],
      chainId: 84532,
    },
    base: {
      type: 'http',
      url: baseRpcUrl || '',
      accounts: basePrivateKey ? [basePrivateKey] : [],
      chainId: 8453,
    },
  },
  verify: {
    etherscan: {
      apiKey: process.env.BASESCAN_API_KEY || '',
    },
    blockscout: {
      enabled: false,
    },
    sourcify: {
      enabled: false,
    },
  },
  chainDescriptors: {
    84532: {
      name: 'Base Sepolia',
      blockExplorers: {
        etherscan: {
          name: 'BaseScan',
          url: 'https://sepolia.basescan.org',
          apiUrl: 'https://api.etherscan.io/v2/api',
        },
      },
    },
    8453: {
      name: 'Base',
      blockExplorers: {
        etherscan: {
          name: 'BaseScan',
          url: 'https://basescan.org',
          apiUrl: 'https://api.etherscan.io/v2/api',
        },
      },
    },
  },
  paths: {
    sources: './contracts',
    tests: './unit-test',
    cache: './cache',
    artifacts: './artifacts',
  },
});
