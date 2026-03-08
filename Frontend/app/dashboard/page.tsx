'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { Skeleton, SkeletonRow } from '@/components/Skeleton';
import { invoiceApi, Invoice } from '@/lib/api/invoice';
import { paymentContractApi, PaymentContract } from '@/lib/api/payment-contract';
import { userApi } from '@/lib/api/user';

type ViewMode = 'overview' | 'employer' | 'contractor';

const CONTRACT_STATUS: Record<string, { label: string; class: string; accent: string }> = {
  ACTIVE: { label: 'Active', class: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', accent: 'border-l-emerald-500' },
  DRAFT: { label: 'Draft', class: 'bg-amber-500/15 text-amber-400 border-amber-500/30', accent: 'border-l-amber-500' },
  PAUSED: { label: 'Paused', class: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', accent: 'border-l-yellow-500' },
  COMPLETED: { label: 'Completed', class: 'bg-sky-500/15 text-sky-400 border-sky-500/30', accent: 'border-l-sky-500' },
  TERMINATED: { label: 'Terminated', class: 'bg-red-500/15 text-red-400 border-red-500/30', accent: 'border-l-red-500' },
  DEFAULTED: { label: 'Defaulted', class: 'bg-red-500/15 text-red-400 border-red-500/30', accent: 'border-l-red-500' },
};

function formatContractAmount(s: string): string {
  const n = parseFloat(s);
  return n >= 1e15 ? (n / 1e18).toFixed(2) : n.toFixed(2);
}

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
      totalFundedAsEmployer: 0,
    },
  });
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [employerContracts, setEmployerContracts] = useState<PaymentContract[]>([]);
  const [contractorContracts, setContractorContracts] = useState<PaymentContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      try {
        const [invoicesResponse, contractsResponse, statsResponse, balanceResponse] = await Promise.all([
          invoiceApi.getUserInvoices(user.id),
          paymentContractApi.getUserContracts().catch(() => ({ success: false, data: null })),
          paymentContractApi.getContractStats().catch(() => ({ success: false, data: null })),
          userApi.getConsolidatedBalance(user.id).catch(() => ({ success: false, data: null })),
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

          setStats((prev) => ({
            ...prev,
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

          const totalFundedAsEmployer = employer
            .filter((c) => c.status !== 'DRAFT')
            .reduce((sum, c) => sum + parseFloat(c.totalAmount || '0'), 0);

          setStats((prev) => ({
            ...prev,
            contracts: {
              asEmployer: employer.length,
              asContractor: contractor.length,
              activeAsEmployer: employer.filter((c) => c.status === 'ACTIVE').length,
              activeAsContractor: contractor.filter((c) => c.status === 'ACTIVE').length,
              totalFundedAsEmployer,
            },
          }));
        }

        const balanceData = balanceResponse.success ? balanceResponse.data : undefined;
        if (balanceData != null && balanceData.withdrawableUsd != null) {
          setStats((prev) => ({
            ...prev,
            totalRevenue: Number(balanceData.withdrawableUsd),
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
      case 'expired':
        return 'bg-gray-400/10 text-gray-400 border-gray-400/20';
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
                {viewMode === 'employer' && 'Manage contracts you fund'}
                {viewMode === 'contractor' && 'Track your incoming payments'}
                {viewMode === 'overview' && 'Your complete dashboard'}
              </p>
            </div>

            <a
              href="/dashboard/invoices/create"
              className="w-full sm:w-auto px-4 py-2.5 bg-teal-400 hover:bg-teal-500 text-black font-medium rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="hidden sm:inline">New Invoice</span>
              <span className="sm:hidden">Create Invoice</span>
            </a>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-gray-800/50 rounded-lg overflow-x-auto">
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
              Recipient
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
                  <div key={i} className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-9 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))
              ) : (
                <>
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6">
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

              <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-400">As Employer</p>
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-white">${(stats.contracts.totalFundedAsEmployer >= 1e15 ? stats.contracts.totalFundedAsEmployer / 1e18 : stats.contracts.totalFundedAsEmployer).toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">{stats.contracts.asEmployer} contracts, amount funded</p>
              </div>

              <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-400">As Recipient</p>
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-white">{stats.contracts.asContractor}</p>
                <p className="text-xs text-gray-500 mt-1">{stats.contracts.activeAsContractor} active</p>
              </div>

              <a href="/dashboard/invoices" className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6 block hover:border-gray-700 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-400">Pending Invoices</p>
                  <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-bold text-white">{stats.invoices.pending}</p>
                <p className="text-xs text-gray-500 mt-1">Awaiting payment →</p>
              </a>
                </>
              )}
            </div>

            {/* Quick Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Invoices */}
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6">
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
                        className="block p-4 bg-black/30 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
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
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6">
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
                          <Link
                            key={contract.id}
                            href={`/dashboard/contracts/${contract.id}`}
                            className="block p-4 bg-black/30 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded-lg text-xs font-medium ${isEmployer ? 'bg-blue-400/10 text-blue-400' : 'bg-purple-400/10 text-purple-400'}`}>
                                  {isEmployer ? 'Employer' : 'Recipient'}
                                </span>
                                <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(contract.status)}`}>
                                  {contract.status}
                                </span>
                              </div>
                              <p className="text-sm font-bold text-white">${formatContractAmount(contract.paymentAmount)}</p>
                            </div>
                            <p className="text-sm text-gray-300 mb-1">{contract.jobTitle || 'Untitled Contract'}</p>
                            <p className="text-xs text-gray-500">{contract.paymentsMade}/{contract.numberOfPayments} payments completed</p>
                          </Link>
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

        {/* Employer View — Contracts you fund */}
        {viewMode === 'employer' && (
          <div className="space-y-6 min-w-0">
            {/* Summary bar + actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-white truncate">Contracts you fund</h2>
                <p className="mt-1 text-xs sm:text-sm text-zinc-500">
                  {stats.contracts.asEmployer} total · {stats.contracts.activeAsEmployer} active · ${(stats.contracts.totalFundedAsEmployer >= 1e15 ? stats.contracts.totalFundedAsEmployer / 1e18 : stats.contracts.totalFundedAsEmployer).toFixed(2)} funded
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Link
                  href="/dashboard/contracts"
                  className="px-3 py-2 sm:px-4 text-sm font-medium text-zinc-300 hover:text-white border border-zinc-600 hover:border-zinc-500 rounded-lg transition-colors"
                >
                  View all
                </Link>
                <Link
                  href="/dashboard/contracts/create"
                  className="px-3 py-2 sm:px-4 text-sm font-semibold bg-teal-500 hover:bg-teal-400 text-black rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  New contract
                </Link>
              </div>
            </div>

            {employerContracts.length > 0 ? (
              <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2 min-w-0">
                {[...employerContracts]
                  .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
                  .map((contract) => {
                  const numPayments = parseInt(contract.numberOfPayments, 10) || 1;
                  const progress = numPayments > 0 ? (parseInt(contract.paymentsMade, 10) / numPayments) * 100 : 0;
                  const statusConf = CONTRACT_STATUS[contract.status] ?? {
                    label: contract.status,
                    class: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
                    accent: 'border-l-zinc-500',
                  };
                  return (
                    <Link
                      key={contract.id}
                      href={`/dashboard/contracts/${contract.id}`}
                      className={`group block rounded-lg border border-zinc-800 bg-zinc-900/40 border-l-4 ${statusConf.accent} p-4 sm:p-5 transition-all hover:bg-zinc-900/60 hover:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 min-w-0 overflow-hidden`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-2 sm:mb-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base sm:text-lg font-semibold text-white truncate group-hover:text-teal-400 transition-colors">
                            {contract.jobTitle || 'Untitled contract'}
                          </h3>
                          <p className="text-xs sm:text-sm text-zinc-400 line-clamp-2 mt-0.5 min-w-0">{contract.description || 'No description'}</p>
                        </div>
                        <span className={`shrink-0 self-start sm:self-auto rounded-full border px-2 py-0.5 sm:px-2.5 sm:py-1 text-xs font-semibold uppercase tracking-wide ${statusConf.class}`}>
                          {statusConf.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500 mb-3 sm:mb-4">
                        <span className="truncate min-w-0">Recipient {contract.contractorDisplayName?.trim() || `${contract.contractor.slice(0, 6)}…${contract.contractor.slice(-4)}`}</span>
                        <span className="text-zinc-600 shrink-0">·</span>
                        <span className="shrink-0">{contract.releaseType === 'TIME_BASED' ? 'Time-based' : 'Project-based'}</span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="flex-1 min-w-0 h-2 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-teal-500 transition-all"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs sm:text-sm font-medium tabular-nums text-zinc-400 shrink-0">
                          {contract.paymentsMade}/{contract.numberOfPayments}
                        </span>
                      </div>
                      <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                        <span className="text-xs text-zinc-500">Per payment</span>
                        <span className="text-base sm:text-lg font-bold text-white tabular-nums">${formatContractAmount(contract.paymentAmount)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 border-dashed p-12 text-center">
                <div className="w-14 h-14 mx-auto rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <p className="text-zinc-300 font-medium mb-1">No contracts as employer</p>
                <p className="text-sm text-zinc-500 mb-6 max-w-sm mx-auto">Create a contract, fund escrow, then approve work and release payment.</p>
                <Link
                  href="/dashboard/contracts/create"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-black font-semibold rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Create contract
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Recipient View — Contracts you're paid from */}
        {viewMode === 'contractor' && (
          <div className="space-y-6 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-white truncate">Contracts you're paid from</h2>
                <p className="mt-1 text-xs sm:text-sm text-zinc-500">
                  {stats.contracts.asContractor} total · {stats.contracts.activeAsContractor} active
                </p>
              </div>
              <Link
                href="/dashboard/contracts"
                className="px-3 py-2 sm:px-4 text-sm font-medium text-zinc-300 hover:text-white border border-zinc-600 hover:border-zinc-500 rounded-lg transition-colors w-fit shrink-0"
              >
                View all
              </Link>
            </div>

            {contractorContracts.length > 0 ? (
              <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2 min-w-0">
                {[...contractorContracts]
                  .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
                  .map((contract) => {
                  const numPayments = parseInt(contract.numberOfPayments, 10) || 1;
                  const progress = numPayments > 0 ? (parseInt(contract.paymentsMade, 10) / numPayments) * 100 : 0;
                  const statusConf = CONTRACT_STATUS[contract.status] ?? {
                    label: contract.status,
                    class: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
                    accent: 'border-l-zinc-500',
                  };
                  const canClaim = contract.status === 'ACTIVE' && parseInt(contract.paymentsMade) < parseInt(contract.numberOfPayments);
                  return (
                    <Link
                      key={contract.id}
                      href={`/dashboard/contracts/${contract.id}`}
                      className={`group block rounded-lg border border-zinc-800 bg-zinc-900/40 border-l-4 ${statusConf.accent} p-4 sm:p-5 transition-all hover:bg-zinc-900/60 hover:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 min-w-0 overflow-hidden`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-2 sm:mb-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base sm:text-lg font-semibold text-white truncate group-hover:text-teal-400 transition-colors">
                            {contract.jobTitle || 'Untitled contract'}
                          </h3>
                          <p className="text-xs sm:text-sm text-zinc-400 line-clamp-2 mt-0.5 min-w-0">{contract.description || 'No description'}</p>
                        </div>
                        <span className={`shrink-0 self-start sm:self-auto rounded-full border px-2 py-0.5 sm:px-2.5 sm:py-1 text-xs font-semibold uppercase tracking-wide ${statusConf.class}`}>
                          {statusConf.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500 mb-3 sm:mb-4">
                        <span className="truncate min-w-0">Employer {contract.employerDisplayName?.trim() || `${contract.employer.slice(0, 6)}…${contract.employer.slice(-4)}`}</span>
                        <span className="text-zinc-600 shrink-0">·</span>
                        <span className="shrink-0">{contract.releaseType === 'TIME_BASED' ? 'Time-based' : 'Project-based'}</span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="flex-1 min-w-0 h-2 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-violet-500 transition-all"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs sm:text-sm font-medium tabular-nums text-zinc-400 shrink-0">
                          {contract.paymentsMade}/{contract.numberOfPayments}
                        </span>
                      </div>
                      <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                        <span className="text-xs text-zinc-500">Per payment</span>
                        <span className="text-base sm:text-lg font-bold text-white tabular-nums">${formatContractAmount(contract.paymentAmount)}</span>
                      </div>
                      {canClaim && (
                        <span className="mt-2 sm:mt-3 block w-full py-2 text-center text-xs sm:text-sm font-medium text-teal-400 border border-teal-500/30 rounded-lg group-hover:bg-teal-500/10 transition-colors">
                          Claim next payment →
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 border-dashed p-12 text-center">
                <div className="w-14 h-14 mx-auto rounded-lg bg-violet-500/10 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                  </svg>
                </div>
                <p className="text-zinc-300 font-medium mb-1">No contracts as recipient</p>
                <p className="text-sm text-zinc-500 max-w-sm mx-auto">Contracts where you're the payee will appear here.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </PremiumDashboardLayout>
  );
}
