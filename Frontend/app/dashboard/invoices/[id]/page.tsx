'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import Link from 'next/link';
import { invoiceApi, Invoice } from '@/lib/api/invoice';

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatCurrency(amount: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(parseFloat(amount));
}

export default function InvoiceDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/signin');
  }, [user, loading, router]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const response = await invoiceApi.getInvoice(id);
        if (response.success && response.data) setInvoice(response.data as Invoice);
        else setError('Invoice not found');
      } catch {
        setError('Failed to load invoice');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id]);

  if (loading || !user || isLoading) {
    return (
      <PremiumDashboardLayout>
        <PageLoader />
      </PremiumDashboardLayout>
    );
  }
  if (!user) return null;

  if (error || !invoice) {
    return (
      <PremiumDashboardLayout>
        <div className="p-4 sm:p-6 md:p-8">
          <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-6 text-center">
            <p className="text-red-400 mb-4">{error || 'Invoice not found'}</p>
            <Link href="/dashboard/invoices" className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300">
              Back to Invoices
            </Link>
          </div>
        </div>
      </PremiumDashboardLayout>
    );
  }

  const vatP = invoice.vat_percent ?? 0;
  const feeP = invoice.processing_fee_percent ?? 0;
  let subtotal: number;
  let lineItemsForTable: Array<{ description: string; quantity: string; unitPrice: string; amount: number }> = [];

  if (invoice.line_items && Array.isArray(invoice.line_items) && invoice.line_items.length > 0) {
    lineItemsForTable = invoice.line_items.map((item: any) => {
      const q = Number(item.quantity) || 1;
      const u = Number(item.unitPrice) || 0;
      const amount = item.amount != null ? Number(item.amount) : q * u;
      return {
        description: item.description ?? '',
        quantity: String(q),
        unitPrice: u.toFixed(2),
        amount,
      };
    });
    subtotal = lineItemsForTable.reduce((sum, row) => sum + row.amount, 0);
  } else {
    subtotal = parseFloat(invoice.amount);
    lineItemsForTable = [{ description: invoice.description || '—', quantity: '1', unitPrice: invoice.amount, amount: subtotal }];
  }

  const vatAmount = (subtotal * vatP) / 100;
  const processingFeeAmount = (subtotal * feeP) / 100;
  const grandTotal = subtotal + vatAmount + processingFeeAmount;
  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
  const isPending = invoice.status === 'pending';
  const isExpired = invoice.status === 'expired';
  const isPaid = invoice.status === 'paid' || invoice.status === 'completed';

  return (
    <PremiumDashboardLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto">
        <Link
          href="/dashboard/invoices"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Invoices
        </Link>

        {/* Document-style invoice */}
        <div className="bg-white text-gray-900 rounded-2xl shadow-xl overflow-hidden">
          {/* Header: logo + number + Pay now */}
          <div className="border-b border-gray-200 px-6 sm:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-500 flex items-center justify-center text-white text-xl font-bold">
                  {user?.firstName?.[0] || user?.email?.[0] || 'H'}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Invoice #{invoice.invoice_id}</h1>
                  <p className="text-sm text-gray-500 mt-0.5">Issue date: {formatDate(invoice.created_at)}</p>
                  {invoice.currency && invoice.currency !== 'USD' && (
                    <p className="text-xs text-gray-500 mt-0.5">Currency: {invoice.currency}</p>
                  )}
                </div>
              </div>
              {isPending && invoice.payment_link_url && (
                <a
                  href={invoice.payment_link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl transition-colors shrink-0"
                >
                  Pay now
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
              {!isPending && (
                <span
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium shrink-0 ${
                    isPaid ? 'bg-emerald-100 text-emerald-800' : isExpired ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {invoice.status === 'paid' || invoice.status === 'completed' ? 'Paid' : invoice.status === 'expired' ? 'Expired' : invoice.status}
                </span>
              )}
            </div>
            {isPending && (
              <div className="mt-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  {dueDate
                    ? `This invoice is valid until ${formatDate(invoice.due_date!)}. After that date, it will be automatically cancelled.`
                    : 'This invoice is valid until paid. Share the payment link with your customer to collect payment.'}
                </p>
              </div>
            )}
            {isExpired && dueDate && (
              <div className="mt-4 px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700">This invoice expired on {formatDate(invoice.due_date!)}.</p>
              </div>
            )}
          </div>

          {/* From / To */}
          <div className="grid sm:grid-cols-2 gap-6 px-6 sm:px-8 py-6 border-b border-gray-200">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">From</p>
              <p className="font-medium text-gray-900">{invoice.business_name || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'Your business')}</p>
              {invoice.business_address && <p className="text-sm text-gray-600 mt-0.5">{invoice.business_address}</p>}
              <p className="text-sm text-gray-600 mt-0.5">{user?.email ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">To</p>
              <p className="font-medium text-gray-900">{invoice.customer_name || 'Customer'}</p>
              {invoice.customer_email && (
                <p className="text-sm text-gray-600 mt-0.5">Email: {invoice.customer_email}</p>
              )}
            </div>
          </div>

          {/* Invoice items */}
          <div className="px-6 sm:px-8 py-6 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Invoice items</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Service / Description</th>
                    <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right w-24">Quantity</th>
                    <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right w-32">Price</th>
                    <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right w-32">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItemsForTable.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-3 text-gray-900">{row.description}</td>
                      <td className="py-3 text-gray-600 text-right">{row.quantity}</td>
                      <td className="py-3 text-gray-600 text-right">{formatCurrency(row.unitPrice)}</td>
                      <td className="py-3 font-medium text-gray-900 text-right">{formatCurrency(row.amount.toFixed(2))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="px-6 sm:px-8 py-6 bg-gray-50">
            <div className="max-w-xs ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Sub total</span>
                <span className="text-gray-900">{formatCurrency(subtotal.toFixed(2))}</span>
              </div>
              {vatP > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT ({vatP}%)</span>
                  <span className="text-gray-900">{formatCurrency(vatAmount.toFixed(2))}</span>
                </div>
              )}
              {feeP > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Processing fee ({feeP}%)</span>
                  <span className="text-gray-900">{formatCurrency(processingFeeAmount.toFixed(2))}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200 mt-2">
                <span className="text-gray-900">Grand total</span>
                <span className="text-gray-900">{formatCurrency(grandTotal.toFixed(2))}</span>
              </div>
            </div>
          </div>

          {/* Footer note for issuer */}
          <div className="px-6 sm:px-8 py-4 bg-gray-100 border-t border-gray-200">
            {isPending && invoice.payment_link_url && (
              <p className="text-sm text-gray-600">
                Share the payment link with your customer. Payment is secured via escrow; you receive funds after they pay.
              </p>
            )}
            {isPaid && invoice.paid_at && (
              <p className="text-sm text-emerald-700">
                Paid on {formatDate(invoice.paid_at)}. Funds have been released per your account settings.
              </p>
            )}
          </div>
        </div>
      </div>
    </PremiumDashboardLayout>
  );
}
