'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { PageLoader } from '@/components/AppLoader';
import { paymentContractApi, PaymentContract, type WorkSubmission, type ContractAttachment } from '@/lib/api/payment-contract';
import { blockchainApi } from '@/lib/api/blockchain';

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

function toSeconds(v: string | number): number {
  if (typeof v === 'number') return v;
  const s = String(v);
  return /^\d+$/.test(s) ? parseInt(s, 10) : Math.floor(new Date(s).getTime() / 1000);
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

type UserRole = 'employer' | 'contractor' | 'admin';

export default function AdminContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.contractId as string;
  const [authChecked, setAuthChecked] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [contract, setContract] = useState<PaymentContract | null>(null);
  const [workSubmission, setWorkSubmission] = useState<WorkSubmission | null>(null);
  const [attachments, setAttachments] = useState<ContractAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fundModalOpen, setFundModalOpen] = useState(false);
  const [fundLinkLoading, setFundLinkLoading] = useState(false);
  const [fundLinkError, setFundLinkError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [submitWorkOpen, setSubmitWorkOpen] = useState(false);
  const [submitWorkComment, setSubmitWorkComment] = useState('');
  const [submitWorkLoading, setSubmitWorkLoading] = useState(false);
  const [approveRejectOpen, setApproveRejectOpen] = useState(false);
  const [approveRejectApproved, setApproveRejectApproved] = useState(true);
  const [approveRejectComment, setApproveRejectComment] = useState('');
  const [approveRejectLoading, setApproveRejectLoading] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [assetSymbol, setAssetSymbol] = useState<string | null>(null);

  const fetchContract = useCallback(async () => {
    if (!contractId) return;
    try {
      const res = await paymentContractApi.getContract(contractId);
      if (res.success && res.data?.contract) {
        setContract(res.data.contract as PaymentContract);
        setWorkSubmission(res.data.workSubmission ?? null);
        setAttachments(res.data.attachments ?? []);
        setUserRole((res.data as { userRole?: UserRole }).userRole ?? 'admin');
      } else {
        setError('Contract not found');
      }
    } catch {
      setError('Failed to load contract');
    } finally {
      setIsLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (!token || !userStr) {
      router.replace('/admin/login');
      return;
    }
    try {
      const parsed = JSON.parse(userStr) as { accountType?: string };
      if (parsed.accountType !== 'admin') {
        router.replace('/');
        return;
      }
    } catch {
      router.replace('/admin/login');
      return;
    }
    setAuthChecked(true);
  }, [router]);

  useEffect(() => {
    if (authChecked && contractId) fetchContract();
  }, [authChecked, contractId, fetchContract]);

  useEffect(() => {
    if (!contract?.chainSlug || !contract?.assetSlug) {
      setAssetSymbol(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const assets = await blockchainApi.getSupportedAssets(contract.chainSlug!);
        if (cancelled) return;
        const asset = assets.find((a) => (a.slug ?? a.id) === contract.assetSlug);
        setAssetSymbol(asset?.symbol ?? null);
      } catch {
        if (!cancelled) setAssetSymbol(null);
      }
    })();
    return () => { cancelled = true; };
  }, [contract?.chainSlug, contract?.assetSlug]);

  const handleFund = async () => {
    if (!contract) return;
    setFundLinkLoading(true);
    setFundLinkError(null);
    try {
      const res = await paymentContractApi.createFundLink(contract.id);
      if (res.success && res.data?.paymentLinkUrl) {
        const url = res.data.paymentLinkUrl;
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        if (!opened || opened.closed) {
          window.location.href = url;
        }
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
        router.push('/admin/contracts');
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

  const handleSubmitWork = async () => {
    if (!contractId) return;
    setActionError(null);
    setSubmitWorkLoading(true);
    try {
      const res = await paymentContractApi.submitWork(contractId, submitWorkComment.trim() || undefined);
      if (res.success) {
        setSubmitWorkOpen(false);
        setSubmitWorkComment('');
        await fetchContract();
      } else {
        setActionError((res as { error?: string }).error || 'Failed to submit work');
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to submit work');
    } finally {
      setSubmitWorkLoading(false);
    }
  };

  const handleApproveReject = async () => {
    if (!contractId) return;
    setActionError(null);
    setApproveRejectLoading(true);
    try {
      const res = await paymentContractApi.approveWork(contractId, approveRejectApproved, approveRejectComment.trim() || undefined);
      if (res.success) {
        setApproveRejectOpen(false);
        setApproveRejectComment('');
        await fetchContract();
      } else {
        setActionError((res as { error?: string }).error || 'Failed to update');
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setApproveRejectLoading(false);
    }
  };

  const handleReleasePayment = async () => {
    if (!contractId) return;
    setActionError(null);
    setReleaseLoading(true);
    try {
      const res = await paymentContractApi.releasePayment(contractId);
      if (res.success) {
        await fetchContract();
      } else {
        setActionError((res as { error?: string }).error || 'Failed to release');
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to release');
    } finally {
      setReleaseLoading(false);
    }
  };

  const handleDownloadAttachment = async (attachmentId: string) => {
    if (!contractId) return;
    setDownloadingId(attachmentId);
    setActionError(null);
    try {
      const res = await paymentContractApi.getAttachmentDownloadUrl(contractId, attachmentId);
      const url = (res as { data?: { url?: string } })?.data?.url;
      if (url) window.open(url, '_blank');
      else setActionError('Could not get download link');
    } catch {
      setActionError('Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  if (!authChecked) return <PageLoader />;
  if (isLoading) return <PageLoader />;

  if (error || !contract) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <p className="text-zinc-400 mb-4">{error || 'Contract not found'}</p>
        <Link href="/admin/contracts" className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 cursor-pointer">
          Back to contracts
        </Link>
      </div>
    );
  }

  const isEmployer = userRole === 'employer';
  const isAdminView = userRole === 'admin';
  const counterpartyName = isAdminView ? (contract.contractorDisplayName?.trim() || contract.employerDisplayName?.trim() || '—') : (isEmployer ? (contract.contractorDisplayName?.trim() || '—') : (contract.employerDisplayName?.trim() || '—'));
  const statusConf = STATUS_CONFIG[contract.status] ?? { label: contract.status, dot: 'bg-zinc-500', pill: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/40' };
  const isProjectBased = contract.releaseType === 'PROJECT_BASED';
  const numPayments = Math.max(0, parseInt(contract.numberOfPayments || '0', 10));
  const paymentsMade = Math.max(0, parseInt(contract.paymentsMade || '0', 10));
  const subStatus = workSubmission?.status ?? null;
  const canSubmitWork = !isAdminView && isProjectBased && contract.status === 'ACTIVE' && !isEmployer && (subStatus === null || subStatus === 'rejected');
  const canApproveReject = !isAdminView && isProjectBased && contract.status === 'ACTIVE' && isEmployer && subStatus === 'pending';
  const canRelease = !isAdminView && isProjectBased && contract.status === 'ACTIVE' && isEmployer && subStatus === 'approved' && workSubmission && !workSubmission.releasedAt;
  const showActions = !isAdminView && (contract.status === 'DRAFT' && isEmployer || canSubmitWork || canApproveReject || canRelease || actionError);

  return (
    <div className="min-w-0 w-full max-w-[1680px] mx-auto pb-16">
      <Link
        href="/admin/contracts"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-6 cursor-pointer transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to contracts
        </Link>

        {/* Header: title + status + role — full width */}
        <header className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
                {contract.jobTitle || 'Untitled contract'}
              </h1>
              <p className="mt-1.5 text-sm text-zinc-500">Contract ID · {truncateAddress(contract.id, 8)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${statusConf.pill}`}
              >
                <span className={`h-2 w-2 rounded-full ${statusConf.dot}`} />
                {statusConf.label}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium ${isAdminView ? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/40' : isEmployer ? 'bg-blue-500/15 text-blue-400 border-blue-500/40' : 'bg-violet-500/15 text-violet-400 border-violet-500/40'
                  }`}
              >
                {isAdminView ? 'Admin' : isEmployer ? 'Employer' : 'Contractor'}
              </span>
            </div>
          </div>
        </header>

        {/* Two-column: main + sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-8 xl:gap-10">
          {/* Main column */}
          <div className="min-w-0 space-y-6">
            {/* Metrics strip — compact horizontal */}
            <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-5 sm:p-6" aria-label="Key figures">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{isProjectBased ? 'Contract value' : 'Per payment'}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-teal-400">${formatAmount(contract.paymentAmount)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Total value</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-white">{contract.isOngoing ? 'Ongoing' : `$${formatAmount(contract.totalAmount)}`}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Remaining</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-white">${formatAmount(contract.remainingBalance)}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{isProjectBased ? 'Approve work → release' : 'Auto each interval'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Release type</p>
                  <p className="mt-1 text-lg font-semibold text-white">{isProjectBased ? 'Project-based' : 'Time-based'}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{isProjectBased ? 'Approve → release' : `Every ${contract.paymentInterval} days`}</p>
                </div>
              </div>
            </section>

            {/* Work status (project-based) */}
            {isProjectBased && (
              <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 overflow-hidden" aria-label="Work status">
                <div className="px-5 py-4 sm:px-6 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Work status</h2>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium ${!workSubmission ? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/40'
                        : workSubmission.status === 'pending' ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                          : workSubmission.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                            : workSubmission.status === 'rejected' ? 'bg-red-500/15 text-red-400 border-red-500/40'
                              : workSubmission.releasedAt ? 'bg-sky-500/15 text-sky-400 border-sky-500/40'
                                : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/40'
                      }`}
                  >
                    {!workSubmission ? 'Not submitted' : workSubmission.status === 'pending' ? 'Pending review' : workSubmission.status === 'approved' ? (workSubmission.releasedAt ? 'Released' : 'Approved') : workSubmission.status === 'rejected' ? 'Rejected' : '—'}
                  </span>
                </div>
                {workSubmission && (
                  <div className="p-5 sm:p-6 space-y-4 rounded-b-lg bg-zinc-800/30">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Submitted</p>
                      {workSubmission.comment ? (
                        <p className="text-sm text-zinc-300 whitespace-pre-wrap">{workSubmission.comment}</p>
                      ) : (
                        <p className="text-sm text-zinc-500 italic">No note</p>
                      )}
                      <p className="text-xs text-zinc-500 mt-1">{formatDateTime(toSeconds(workSubmission.submittedAt as string | number))}</p>
                    </div>
                    {workSubmission.reviewedAt && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Review</p>
                        <p className="text-sm text-zinc-300">{workSubmission.status === 'approved' ? 'Approved' : 'Rejected'}{workSubmission.reviewerComment ? ` — ${workSubmission.reviewerComment}` : ''}</p>
                        <p className="text-xs text-zinc-500 mt-1">{formatDateTime(toSeconds(workSubmission.reviewedAt as string | number))}</p>
                      </div>
                    )}
                    {workSubmission.releasedAt && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Payment released</p>
                        <p className="text-xs text-zinc-500">{formatDateTime(toSeconds(workSubmission.releasedAt as string | number))}</p>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Payment progress (time-based) */}
            {!isProjectBased && (
              <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-5 sm:p-6" aria-label="Payment progress">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Payment progress</h2>
                  <span className="text-lg font-bold tabular-nums text-white">
                    {contract.paymentsMade} <span className="text-zinc-500 font-normal">/</span> {contract.numberOfPayments}{' '}
                    <span className="text-sm font-normal text-zinc-500">payments</span>
                  </span>
                </div>
                <div className="relative">
                  <div
                    className="h-3 sm:h-4 w-full rounded-full bg-zinc-800/80 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={numPayments > 0 ? Math.round((paymentsMade / numPayments) * 100) : 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-linear-to-r from-teal-500 to-cyan-400 transition-all duration-500 min-w-[8px]"
                      style={{
                        width: `${Math.min(100, numPayments > 0 ? (paymentsMade / numPayments) * 100 : 0)}%`,
                      }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-end">
                    <span className="inline-flex items-center rounded-lg bg-zinc-800/90 px-3 py-1.5 text-sm font-semibold tabular-nums text-teal-400">
                      {numPayments > 0 ? Math.round((paymentsMade / numPayments) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* Scope */}
            {(contract.description || contract.deliverables) && (
              <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
                <div className="px-5 py-4 sm:px-6 border-b border-zinc-800/80">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Scope</h2>
                </div>
                <div className="p-5 sm:p-6 space-y-6">
                  {contract.description && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">Description</p>
                      <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{contract.description}</p>
                    </div>
                  )}
                  {contract.deliverables && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">Deliverables</p>
                      <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{contract.deliverables}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Documents */}
            {attachments.length > 0 && (
              <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
                <div className="px-5 py-4 sm:px-6 border-b border-zinc-800/80">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Documents</h2>
                </div>
                <div className="p-5 sm:p-6">
                  <ul className="space-y-2">
                    {attachments.map((att) => (
                      <li key={att.id} className="flex items-center justify-between gap-4 rounded-lg bg-zinc-800/50 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{att.fileName}</p>
                          {att.label && <p className="text-xs text-zinc-500 truncate">{att.label}</p>}
                          <p className="text-xs text-zinc-500">{(att.fileSize / 1024).toFixed(1)} KB</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadAttachment(att.id)}
                          disabled={downloadingId === att.id}
                          className="shrink-0 rounded-lg border border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                        >
                          {downloadingId === att.id ? '…' : 'Download'}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
          </div>

          {/* Sidebar: details + actions */}
          <aside className="xl:order-2">
            <div className="xl:sticky xl:top-6 space-y-6">
              {/* Contract details */}
              <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-800/80">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Details</h2>
                </div>
                <div className="p-5 divide-y divide-zinc-800/80">
                  <DetailRow label="Counterparty" value={counterpartyName} />
                  <DetailRow label="Your role" value={isAdminView ? 'Admin (view only)' : (isEmployer ? 'Employer' : 'Contractor')} />
                  <DetailRow label="Started" value={formatDate(contract.startDate)} />
                  {contract.nextPaymentDate ? (
                    <DetailRow label="Next payment" value={formatDate(contract.nextPaymentDate)} />
                  ) : null}
                  {contract.lastPaymentDate != null && (
                    <DetailRow label="Last payment" value={formatDate(contract.lastPaymentDate)} />
                  )}
                  {contract.endDate != null && contract.endDate > 0 && (
                    <DetailRow label="End date" value={formatDate(contract.endDate)} />
                  )}
                  <DetailRow label="Payment interval" value={`${contract.paymentInterval || '0'} days`} />
                  <DetailRow label="Grace period" value={`${contract.gracePeriodDays || 0} days`} />
                  {(contract.chainSlug || contract.assetSlug) && (
                    <DetailRow
                      label="Network / Asset"
                      value={[contract.chainSlug, assetSymbol ?? contract.assetSlug].filter(Boolean).join(' · ') || '—'}
                    />
                  )}
                  {contract.contractHash && (
                    <DetailRow label="Contract hash" value={truncateAddress(contract.contractHash, 10)} mono />
                  )}
                  <DetailRow label="Created" value={formatDateTime(contract.createdAt)} />
                </div>
              </section>

              {/* Actions — only when there is something to do */}
              {showActions && (
                <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-5">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-4">Actions</h2>
                  {actionError && (
                    <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
                      {actionError}
                    </div>
                  )}
                  <div className="flex flex-col gap-3">
                    {contract.status === 'DRAFT' && isEmployer && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setFundModalOpen(true);
                            setFundLinkError(null);
                          }}
                          className="w-full rounded-lg bg-teal-500 px-4 py-3 text-sm font-semibold text-black hover:bg-teal-400 transition-colors cursor-pointer"
                        >
                          Fund contract
                        </button>
                        <Link
                          href={`/admin/contracts/create?id=${contract.id}`}
                          className="w-full rounded-lg border border-zinc-600 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer inline-flex justify-center"
                        >
                          Edit
                        </Link>
                        {deleteConfirm ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleDelete}
                              disabled={deleting}
                              className="flex-1 rounded-lg px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 cursor-pointer disabled:opacity-50"
                            >
                              {deleting ? 'Deleting…' : 'Confirm delete'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(false)}
                              disabled={deleting}
                              className="flex-1 rounded-lg px-4 py-3 text-sm font-medium text-zinc-400 hover:bg-zinc-700 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(true)}
                            className="w-full rounded-lg border border-red-500/30 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </>
                    )}
                    {canSubmitWork && (
                      <button
                        type="button"
                        onClick={() => { setSubmitWorkOpen(true); setActionError(null); setSubmitWorkComment(''); }}
                        className="w-full rounded-lg bg-teal-500 px-4 py-3 text-sm font-semibold text-black hover:bg-teal-400 transition-colors cursor-pointer"
                      >
                        Submit work for approval
                      </button>
                    )}
                    {canApproveReject && (
                      <>
                        <button
                          type="button"
                          onClick={() => { setApproveRejectOpen(true); setApproveRejectApproved(true); setApproveRejectComment(''); setActionError(null); }}
                          className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-black hover:bg-emerald-400 transition-colors cursor-pointer"
                        >
                          Approve work
                        </button>
                        <button
                          type="button"
                          onClick={() => { setApproveRejectOpen(true); setApproveRejectApproved(false); setApproveRejectComment(''); setActionError(null); }}
                          className="w-full rounded-lg border border-red-500/50 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 cursor-pointer"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {canRelease && (
                      <button
                        type="button"
                        onClick={handleReleasePayment}
                        disabled={releaseLoading}
                        className="w-full rounded-lg bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-400 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {releaseLoading ? 'Releasing…' : 'Release payment'}
                      </button>
                    )}
                  </div>
                </section>
              )}
            </div>
          </aside>
        </div>

      {/* Fund modal */}
      {fundModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => !fundLinkLoading && setFundModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">Fund contract</h3>
            <p className="mt-2 text-sm text-zinc-400">{contract.jobTitle || 'Untitled'}</p>
            <p className="mt-5 text-3xl font-bold text-white">${formatAmount(contract.totalAmount)}</p>
            {(contract.chainSlug || contract.assetSlug) && (
              <p className="mt-2 text-sm font-medium text-teal-400">
                Pay with: {[contract.chainSlug, assetSymbol ?? contract.assetSlug].filter(Boolean).join(' · ')}
              </p>
            )}
            <p className="mt-3 text-sm text-zinc-500 leading-relaxed">
              Complete payment in checkout. The contract will become active after payment.
            </p>
            {fundLinkError && <p className="mt-4 text-sm text-red-400">{fundLinkError}</p>}
            <div className="mt-8 flex gap-4">
              <button
                type="button"
                onClick={handleFund}
                disabled={fundLinkLoading}
                className="flex-1 py-3 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-black font-semibold text-sm cursor-pointer"
              >
                {fundLinkLoading ? 'Opening…' : 'Open checkout'}
              </button>
              <button
                type="button"
                onClick={() => setFundModalOpen(false)}
                disabled={fundLinkLoading}
                className="py-3 px-4 rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800 text-sm font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit work modal */}
      {submitWorkOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => !submitWorkLoading && setSubmitWorkOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">Submit work for approval</h3>
            <p className="mt-2 text-sm text-zinc-400">You can add an optional note (e.g. what you delivered or a link).</p>
            <label className="block text-xs font-medium text-zinc-500 mt-4 mb-1">Note (optional)</label>
            <textarea
              value={submitWorkComment}
              onChange={(e) => setSubmitWorkComment(e.target.value)}
              placeholder="Describe what you delivered or share a link..."
              rows={4}
              className="mt-4 w-full px-4 py-3 rounded-lg border-2 border-zinc-700 bg-zinc-800/60 text-white placeholder-zinc-500 focus:outline-none focus:border-teal-500 resize-y"
            />
            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
            <div className="mt-6 flex gap-4">
              <button
                type="button"
                onClick={handleSubmitWork}
                disabled={submitWorkLoading}
                className="flex-1 py-3 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-black font-semibold text-sm cursor-pointer"
              >
                {submitWorkLoading ? 'Submitting…' : 'Submit'}
              </button>
              <button
                type="button"
                onClick={() => setSubmitWorkOpen(false)}
                disabled={submitWorkLoading}
                className="py-3 px-4 rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800 text-sm font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve / Reject modal */}
      {approveRejectOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => !approveRejectLoading && setApproveRejectOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">{approveRejectApproved ? 'Approve work' : 'Reject work'}</h3>
            <p className="mt-2 text-sm text-zinc-400">You can add an optional note for the contractor (e.g. feedback).</p>
            <label className="block text-xs font-medium text-zinc-500 mt-4 mb-1">Note (optional)</label>
            <textarea
              value={approveRejectComment}
              onChange={(e) => setApproveRejectComment(e.target.value)}
              placeholder={approveRejectApproved ? 'e.g. Looks good, thanks!' : 'e.g. Please revise the following...'}
              rows={3}
              className="mt-4 w-full px-4 py-3 rounded-lg border-2 border-zinc-700 bg-zinc-800/60 text-white placeholder-zinc-500 focus:outline-none focus:border-teal-500 resize-y"
            />
            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
            <div className="mt-6 flex gap-4">
              <button
                type="button"
                onClick={handleApproveReject}
                disabled={approveRejectLoading}
                className={`flex-1 py-3 rounded-lg font-semibold text-sm cursor-pointer disabled:opacity-50 ${approveRejectApproved ? 'bg-emerald-500 hover:bg-emerald-400 text-black' : 'bg-red-500 hover:bg-red-400 text-white'
                  }`}
              >
                {approveRejectLoading ? 'Saving…' : approveRejectApproved ? 'Approve' : 'Reject'}
              </button>
              <button
                type="button"
                onClick={() => setApproveRejectOpen(false)}
                disabled={approveRejectLoading}
                className="py-3 px-4 rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800 text-sm font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
