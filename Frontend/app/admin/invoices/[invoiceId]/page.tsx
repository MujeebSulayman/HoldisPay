'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { invoiceApi, Invoice } from '@/lib/api/invoice';
import { PageLoader } from '@/components/AppLoader';
import { InvoiceDetailTemplate } from '@/components/InvoiceDetailTemplate';

interface AdminUser {
  id: string;
  email?: string;
  accountType?: string;
}

export default function AdminInvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.invoiceId as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (!token || !userStr) {
      router.replace('/admin/login');
      return;
    }
    try {
      const parsed = JSON.parse(userStr) as AdminUser;
      if (parsed.accountType !== 'admin') {
        router.replace('/');
        return;
      }
      setAdminUser(parsed);
    } catch {
      router.replace('/admin/login');
    }
  }, [router]);

  useEffect(() => {
    if (!invoiceId) return;
    setLoading(true);
    setError(null);
    invoiceApi
      .getInvoice(invoiceId)
      .then((res) => {
        if (res.success && res.data) setInvoice(res.data as Invoice);
        else setError('Invoice not found');
      })
      .catch(() => setError('Failed to load invoice'))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  if (!adminUser) return <PageLoader />;
  if (loading && !invoice) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0A0A0A]">
        <PageLoader />
      </div>
    );
  }
  if (error || !invoice) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <p className="text-red-400">{error ?? 'Invoice not found'}</p>
          <Link href="/admin/invoices" className="mt-4 inline-block text-teal-400 hover:underline">
            ← Back to Invoices
          </Link>
        </div>
      </div>
    );
  }

  return (
    <InvoiceDetailTemplate
      invoice={invoice}
      backHref="/admin/invoices"
      backLabel="Back to Invoices"
      issuerDisplayName="Admin"
      issuerEmail={adminUser.email}
      issuerInitial={adminUser.email?.[0] || 'A'}
    />
  );
}
