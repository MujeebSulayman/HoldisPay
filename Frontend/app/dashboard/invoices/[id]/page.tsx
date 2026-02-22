'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import Link from 'next/link';
import { invoiceApi, Invoice } from '@/lib/api/invoice';
import { formatDateTime } from '@/lib/date';

export default function InvoiceDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!id) return;
      try {
        const response = await invoiceApi.getInvoice(id);
        if (response.success && response.data) {
          setInvoice(response.data as Invoice);
        } else {
          setError('Invoice not found');
        }
      } catch {
        setError('Failed to load invoice');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchInvoice();
  }, [id]);

  if (loading || !user) {
    return (
      <PremiumDashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400" />
        </div>
      </PremiumDashboardLayout>
    );
  }

  if (!user) return null;

  if (isLoading) {
    return (
      <PremiumDashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400" />
        </div>
      </PremiumDashboardLayout>
    );
  }

  if (error || !invoice) {
    return (
      <PremiumDashboardLayout>
        <div className="p-4 sm:p-6 md:p-8">
          <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-6 text-center">
            <p className="text-red-400 mb-4">{error || 'Invoice not found'}</p>
            <Link
              href="/dashboard/invoices"
              className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300"
            >
              <span>Back to Invoices</span>
            </Link>
          </div>
        </div>
      </PremiumDashboardLayout>
    );
  }

  const statusColors: Record<string, string> = {
    completed: 'bg-green-400/10 text-green-400 border-green-400/20',
    paid: 'bg-green-400/10 text-green-400 border-green-400/20',
    pending: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    funded: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    delivered: 'bg-purple-400/10 text-purple-400 border-purple-400/20',
    failed: 'bg-red-400/10 text-red-400 border-red-400/20',
  };
  const statusColor = statusColors[invoice.status] ?? 'bg-gray-400/10 text-gray-400 border-gray-400/20';

  return (
    <PremiumDashboardLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/invoices"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Invoices
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Invoice #{invoice.invoice_id}
            </h1>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border capitalize ${statusColor}`}
            >
              {invoice.status}
            </span>
          </div>
        </div>

        <div className="bg-[#111111] border border-gray-800 rounded-xl overflow-hidden space-y-6 p-6">
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Amount</h3>
            <p className="text-2xl font-bold text-white">${parseFloat(invoice.amount).toFixed(2)}</p>
          </div>
          {invoice.description && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Description</h3>
              <p className="text-gray-300">{invoice.description}</p>
            </div>
          )}
          {(invoice.customer_name || invoice.customer_email) && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Customer</h3>
              <p className="text-white">{invoice.customer_name || '—'}</p>
              {invoice.customer_email && (
                <p className="text-gray-400 text-sm mt-1">{invoice.customer_email}</p>
              )}
            </div>
          )}
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Created</h3>
            <p className="text-gray-300">{formatDateTime(invoice.created_at)}</p>
          </div>
          {(invoice.status === 'paid' || invoice.status === 'completed') && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Amount received</h3>
              <p className="text-2xl font-bold text-green-400">${parseFloat(invoice.amount).toFixed(2)}</p>
              {invoice.paid_at && (
                <p className="text-gray-400 text-sm mt-1">Paid at {formatDateTime(invoice.paid_at)}</p>
              )}
            </div>
          )}

          {invoice.payment_link_url && invoice.status === 'pending' && (
            <div className="pt-4 border-t border-gray-800">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Payment link</h3>
              <a
                href={invoice.payment_link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-400 hover:bg-teal-500 text-black font-medium rounded-lg"
              >
                Open payment page
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <p className="text-gray-500 text-sm mt-2">Share this link with the customer to collect payment.</p>
            </div>
          )}
        </div>
      </div>
    </PremiumDashboardLayout>
  );
}
