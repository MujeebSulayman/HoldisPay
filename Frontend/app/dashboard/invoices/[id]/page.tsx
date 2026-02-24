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

function formatCurrency(amount: string | number, currency = 'USD'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(num);
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
    if (!loading && !user && id) router.replace(`/invoices/${id}`);
  }, [user, loading, router, id]);

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

  if (loading || !user) {
    return <PageLoader />;
  }
  if (isLoading) {
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

  const currency = invoice.currency || 'USD';
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
      <div className="min-h-full">
        <div className="w-full max-w-3xl mx-auto px-4 py-4 sm:px-8 sm:py-6 md:px-12 lg:px-16 min-w-0 box-border">
          <Link
            href="/dashboard/invoices"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Invoices
          </Link>

          {/* White card - clean template */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 py-[10px] overflow-x-hidden">
            {/* Header: logo | Invoice # | Pay now */}
            <div className="px-4 pt-5 pb-2 sm:px-5 sm:pt-6 md:px-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="flex items-center gap-3 min-w-0 sm:gap-4">
                  <div className="w-10 h-10 shrink-0 bg-gray-700 flex items-center justify-center text-white text-lg font-bold rounded sm:w-12 sm:h-12 sm:text-xl">
                    {user?.firstName?.[0] || user?.email?.[0] || 'H'}
                  </div>
                  <h1 className="text-xl font-bold text-gray-900 truncate sm:text-2xl">Invoice #{invoice.invoice_id}</h1>
                </div>
                <div className="shrink-0">
                  {isPending && invoice.payment_link_url && (
                    <a
                      href={invoice.payment_link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-md transition-colors sm:px-5 sm:text-base"
                    >
                      Pay now
                    </a>
                  )}
                  {!isPending && (
                    <span
                      className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${
                        isPaid ? 'bg-emerald-100 text-emerald-800' : isExpired ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {isPaid ? 'Paid' : isExpired ? 'Expired' : invoice.status}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Validity note - full width inside card, contained */}
            {isPending && (
              <div className="mx-4 mt-4 px-4 py-3 bg-amber-50 border border-amber-100 rounded-md sm:mx-5 md:mx-8">
                <p className="text-sm text-amber-800">
                  {dueDate
                    ? `This invoice is valid until ${formatDate(invoice.due_date!)}. After that date, it will be automatically cancelled.`
                    : 'This invoice is valid until paid.'}
                </p>
              </div>
            )}
            {isExpired && dueDate && (
              <div className="mx-4 mt-4 px-4 py-3 bg-gray-100 border border-gray-200 rounded-md sm:mx-5 md:mx-8">
                <p className="text-sm text-gray-700">This invoice expired on {formatDate(invoice.due_date!)}.</p>
              </div>
            )}

            {/* Issue date - left, above From/To */}
            <div className="px-4 pt-4 pb-4 border-t border-gray-100 sm:px-5 sm:pt-5 sm:pb-5 md:px-8">
              <p className="text-sm text-gray-500">Issue date: {formatDate(invoice.created_at)}</p>
            </div>

            {/* From / To */}
            <div className="grid grid-cols-1 gap-6 px-4 py-5 border-t border-gray-100 sm:grid-cols-2 sm:gap-8 sm:px-5 sm:py-6 md:px-8">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">From</p>
                <p className="font-medium text-gray-900 break-words">{invoice.business_name || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'Your business')}</p>
                {invoice.business_address && <p className="text-sm text-gray-600 mt-0.5 break-words">{invoice.business_address}</p>}
                {user?.email && <p className="text-sm text-gray-600 mt-0.5 break-all">{user.email}</p>}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">To</p>
                <p className="font-medium text-gray-900 break-words">{invoice.customer_name || 'Customer'}</p>
                {invoice.customer_email && <p className="text-sm text-gray-600 mt-0.5 break-all">Email: {invoice.customer_email}</p>}
              </div>
            </div>

            {/* Invoice items - card layout on mobile, table from sm */}
            <div className="px-4 py-5 border-t border-gray-100 sm:px-5 sm:py-6 md:px-8">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Invoice items</h2>
              {/* Mobile: stacked cards */}
              <div className="space-y-3 sm:hidden">
                {lineItemsForTable.map((row, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3">
                    <p className="text-gray-900 font-medium text-sm">{row.description}</p>
                    <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
                      <span>{row.quantity} {Number(row.quantity) === 1 ? 'slot' : 'slots'}</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(row.amount.toFixed(2), currency)}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Service</th>
                      <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Period/slots</th>
                      <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItemsForTable.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-3 text-gray-900 text-sm break-words pr-2">{row.description}</td>
                        <td className="py-3 text-gray-600 text-sm whitespace-nowrap">{row.quantity} {Number(row.quantity) === 1 ? 'slot' : 'slots'}</td>
                        <td className="py-3 text-gray-900 text-sm text-right font-medium whitespace-nowrap">{formatCurrency(row.amount.toFixed(2), currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary */}
            <div className="px-4 py-5 pb-6 border-t border-gray-100 sm:px-5 sm:py-6 sm:pb-8 md:px-8">
              <div className="w-full max-w-xs ml-auto space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Sub total</span>
                  <span className="text-gray-900">{formatCurrency(subtotal.toFixed(2), currency)}</span>
                </div>
                {vatP > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>VAT ({vatP}%)</span>
                    <span className="text-gray-900">{formatCurrency(vatAmount.toFixed(2), currency)}</span>
                  </div>
                )}
                {feeP > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Processing Fee ({feeP}%)</span>
                    <span className="text-gray-900">{formatCurrency(processingFeeAmount.toFixed(2), currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-gray-900 pt-4 mt-4 border-t border-gray-200">
                  <span>Grand Total</span>
                  <span>{formatCurrency(grandTotal.toFixed(2), currency)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PremiumDashboardLayout>
  );
}
