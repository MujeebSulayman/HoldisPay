'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { transactionApi, Transaction as BackendTransaction } from '@/lib/api/transaction';
import { PageLoader } from '@/components/AppLoader';

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
  source: 'invoice' | 'contract';
  contractId?: string;
}

const CHAINS: Record<string, { name: string; logoUrl: string; explorer: string }> = {
  base: {
    name: 'Base',
    logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_base.jpg',
    explorer: 'https://sepolia.basescan.org',
  },
  ethereum: {
    name: 'Ethereum',
    logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg',
    explorer: 'https://sepolia.etherscan.io',
  },
  polygon: {
    name: 'Polygon',
    logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_polygon.jpg',
    explorer: 'https://amoy.polygonscan.com',
  },
  bnb: {
    name: 'BNB',
    logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_bnb.jpg',
    explorer: 'https://testnet.bscscan.com',
  },
  arbitrum: {
    name: 'Arbitrum',
    logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg',
    explorer: 'https://sepolia.arbiscan.io',
  },
  optimism: {
    name: 'Optimism',
    logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_optimism.jpg',
    explorer: 'https://sepolia-optimism.etherscan.io',
  },
  tron: {
    name: 'Tron',
    logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_tron.jpg',
    explorer: 'https://nile.tronscan.org',
  },
  solana: {
    name: 'Solana',
    logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_solana.jpg',
    explorer: 'https://explorer.solana.com',
  },
  avalanche: {
    name: 'Avalanche',
    logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_avalanche.jpg',
    explorer: 'https://testnet.snowtrace.io',
  },
  unknown: {
    name: 'Unknown',
    logoUrl: '',
    explorer: '',
  },
};

const CHAIN_KEYS = Object.keys(CHAINS).filter((k) => k !== 'unknown');

function normalizeChainId(chainId: string | undefined): string {
  if (!chainId || typeof chainId !== 'string') return 'unknown';
  const s = chainId.toLowerCase().trim();
  if (s.includes('ethereum')) return 'ethereum';
  if (s.includes('base')) return 'base';
  if (s.includes('polygon')) return 'polygon';
  if (s.includes('avalanche')) return 'avalanche';
  if (s.includes('bnb') || s.includes('bsc')) return 'bnb';
  if (s.includes('arbitrum')) return 'arbitrum';
  if (s.includes('optimism')) return 'optimism';
  if (s.includes('tron')) return 'tron';
  if (s.includes('solana')) return 'solana';
  if (CHAINS[s as keyof typeof CHAINS] && s !== 'unknown') return s;
  return 'unknown';
}

const USDC_DECIMALS = 6;

function amountWeiToUsd(amountWei: string | undefined): number {
  return Number(amountWei ?? 0) / 10 ** USDC_DECIMALS;
}

function formatAmount(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(2);
}

function shortHash(hash: string): string {
  if (!hash || hash.length < 16) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

function ChainLogo({ chain }: { chain: { name: string; logoUrl: string } }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="h-8 w-8 rounded-full border border-gray-800 shrink-0 overflow-hidden bg-gray-900 flex items-center justify-center">
      {failed ? (
        <span className="text-xs font-medium text-gray-500">{chain.name.charAt(0)}</span>
      ) : (
        <img
          src={chain.logoUrl}
          alt={chain.name}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export default function TransactionsContent() {
  const { user, loading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'invoice' | 'contract'>('all');
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
            if (tx.tx_type === 'invoice_fund' || tx.tx_type === 'contract_fund') type = 'deposit';
            else if (tx.tx_type === 'transfer') type = 'send';
            else if (tx.tx_type === 'invoice_create') type = 'invoice';
            const row = tx as BackendTransaction & { chain_id?: string; metadata?: { chainId?: string; contractId?: string } };
            const chainId = normalizeChainId(row.chain_id ?? row.metadata?.chainId);
            const source: 'invoice' | 'contract' = tx.tx_type === 'contract_fund' ? 'contract' : 'invoice';
            const contractId = row.metadata?.contractId ?? undefined;
            return {
              id: tx.id,
              type,
              amount: String(amountWeiToUsd(tx.amount)),
              asset: 'USDC',
              status: tx.status === 'success' ? 'completed' : tx.status,
              timestamp: tx.created_at,
              txHash: tx.tx_hash,
              from: tx.from_address,
              to: tx.to_address,
              chainId,
              description: tx.tx_type.replace(/_/g, ' '),
              source,
              contractId,
            };
          });
          setTransactions(formatted);
        }
      } catch (e) {
        console.error('Failed to fetch transactions', e);
      } finally {
        setIsLoading(false);
      }
    };
    if (user) fetchTransactions();
  }, [user]);

  const filtered = useMemo(() => {
    let list = transactions;
    if (sourceFilter !== 'all') {
      list = list.filter((tx) => tx.source === sourceFilter);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (tx) =>
        tx.txHash?.toLowerCase().includes(q) ||
        tx.from?.toLowerCase().includes(q) ||
        tx.to?.toLowerCase().includes(q)
    );
  }, [transactions, searchQuery, sourceFilter]);

  const analysis = useMemo(() => {
    let out = 0;
    let in_ = 0;
    let pending = 0;
    let failed = 0;
    const isCompleted = (s: string) => s === 'success' || s === 'completed';
    filtered.forEach((tx) => {
      const amt = parseFloat(tx.amount) || 0;
      if (tx.status === 'pending') pending += 1;
      else if (tx.status === 'failed') failed += 1;
      if (!isCompleted(tx.status)) return;
      if (tx.type === 'send' || tx.type === 'withdrawal') out += amt;
      else if (tx.type === 'deposit' || tx.type === 'receive') in_ += amt;
    });
    return { out, in: in_, pending, failed };
  }, [filtered]);

  const chainKeys = CHAIN_KEYS;

  if (loading || !user || isLoading) {
    return (
      <PremiumDashboardLayout>
        <PageLoader />
      </PremiumDashboardLayout>
    );
  }

  return (
    <PremiumDashboardLayout>
      <div className="space-y-6 min-w-0">
        <header>
          <h1 className="text-xl font-semibold text-white tracking-tight">Transactions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Activity and status by chain</p>
        </header>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Out</p>
            <p className="text-lg font-semibold text-white mt-1">{formatAmount(analysis.out)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total sent</p>
          </div>
          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">In</p>
            <p className="text-lg font-semibold text-white mt-1">{formatAmount(analysis.in)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total received</p>
          </div>
          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Pending</p>
            <p className="text-lg font-semibold text-amber-400 mt-1">{analysis.pending}</p>
            <p className="text-xs text-gray-500 mt-0.5">Awaiting confirmation</p>
          </div>
          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Failed</p>
            <p className="text-lg font-semibold text-red-400 mt-1">{analysis.failed}</p>
            <p className="text-xs text-gray-500 mt-0.5">Unsuccessful</p>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by hash or address"
              className="w-full h-10 pl-10 pr-4 bg-[#0f0f0f] border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-600"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <div className="flex rounded-lg border border-gray-800 bg-[#0f0f0f] p-0.5">
            {(['all', 'invoice', 'contract'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setSourceFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  sourceFilter === f
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {f === 'all' ? 'All' : f === 'invoice' ? 'Invoice' : 'Contract'}
              </button>
            ))}
          </div>
        </div>

        <div className="border border-gray-800 rounded-lg bg-[#0a0a0a] overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-gray-500 text-sm">No transactions match.</p>
              <Link href="/dashboard/wallet/deposit" className="inline-block mt-3 text-sm text-teal-400 hover:text-teal-300">
                Add funds
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Chain / Type</th>
                    <th className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tx) => {
                    const chain = CHAINS[chainKeys.includes(tx.chainId) ? tx.chainId : 'unknown'] ?? CHAINS.unknown;
                    const isOut = tx.type === 'send' || tx.type === 'withdrawal';
                    const amt = parseFloat(tx.amount) || 0;
                    const statusStyle =
                      tx.status === 'completed' || tx.status === 'success'
                        ? 'text-emerald-400'
                        : tx.status === 'pending'
                          ? 'text-amber-400'
                          : 'text-red-400';
                    return (
                      <tr key={tx.id} className="border-b border-gray-800/80 hover:bg-gray-900/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <ChainLogo chain={chain} />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-white capitalize">{tx.type.replace(/_/g, ' ')}</p>
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                    tx.source === 'contract'
                                      ? 'bg-violet-500/20 text-violet-300'
                                      : 'bg-teal-500/20 text-teal-300'
                                  }`}
                                >
                                  {tx.source === 'contract' ? (
                                    tx.contractId ? (
                                      <Link href={`/dashboard/contracts/${tx.contractId}`} className="hover:underline">
                                        Contract
                                      </Link>
                                    ) : (
                                      'Contract'
                                    )
                                  ) : (
                                    'Invoice'
                                  )}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">{chain.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-sm font-medium capitalize ${statusStyle}`}>{tx.status}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-sm font-medium ${isOut ? 'text-red-400' : 'text-emerald-400'}`}>
                            {isOut ? '−' : '+'}{amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {tx.asset}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-400">
                          {new Date(tx.timestamp).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          {tx.txHash ? (
                            chain.explorer ? (
                              <a
                                href={`${chain.explorer}/tx/${tx.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-mono text-gray-400 hover:text-teal-400 transition-colors"
                              >
                                {shortHash(tx.txHash)}
                              </a>
                            ) : (
                              <span className="text-xs font-mono text-gray-500" title="Chain unknown – no explorer link">
                                {shortHash(tx.txHash)}
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PremiumDashboardLayout>
  );
}
