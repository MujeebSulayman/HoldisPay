'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface Chain {
  id: string;
  name: string;
  symbol: string;
  logoUrl: string;
  isEVM: boolean;
  isTestnet: boolean;
  blockExplorer: string;
}

const SUPPORTED_CHAINS: Chain[] = [
  {
    id: 'base',
    name: 'Base Sepolia',
    symbol: 'ETH',
    logoUrl: 'https://cryptologos.cc/logos/usd-base-coin-usdb-logo.png',
    isEVM: true,
    isTestnet: true,
    blockExplorer: 'https://sepolia.basescan.org',
  },
  {
    id: 'ethereum',
    name: 'Ethereum Sepolia',
    symbol: 'ETH',
    logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    isEVM: true,
    isTestnet: true,
    blockExplorer: 'https://sepolia.etherscan.io',
  },
  {
    id: 'polygon',
    name: 'Polygon Amoy',
    symbol: 'MATIC',
    logoUrl: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
    isEVM: true,
    isTestnet: true,
    blockExplorer: 'https://amoy.polygonscan.com',
  },
  {
    id: 'bnb',
    name: 'BNB Testnet',
    symbol: 'BNB',
    logoUrl: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
    isEVM: true,
    isTestnet: true,
    blockExplorer: 'https://testnet.bscscan.com',
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum Sepolia',
    symbol: 'ETH',
    logoUrl: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
    isEVM: true,
    isTestnet: true,
    blockExplorer: 'https://sepolia.arbiscan.io',
  },
  {
    id: 'optimism',
    name: 'Optimism Sepolia',
    symbol: 'ETH',
    logoUrl: 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png',
    isEVM: true,
    isTestnet: true,
    blockExplorer: 'https://sepolia-optimism.etherscan.io',
  },
  {
    id: 'tron',
    name: 'Tron Nile',
    symbol: 'TRX',
    logoUrl: 'https://cryptologos.cc/logos/tron-trx-logo.png',
    isEVM: false,
    isTestnet: true,
    blockExplorer: 'https://nile.tronscan.org',
  },
  {
    id: 'solana',
    name: 'Solana Devnet',
    symbol: 'SOL',
    logoUrl: 'https://cryptologos.cc/logos/solana-sol-logo.png',
    isEVM: false,
    isTestnet: true,
    blockExplorer: 'https://explorer.solana.com/?cluster=devnet',
  },
];

interface NetworkSwitcherProps {
  selectedChain: Chain;
  onChainChange: (chain: Chain) => void;
}

export default function NetworkSwitcher({
  selectedChain,
  onChainChange,
}: NetworkSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2.5 glass border border-white/10 rounded-lg hover:border-brand-400/50 transition-all"
      >
        <img src={selectedChain.logoUrl} alt={selectedChain.name} className="w-8 h-8 rounded-full" />
        <div className="flex flex-col items-start">
          <span className="text-white text-sm font-medium">{selectedChain.name}</span>
          <span className="text-gray-500 text-xs">{selectedChain.symbol}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 glass-strong border border-white/10 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          <div className="p-2">
            <div className="text-xs text-gray-500 font-medium px-3 py-2">
              SELECT NETWORK
            </div>
            {SUPPORTED_CHAINS.map((chain) => (
              <button
                key={chain.id}
                onClick={() => {
                  onChainChange(chain);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  selectedChain.id === chain.id
                    ? 'bg-brand-400/10 border border-brand-400/30'
                    : 'hover:bg-white/[.06]'
                }`}
              >
                <img src={chain.logoUrl} alt={chain.name} className="w-8 h-8 rounded-full" />
                <div className="flex-1 flex flex-col items-start">
                  <span className="text-white text-sm font-medium">
                    {chain.name}
                  </span>
                  <span className="text-gray-500 text-xs">{chain.symbol}</span>
                </div>
                {selectedChain.id === chain.id && (
                  <Check className="w-4 h-4 text-brand-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { SUPPORTED_CHAINS };
