'use client';

import { useState, useEffect } from 'react';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { useAuth } from '@/lib/contexts/AuthContext';
import { transactionApi, Transaction } from '@/lib/api/transaction';
import Link from 'next/link';

const USDC_DECIMALS = 6;
function formatUsdcAmount(amountWei: string | undefined): string {
  const usd = Number(amountWei ?? 0) / 10 ** USDC_DECIMALS;
  return usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

export default function TransactionHistoryContent() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterChain, setFilterChain] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchTransactions();
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [transactions, searchQuery, filterType, filterChain, filterStatus, dateRange]);

  const fetchTransactions = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await transactionApi.getUserTransactions(user.id, {
        status: 'success,failed',
        limit: 500,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch transactions');
      }

      setTransactions(response.data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...transactions];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          (tx.tx_hash && tx.tx_hash.toLowerCase().includes(query)) ||
          (tx.from_address && tx.from_address.toLowerCase().includes(query)) ||
          (tx.to_address && tx.to_address.toLowerCase().includes(query))
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter((tx) => tx.tx_type === filterType);
    }

    if (filterChain !== 'all') {
      filtered = filtered.filter((tx) => (tx.metadata as { chainId?: string })?.chainId === filterChain);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((tx) => tx.status === filterStatus);
    }

    if (dateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date(now);

      switch (dateRange) {
        case '24h':
          filterDate.setDate(now.getDate() - 1);
          break;
        case '7d':
          filterDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          filterDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          filterDate.setDate(now.getDate() - 90);
          break;
      }

      filtered = filtered.filter((tx) => new Date(tx.created_at) >= filterDate);
    }

    setFilteredTransactions(filtered);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterType('all');
    setFilterChain('all');
    setFilterStatus('all');
    setDateRange('all');
  };

  const hasActiveFilters =
    searchQuery ||
    filterType !== 'all' ||
    filterChain !== 'all' ||
    filterStatus !== 'all' ||
    dateRange !== 'all';

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
      case 'GATEWAY_DEPOSIT':
      case 'invoice_fund':
      case 'contract_fund':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
          </svg>
        );
      case 'WITHDRAW':
      case 'GATEWAY_WITHDRAW':
      case 'withdraw':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        );
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
      case 'GATEWAY_DEPOSIT':
      case 'invoice_fund':
        return 'text-green-400 bg-green-500/20';
      case 'contract_fund':
        return 'text-violet-400 bg-violet-500/20';
      case 'WITHDRAW':
      case 'GATEWAY_WITHDRAW':
      case 'withdraw':
        return 'text-emerald-400 bg-emerald-500/20';
      default:
        return 'text-purple-400 bg-purple-500/20';
    }
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <PremiumDashboardLayout>
        <PageLoader />
      </PremiumDashboardLayout>
    );
  }

  return (
    <PremiumDashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Transaction History</h1>
            <p className="text-gray-400">
              {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <Link
            href="/dashboard/transactions/pending"
            className="px-4 py-2 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded-lg transition-colors"
          >
            View Pending
          </Link>
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
          <div className="grid lg:grid-cols-4 gap-4 mb-4">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-400 mb-2">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by hash, address, or asset..."
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Types</option>
                <option value="invoice_fund">Invoice payment</option>
                <option value="contract_fund">Contract payment</option>
                <option value="invoice_create">Invoice create</option>
                <option value="withdraw">Withdrawal</option>
                <option value="transfer">Transfer</option>
                <option value="DEPOSIT">Deposit</option>
                <option value="WITHDRAW">Withdraw</option>
                <option value="GATEWAY_DEPOSIT">Gateway Deposit</option>
                <option value="GATEWAY_WITHDRAW">Gateway Withdraw</option>
                <option value="SWAP">Swap</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Time</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
            </div>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-teal-400 hover:text-teal-300 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear all filters
            </button>
          )}
        </div>

        {paginatedTransactions.length > 0 ? (
          <>
            <div className="space-y-3">
              {paginatedTransactions.map((tx) => {
                const metadata = tx.metadata as { chainId?: string; chainName?: string; note?: string; contractId?: string; type?: string } | undefined;
                const isFiatWithdrawal = tx.tx_type === 'withdraw' && (metadata?.type === 'naira_bank_withdrawal' || tx.tx_hash?.startsWith('withdraw-'));
                const chainKey = metadata?.chainId || 'base';
                const explorer = CHAIN_CONFIGS[chainKey]?.blockExplorer ?? CHAIN_CONFIGS.base.blockExplorer;
                const isContract = tx.tx_type === 'contract_fund' || metadata?.contractId;
                const contractId = metadata?.contractId;
                return (
                  <div
                    key={tx.id}
                    className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`p-3 rounded-lg ${getTypeColor(tx.tx_type)}`}>
                          {getTypeIcon(tx.tx_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <h3 className="text-lg font-semibold text-white capitalize">
                              {tx.tx_type.replace(/_/g, ' ')}
                            </h3>
                            {isContract ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-violet-500/20 text-violet-300">
                                {contractId ? (
                                  <Link href={`/dashboard/contracts/${contractId}`} className="hover:underline">
                                    Contract
                                  </Link>
                                ) : (
                                  'Contract'
                                )}
                              </span>
                            ) : isFiatWithdrawal ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300">
                                Bank Transfer
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-500/20 text-teal-300">
                                Invoice
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                tx.status === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                              }`}
                            >
                              <div
                                className={`w-2 h-2 rounded-full ${tx.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`}
                              />
                              {tx.status}
                            </span>
                            <span className="text-xs text-gray-500">{isFiatWithdrawal ? 'Fiat · NGN' : (metadata?.chainName || 'Base')}</span>
                          </div>
                          <p className="text-sm text-gray-400 mb-3">{formatDate(tx.created_at)}</p>
                          <div className="grid sm:grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-gray-500 mb-1">From</p>
                              <code className="text-gray-300 font-mono">{shortenAddress(tx.from_address || '')}</code>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">To</p>
                              <code className="text-gray-300 font-mono">{shortenAddress(tx.to_address || '')}</code>
                            </div>
                          </div>
                          {metadata?.note && (
                            <div className="mt-3 p-2 bg-gray-800/30 rounded text-sm text-gray-400">
                              <span className="text-gray-500">Note:</span> {metadata.note}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className={`text-xl font-bold ${tx.status === 'success' ? 'text-white' : 'text-red-400'}`}>
                          {tx.tx_type.includes('withdraw') ? '-' : '+'}{formatUsdcAmount(tx.amount)} USDC
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-800">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
                          <code className="text-xs text-gray-400 font-mono break-all">{tx.tx_hash}</code>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => navigator.clipboard.writeText(tx.tx_hash)}
                            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                            title="Copy hash"
                          >
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                            </svg>
                          </button>
                          {tx.tx_hash && (
                            <a
                              href={`${explorer}/tx/${tx.tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                              title="View on explorer"
                            >
                              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredTransactions.length)} of{' '}
                  {filteredTransactions.length} transactions
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-600 rounded-lg text-white transition-colors"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) pageNum = i + 1;
                      else if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;
                      return (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                            currentPage === pageNum ? 'bg-teal-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-600 rounded-lg text-white transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-12 text-center">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No Transactions Found</h3>
            <p className="text-gray-400 mb-4">
              {hasActiveFilters ? 'Try adjusting your filters' : "You haven't made any transactions yet"}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-6 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg text-white transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>
    </PremiumDashboardLayout>
  );
}
