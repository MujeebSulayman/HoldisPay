'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { transactionApi, Transaction as BackendTransaction } from '@/lib/api/transaction';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'send' | 'receive' | 'invoice';
  amount: string;
  asset: string;
  status: 'pending' | 'completed' | 'failed' | 'success';
  timestamp: string;
  txHash?: string;
  from?: string;
  to?: string;
  chainId: string;
  description?: string;
}

const CHAIN_CONFIGS: Record<string, { id: string; name: string; logoUrl: string; blockExplorer: string }> = {
  base: {
    id: 'base',
    name: 'Base Sepolia',
    logoUrl: 'https://cryptologos.cc/logos/usd-base-coin-usdb-logo.png',
    blockExplorer: 'https://sepolia.basescan.org',
  },
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum Sepolia',
    logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    blockExplorer: 'https://sepolia.etherscan.io',
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon Amoy',
    logoUrl: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
    blockExplorer: 'https://amoy.polygonscan.com',
  },
  bnb: {
    id: 'bnb',
    name: 'BNB Testnet',
    logoUrl: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
    blockExplorer: 'https://testnet.bscscan.com',
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum Sepolia',
    logoUrl: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
    blockExplorer: 'https://sepolia.arbiscan.io',
  },
  optimism: {
    id: 'optimism',
    name: 'Optimism Sepolia',
    logoUrl: 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png',
    blockExplorer: 'https://sepolia-optimism.etherscan.io',
  },
  tron: {
    id: 'tron',
    name: 'Tron Nile',
    logoUrl: 'https://cryptologos.cc/logos/tron-trx-logo.png',
    blockExplorer: 'https://nile.tronscan.org',
  },
  solana: {
    id: 'solana',
    name: 'Solana Devnet',
    logoUrl: 'https://cryptologos.cc/logos/solana-sol-logo.png',
    blockExplorer: 'https://explorer.solana.com/?cluster=devnet',
  },
};

export default function TransactionsPage() {
  const { user, loading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user?.id) return;

      try {
        const response = await transactionApi.getUserTransactions(user.id);
        if (response.success && response.data) {
          const formatted = response.data.map((tx: BackendTransaction): Transaction => {
            let type: Transaction['type'] = 'invoice';
            if (tx.tx_type === 'invoice_fund') type = 'deposit';
            else if (tx.tx_type === 'transfer') type = 'send';
            else if (tx.tx_type === 'invoice_create') type = 'invoice';

            return {
              id: tx.id,
              type,
              amount: tx.amount || '0',
              asset: 'USDC',
              status: tx.status === 'success' ? 'completed' : tx.status,
              timestamp: tx.created_at,
              txHash: tx.tx_hash,
              from: tx.from_address,
              to: tx.to_address,
              chainId: 'base',
              description: tx.tx_type.replace('_', ' ').toUpperCase(),
            };
          });
          setTransactions(formatted);
        }
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchTransactions();
    }
  }, [user]);

  if (loading || !user) {
    return (
      <PremiumDashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
        </div>
      </PremiumDashboardLayout>
    );
  }

  const filteredTransactions = transactions.filter((tx) => {
    if (searchQuery && !tx.txHash?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-400/10 text-green-400 border-green-400/20';
      case 'pending':
        return 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20';
      case 'failed':
        return 'bg-red-400/10 text-red-400 border-red-400/20';
      default:
        return 'bg-gray-400/10 text-gray-400 border-gray-400/20';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'receive':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
          </svg>
        );
      case 'withdrawal':
      case 'send':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
          </svg>
        );
      case 'invoice':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        );
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'receive':
        return 'bg-green-500';
      case 'withdrawal':
      case 'send':
        return 'bg-red-500';
      case 'invoice':
        return 'bg-purple-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <PremiumDashboardLayout>
      <div className="space-y-6 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Transactions</h1>
            <p className="text-gray-400 text-sm sm:text-base">Track all your on-chain activity</p>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-4 sm:p-6">
          <div className="relative max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by transaction hash..."
              className="w-full px-4 py-3 pl-11 bg-black/30 text-white border border-gray-800 rounded-xl focus:outline-none focus:border-teal-400"
            />
            <svg className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
            </div>
          ) : filteredTransactions.length > 0 ? (
            <div className="divide-y divide-gray-800">
              {filteredTransactions.map((tx) => {
                const chain = CHAIN_CONFIGS[tx.chainId] || null;
                return (
                  <div
                    key={tx.id}
                    className="p-4 sm:p-6 hover:bg-gray-900/30 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                      <div className={`w-14 h-14 ${getTypeColor(tx.type)} rounded-2xl flex items-center justify-center text-white shrink-0`}>
                        {getTypeIcon(tx.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                          <span className="text-white font-semibold text-base sm:text-lg capitalize">
                            {tx.type}
                          </span>
                          {chain && (
                            <span className="px-2 py-1 bg-gray-800 rounded-lg text-xs text-gray-400 flex items-center gap-1">
                              <img src={chain.logoUrl} alt={chain.name} className="w-4 h-4 rounded-full" />
                              {chain.name}
                            </span>
                          )}
                          <span
                            className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(tx.status)} capitalize`}
                          >
                            {tx.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-400">
                            {new Date(tx.timestamp).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {tx.txHash && (
                            <a
                              href={`${chain?.blockExplorer || ''}/tx/${tx.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-teal-400 hover:text-teal-300 font-mono text-xs flex items-center gap-1 transition-colors"
                            >
                              {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className={`text-xl font-bold ${tx.type === 'withdrawal' || tx.type === 'send' ? 'text-red-400' : 'text-green-400'}`}>
                          {tx.type === 'withdrawal' || tx.type === 'send' ? '-' : '+'}
                          {tx.amount} {tx.asset}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          ≈ ${(parseFloat(tx.amount) * 1).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 bg-gray-800 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">No transactions yet</h3>
              <p className="text-gray-500 text-center max-w-md mb-6">
                Your transaction history will appear here once you make your first transaction.
              </p>
              <div className="flex gap-3">
                <a
                  href="/dashboard/wallet"
                  className="px-6 py-3 bg-teal-400 hover:bg-teal-500 text-black font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Go to Wallet
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </PremiumDashboardLayout>
  );
}
