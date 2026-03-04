'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { adminApi } from '@/lib/api/admin';
import { PageLoader } from '@/components/AppLoader';

interface InvoiceItem {
  id?: string;
  invoiceId?: string;
  status?: number;
  amount?: string;
  tokenAddress?: string;
  issuer?: string;
  payer?: string;
  receiver?: string;
  createdAt?: string | number;
  [key: string]: unknown;
}

function AdminInvoicesContent() {
  const searchParams = useSearchParams();
  const filterFailed = searchParams.get('filter') === 'failed';

  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [failedMeta, setFailedMeta] = useState<Array<{ reason: string; stuckFor: string }>>([]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      if (filterFailed) {
        const result = await adminApi.getFailedInvoices();
        const data = result as { invoices?: Array<{ invoice?: InvoiceItem; reason?: string; stuckFor?: string }>; total?: number };
        const list = Array.isArray(data?.invoices) ? data.invoices : [];
        setInvoices(list.map((x) => (x as { invoice?: InvoiceItem }).invoice ?? x).filter(Boolean) as InvoiceItem[]);
        setFailedMeta(list.map((x) => ({ reason: (x as { reason?: string }).reason ?? '—', stuckFor: (x as { stuckFor?: string }).stuckFor ?? '—' })));
        setTotal(list.length);
      } else {
        const params: { status?: number; startDate?: string; endDate?: string } = {};
        if (statusFilter !== '') params.status = parseInt(statusFilter, 10);
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        const result = await adminApi.getAllInvoices(params);
        const data = result as { invoices?: InvoiceItem[]; total?: number };
        setInvoices(Array.isArray(data?.invoices) ? data.invoices : []);
        setTotal(typeof data?.total === 'number' ? data.total : 0);
        setFailedMeta([]);
      }
    } catch (e) {
      console.error('Failed to load invoices', e);
      setInvoices([]);
      setTotal(0);
      setFailedMeta([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [filterFailed, statusFilter, startDate, endDate]);

  if (loading && invoices.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0A0A0A]">
        <PageLoader />
      </div>
    );
  }

  const statusLabel = (s: number | undefined) => {
    if (s === undefined) return '—';
    const map: Record<number, string> = { 0: 'Pending', 1: 'Funded', 2: 'Delivered', 3: 'Completed', 4: 'Cancelled' };
    return map[s] ?? String(s);
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">Invoices</h2>
            {filterFailed && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Failed / Stuck
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {!filterFailed && (
              <Link
                href="/admin/invoices?filter=failed"
                className="text-sm text-amber-400 hover:text-amber-300"
              >
                View failed
              </Link>
            )}
            {filterFailed && (
              <Link href="/admin/invoices" className="text-sm text-teal-400 hover:text-teal-300">
                All invoices
              </Link>
            )}
            <span className="text-gray-400">{total} total</span>
          </div>
        </div>

        {!filterFailed && (
        <div className="bg-[#111111] border border-gray-800 rounded-xl p-4 mb-6 shadow-lg shadow-black/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">All</option>
                <option value="0">Pending</option>
                <option value="1">Paid</option>
                <option value="2">Cancelled</option>
                <option value="3">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
        </div>
        )}

        <div className="bg-[#111111] border border-gray-800 rounded-xl overflow-hidden shadow-lg shadow-black/20">
          {invoices.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No invoices match the filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0d0d0d] border-b border-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                    {filterFailed && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-amber-400 uppercase tracking-wider">Reason</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-amber-400 uppercase tracking-wider">Stuck for</th>
                      </>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Issuer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Payer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/80">
                  {invoices.map((inv, i) => {
                    const id = inv.id ?? (inv as { invoiceId?: string }).invoiceId ?? (inv as { invoice?: { id?: string } }).invoice?.id;
                    const meta = failedMeta[i];
                    const row = typeof (inv as { invoice?: InvoiceItem }).invoice === 'object' ? (inv as { invoice: InvoiceItem }).invoice : inv;
                    return (
                    <tr key={String(id ?? i)} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                        {id != null ? (
                          <Link href={`/admin/invoices/${id}`} className="text-teal-400 hover:underline">{String(id)}</Link>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {statusLabel(row.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {row.amount ?? (inv as { amount?: string }).amount ?? '—'}
                      </td>
                      {filterFailed && meta && (
                        <>
                          <td className="px-6 py-4 text-sm text-amber-200/90 max-w-[200px] truncate" title={meta.reason}>{meta.reason}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{meta.stuckFor}</td>
                        </>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono truncate max-w-[120px]">
                        {(row.issuer ?? (inv as { issuer?: string }).issuer) ?? '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono truncate max-w-[120px]">
                        {(row.payer ?? (inv as { payer?: string }).payer) ?? '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {(row.createdAt ?? (inv as { createdAt?: unknown }).createdAt) != null
                          ? new Date(typeof row.createdAt === 'number' ? row.createdAt * 1000 : String(row.createdAt)).toLocaleString()
                          : '—'}
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
    </div>
  );
}

export default function AdminInvoicesPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center bg-[#0A0A0A] min-h-[40vh]"><PageLoader /></div>}>
      <AdminInvoicesContent />
    </Suspense>
  );
}
