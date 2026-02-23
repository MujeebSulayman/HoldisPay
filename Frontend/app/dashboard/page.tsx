'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { Skeleton, SkeletonRow } from '@/components/Skeleton';
import { invoiceApi, Invoice } from '@/lib/api/invoice';
import { paymentContractApi, PaymentContract } from '@/lib/api/payment-contract';
import { userApi } from '@/lib/api/user';

type ViewMode = 'overview' | 'employer' | 'contractor';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [stats, setStats] = useState({
    totalRevenue: 0,
    invoices: {
      total: 0,
      pending: 0,
      paid: 0,
    },
    contracts: {
      asEmployer: 0,
      asContractor: 0,
      activeAsEmployer: 0,
      activeAsContractor: 0,
    },
    walletBalance: '0.00',
  });
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [employerContracts, setEmployerContracts] = useState<PaymentContract[]>([]);
  const [contractorContracts, setContractorContracts] = useState<PaymentContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      try {
        const [invoicesResponse, contractsResponse, statsResponse, walletsResponse] = await Promise.all([
          invoiceApi.getUserInvoices(user.id),
          paymentContractApi.getUserContracts().catch(() => ({ success: false, data: null })),
          paymentContractApi.getContractStats().catch(() => ({ success: false, data: null })),
          userApi.getAllWallets(user.id).catch(() => ({ success: false, data: null })),
        ]);

        if (invoicesResponse.success && invoicesResponse.data !== undefined) {
          const raw = invoicesResponse.data as Invoice[] | { issued?: Invoice[]; paying?: Invoice[]; receiving?: Invoice[] };
          const list = Array.isArray(raw)
            ? raw
            : [...(raw.issued ?? []), ...(raw.paying ?? []), ...(raw.receiving ?? [])];
          const seen = new Set<string>();
          const invoices = list.filter((inv) => {
            const id = inv.id ?? inv.invoice_id;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          const byDate = [...invoices].sort(
            (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          );
          setRecentInvoices(byDate.slice(0, 5));

          const totalRevenue = invoices
            .filter((inv) => inv.status === 'completed' || inv.status === 'paid')
            .reduce((sum, inv) => sum + parseFloat(String(inv.amount || '0')), 0);

          setStats((prev) => ({
            ...prev,
            totalRevenue,
            invoices: {
              total: invoices.length,
              pending: invoices.filter((inv) => inv.status === 'pending').length,
              paid: invoices.filter((inv) => inv.status === 'completed' || inv.status === 'paid').length,
            },
          }));
        }

        if (contractsResponse.success && contractsResponse.data && contractsResponse.data.contracts) {
          const contracts = contractsResponse.data.contracts;
          const userWallet = user.walletAddress?.toLowerCase();

          const employer = contracts.filter((c) => c.employer.toLowerCase() === userWallet);
          const contractor = contracts.filter((c) => c.contractor.toLowerCase() === userWallet);

          setEmployerContracts(employer);
          setContractorContracts(contractor);

          setStats((prev) => ({
            ...prev,
            contracts: {
              asEmployer: employer.length,
              asContractor: contractor.length,
              activeAsEmployer: employer.filter((c) => c.status === 'ACTIVE').length,
              activeAsContractor: contractor.filter((c) => c.status === 'ACTIVE').length,
            },
          }));
        }

        if (walletsResponse.success && walletsResponse.data && Array.isArray(walletsResponse.data)) {
          const wallets = walletsResponse.data;
          const totalValue = wallets.reduce((sum, wallet) => {
            const native = parseFloat(wallet.balance?.nativeUSD || '0');
            const tokens = (wallet.balance?.tokens || []).reduce(
              (tSum: number, t) => tSum + parseFloat(t.balanceUSD || '0'),
              0
            );
            return sum + native + tokens;
          }, 0);
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
        <PageLoader />
      </PremiumDashboardLayout>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'paid':
      case 'COMPLETED':
      case 'ACTIVE':
        return 'bg-green-400/10 text-green-400 border-green-400/20';
      case 'pending':
      case 'PAUSED':
        return 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20';
      case 'failed':
      case 'cancelled':
      case 'TERMINATED':
      case 'DEFAULTED':
        return 'bg-red-400/10 text-red-400 border-red-400/20';
      default:
        return 'bg-gray-400/10 text-gray-400 border-gray-400/20';
    }
  };

  return (
    <PremiumDashboardLayout>
      <div className="space-y-6 min-w-0">
        {/* Header with View Toggle */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                Welcome back, {user.firstName}
              </h1>
              <p className="text-sm sm:text-base text-gray-400">
                {viewMode === 'employer' && 'Manage contracts and payments'}
                {viewMode === 'contractor' && 'Track your work and earnings'}
                {viewMode === 'overview' && 'Your complete dashboard'}
              </p>
            </div>

            <a
              href="/dashboard/invoices/create"
              className="w-full sm:w-auto px-4 py-2.5 bg-teal-400 hover:bg-teal-500 text-black font-medium rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="hidden sm:inline">New Invoice</span>
              <span className="sm:hidden">Create Invoice</span>
            </a>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-gray-800/50 rounded-xl overflow-x-auto">
            <button
              onClick={() => setViewMode('overview')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                viewMode === 'overview'
                  ? 'bg-teal-400 text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setViewMode('employer')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                viewMode === 'employer'
                  ? 'bg-teal-400 text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Employer
              {stats.contracts.asEmployer > 0 && (
                <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 bg-black/20 rounded-full text-xs">
                  {stats.contracts.asEmployer}
                </span>
              )}
            </button>
            <button
              onClick={() => setViewMode('contractor')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                viewMode === 'contractor'
                  ? 'bg-teal-400 text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Contractor
              {stats.contracts.asContractor > 0 && (
                <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 bg-black/20 rounded-full text-xs">
                  {stats.contracts.asContractor}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Overview Stats */}
        {viewMode === 'overview' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {isLoading ? (
                [1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-9 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))
              ) : (
                <>
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
                <p className="text-xs text-gray-500 mt-1">From invoices</p>
              </div>

              <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-400">As Employer</p>
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-white">{stats.contracts.asEmployer}</p>
                <p className="text-xs text-gray-500 mt-1">{stats.contracts.activeAsEmployer} active contracts</p>
              </div>

              <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-400">As Contractor</p>
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-white">{stats.contracts.asContractor}</p>
                <p className="text-xs text-gray-500 mt-1">{stats.contracts.activeAsContractor} active contracts</p>
              </div>

              <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-400">Wallet Balance</p>
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-white">${stats.walletBalance}</p>
                <p className="text-xs text-gray-500 mt-1">All chains</p>
              </div>
                </>
              )}
            </div>

            {/* Quick Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Invoices */}
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-white">Recent Invoices</h3>
                  <a href="/dashboard/invoices" className="text-sm text-teal-400 hover:text-teal-300 transition-colors">
                    View All
                  </a>
                </div>

                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <SkeletonRow key={i} />
                    ))}
                  </div>
                ) : recentInvoices.length > 0 ? (
                  <div className="space-y-3">
                    {recentInvoices.map((invoice) => (
                      <a
                        key={invoice.id ?? invoice.invoice_id}
                        href={`/dashboard/invoices/${invoice.invoice_id ?? invoice.id}`}
                        className="block p-4 bg-black/30 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <p className="text-white font-medium text-sm">
                                #{invoice.invoice_id ?? (invoice.id?.slice?.(0, 8) ?? '-')}
                              </p>
                              <span className={`px-2 py-0.5 rounded-lg text-xs font-medium border ${getStatusColor(invoice.status)}`}>
                                {invoice.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 line-clamp-1">{invoice.description || 'No description'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-white">${invoice.amount}</p>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm">No invoices yet</p>
                  </div>
                )}
              </div>

              {/* Recent Contracts */}
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-white">Active Contracts</h3>
                </div>

                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <SkeletonRow key={i} />
                    ))}
                  </div>
                ) : [...employerContracts, ...contractorContracts].filter(c => c.status === 'ACTIVE').length > 0 ? (
                  <div className="space-y-3">
                    {[...employerContracts, ...contractorContracts]
                      .filter(c => c.status === 'ACTIVE')
                      .slice(0, 3)
                      .map((contract) => {
                        const isEmployer = contract.employer.toLowerCase() === user.walletAddress?.toLowerCase();
                        return (
                          <div
                            key={contract.id}
                            className="p-4 bg-black/30 border border-gray-800 rounded-xl"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded-lg text-xs font-medium ${isEmployer ? 'bg-blue-400/10 text-blue-400' : 'bg-purple-400/10 text-purple-400'}`}>
                                  {isEmployer ? 'Employer' : 'Contractor'}
                                </span>
                                <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(contract.status)}`}>
                                  {contract.status}
                                </span>
                              </div>
                              <p className="text-sm font-bold text-white">${(parseFloat(contract.paymentAmount) / 1e18).toFixed(2)}</p>
                            </div>
                            <p className="text-sm text-gray-300 mb-1">{contract.jobTitle || 'Untitled Contract'}</p>
                            <p className="text-xs text-gray-500">{contract.paymentsMade}/{contract.numberOfPayments} payments completed</p>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm">No active contracts</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Employer View */}
        {viewMode === 'employer' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
                <p className="text-sm text-gray-400 mb-2">Total Contracts</p>
                <p className="text-3xl font-bold text-white">{stats.contracts.asEmployer}</p>
                <p className="text-xs text-gray-500 mt-1">Created by you</p>
              </div>

              <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
                <p className="text-sm text-gray-400 mb-2">Active Contracts</p>
                <p className="text-3xl font-bold text-green-400">{stats.contracts.activeAsEmployer}</p>
                <p className="text-xs text-gray-500 mt-1">Currently running</p>
              </div>

              <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
                <p className="text-sm text-gray-400 mb-2">Invoices Sent</p>
                <p className="text-3xl font-bold text-white">{stats.invoices.total}</p>
                <p className="text-xs text-gray-500 mt-1">{stats.invoices.pending} pending</p>
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-6">Your Contracts as Employer</h3>
              {employerContracts.length > 0 ? (
                <div className="space-y-3">
                  {employerContracts.map((contract) => (
                    <div
                      key={contract.id}
                      className="p-5 bg-black/30 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-white font-semibold">{contract.jobTitle || 'Untitled Contract'}</h4>
                            <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(contract.status)}`}>
                              {contract.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 line-clamp-1">{contract.description || 'No description'}</p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                            <span>Contractor: {contract.contractor.slice(0, 6)}...{contract.contractor.slice(-4)}</span>
                            <span>•</span>
                            <span>{contract.releaseType === 'TIME_BASED' ? 'Time-Based' : 'Milestone-Based'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-white mb-1">
                            ${(parseFloat(contract.paymentAmount) / 1e18).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">per payment</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 bg-gray-800 rounded-full h-2">
                          <div
                            className="bg-teal-400 h-2 rounded-full transition-all"
                            style={{
                              width: `${(parseInt(contract.paymentsMade) / parseInt(contract.numberOfPayments)) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 font-medium">
                          {contract.paymentsMade}/{contract.numberOfPayments}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
                  </svg>
                  <p className="text-gray-400 font-medium mb-2">No contracts as employer</p>
                  <p className="text-sm text-gray-500">Create your first payment contract to hire contractors</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contractor View */}
        {viewMode === 'contractor' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
                <p className="text-sm text-gray-400 mb-2">Total Contracts</p>
                <p className="text-3xl font-bold text-white">{stats.contracts.asContractor}</p>
                <p className="text-xs text-gray-500 mt-1">Work contracts</p>
              </div>

              <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
                <p className="text-sm text-gray-400 mb-2">Active Work</p>
                <p className="text-3xl font-bold text-green-400">{stats.contracts.activeAsContractor}</p>
                <p className="text-xs text-gray-500 mt-1">Ongoing projects</p>
              </div>

              <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6">
                <p className="text-sm text-gray-400 mb-2">Invoices Received</p>
                <p className="text-3xl font-bold text-white">{stats.invoices.paid}</p>
                <p className="text-xs text-gray-500 mt-1">Paid invoices</p>
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-6">Your Contracts as Contractor</h3>
              {contractorContracts.length > 0 ? (
                <div className="space-y-3">
                  {contractorContracts.map((contract) => (
                    <div
                      key={contract.id}
                      className="p-5 bg-black/30 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-white font-semibold">{contract.jobTitle || 'Untitled Contract'}</h4>
                            <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(contract.status)}`}>
                              {contract.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 line-clamp-1">{contract.description || 'No description'}</p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                            <span>Employer: {contract.employer.slice(0, 6)}...{contract.employer.slice(-4)}</span>
                            <span>•</span>
                            <span>{contract.releaseType === 'TIME_BASED' ? 'Time-Based' : 'Milestone-Based'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-white mb-1">
                            ${(parseFloat(contract.paymentAmount) / 1e18).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">per payment</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 bg-gray-800 rounded-full h-2">
                          <div
                            className="bg-purple-400 h-2 rounded-full transition-all"
                            style={{
                              width: `${(parseInt(contract.paymentsMade) / parseInt(contract.numberOfPayments)) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 font-medium">
                          {contract.paymentsMade}/{contract.numberOfPayments}
                        </span>
                      </div>
                      {contract.status === 'ACTIVE' && parseInt(contract.paymentsMade) < parseInt(contract.numberOfPayments) && (
                        <button
                          className="mt-4 w-full px-4 py-2 bg-teal-400/10 hover:bg-teal-400/20 border border-teal-400/20 hover:border-teal-400/40 text-teal-400 font-medium rounded-xl transition-all"
                        >
                          Claim Next Payment
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                  </svg>
                  <p className="text-gray-400 font-medium mb-2">No contracts as contractor</p>
                  <p className="text-sm text-gray-500">You'll see work contracts here when you're hired</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PremiumDashboardLayout>
  );
}
