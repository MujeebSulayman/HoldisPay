'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import Link from 'next/link';
import { invoiceApi, Invoice } from '@/lib/api/invoice';

export default function InvoicesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!user?.id) return;
      
      try {
        const response = await invoiceApi.getUserInvoices(user.id);
        if (response.success && response.data) {
          setInvoices(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch invoices:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchInvoices();
    }
  }, [user]);

  if (loading) {
    return (
      <PremiumDashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
        </div>
      </PremiumDashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-400/10 text-green-400 border-green-400/20';
      case 'pending':
        return 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20';
      case 'funded':
        return 'bg-blue-400/10 text-blue-400 border-blue-400/20';
      case 'delivered':
        return 'bg-purple-400/10 text-purple-400 border-purple-400/20';
      case 'failed':
        return 'bg-red-400/10 text-red-400 border-red-400/20';
      default:
        return 'bg-gray-400/10 text-gray-400 border-gray-400/20';
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch = !searchQuery || 
      invoice.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <PremiumDashboardLayout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Invoices</h2>
            <p className="text-gray-400">Manage your payment invoices</p>
          </div>
          <Link
            href="/dashboard/invoices/create"
            className="px-6 py-3 bg-teal-400 hover:bg-teal-500 text-black font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Invoice
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search by customer email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-[#0a0a0a] text-white border border-gray-800 rounded-lg focus:outline-none focus:border-teal-400"
              />
            </div>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-[#0a0a0a] text-white border border-gray-800 rounded-lg focus:outline-none focus:border-teal-400"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="funded">Funded</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-[#111111] border border-gray-800 rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400">Loading invoices...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">No invoices yet</h3>
              <p className="text-gray-400 mb-6">Create your first invoice to get started</p>
              <Link
                href="/dashboard/invoices/create"
                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-400 hover:bg-teal-500 text-black font-medium rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Invoice
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0a0a0a] border-b border-gray-800">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Invoice #
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-[#0a0a0a] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-white">
                          #{invoice.invoice_id}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-white">
                          {invoice.customer_name || 'No name'}
                        </div>
                        {invoice.customer_email && (
                          <div className="text-xs text-gray-500">{invoice.customer_email}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-white max-w-xs truncate">
                          {invoice.description || 'No description'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">
                          ${parseFloat(invoice.amount).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border capitalize ${getStatusColor(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-400">
                          {new Date(invoice.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/dashboard/invoices/${invoice.invoice_id}`}
                          className="text-teal-400 hover:text-teal-300 text-sm font-medium"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PremiumDashboardLayout>
  );
}
