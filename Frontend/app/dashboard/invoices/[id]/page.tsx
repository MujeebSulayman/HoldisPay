'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import Link from 'next/link';
import { invoiceApi, Invoice } from '@/lib/api/invoice';
import { InvoiceDetailTemplate } from '@/components/InvoiceDetailTemplate';

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
    return (
      <PremiumDashboardLayout>
        <PageLoader />
      </PremiumDashboardLayout>
    );
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
        <div className="space-y-6 min-w-0">
          <div className="bg-red-400/10 border border-red-400/20 rounded-lg p-6 text-center">
            <p className="text-red-400 mb-4">{error || 'Invoice not found'}</p>
            <Link href="/dashboard/invoices" className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300">
              Back to Invoices
            </Link>
          </div>
        </div>
      </PremiumDashboardLayout>
    );
  }

  return (
    <PremiumDashboardLayout>
      <InvoiceDetailTemplate
        invoice={invoice}
        backHref="/dashboard/invoices"
        backLabel="Back to Invoices"
        issuerDisplayName={user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : undefined}
        issuerEmail={user.email ?? undefined}
        issuerInitial={user.firstName?.[0] || user.email?.[0] || 'H'}
      />
    </PremiumDashboardLayout>
  );
}
