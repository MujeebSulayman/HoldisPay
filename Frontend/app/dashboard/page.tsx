'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { invoiceApi, Invoice } from '@/lib/api/invoice';
import { userApi, ChainWallet } from '@/lib/api/user';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState({
    totalInvoices: 0,
    pendingInvoices: 0,
    paidInvoices: 0,
    totalRevenue: 0,
    walletBalance: '0.00',
  });
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      try {
        const [invoicesResponse, walletResponse] = await Promise.all([
          invoiceApi.getUserInvoices(user.id),
          userApi.getChainWallet(user.id, 'base').catch(() => ({ success: false, data: null })),
        ]);

        if (invoicesResponse.success && invoicesResponse.data) {
          const invoices = invoicesResponse.data;
          setRecentInvoices(invoices.slice(0, 5));

          const totalRevenue = invoices
            .filter((inv) => inv.status === 'completed' || inv.status === 'paid')
            .reduce((sum, inv) => sum + parseFloat(inv.amount || '0'), 0);

          setStats({
            totalInvoices: invoices.length,
            pendingInvoices: invoices.filter((inv) => inv.status === 'pending').length,
            paidInvoices: invoices.filter((inv) => inv.status === 'completed' || inv.status === 'paid').length,
            totalRevenue,
            walletBalance: '0.00',
          });
        }

        if (walletResponse.success && walletResponse.data) {
          const wallet = walletResponse.data;
          const totalValue = parseFloat(wallet.balance.nativeUSD || '0') +
            wallet.balance.tokens.reduce((sum, token) => sum + parseFloat(token.balanceUSD || '0'), 0);
          
          setStats((prev) => ({
            ...prev,
            walletBalance: totalValue.toFixed(2),
          }));
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  if (loading || !user) {
    return (
      <PremiumDashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
        </div>
      </PremiumDashboardLayout>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'paid':
        return 'bg-green-400/10 text-green-400 border-green-400/20';
      case 'pending':
        return 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20';
      case 'failed':
      case 'cancelled':
        return 'bg-red-400/10 text-red-400 border-red-400/20';
      default:
        return 'bg-gray-400/10 text-gray-400 border-gray-400/20';
    }
  };

  return (
    <PremiumDashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              Welcome back, {user.firstName}
            </h1>
            <p className="text-gray-400">Manage your invoices and track payments</p>
          </div>
          <a
            href="/dashboard/invoices/create"
            className="px-4 py-2 bg-teal-400 hover:bg-teal-500 text-black font-medium rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Invoice
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-400">Total Revenue</p>
              <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-white">${stats.totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">From completed invoices</p>
          </div>

          <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-400">Total Invoices</p>
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{stats.totalInvoices}</p>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </div>

          <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-400">Paid Invoices</p>
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-green-400">{stats.paidInvoices}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.totalInvoices > 0 ? ((stats.paidInvoices / stats.totalInvoices) * 100).toFixed(0) : 0}% completion rate</p>
          </div>

          <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-400">Pending</p>
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-yellow-400">{stats.pendingInvoices}</p>
            <p className="text-xs text-gray-500 mt-1">Awaiting payment</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Recent Invoices</h3>
                <a href="/dashboard/invoices" className="text-sm text-teal-400 hover:text-teal-300 transition-colors">
                  View All
                </a>
              </div>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400"></div>
                </div>
              ) : recentInvoices.length > 0 ? (
                <div className="space-y-3">
                  {recentInvoices.map((invoice) => (
                    <a
                      key={invoice.id}
                      href={`/dashboard/invoices/${invoice.id}`}
                      className="block p-4 bg-black/30 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="text-white font-medium">Invoice #{invoice.invoice_id || invoice.id.slice(0, 8)}</p>
                            <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(invoice.status)}`}>
                              {invoice.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400">{invoice.description || 'No description'}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Created {new Date(invoice.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-white">${invoice.amount}</p>
                          <p className="text-xs text-gray-500">{invoice.currency || 'USD'}</p>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <p className="text-gray-400 font-medium mb-2">No invoices yet</p>
                  <p className="text-sm text-gray-500 mb-4">Create your first invoice to get started</p>
                  <a
                    href="/dashboard/invoices/create"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-400 hover:bg-teal-500 text-black font-medium rounded-xl transition-colors cursor-pointer"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Create Invoice
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-teal-500/10 via-blue-500/10 to-purple-500/10 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-400">Wallet Balance</p>
                <a
                  href="/dashboard/wallet"
                  className="text-xs text-teal-400 hover:text-teal-300 transition-colors cursor-pointer"
                >
                  View Wallet
                </a>
              </div>
              <p className="text-3xl font-bold text-white mb-1">${stats.walletBalance}</p>
              <p className="text-xs text-gray-500">Base Sepolia</p>
              <div className="flex gap-2 mt-4">
                <a
                  href="/dashboard/wallet"
                  className="flex-1 px-3 py-2 bg-teal-400/10 hover:bg-teal-400/20 text-teal-400 text-sm font-medium rounded-lg transition-colors text-center cursor-pointer"
                >
                  Deposit
                </a>
                <a
                  href="/dashboard/wallet"
                  className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors text-center cursor-pointer"
                >
                  Send
                </a>
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <a
                  href="/dashboard/invoices/create"
                  className="flex items-center gap-3 p-3 bg-gradient-to-r from-teal-500/10 to-blue-500/10 border border-teal-500/20 hover:border-teal-500/40 rounded-xl transition-all group cursor-pointer"
                >
                  <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center group-hover:bg-teal-500/30 transition-colors">
                    <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">Create Invoice</p>
                    <p className="text-xs text-gray-400">Request payment</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-teal-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>

                <a
                  href="/dashboard/invoices"
                  className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-500/40 rounded-xl transition-all group cursor-pointer"
                >
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">View Invoices</p>
                    <p className="text-xs text-gray-400">Manage payments</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>

                <a
                  href="/dashboard/wallet"
                  className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 hover:border-blue-500/40 rounded-xl transition-all group cursor-pointer"
                >
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">My Wallet</p>
                    <p className="text-xs text-gray-400">View balance</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PremiumDashboardLayout>
  );
}
