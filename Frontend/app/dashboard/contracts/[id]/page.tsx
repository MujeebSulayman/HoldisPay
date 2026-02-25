'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { paymentContractApi, PaymentContract } from '@/lib/api/payment-contract';

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
  const progress = numPayments > 0 ? (parseInt(contract.paymentsMade, 10) / numPayments) * 100 : 0;
  const statusConf = STATUS_CONFIG[contract.status] ?? { label: contract.status, dot: 'bg-zinc-500', text: 'text-zinc-400' };

  return (
    <PremiumDashboardLayout>
      <div className="min-w-0 max-w-2xl mx-auto">
        <Link href="/dashboard/contracts" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-6 cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to contracts
        </Link>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h1 className="text-xl font-semibold text-white">{contract.jobTitle || 'Untitled contract'}</h1>
            <span className={`inline-flex items-center gap-1.5 text-sm ${statusConf.text}`}>
              <span className={`h-2 w-2 rounded-full ${statusConf.dot}`} />
              {statusConf.label}
            </span>
          </div>

          <div className="mt-6 space-y-4 text-sm">
            <div className="flex justify-between py-2 border-b border-zinc-800">
              <span className="text-zinc-500">Counterparty</span>
              <span className="text-white">{counterpartyName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-zinc-800">
              <span className="text-zinc-500">Your role</span>
              <span className={isEmployer ? 'text-blue-400' : 'text-violet-400'}>{isEmployer ? 'Employer' : 'Contractor'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-zinc-800">
              <span className="text-zinc-500">Amount per payment</span>
              <span className="text-white">${formatAmount(contract.paymentAmount)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-zinc-800">
              <span className="text-zinc-500">Total</span>
              <span className="text-white">{contract.isOngoing ? 'Ongoing' : `$${formatAmount(contract.totalAmount)}`}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-zinc-800">
              <span className="text-zinc-500">Progress</span>
              <span className="text-white">{contract.paymentsMade} / {contract.numberOfPayments} payments</span>
            </div>
            <div className="flex justify-between py-2 border-b border-zinc-800">
              <span className="text-zinc-500">Started</span>
              <span className="text-white">{formatDate(contract.startDate)}</span>
            </div>
            {contract.description && (
              <div className="pt-4 border-b border-zinc-800">
                <span className="text-zinc-500 block mb-2">Description</span>
                <p className="text-zinc-300">{contract.description}</p>
              </div>
            )}
          </div>

          <div className="mt-6 h-2 rounded-full bg-zinc-700 overflow-hidden">
            <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {contract.status === 'DRAFT' && isEmployer && (
              <>
                <button type="button" onClick={() => { setFundModalOpen(true); setFundLinkError(null); }} className="rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-medium text-black hover:bg-teal-400 cursor-pointer">
                  Fund contract
                </button>
                <Link href={`/dashboard/contracts/create?id=${contract.id}`} className="rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 cursor-pointer">
                  Edit
                </Link>
                {deleteConfirm ? (
                  <span className="flex items-center gap-2">
                    <button type="button" onClick={handleDelete} disabled={deleting} className="rounded-lg px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 cursor-pointer disabled:opacity-50">
                      {deleting ? 'Deleting…' : 'Confirm delete'}
                    </button>
                    <button type="button" onClick={() => setDeleteConfirm(false)} disabled={deleting} className="rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-400 hover:bg-zinc-700 cursor-pointer">
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setDeleteConfirm(true)} className="rounded-lg border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 cursor-pointer">
                    Delete
                  </button>
                )}
              </>
            )}
            {contract.status === 'ACTIVE' && !isEmployer && (
              <button type="button" className="rounded-lg bg-teal-500/20 border border-teal-500/30 px-4 py-2.5 text-sm font-medium text-teal-400 hover:bg-teal-500/30 cursor-pointer">
                Claim payment
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fund modal */}
      {fundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => !fundLinkLoading && setFundModalOpen(false)}>
          <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white">Fund contract</h3>
            <p className="mt-1 text-sm text-zinc-400">{contract.jobTitle || 'Untitled'}</p>
            <p className="mt-3 text-2xl font-semibold text-white">${formatAmount(contract.totalAmount)}</p>
            <p className="mt-2 text-sm text-zinc-500">
              You’ll complete payment in Blockrader checkout. The contract will become active after payment.
            </p>
            {fundLinkError && <p className="mt-2 text-sm text-red-400">{fundLinkError}</p>}
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={handleFund} disabled={fundLinkLoading} className="flex-1 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-black font-medium text-sm cursor-pointer">
                {fundLinkLoading ? 'Opening…' : 'Open checkout'}
              </button>
              <button type="button" onClick={() => setFundModalOpen(false)} disabled={fundLinkLoading} className="py-2.5 px-4 rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800 text-sm font-medium cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </PremiumDashboardLayout>
  );
}
