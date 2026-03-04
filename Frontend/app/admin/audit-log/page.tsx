'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/admin';
import { PageLoader } from '@/components/AppLoader';
import { format } from 'date-fns';

type AuditEntry = {
  id: string;
  adminUserId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  createdAt?: string;
};

export default function AdminAuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const limit = 30;

  useEffect(() => {
    setError(null);
    setLoading(true);
    adminApi.getAuditLog({ limit, offset: page * limit }).then((res) => {
      setEntries((res.entries ?? []) as AuditEntry[]);
      setTotal(res.total ?? 0);
    }).catch((e) => setError(e instanceof Error ? e.message : 'Failed to load audit log')).finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-white mb-2">Audit log</h1>
        <p className="text-gray-400 text-sm mb-6">Admin actions and security events.</p>
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-16"><PageLoader /></div>
        ) : (
          <>
            <div className="bg-[#111111] border border-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-800 bg-[#0A0A0A]">
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">Admin</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Target</th>
                      <th className="py-3 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 ? (
                      <tr><td colSpan={5} className="py-12 text-center text-gray-500">No audit entries yet.</td></tr>
                    ) : (
                      entries.map((e) => (
                        <tr key={e.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="py-3 px-4 text-gray-300 whitespace-nowrap">
                            {e.createdAt ? format(new Date(e.createdAt), 'yyyy-MM-dd HH:mm:ss') : '—'}
                          </td>
                          <td className="py-3 px-4 text-gray-300 font-mono text-xs">{e.adminUserId ? `${e.adminUserId.slice(0, 8)}…` : '—'}</td>
                          <td className="py-3 px-4 text-teal-400">{e.action ?? '—'}</td>
                          <td className="py-3 px-4 text-gray-400">{e.targetType && e.targetId ? `${e.targetType} ${e.targetId.slice(0, 8)}…` : '—'}</td>
                          <td className="py-3 px-4 text-gray-500 max-w-xs truncate">{e.details && Object.keys(e.details).length > 0 ? JSON.stringify(e.details) : '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-gray-500 text-sm">Page {page + 1} of {totalPages} ({total} total)</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-50 text-sm">Previous</button>
                  <button type="button" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-50 text-sm">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
