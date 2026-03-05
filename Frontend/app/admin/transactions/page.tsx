'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api/admin';
import { PageLoader } from '@/components/AppLoader';
import { format } from 'date-fns';

type TxRow = Record<string, unknown> & {
  id?: string;
  user_id?: string;
  invoice_id?: string;
  tx_type?: string;
  status?: string;
  created_at?: string;
  amount?: string;
  chain_id?: string;
  token_address?: string;
  tx_hash?: string;
  metadata?: { contractId?: string; type?: string };
};

const TX_TYPE_LABELS: Record<string, string> = {
  invoice_create: 'Invoice created',
  invoice_fund: 'Invoice funded',
  delivery_submit: 'Delivery submitted',
  delivery_confirm: 'Delivery confirmed',
  transfer: 'Transfer',
  deposit: 'Deposit',
  withdraw: 'Withdraw',
  contract_fund: 'Contract funded',
};

function sourceForType(txType: string): 'Invoice' | 'Contract' | 'Wallet' {
  if (!txType) return 'Wallet';
  if (txType === 'contract_fund') return 'Contract';
  if (txType.startsWith('invoice_') || txType.startsWith('delivery_')) return 'Invoice';
  return 'Wallet';
}

function getExplorerUrl(chainId: string | null | undefined, txHash: string | null | undefined): string | null {
  if (!txHash) return null;
  const c = String(chainId ?? '').toLowerCase();
  const base =
    c === 'base' || c === '8453'
      ? 'https://basescan.org'
      : c === 'ethereum' || c === '1'
        ? 'https://etherscan.io'
        : c === 'arbitrum' || c === '42161'
          ? 'https://arbiscan.io'
          : c === 'polygon' || c === '137'
            ? 'https://polygonscan.com'
            : 'https://basescan.org';
  return `${base}/tx/${txHash}`;
}

function formatAmount(wei: string | number | null | undefined): string {
  if (wei == null || wei === '') return '—';
  const raw = typeof wei === 'number' ? wei : String(wei).trim();
  if (raw === '') return '—';
  const str = typeof raw === 'string' ? raw : String(raw);
  const trimZeros = (s: string) => s.replace(/\.?0+$/, '');
  try {
    if (str.includes('.')) {
      const n = parseFloat(str);
      return Number.isFinite(n) ? trimZeros(n.toFixed(4)) : '—';
    }
    const n = BigInt(str);
    if (n === BigInt(0)) return '0';
    const s = n.toString();
    if (s.length <= 18) return trimZeros((Number(s) / 1e18).toFixed(4));
    return trimZeros((Number(s.slice(0, -18) + '.' + s.slice(-18))).toFixed(2));
  } catch {
    const n = parseFloat(str);
    return Number.isFinite(n) ? trimZeros(n.toFixed(4)) : '—';
  }
}

const PAGE_SIZE = 25;

export default function AdminTransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await adminApi.getTransactions({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        status: statusFilter || undefined,
        txType: typeFilter || undefined,
      });
      setTransactions((res.transactions ?? []) as TxRow[]);
      setTotal(res.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transactions');
      setTransactions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const showPagination = total > PAGE_SIZE;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-sm text-gray-400">
            All invoice, contract, and wallet transactions across the platform.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="bg-[#111] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
          >
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(0);
            }}
            className="bg-[#111] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 min-w-[180px]"
          >
            <option value="">All types</option>
            {Object.entries(TX_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <PageLoader />
          </div>
        ) : (
          <div className="bg-[#111] border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-800 bg-[#0a0a0a]">
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Source</th>
                    <th className="py-3 px-4 font-medium">Type</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Amount</th>
                    <th className="py-3 px-4 font-medium">Chain</th>
                    <th className="py-3 px-4 font-medium">Reference</th>
                    <th className="py-3 px-4 font-medium">Tx hash</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-500">
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx, idx) => {
                      const source = sourceForType(String(tx.tx_type ?? ''));
                      const typeLabel = TX_TYPE_LABELS[String(tx.tx_type ?? '')] ?? String(tx.tx_type ?? '—');
                      const status = String(tx.status ?? '—');
                      const explorerUrl = getExplorerUrl(tx.chain_id as string, tx.tx_hash as string);
                      const ref = tx.invoice_id
                        ? `Invoice #${tx.invoice_id}`
                        : (tx.metadata as { contractId?: string })?.contractId
                          ? `Contract ${String((tx.metadata as { contractId?: string }).contractId).slice(0, 8)}…`
                          : '—';
                      return (
                        <tr
                          key={tx.id != null ? String(tx.id) : `tx-${page}-${idx}`}
                          className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                        >
                          <td className="py-3 px-4 text-gray-300 whitespace-nowrap">
                            {tx.created_at
                              ? format(new Date(tx.created_at as string), 'MMM d, yyyy HH:mm')
                              : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={
                                source === 'Invoice'
                                  ? 'text-blue-400'
                                  : source === 'Contract'
                                    ? 'text-teal-400'
                                    : 'text-gray-400'
                              }
                            >
                              {source}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-300">{typeLabel}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                status === 'success'
                                  ? 'bg-green-500/20 text-green-400'
                                  : status === 'failed'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-amber-500/20 text-amber-400'
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-300 font-mono tabular-nums">
                            {formatAmount(
                              tx.amount ??
                                (tx.metadata && typeof tx.metadata === 'object' && 'amount' in tx.metadata
                                  ? (tx.metadata as { amount?: string | number }).amount
                                  : undefined)
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-400">{tx.chain_id ?? '—'}</td>
                          <td className="py-3 px-4 text-gray-400 text-xs">{ref}</td>
                          <td className="py-3 px-4 font-mono text-xs">
                            {explorerUrl ? (
                              <a
                                href={explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-teal-400 hover:underline"
                              >
                                {(tx.tx_hash as string)?.slice(0, 10)}…
                              </a>
                            ) : (
                              <span className="text-gray-500">
                                {(tx.tx_hash as string) ? `${String(tx.tx_hash).slice(0, 10)}…` : '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {showPagination && totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
                <span className="text-gray-500 text-sm">
                  {total} total
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Previous
                  </button>
                  <span className="text-gray-500 text-sm">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
