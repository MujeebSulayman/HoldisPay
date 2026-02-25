'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { paymentContractApi, PaymentContract } from '@/lib/api/payment-contract';

const STATUS_CONFIG: Record<string, { label: string; dot: string; pill: string }> = {
  ACTIVE: { label: 'Active', dot: 'bg-emerald-500', pill: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' },
  DRAFT: { label: 'Draft', dot: 'bg-amber-500', pill: 'bg-amber-500/15 text-amber-400 border-amber-500/40' },
  PAUSED: { label: 'Paused', dot: 'bg-yellow-500', pill: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40' },
  COMPLETED: { label: 'Completed', dot: 'bg-sky-500', pill: 'bg-sky-500/15 text-sky-400 border-sky-500/40' },
  TERMINATED: { label: 'Terminated', dot: 'bg-red-500', pill: 'bg-red-500/15 text-red-400 border-red-500/40' },
  DEFAULTED: { label: 'Defaulted', dot: 'bg-red-500', pill: 'bg-red-500/15 text-red-400 border-red-500/40' },
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

function formatDateTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateAddress(addr: string, chars = 6): string {
  if (!addr || addr.length <= chars * 2 + 2) return addr;
  return `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`;
}

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 py-4 border-b border-zinc-800/80 last:border-0">
      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span>
      <span className={`text-sm font-medium text-zinc-200 ${mono ? 'font-mono text-zinc-300' : ''}`}>{value}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'teal' | 'blue' | 'violet' | 'zinc';
}) {
  const accentClass =
    accent === 'teal'
      ? 'text-teal-400'
      : accent === 'blue'
        ? 'text-blue-400'
        : accent === 'violet'
          ? 'text-violet-400'
          : 'text-white';
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 sm:p-6 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-2 text-xl sm:text-2xl font-bold tabular-nums ${accentClass}`}>{value}</p>
      {sub != null && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export default function ContractViewPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const contractId = params.id as string;
  const [contract, setContract] = useState<PaymentContract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fundModalOpen, setFundModalOpen] = useState(false);
  const [fundLinkLoading, setFundLinkLoading] = useState(false);
  const [fundLinkError, setFundLinkError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user?.id || !contractId) return;
    const fetchContract = async () => {
      try {
        const res = await paymentContractApi.getContract(contractId);
        if (res.success && res.data?.contract) {
          setContract(res.data.contract as PaymentContract);
        } else {
          setError('Contract not found');
        }
      } catch {
        setError('Failed to load contract');
      } finally {
        setIsLoading(false);
      }
    };
    fetchContract();
  }, [user?.id, contractId]);

  const handleFund = async () => {
    if (!contract) return;
    setFundLinkLoading(true);
    setFundLinkError(null);
    try {
      const res = await paymentContractApi.createFundLink(contract.id);
      if (res.success && res.data?.data?.paymentLinkUrl) {
        window.open(res.data.data.paymentLinkUrl, '_blank', 'noopener,noreferrer');
        setFundModalOpen(false);
      } else {
        setFundLinkError((res as { error?: string }).error || 'Could not create payment link');
      }
    } catch (e) {
      setFundLinkError(e instanceof Error ? e.message : 'Failed to open checkout');
    } finally {
      setFundLinkLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!contract) return;
    setDeleting(true);
    try {
      const res = await paymentContractApi.deleteContract(contract.id);
      if (res.success) {
        router.push('/dashboard/contracts');
      } else {
        setError((res as { error?: string }).error || 'Failed to delete');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

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
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-teal-500" />
        </div>
      </PremiumDashboardLayout>
    );
  }

  if (error || !contract) {
    return (
      <PremiumDashboardLayout>
        <div className="max-w-2xl mx-auto py-12 text-center">
          <p className="text-zinc-400 mb-4">{error || 'Contract not found'}</p>
          <Link href="/dashboard/contracts" className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 cursor-pointer">
            Back to contracts
          </Link>
        </div>
      </PremiumDashboardLayout>
    );
  }

  const isEmployer = contract.employer.toLowerCase() === user?.walletAddress?.toLowerCase();
  const counterpartyName = isEmployer ? (contract.contractorDisplayName?.trim() || '—') : (contract.employerDisplayName?.trim() || '—');
  const numPayments = parseInt(contract.numberOfPayments, 10) || 1;
  const paymentsMade = parseInt(contract.paymentsMade, 10) || 0;
  const progress = numPayments > 0 ? (paymentsMade / numPayments) * 100 : 0;
  const statusConf = STATUS_CONFIG[contract.status] ?? { label: contract.status, dot: 'bg-zinc-500', pill: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/40' };

  const intervalLabel =
    contract.paymentInterval === '0' || !contract.paymentInterval
      ? 'One-time'
      : `${contract.paymentInterval} day${parseInt(contract.paymentInterval, 10) === 1 ? '' : 's'}`;

  return (
    <PremiumDashboardLayout>
      <div className="min-w-0 w-full max-w-4xl mx-auto pb-16">
        <Link
          href="/dashboard/contracts"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-8 cursor-pointer transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to contracts
        </Link>

        {/* Hero card */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden shadow-sm">
          <div className="p-7 sm:p-9">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {contract.jobTitle || 'Untitled contract'}
                </h1>
                <p className="mt-2 text-sm text-zinc-500">Contract ID · {truncateAddress(contract.id, 8)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${statusConf.pill}`}
                >
                  <span className={`h-2 w-2 rounded-full ${statusConf.dot}`} />
                  {statusConf.label}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium ${
                    isEmployer ? 'bg-blue-500/15 text-blue-400 border-blue-500/40' : 'bg-violet-500/15 text-violet-400 border-violet-500/40'
                  }`}
                >
                  {isEmployer ? 'Employer' : 'Contractor'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress section — modern bar */}
        <section className="mt-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-7 sm:p-9 shadow-sm" aria-label="Payment progress">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Payment progress</h2>
            <span className="text-lg font-bold tabular-nums text-white">
              {contract.paymentsMade} <span className="text-zinc-500 font-normal">/</span> {contract.numberOfPayments}{' '}
              <span className="text-sm font-normal text-zinc-500">payments</span>
            </span>
          </div>
          <div className="relative">
            {/* Track */}
            <div
              className="h-3 sm:h-4 w-full rounded-full bg-zinc-800/80 overflow-hidden"
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Payment progress"
            >
              {/* Fill with gradient and subtle glow */}
              <div
                className="h-full rounded-full bg-linear-to-r from-teal-500 via-teal-400 to-cyan-400 transition-all duration-500 ease-out min-w-[8px]"
                style={{
                  width: `${Math.min(100, Math.max(0, progress))}%`,
                  boxShadow: progress > 0 ? '0 0 20px rgba(20, 184, 166, 0.35)' : undefined,
                }}
              />
            </div>
            {/* Percentage badge (right of bar on desktop) */}
            <div className="mt-3 flex items-center justify-end">
              <span className="inline-flex items-center rounded-lg bg-zinc-800/90 px-3 py-1.5 text-sm font-semibold tabular-nums text-teal-400">
                {Math.round(progress)}%
              </span>
            </div>
          </div>
          {/* Optional: step dots for small number of payments */}
          {numPayments <= 12 && numPayments >= 1 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {Array.from({ length: numPayments }, (_, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    i < paymentsMade ? 'bg-teal-500' : 'bg-zinc-700'
                  }`}
                  title={`Payment ${i + 1}${i < paymentsMade ? ' (done)' : ''}`}
                />
              ))}
            </div>
          )}
        </section>

        {/* Key metrics */}
        <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5" aria-label="Key figures">
          <StatCard label="Per payment" value={`$${formatAmount(contract.paymentAmount)}`} accent="teal" />
          <StatCard
            label="Total value"
            value={contract.isOngoing ? 'Ongoing' : `$${formatAmount(contract.totalAmount)}`}
            sub={contract.isOngoing ? 'No fixed end' : undefined}
          />
          <StatCard
            label="Remaining"
            value={contract.isOngoing ? '—' : `$${formatAmount(contract.remainingBalance)}`}
            sub={contract.isOngoing ? undefined : `${numPayments - paymentsMade} payments left`}
          />
          <StatCard
            label="Release type"
            value={contract.releaseType === 'TIME_BASED' ? 'Time-based' : 'Milestone'}
            sub={intervalLabel}
          />
        </section>

        {/* Details grid */}
        <section className="mt-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden shadow-sm">
          <div className="px-7 py-5 sm:px-8 sm:py-5 border-b border-zinc-800/80">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Contract details</h2>
          </div>
          <div className="p-6 sm:p-7 divide-y divide-zinc-800/80 sm:divide-y-0 sm:divide-x sm:grid sm:grid-cols-2">
            <div className="space-y-0 sm:pr-8">
              <DetailRow label="Counterparty" value={counterpartyName} />
              <DetailRow label="Your role" value={isEmployer ? 'Employer' : 'Contractor'} />
              <DetailRow label="Started" value={formatDate(contract.startDate)} />
              <DetailRow label="Next payment" value={contract.nextPaymentDate ? formatDate(contract.nextPaymentDate) : '—'} />
              {contract.lastPaymentDate != null && (
                <DetailRow label="Last payment" value={formatDate(contract.lastPaymentDate)} />
              )}
              {contract.endDate != null && contract.endDate > 0 && (
                <DetailRow label="End date" value={formatDate(contract.endDate)} />
              )}
            </div>
            <div className="space-y-0 pt-4 sm:pt-0 sm:pl-8 border-t border-zinc-800/80 sm:border-t-0">
              <DetailRow label="Payment interval" value={intervalLabel} />
              <DetailRow label="Grace period" value={`${contract.gracePeriodDays || 0} days`} />
              {(contract.chainSlug || contract.assetSlug) && (
                <DetailRow
                  label="Network / Asset"
                  value={[contract.chainSlug, contract.assetSlug].filter(Boolean).join(' · ') || '—'}
                />
              )}
              {contract.contractHash && (
                <DetailRow label="Contract hash" value={truncateAddress(contract.contractHash, 10)} mono />
              )}
              <DetailRow label="Created" value={formatDateTime(contract.createdAt)} />
            </div>
          </div>
        </section>

        {/* Description & deliverables */}
        {(contract.description || contract.deliverables) && (
          <section className="mt-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden shadow-sm">
            <div className="px-7 py-5 sm:px-8 sm:py-5 border-b border-zinc-800/80">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Scope</h2>
            </div>
            <div className="p-6 sm:p-8 space-y-8">
              {contract.description && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">Description</p>
                  <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{contract.description}</p>
                </div>
              )}
              {contract.deliverables && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">Deliverables</p>
                  <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{contract.deliverables}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Actions */}
        <div className="mt-10 flex flex-wrap gap-4">
          {contract.status === 'DRAFT' && isEmployer && (
            <>
              <button
                type="button"
                onClick={() => {
                  setFundModalOpen(true);
                  setFundLinkError(null);
                }}
                className="rounded-xl bg-teal-500 px-5 py-3 text-sm font-semibold text-black hover:bg-teal-400 transition-colors cursor-pointer"
              >
                Fund contract
              </button>
              <Link
                href={`/dashboard/contracts/create?id=${contract.id}`}
                className="rounded-xl border border-zinc-600 px-5 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer inline-flex"
              >
                Edit
              </Link>
              {deleteConfirm ? (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-xl px-5 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 cursor-pointer disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Confirm delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(false)}
                    disabled={deleting}
                    className="rounded-xl px-5 py-3 text-sm font-medium text-zinc-400 hover:bg-zinc-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="rounded-xl border border-red-500/30 px-5 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 cursor-pointer"
                >
                  Delete
                </button>
              )}
            </>
          )}
          {contract.status === 'ACTIVE' && !isEmployer && (
            <button
              type="button"
              className="rounded-xl bg-teal-500/20 border border-teal-500/40 px-5 py-3 text-sm font-medium text-teal-400 hover:bg-teal-500/30 cursor-pointer"
            >
              Claim payment
            </button>
          )}
        </div>
      </div>

      {/* Fund modal */}
      {fundModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => !fundLinkLoading && setFundModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">Fund contract</h3>
            <p className="mt-2 text-sm text-zinc-400">{contract.jobTitle || 'Untitled'}</p>
            <p className="mt-5 text-3xl font-bold text-white">${formatAmount(contract.totalAmount)}</p>
            <p className="mt-3 text-sm text-zinc-500 leading-relaxed">
              You’ll complete payment in Blockrader checkout. The contract will become active after payment.
            </p>
            {fundLinkError && <p className="mt-4 text-sm text-red-400">{fundLinkError}</p>}
            <div className="mt-8 flex gap-4">
              <button
                type="button"
                onClick={handleFund}
                disabled={fundLinkLoading}
                className="flex-1 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-black font-semibold text-sm cursor-pointer"
              >
                {fundLinkLoading ? 'Opening…' : 'Open checkout'}
              </button>
              <button
                type="button"
                onClick={() => setFundModalOpen(false)}
                disabled={fundLinkLoading}
                className="py-3 px-4 rounded-xl border border-zinc-600 text-zinc-300 hover:bg-zinc-800 text-sm font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </PremiumDashboardLayout>
  );
}
