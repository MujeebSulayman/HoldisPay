'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/admin';
import { PageLoader } from '@/components/AppLoader';
import { format } from 'date-fns';

type VolumeRow = { token: string; volume: string; count?: number };
type TxRow = Record<string, unknown> & { id?: string; user_id?: string; tx_type?: string; status?: string; created_at?: string; amount?: string; chain_id?: string };

export default function AdminTransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [volume, setVolume] = useState<VolumeRow[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(0);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const txLimit = 20;

  const loadVolume = async () => {
    try {
      const data = await adminApi.getTransactionVolume() as Record<string, { volume?: string; count?: number }> | undefined;
      if (!data || typeof data !== 'object') {
        setVolume([]);
        return;
      }
      setVolume(
        Object.entries(data).map(([token, v]) => ({ token, volume: v.volume ?? '0', count: v.count }))
      );
    } catch (e) {
      console.error(e);
      setVolume([]);
    }
  };

  const loadTransactions = async () => {
    try {
      const res = await adminApi.getTransactions({ limit: txLimit, offset: txPage * txLimit });
      setTransactions(res.transactions ?? []);
      setTxTotal(res.total ?? 0);
    } catch (e) {
      setTransactions([]);
      setTxTotal(0);
    }
  };

  useEffect(() => {
    setError(null);
    setLoading(true);
    Promise.all([loadVolume(), loadTransactions()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    loadTransactions();
  }, [txPage]);

  const runBackfill = async () => {
    setBackfillResult(null);
    setError(null);
    setBackfilling(true);
    try {
      const result = await adminApi.backfillChainIds();
      const msg = typeof result === 'object' && result !== null && 'message' in result
        ? (result as { message?: string }).message
        : typeof result === 'string'
          ? result
          : 'Backfill completed.';
      setBackfillResult(msg ?? 'Backfill completed.');
      await loadVolume();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Backfill failed');
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-white mb-6">Transactions</h2>

        <div className="mb-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={runBackfill}
            disabled={backfilling}
            className="px-4 py-2 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/40 hover:bg-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {backfilling ? 'Backfilling…' : 'Backfill chain IDs'}
          </button>
          {backfillResult && (
            <span className="text-gray-400 text-sm">{backfillResult}</span>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <PageLoader />
          </div>
        ) : (
          <div className="bg-[#111111] border border-gray-800 rounded-lg overflow-hidden">
            <h3 className="text-lg font-semibold text-white p-4 border-b border-gray-800">Volume by token</h3>
            {volume.length === 0 ? (
              <p className="p-6 text-gray-400">No transaction volume data.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-800 bg-[#0A0A0A]">
                      <th className="py-3 px-4">Token</th>
                      <th className="py-3 px-4">Volume</th>
                      <th className="py-3 px-4">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {volume.map((row, i) => (
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-[#0A0A0A]/50">
                        <td className="py-2 px-4 text-white">{row.token}</td>
                        <td className="py-2 px-4 text-gray-300">{row.volume}</td>
                        <td className="py-2 px-4 text-gray-300">{row.count ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-8 bg-[#111111] border border-gray-800 rounded-lg overflow-hidden">
            <h3 className="text-lg font-semibold text-white p-4 border-b border-gray-800">Platform transactions</h3>
            {loading ? (
              <div className="p-6 flex justify-center"><PageLoader /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-800 bg-[#0A0A0A]">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Chain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr><td colSpan={5} className="py-8 text-center text-gray-500">No platform transactions.</td></tr>
                    ) : (
                      transactions.map((tx, idx) => (
                        <tr key={tx.id != null ? String(tx.id) : `tx-${txPage}-${idx}`} className="border-b border-gray-800/50 hover:bg-[#0A0A0A]/50">
                          <td className="py-2 px-4 text-gray-300">
                            {tx.created_at ? format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm') : '—'}
                          </td>
                          <td className="py-2 px-4 text-gray-300 font-mono text-xs">{tx.user_id ? `${String(tx.user_id).slice(0, 8)}…` : '—'}</td>
                          <td className="py-2 px-4 text-teal-400">{String(tx.tx_type ?? '—')}</td>
                          <td className="py-2 px-4 text-gray-300">{String(tx.status ?? '—')}</td>
                          <td className="py-2 px-4 text-gray-400">{tx.chain_id ?? '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {txTotal > txLimit && (
              <div className="p-3 border-t border-gray-800 flex justify-between items-center">
                <span className="text-gray-500 text-sm">{txTotal} total</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setTxPage((p) => Math.max(0, p - 1))} disabled={txPage === 0} className="px-2 py-1 rounded border border-gray-700 text-gray-400 hover:bg-gray-800 disabled:opacity-50 text-xs">Prev</button>
                  <button type="button" onClick={() => setTxPage((p) => p + 1)} disabled={(txPage + 1) * txLimit >= txTotal} className="px-2 py-1 rounded border border-gray-700 text-gray-400 hover:bg-gray-800 disabled:opacity-50 text-xs">Next</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
