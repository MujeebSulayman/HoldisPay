'use client';

import { useState, useRef, useEffect } from 'react';

export interface Chain {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  isEVM: boolean;
  isTestnet: boolean;
  blockExplorer: string;
}

const SUPPORTED_CHAINS: Chain[] = [
  {
    id: 'base',
    name: 'Base Sepolia',
    symbol: 'ETH',
    icon: '⚡',
    isEVM: true,
    isTestnet: true,
    blockExplorer: 'https://sepolia.basescan.org',
  },
  {
    id: 'ethereum',
    name: 'Ethereum Sepolia',
    symbol: 'ETH',
    icon: '◆',
    isEVM: true,
    isTestnet: true,
    blockExplorer: 'https://sepolia.etherscan.io',
  },
  {
    id: 'polygon',
    name: 'Polygon Amoy',
    symbol: 'MATIC',
    icon: '⬡',
    isEVM: true,
    isTestnet: true,
    blockExplorer: 'https://amoy.polygonscan.com',
  },
  {
    id: 'bnb',
    name: 'BNB Testnet',
    symbol: 'BNB',
    icon: '◉',
    isEVM: true,
    isTestnet: true,
    blockExplorer: 'https://testnet.bscscan.com',
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum Sepolia',
    symbol: 'ETH',
    icon: '▲',
    isEVM: true,
    isTestnet: true,
    blockExplorer: 'https://sepolia.arbiscan.io',
  },
  {
    id: 'optimism',
    name: 'Optimism Sepolia',
    symbol: 'ETH',
    icon: '🔴',
    isEVM: true,
    isTestnet: true,
    blockExplorer: 'https://sepolia-optimism.etherscan.io',
  },
  {
    id: 'tron',
    name: 'Tron Shasta',
    symbol: 'TRX',
    icon: '⚫',
    isEVM: false,
    isTestnet: true,
    blockExplorer: 'https://shasta.tronscan.org',
  },
  {
    id: 'solana',
    name: 'Solana Devnet',
    symbol: 'SOL',
    icon: '◎',
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
        className="flex items-center gap-3 px-4 py-2.5 bg-[#111111] border border-gray-800 rounded-lg hover:border-teal-400/50 transition-all"
      >
        <span className="text-2xl">{selectedChain.icon}</span>
        <div className="flex flex-col items-start">
          <span className="text-white text-sm font-medium">{selectedChain.name}</span>
          <span className="text-gray-500 text-xs">{selectedChain.symbol}</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-[#111111] border border-gray-800 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
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
                    ? 'bg-teal-400/10 border border-teal-400/30'
                    : 'hover:bg-gray-800/50'
                }`}
              >
                <span className="text-2xl">{chain.icon}</span>
                <div className="flex-1 flex flex-col items-start">
                  <span className="text-white text-sm font-medium">
                    {chain.name}
                  </span>
                  <span className="text-gray-500 text-xs">{chain.symbol}</span>
                </div>
                {selectedChain.id === chain.id && (
                  <svg
                    className="w-4 h-4 text-teal-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
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
