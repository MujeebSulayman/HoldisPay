'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api/admin';
import { PageLoader } from '@/components/AppLoader';

const STATUS_LABELS: Record<number, string> = { 0: 'Pending', 1: 'Funded', 2: 'Delivered', 3: 'Completed', 4: 'Cancelled' };

function shorten(addr: string | undefined) {
  if (!addr) return '—';
  return addr.length <= 16 ? addr : `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

export default function AdminInvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.invoiceId as string;
  const [invoice, setInvoice] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) return;
    setLoading(true);
    setError(null);
    adminApi.getInvoiceById(invoiceId).then(setInvoice).catch((e) => setError(e instanceof Error ? e.message : 'Failed to load')).finally(() => setLoading(false));
  }, [invoiceId]);

  if (loading && !invoice) return (<div className="flex-1 flex items-center justify-center bg-[#0A0A0A]"><PageLoader /></div>);
  if (error || !invoice) return (
    <div className="flex-1 overflow-auto"><div className="max-w-3xl mx-auto px-4 py-8">
      <p className="text-red-400">{error ?? 'Invoice not found'}</p>
      <Link href="/admin/invoices" className="mt-4 inline-block text-teal-400 hover:underline">← Back to Invoices</Link>
    </div></div>
  );

  const status = invoice.status as number | undefined;
  const ts = (v: unknown) => (v ? new Date(Number(v) * 1000).toLocaleString() : '—');

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/admin/invoices" className="text-gray-400 hover:text-white">← Invoices</Link>
          <h2 className="text-2xl font-bold text-white">Invoice #{invoice.id}</h2>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${status === 3 ? 'bg-green-500/20 text-green-400' : status === 4 ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
            {STATUS_LABELS[status ?? 0] ?? status}
          </span>
        </div>
        <div className="bg-[#111111] border border-gray-800 rounded-lg p-6 space-y-6">
          <section>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Amount & token</h3>
            <p className="text-xl font-semibold text-white">{invoice.amount ?? '0'}</p>
            <p className="text-gray-400 text-sm font-mono">{shorten(invoice.tokenAddress as string)}</p>
          </section>
          <section>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Parties</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div><dt className="text-gray-500">Issuer</dt><dd className="text-white font-mono">{shorten(invoice.issuer as string)}</dd></div>
              <div><dt className="text-gray-500">Payer</dt><dd className="text-white font-mono">{shorten(invoice.payer as string)}</dd></div>
              <div><dt className="text-gray-500">Receiver</dt><dd className="text-white font-mono">{shorten(invoice.receiver as string)}</dd></div>
            </dl>
          </section>
          <section>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Timeline</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div><dt className="text-gray-500">Created</dt><dd className="text-gray-300">{ts(invoice.createdAt)}</dd></div>
              <div><dt className="text-gray-500">Funded</dt><dd className="text-gray-300">{ts(invoice.fundedAt)}</dd></div>
              <div><dt className="text-gray-500">Delivered</dt><dd className="text-gray-300">{ts(invoice.deliveredAt)}</dd></div>
              <div><dt className="text-gray-500">Completed</dt><dd className="text-gray-300">{ts(invoice.completedAt)}</dd></div>
            </dl>
          </section>
          {invoice.description && (<section><h3 className="text-sm font-medium text-gray-400 mb-2">Description</h3><p className="text-gray-300 text-sm">{String(invoice.description)}</p></section>)}
          <section className="pt-4 border-t border-gray-800">
            <p className="text-gray-500 text-xs">Invoice lifecycle (fund, deliver, complete, cancel) is managed on-chain. Admin view is read-only.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
