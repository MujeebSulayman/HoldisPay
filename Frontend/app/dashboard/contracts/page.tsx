'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { paymentContractApi, PaymentContract } from '@/lib/api/payment-contract';

type FilterType = 'all' | 'employer' | 'contractor';
type StatusFilter = 'all' | 'DRAFT' | 'ACTIVE' | 'COMPLETED';

const STATUS_MAP: Record<string, { label: string; class: string; accent: string }> = {
  ACTIVE: { label: 'Active', class: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', accent: 'border-l-emerald-500' },
  DRAFT: { label: 'Draft', class: 'bg-amber-500/15 text-amber-400 border-amber-500/30', accent: 'border-l-amber-500' },
  PAUSED: { label: 'Paused', class: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', accent: 'border-l-yellow-500' },
  COMPLETED: { label: 'Completed', class: 'bg-sky-500/15 text-sky-400 border-sky-500/30', accent: 'border-l-sky-500' },
  TERMINATED: { label: 'Terminated', class: 'bg-red-500/15 text-red-400 border-red-500/30', accent: 'border-l-red-500' },
  DEFAULTED: { label: 'Defaulted', class: 'bg-red-500/15 text-red-400 border-red-500/30', accent: 'border-l-red-500' },
};

function formatAmount(s: string): string {
  const n = parseFloat(s);
  return n >= 1e15 ? (n / 1e18).toFixed(2) : n.toFixed(2);
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const DESCRIPTION_PREVIEW_LENGTH = 100;

function truncateDescription(text: string, maxLen: number = DESCRIPTION_PREVIEW_LENGTH): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen).trim() + '…';
}

function ContractCard({
  contract,
  isEmployer,
  counterpartyName,
  onFund,
  onDelete,
  deleteConfirmId,
  deletingId,
  setDeleteConfirmId,
  openMenuId,
  setOpenMenuId,
  userWallet,
}: {
  contract: PaymentContract;
  isEmployer: boolean;
  counterpartyName: string;
  onFund: () => void;
  onDelete: (id: string) => void;
  deleteConfirmId: string | null;
  deletingId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  userWallet: string;
}) {
  const router = useRouter();
  const numPayments = parseInt(contract.numberOfPayments, 10) || 1;
  const progress = numPayments > 0 ? (parseInt(contract.paymentsMade, 10) / numPayments) * 100 : 0;
  const statusConf = STATUS_MAP[contract.status] ?? { label: contract.status, class: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30', accent: 'border-l-zinc-500' };
  const isMenuOpen = openMenuId === contract.id;
  const isDeleteMode = deleteConfirmId === contract.id;
  const showMoreMenu = (contract.status === 'DRAFT' && isEmployer) || (contract.status === 'ACTIVE' && !isEmployer);

  return (
    <article
      className={`group relative rounded-2xl border border-zinc-800 bg-zinc-900/40 border-l-4 ${statusConf.accent} transition-all hover:bg-zinc-900/60 hover:border-zinc-700 overflow-hidden shadow-sm hover:shadow-md`}
      onClick={() => router.push(`/dashboard/contracts/${contract.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/dashboard/contracts/${contract.id}`)}
    >
      <div className="p-0">
        {/* Row 1: title + status — full width, clear hierarchy */}
        <div className="flex items-center justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
          <h3 className="text-lg font-semibold text-white truncate min-w-0 flex-1">
            {contract.jobTitle || 'Untitled contract'}
          </h3>
          <span className={`shrink-0 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusConf.class}`}>
            {statusConf.label}
          </span>
        </div>

        {/* Row 2: counterparty + role — styled strip */}
        <div className="mt-3 flex flex-wrap items-center gap-3 px-5 sm:px-6">
          <span className="text-sm text-zinc-400">
            With <span className="font-medium text-zinc-300">{counterpartyName}</span>
          </span>
          <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${isEmployer ? 'bg-blue-500/20 text-blue-400' : 'bg-violet-500/20 text-violet-400'}`}>
            {isEmployer ? 'Employer' : 'Contractor'}
          </span>
        </div>

        {/* Row 3: meta — pill-style items in a bar */}
        <div className="mt-4 mx-5 sm:mx-6 rounded-xl bg-zinc-800/60 border border-zinc-700/60 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="text-zinc-500 text-xs uppercase tracking-wider">Pay</span>
              <span className="font-semibold tabular-nums text-zinc-300">${formatAmount(contract.paymentAmount)}</span>
            </span>
            <span className="h-4 w-px bg-zinc-600 shrink-0" aria-hidden />
            <span className="text-zinc-400">
              <span className="font-medium tabular-nums text-zinc-300">{contract.paymentsMade}</span>
              <span className="text-zinc-500">/{contract.numberOfPayments} paid</span>
            </span>
            <span className="h-4 w-px bg-zinc-600 shrink-0" aria-hidden />
            <span className="text-zinc-500 text-xs">{formatDate(contract.startDate)}</span>
            <span className="h-4 w-px bg-zinc-600 shrink-0" aria-hidden />
            <span className="rounded-md bg-zinc-700/80 px-2 py-0.5 text-xs font-medium text-zinc-400">
              {contract.releaseType === 'TIME_BASED' ? 'Time-based' : 'Milestone'}
            </span>
            <span className="h-4 w-px bg-zinc-600 shrink-0" aria-hidden />
            <span className="text-zinc-400 font-medium tabular-nums">
              {contract.isOngoing ? 'Ongoing' : `$${formatAmount(contract.totalAmount)}`}
            </span>
            <span className="h-4 w-px bg-zinc-600 shrink-0" aria-hidden />
            <span className="flex items-center gap-2 ml-auto">
              <span className="w-14 h-2 rounded-full bg-zinc-700 overflow-hidden">
                <span
                  className="h-full rounded-full bg-teal-500 block transition-all duration-300"
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </span>
              <span className="text-xs font-bold tabular-nums text-teal-400 w-8">{Math.round(progress)}%</span>
            </span>
          </div>
        </div>

        {contract.description && (
          <p className="mt-3 mx-5 sm:mx-6 mb-1 px-3 py-2 rounded-lg bg-zinc-800/30 border-l-2 border-zinc-600 text-sm text-zinc-500 truncate">
            {truncateDescription(contract.description)}
          </p>
        )}

        {/* Actions bar — full width, clear separation */}
        <div
          className="mt-5 pt-4 mx-5 sm:mx-6 pb-5 sm:pb-6 border-t border-zinc-700/80 flex flex-wrap items-center justify-end gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/contracts/${contract.id}`); }}
            className="rounded-xl bg-teal-500/20 border border-teal-500/50 px-5 py-2.5 text-sm font-semibold text-teal-400 hover:bg-teal-500/30 hover:border-teal-500/70 transition-colors cursor-pointer"
          >
            View
          </button>
          {contract.status === 'DRAFT' && isEmployer && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onFund(); }}
                className="rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-teal-400 transition-colors cursor-pointer"
              >
                Fund
              </button>
              <Link
                href={`/dashboard/contracts/create?id=${contract.id}`}
                onClick={(e) => e.stopPropagation()}
                className="rounded-xl border border-zinc-600 bg-zinc-800/60 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer inline-flex"
              >
                Edit
              </Link>
            </>
          )}
          {showMoreMenu && (
            <div className="relative" data-dropdown-id={contract.id}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : contract.id); }}
                className="rounded-xl border border-zinc-600 bg-zinc-800/60 p-2.5 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer"
                aria-expanded={isMenuOpen}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                </svg>
              </button>
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-20 min-w-44 rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl py-1.5">
                  {contract.status === 'ACTIVE' && !isEmployer && (
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                    >
                      Claim payment
                    </button>
                  )}
                  {contract.status === 'DRAFT' && isEmployer && (
                    isDeleteMode ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onDelete(contract.id); setOpenMenuId(null); }}
                          disabled={deletingId === contract.id}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 cursor-pointer disabled:opacity-50"
                        >
                          {deletingId === contract.id ? 'Deleting…' : 'Confirm delete'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); setOpenMenuId(null); }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-zinc-400 hover:bg-zinc-800 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(contract.id); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 cursor-pointer"
                      >
                        Delete contract
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function ContractsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [contracts, setContracts] = useState<PaymentContract[]>([]);
  const [roleFilter, setRoleFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loadingList, setLoadingList] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fundContractId, setFundContractId] = useState<string | null>(null);
  const [fundLoading, setFundLoading] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.('[data-dropdown-id]')) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await paymentContractApi.getUserContracts();
        if (cancelled) return;
        if (res.success && res.data && Array.isArray((res.data as { contracts?: PaymentContract[] }).contracts)) {
          setContracts((res.data as { contracts: PaymentContract[] }).contracts);
        }
      } catch (err) {
        if (!cancelled) console.error('Fetch contracts:', err);
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await paymentContractApi.deleteContract(id);
      if (res.success) {
        setContracts((prev) => prev.filter((c) => c.id !== id));
        setDeleteConfirmId(null);
        setOpenMenuId(null);
      } else {
        setError((res as { error?: string }).error || 'Failed to delete');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const handleFund = async (contractId: string) => {
    setFundLoading(true);
    setFundError(null);
    try {
      const res = await paymentContractApi.createFundLink(contractId);
      if (res.success && res.data?.data?.paymentLinkUrl) {
        window.open(res.data.data.paymentLinkUrl, '_blank', 'noopener,noreferrer');
        setFundContractId(null);
      } else {
        setFundError((res as { error?: string }).error || 'Could not create payment link');
      }
    } catch (e) {
      setFundError(e instanceof Error ? e.message : 'Failed to open checkout');
    } finally {
      setFundLoading(false);
    }
  };

  const filtered = contracts.filter((c) => {
    const wallet = user?.walletAddress?.toLowerCase();
    const emp = c.employer.toLowerCase() === wallet;
    const con = c.contractor.toLowerCase() === wallet;
    const roleOk = roleFilter === 'all' || (roleFilter === 'employer' && emp) || (roleFilter === 'contractor' && con);
    const statusOk = statusFilter === 'all' || c.status === statusFilter;
    return roleOk && statusOk;
  });

  const total = contracts.length;
  const asEmployer = contracts.filter((c) => c.employer.toLowerCase() === user?.walletAddress?.toLowerCase()).length;
  const asContractor = contracts.filter((c) => c.contractor.toLowerCase() === user?.walletAddress?.toLowerCase()).length;
  const active = contracts.filter((c) => c.status === 'ACTIVE').length;

  function counterparty(c: PaymentContract, isEmp: boolean): string {
    const name = isEmp ? c.contractorDisplayName : c.employerDisplayName;
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
      <div className="min-w-0 w-full max-w-6xl mx-auto pb-16">
        {/* Header */}
        <header className="pt-2 pb-10 sm:pt-4 sm:pb-12">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Contracts</h1>
              <p className="mt-2 text-sm text-zinc-500">Payment agreements and escrow</p>
            </div>
            <Link
              href="/dashboard/contracts/create"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-semibold text-black hover:bg-teal-400 transition-colors cursor-pointer shrink-0 shadow-lg shadow-teal-500/20"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New contract
            </Link>
          </div>
        </header>

        {/* Stats — single card with 4 columns and gap between cells */}
        <section className="mb-14" aria-label="Summary">
          {loadingList ? (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 h-28 animate-pulse" />
          ) : (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 shadow-sm p-5 sm:p-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div className="rounded-xl bg-zinc-800/40 border border-zinc-800/60 px-5 py-5 sm:px-6 sm:py-6">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total</p>
                  <p className="mt-2 text-2xl sm:text-3xl font-bold text-white tabular-nums">{total}</p>
                </div>
                <div className="rounded-xl bg-zinc-800/40 border border-zinc-800/60 px-5 py-5 sm:px-6 sm:py-6">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">As employer</p>
                  <p className="mt-2 text-2xl sm:text-3xl font-bold text-blue-400 tabular-nums">{asEmployer}</p>
                </div>
                <div className="rounded-xl bg-zinc-800/40 border border-zinc-800/60 px-5 py-5 sm:px-6 sm:py-6">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">As contractor</p>
                  <p className="mt-2 text-2xl sm:text-3xl font-bold text-violet-400 tabular-nums">{asContractor}</p>
                </div>
                <div className="rounded-xl bg-zinc-800/40 border border-zinc-800/60 px-5 py-5 sm:px-6 sm:py-6">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Active</p>
                  <p className="mt-2 text-2xl sm:text-3xl font-bold text-emerald-400 tabular-nums">{active}</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Filters */}
        {!loadingList && (
          <div className="flex flex-wrap items-center gap-4 mb-8">
            <div className="inline-flex rounded-xl bg-zinc-800/50 p-1.5 border border-zinc-700/80">
              {(['all', 'employer', 'contractor'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                    roleFilter === r ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {r === 'all' ? 'All roles' : r === 'employer' ? 'Employer' : 'Contractor'}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-xl bg-zinc-800/50 p-1.5 border border-zinc-700/80">
              {(['all', 'DRAFT', 'ACTIVE', 'COMPLETED'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                    statusFilter === s ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {s === 'all' ? 'All statuses' : s === 'DRAFT' ? 'Draft' : s === 'ACTIVE' ? 'Active' : 'Completed'}
                </button>
              ))}
            </div>
            <span className="text-sm text-zinc-500 ml-auto font-medium">
              {filtered.length} {filtered.length === 1 ? 'contract' : 'contracts'}
            </span>
          </div>
        )}

        {error && (
          <div className="mb-8 flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4">
            <p className="text-sm text-red-400">{error}</p>
            <button type="button" onClick={() => setError(null)} className="text-sm text-red-400 hover:text-red-300 cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* List */}
        <section className="space-y-5" aria-label="Contract list">
          {loadingList ? (
            <div className="space-y-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 sm:p-7 animate-pulse">
                  <div className="h-5 w-48 rounded bg-zinc-700/60" />
                  <div className="mt-2 h-4 w-32 rounded bg-zinc-700/40" />
                  <div className="mt-4 flex gap-4">
                    <div className="h-4 w-24 rounded bg-zinc-700/40" />
                    <div className="h-4 w-20 rounded bg-zinc-700/40" />
                  </div>
                  <div className="mt-3 h-1.5 w-full max-w-xs rounded-full bg-zinc-700/60" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 py-20 px-8 sm:py-24 sm:px-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/80">
                <svg className="h-8 w-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h2 className="mt-6 text-xl font-semibold text-white">No contracts yet</h2>
              <p className="mt-2 text-sm text-zinc-500 max-w-sm mx-auto leading-relaxed">
                {roleFilter !== 'all' || statusFilter !== 'all'
                  ? 'No contracts match the current filters.'
                  : 'Create a contract to start a payment agreement with escrow.'}
              </p>
              <Link
                href="/dashboard/contracts/create"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-teal-500 px-6 py-3.5 text-sm font-semibold text-black hover:bg-teal-400 transition-colors cursor-pointer shadow-lg shadow-teal-500/20"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New contract
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {filtered.map((contract) => {
                const isEmployer = contract.employer.toLowerCase() === user?.walletAddress?.toLowerCase();
                return (
                  <ContractCard
                    key={contract.id}
                    contract={contract}
                    isEmployer={isEmployer}
                    counterpartyName={counterparty(contract, isEmployer)}
                    onFund={() => { setFundContractId(contract.id); setFundError(null); }}
                    onDelete={handleDelete}
                    deleteConfirmId={deleteConfirmId}
                    deletingId={deletingId}
                    setDeleteConfirmId={setDeleteConfirmId}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                    userWallet={user?.walletAddress ?? ''}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Fund modal */}
        {fundContractId && (() => {
          const contract = filtered.find((c) => c.id === fundContractId);
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
              onClick={() => !fundLoading && setFundContractId(null)}
            >
        <div
          className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-8 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-semibold text-white">Fund contract</h3>
          {contract ? (
            <>
              <p className="mt-2 text-sm text-zinc-400">{contract.jobTitle || 'Untitled'}</p>
              <p className="mt-5 text-3xl font-bold text-white">${formatAmount(contract.totalAmount)}</p>
              <p className="mt-3 text-sm text-zinc-500 leading-relaxed">
                You’ll complete payment in Blockrader checkout. The contract will become active after payment.
              </p>
              {fundError && <p className="mt-4 text-sm text-red-400">{fundError}</p>}
              <div className="mt-8 flex gap-4">
                      <button
                        type="button"
                        onClick={() => handleFund(contract.id)}
                        disabled={fundLoading}
                        className="flex-1 rounded-xl bg-teal-500 py-3 text-sm font-semibold text-black hover:bg-teal-400 disabled:opacity-50 cursor-pointer"
                      >
                        {fundLoading ? 'Opening…' : 'Open checkout'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFundContractId(null)}
                        disabled={fundLoading}
                        className="rounded-xl border border-zinc-600 py-3 px-5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 cursor-pointer"
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
      </div>
    </PremiumDashboardLayout>
  );
}
