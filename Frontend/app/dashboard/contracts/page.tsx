'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { paymentContractApi, PaymentContract } from '@/lib/api/payment-contract';

type FilterType = 'all' | 'employer' | 'contractor';
type StatusFilter = 'all' | 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'TERMINATED';

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  ACTIVE: { label: 'Active', dot: 'bg-emerald-500', text: 'text-emerald-400' },
  DRAFT: { label: 'Draft', dot: 'bg-amber-500', text: 'text-amber-400' },
  PAUSED: { label: 'Paused', dot: 'bg-yellow-500', text: 'text-yellow-400' },
  COMPLETED: { label: 'Completed', dot: 'bg-sky-500', text: 'text-sky-400' },
  TERMINATED: { label: 'Terminated', dot: 'bg-red-500', text: 'text-red-400' },
  DEFAULTED: { label: 'Defaulted', dot: 'bg-red-500', text: 'text-red-400' },
};

function formatAmount(s: string): string {
  const n = parseFloat(s);
  return n >= 1e15 ? (n / 1e18).toFixed(2) : n.toFixed(2);
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function ContractsPage() {
  const { user, loading } = useAuth();
  const [contracts, setContracts] = useState<PaymentContract[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fundModalContractId, setFundModalContractId] = useState<string | null>(null);
  const [fundLinkLoading, setFundLinkLoading] = useState(false);
  const [fundLinkError, setFundLinkError] = useState<string | null>(null);
  const [viewContractId, setViewContractId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const fetchContracts = async () => {
      try {
        const response = await paymentContractApi.getUserContracts();
        if (response.success && response.data && Array.isArray((response.data as { contracts?: PaymentContract[] }).contracts)) {
          setContracts((response.data as { contracts: PaymentContract[] }).contracts);
        }
      } catch (error) {
        console.error('Failed to fetch contracts:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchContracts();
  }, [user]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await paymentContractApi.deleteContract(id);
      if (res.success) {
        setContracts((prev) => prev.filter((c) => c.id !== id));
        setDeleteConfirmId(null);
      } else {
        setActionError((res as { error?: string }).error || 'Failed to delete');
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to delete contract');
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenFundCheckout = async (contractId: string) => {
    setFundLinkLoading(true);
    setFundLinkError(null);
    try {
      const res = await paymentContractApi.createFundLink(contractId);
      if (res.success && res.data?.data?.paymentLinkUrl) {
        window.open(res.data.data.paymentLinkUrl, '_blank', 'noopener,noreferrer');
        setFundModalContractId(null);
      } else {
        setFundLinkError((res as { error?: string }).error || 'Could not create payment link');
      }
    } catch (e) {
      setFundLinkError(e instanceof Error ? e.message : 'Failed to open checkout');
    } finally {
      setFundLinkLoading(false);
    }
  };

  const filteredContracts = contracts.filter((contract) => {
    const userWallet = user?.walletAddress?.toLowerCase();
    const isEmployer = contract.employer.toLowerCase() === userWallet;
    const isContractor = contract.contractor.toLowerCase() === userWallet;
    const roleMatch = filter === 'all' || (filter === 'employer' && isEmployer) || (filter === 'contractor' && isContractor);
    const statusMatch = statusFilter === 'all' || contract.status === statusFilter;
    return roleMatch && statusMatch;
  });

  const asEmployerCount = contracts.filter((c) => c.employer.toLowerCase() === user?.walletAddress?.toLowerCase()).length;
  const asContractorCount = contracts.filter((c) => c.contractor.toLowerCase() === user?.walletAddress?.toLowerCase()).length;
  const activeCount = contracts.filter((c) => c.status === 'ACTIVE').length;

  function getCounterpartyName(contract: PaymentContract, isEmployer: boolean): string {
    const name = isEmployer ? contract.contractorDisplayName : contract.employerDisplayName;
    return name?.trim() || '—';
  }

  if (loading || !user) {
    return (
      <PremiumDashboardLayout>
        <PageLoader />
      </PremiumDashboardLayout>
    );
  }

  return (
    <PremiumDashboardLayout>
      <div className="min-w-0 max-w-6xl mx-auto">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Contracts</h1>
            <p className="mt-1 text-sm text-zinc-500">Payment agreements and escrow</p>
          </div>
          <Link
            href="/dashboard/contracts/create"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-black text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New contract
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total</p>
            <p className="mt-0.5 text-xl font-semibold text-white">{contracts.length}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">As employer</p>
            <p className="mt-0.5 text-xl font-semibold text-blue-400">{asEmployerCount}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">As contractor</p>
            <p className="mt-0.5 text-xl font-semibold text-violet-400">{asContractorCount}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Active</p>
            <p className="mt-0.5 text-xl font-semibold text-emerald-400">{activeCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/30 p-0.5">
            {(['all', 'employer', 'contractor'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === f ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {f === 'all' ? 'All' : f === 'employer' ? 'Employer' : 'Contractor'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/30 p-0.5">
            {(['all', 'DRAFT', 'ACTIVE', 'COMPLETED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  statusFilter === s ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {s === 'all' ? 'All' : s === 'DRAFT' ? 'Draft' : s === 'ACTIVE' ? 'Active' : 'Completed'}
              </button>
            ))}
          </div>
          <span className="text-sm text-zinc-500 ml-auto">
            {filteredContracts.length} {filteredContracts.length === 1 ? 'contract' : 'contracts'}
          </span>
        </div>

        {actionError && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="text-sm text-red-400">{actionError}</p>
            <button onClick={() => setActionError(null)} className="text-sm text-red-400 hover:text-red-300">
              Dismiss
            </button>
          </div>
        )}

        {/* View contract modal */}
        {viewContractId && (() => {
          const contract = filteredContracts.find((c) => c.id === viewContractId);
          if (!contract) return null;
          const isEmployer = contract.employer.toLowerCase() === user?.walletAddress?.toLowerCase();
          const counterpartyName = getCounterpartyName(contract, isEmployer);
          const numPayments = parseInt(contract.numberOfPayments, 10) || 1;
          const progress = numPayments > 0 ? (parseInt(contract.paymentsMade, 10) / numPayments) * 100 : 0;
          const statusConf = STATUS_CONFIG[contract.status] ?? { label: contract.status, dot: 'bg-zinc-500', text: 'text-zinc-400' };
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setViewContractId(null)}>
              <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-lg font-semibold text-white">{contract.jobTitle || 'Untitled contract'}</h3>
                  <button onClick={() => setViewContractId(null)} className="p-1 rounded text-zinc-400 hover:bg-zinc-700 hover:text-white">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-zinc-500">Counterparty</span><span className="text-white">{counterpartyName}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Your role</span><span className={isEmployer ? 'text-blue-400' : 'text-violet-400'}>{isEmployer ? 'Employer' : 'Contractor'}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Status</span><span className={`inline-flex items-center gap-1.5 ${statusConf.text}`}><span className={`h-1.5 w-1.5 rounded-full ${statusConf.dot}`} />{statusConf.label}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Amount per payment</span><span className="text-white">${formatAmount(contract.paymentAmount)}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Total</span><span className="text-white">{contract.isOngoing ? 'Ongoing' : `$${formatAmount(contract.totalAmount)}`}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Progress</span><span className="text-white">{contract.paymentsMade} / {contract.numberOfPayments} payments</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Started</span><span className="text-white">{formatDate(contract.startDate)}</span></div>
                  {contract.description && <div className="pt-2 border-t border-zinc-800"><span className="text-zinc-500 block mb-1">Description</span><p className="text-zinc-300">{contract.description}</p></div>}
                </div>
                <div className="mt-4 h-1.5 rounded-full bg-zinc-700 overflow-hidden"><div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(100, progress)}%` }} /></div>
                <div className="mt-6 flex flex-wrap gap-2">
                  {contract.status === 'DRAFT' && isEmployer && (
                    <>
                      <button onClick={() => { setFundModalContractId(contract.id); setFundLinkError(null); setViewContractId(null); }} className="rounded-lg bg-teal-500 px-3 py-2 text-sm font-medium text-black hover:bg-teal-400">Fund contract</button>
                      <Link href={`/dashboard/contracts/create?id=${contract.id}`} className="rounded-lg border border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800">Edit</Link>
                      {deleteConfirmId === contract.id ? (
                        <span className="flex items-center gap-2">
                          <button onClick={() => handleDelete(contract.id)} disabled={deletingId === contract.id} className="text-sm text-red-400 hover:text-red-300">Confirm delete</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="text-sm text-zinc-400 hover:text-white">Cancel</button>
                        </span>
                      ) : (
                        <button onClick={() => setDeleteConfirmId(contract.id)} className="rounded-lg border border-red-500/30 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10">Delete</button>
                      )}
                    </>
                  )}
                  {contract.status === 'ACTIVE' && !isEmployer && <button className="rounded-lg bg-teal-500/20 border border-teal-500/30 px-3 py-2 text-sm font-medium text-teal-400">Claim payment</button>}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Fund modal */}
        {fundModalContractId && (() => {
          const contract = filteredContracts.find((c) => c.id === fundModalContractId);
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
              onClick={() => !fundLinkLoading && setFundModalContractId(null)}
            >
              <div
                className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-white">Fund contract</h3>
                {contract ? (
                  <>
                    <p className="mt-1 text-sm text-zinc-400">{contract.jobTitle || 'Untitled'}</p>
                    <p className="mt-3 text-2xl font-semibold text-white">${formatAmount(contract.totalAmount)}</p>
                    <p className="mt-2 text-sm text-zinc-500">
                      You’ll complete payment in Blockrader checkout. The contract will become active after payment.
                    </p>
                    {fundLinkError && <p className="mt-2 text-sm text-red-400">{fundLinkError}</p>}
                    <div className="mt-6 flex gap-3">
                      <button
                        onClick={() => handleOpenFundCheckout(contract.id)}
                        disabled={fundLinkLoading}
                        className="flex-1 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-black font-medium text-sm"
                      >
                        {fundLinkLoading ? 'Opening…' : 'Open checkout'}
                      </button>
                      <button
                        onClick={() => setFundModalContractId(null)}
                        disabled={fundLinkLoading}
                        className="py-2.5 px-4 rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-zinc-400">Contract not found.</p>
                )}
              </div>
            </div>
          );
        })()}

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-teal-500" />
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
              <svg className="h-6 w-6 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="mt-4 text-base font-medium text-white">No contracts</h3>
            <p className="mt-1 text-sm text-zinc-500">
              {filter !== 'all' || statusFilter !== 'all'
                ? 'No contracts match the current filters.'
                : 'Create a contract to start a payment agreement.'}
            </p>
            <Link
              href="/dashboard/contracts/create"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-medium text-black hover:bg-teal-400"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New contract
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Contract</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Counterparty</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Role</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Progress</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filteredContracts.map((contract) => {
                    const isEmployer = contract.employer.toLowerCase() === user?.walletAddress?.toLowerCase();
                    const numPayments = parseInt(contract.numberOfPayments, 10) || 1;
                    const progress = numPayments > 0 ? (parseInt(contract.paymentsMade, 10) / numPayments) * 100 : 0;
                    const statusConf = STATUS_CONFIG[contract.status] ?? { label: contract.status, dot: 'bg-zinc-500', text: 'text-zinc-400' };
                    const counterpartyName = getCounterpartyName(contract, isEmployer);

                    return (
                      <tr key={contract.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-medium text-white">{contract.jobTitle || 'Untitled'}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {contract.releaseType === 'TIME_BASED' ? 'Time-based' : 'Milestone'} · Started {formatDate(contract.startDate)}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-zinc-300">{counterpartyName}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${isEmployer ? 'bg-blue-500/10 text-blue-400' : 'bg-violet-500/10 text-violet-400'}`}>
                            {isEmployer ? 'Employer' : 'Contractor'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 text-sm ${statusConf.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusConf.dot}`} />
                            {statusConf.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-semibold text-white">${formatAmount(contract.paymentAmount)}</span>
                          <span className="text-zinc-500 text-sm">/pay</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 max-w-[120px]">
                            <div className="flex-1 h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-teal-500"
                                style={{ width: `${Math.min(100, progress)}%` }}
                              />
                            </div>
                            <span className="text-xs text-zinc-500 shrink-0">{contract.paymentsMade}/{contract.numberOfPayments}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button onClick={() => setViewContractId(contract.id)} className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white">
                              View
                            </button>
                            {contract.status === 'DRAFT' && isEmployer && (
                              <>
                                <button onClick={() => { setFundModalContractId(contract.id); setFundLinkError(null); }} className="rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-teal-400">
                                  Fund
                                </button>
                                <Link href={`/dashboard/contracts/create?id=${contract.id}`} className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white">
                                  Edit
                                </Link>
                                {deleteConfirmId === contract.id ? (
                                  <>
                                    <button onClick={() => handleDelete(contract.id)} disabled={deletingId === contract.id} className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50">{deletingId === contract.id ? 'Deleting…' : 'Confirm'}</button>
                                    <button onClick={() => setDeleteConfirmId(null)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-700">Cancel</button>
                                  </>
                                ) : (
                                  <button onClick={() => setDeleteConfirmId(contract.id)} className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10">
                                    Delete
                                  </button>
                                )}
                              </>
                            )}
                            {contract.status === 'ACTIVE' && !isEmployer && (
                              <button className="rounded-lg bg-teal-500/20 border border-teal-500/30 px-3 py-1.5 text-xs font-medium text-teal-400 hover:bg-teal-500/30">
                                Claim payment
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-zinc-800">
              {filteredContracts.map((contract) => {
                const isEmployer = contract.employer.toLowerCase() === user?.walletAddress?.toLowerCase();
                const numPayments = parseInt(contract.numberOfPayments, 10) || 1;
                const progress = numPayments > 0 ? (parseInt(contract.paymentsMade, 10) / numPayments) * 100 : 0;
                const statusConf = STATUS_CONFIG[contract.status] ?? { label: contract.status, dot: 'bg-zinc-500', text: 'text-zinc-400' };
                const counterpartyName = getCounterpartyName(contract, isEmployer);

                return (
                  <div key={contract.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-white">{contract.jobTitle || 'Untitled'}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{counterpartyName}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-sm shrink-0 ${statusConf.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusConf.dot}`} />
                        {statusConf.label}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-zinc-400">
                        ${formatAmount(contract.paymentAmount)}/pay · {contract.paymentsMade}/{contract.numberOfPayments}
                      </span>
                      <span className={isEmployer ? 'text-blue-400' : 'text-violet-400'}>
                        {isEmployer ? 'Employer' : 'Contractor'}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                      <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(100, progress)}%` }} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => setViewContractId(contract.id)} className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800">
                        View
                      </button>
                      {contract.status === 'DRAFT' && isEmployer && (
                        <>
                          <button onClick={() => { setFundModalContractId(contract.id); setFundLinkError(null); }} className="rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-medium text-black hover:bg-teal-400">
                            Fund
                          </button>
                          <Link href={`/dashboard/contracts/create?id=${contract.id}`} className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800">
                            Edit
                          </Link>
                          {deleteConfirmId === contract.id ? (
                            <span className="flex items-center gap-2">
                              <button onClick={() => handleDelete(contract.id)} disabled={deletingId === contract.id} className="text-sm text-red-400">{deletingId === contract.id ? 'Deleting…' : 'Confirm'}</button>
                              <button onClick={() => setDeleteConfirmId(null)} className="text-sm text-zinc-400">Cancel</button>
                            </span>
                          ) : (
                            <button onClick={() => setDeleteConfirmId(contract.id)} className="text-sm text-red-400 hover:text-red-300">
                              Delete
                            </button>
                          )}
                        </>
                      )}
                      {contract.status === 'ACTIVE' && !isEmployer && (
                        <button className="rounded-lg bg-teal-500/20 border border-teal-500/30 px-3 py-1.5 text-sm font-medium text-teal-400 hover:bg-teal-500/10">
                          Claim payment
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* How it works - compact */}
        <details className="mt-8 group">
          <summary className="cursor-pointer text-sm font-medium text-zinc-500 hover:text-zinc-400 list-none flex items-center gap-2">
            <svg className="h-4 w-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            How payment contracts work
          </summary>
          <ol className="mt-3 ml-6 space-y-2 text-sm text-zinc-500 border-l border-zinc-700 pl-4">
            <li><strong className="text-zinc-400">Create</strong> — Add contractor, amount, and schedule. Saved as Draft.</li>
            <li><strong className="text-zinc-400">Fund</strong> — As employer, deposit the total via checkout. Contract becomes Active.</li>
            <li><strong className="text-zinc-400">Work</strong> — Contractor completes work or milestones.</li>
            <li><strong className="text-zinc-400">Claim</strong> — Contractor claims payments as they’re released.</li>
          </ol>
        </details>
      </div>
    </PremiumDashboardLayout>
  );
}
