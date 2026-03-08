'use client';

import { useState, useEffect } from 'react';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { useAuth } from '@/lib/contexts/AuthContext';
import { transactionApi, Transaction } from '@/lib/api/transaction';
import Link from 'next/link';

export default function PendingTransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchPendingTransactions();
    
    const interval = setInterval(fetchPendingTransactions, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchPendingTransactions = async () => {
    if (!user) return;

    try {
      if (!loading) setRefreshing(true);
      
      const response = await transactionApi.getUserTransactions(user.id, {
        status: 'pending,PENDING,PROCESSING',
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch transactions');
      }

      setTransactions(response.data || []);
    } catch (error) {
      console.error('Error fetching pending transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getTypeIcon = (type: string) => {
    const upperType = type.toUpperCase();
    switch (upperType) {
      case 'DEPOSIT':
      case 'GATEWAY_DEPOSIT':
      case 'INVOICE_FUND':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
          </svg>
        );
      case 'WITHDRAW':
      case 'GATEWAY_WITHDRAW':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
          </svg>
        );
      case 'SWAP':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
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
        return 'text-green-400 bg-green-500/20';
      case 'WITHDRAW':
      case 'GATEWAY_WITHDRAW':
        return 'text-orange-400 bg-orange-500/20';
      case 'SWAP':
        return 'text-purple-400 bg-purple-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
          Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
        Processing
      </span>
    );
  };

  const getTimeRemaining = (estimatedTime: number): string => {
    if (estimatedTime < 60) return `~${estimatedTime}s`;
    const minutes = Math.floor(estimatedTime / 60);
    return `~${minutes}m`;
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getTimeSince = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Pending Transactions</h1>
            <p className="text-gray-400">
              {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} awaiting confirmation
            </p>
          </div>
          <div className="flex items-center gap-3">
            {refreshing && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                Updating...
              </div>
            )}
            <Link
              href="/dashboard/transactions"
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
            >
              All Transactions
            </Link>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-blue-400 font-medium mb-1">Auto-Refreshing</h3>
              <p className="text-sm text-gray-400">
                This page automatically updates every 10 seconds to show the latest transaction status.
              </p>
            </div>
          </div>
        </div>

        {/* Transactions List */}
        {transactions.length > 0 ? (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${getTypeColor(tx.tx_type)}`}>
                      {getTypeIcon(tx.tx_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-white capitalize">
                          {tx.tx_type.replace(/_/g, ' ')}
                        </h3>
                        {getStatusBadge(tx.status)}
                      </div>
                      <p className="text-sm text-gray-400">{getTimeSince(tx.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">
                      {tx.tx_type.includes('withdraw') ? '-' : '+'}{(Number(tx.amount ?? 0) / 1e6).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                    </p>
                    <p className="text-sm text-gray-400">{(tx.metadata as any)?.chainName || 'Base'}</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 capitalize">
                      Status: {tx.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      Processing...
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-teal-500 h-full rounded-full transition-all duration-500 animate-pulse"
                      style={{
                        width: `${tx.status === 'pending' ? '30%' : '70%'}`,
                      }}
                    ></div>
                  </div>
                </div>

                {/* Transaction Details */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-black/20 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">From</p>
                    <code className="text-sm text-gray-300 font-mono">
                      {shortenAddress(tx.from_address || '')}
                    </code>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">To</p>
                    <code className="text-sm text-gray-300 font-mono">
                      {shortenAddress(tx.to_address || '')}
                    </code>
                  </div>
                  {tx.tx_hash && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-gray-300 font-mono break-all">
                          {tx.tx_hash}
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(tx.tx_hash)}
                          className="shrink-0 p-1.5 hover:bg-gray-800 rounded transition-colors"
                        >
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                  {(tx.metadata as any)?.note && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500 mb-1">Note</p>
                      <p className="text-sm text-gray-300">{(tx.metadata as any)?.note}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-12 text-center">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No Pending Transactions</h3>
            <p className="text-gray-400 mb-6">All your transactions have been completed</p>
            <Link
              href="/dashboard/transactions"
              className="inline-block px-6 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg text-white transition-colors"
            >
              View Transaction History
            </Link>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/dashboard/withdraw"
            className="flex items-center gap-4 p-6 bg-gray-900/50 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors group"
          >
            <div className="p-3 bg-green-500/20 rounded-lg text-green-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white group-hover:text-teal-400 transition-colors">
                Deposit Funds
              </h3>
              <p className="text-sm text-gray-400">Add funds to your wallet</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-teal-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>

          <Link
            href="/dashboard/withdraw"
            className="flex items-center gap-4 p-6 bg-gray-900/50 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors group"
          >
            <div className="p-3 bg-orange-500/20 rounded-lg text-orange-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white group-hover:text-teal-400 transition-colors">
                Withdraw Funds
              </h3>
              <p className="text-sm text-gray-400">Send funds to external wallet</p>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-teal-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </div>
      </div>
    </PremiumDashboardLayout>
  );
}
