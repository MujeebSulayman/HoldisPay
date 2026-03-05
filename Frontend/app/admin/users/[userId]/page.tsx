'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi, type AdminUserOverview } from '@/lib/api/admin';
import { userApi } from '@/lib/api/user';
import type { UserProfile } from '@/lib/api/user';
import { PageLoader } from '@/components/AppLoader';

type ActivityEntry = {
  invoiceId?: string;
  type?: string;
  amount?: string;
  tokenAddress?: string;
  status?: string;
  timestamp?: string;
  [key: string]: unknown;
};

function getInitial(name: string): string {
  const n = (name || '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-600 bg-gray-800/50 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700/50"
      title={label ?? 'Copy'}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = params.userId as string;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [overview, setOverview] = useState<AdminUserOverview | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kycStatus, setKycStatus] = useState('');
  const [kycNotes, setKycNotes] = useState('');
  const [kycReviewedBy, setKycReviewedBy] = useState('');
  const [kycRejectionReason, setKycRejectionReason] = useState('');
  const [kycSubmitting, setKycSubmitting] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [fundToken, setFundToken] = useState('');
  const [fundSubmitting, setFundSubmitting] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [passwordResetSending, setPasswordResetSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isCurrentAdmin, setIsCurrentAdmin] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      userApi.getProfile(userId).then((r: unknown) => (r as { data?: UserProfile })?.data ?? r),
      adminApi.getUserOverview(userId).catch(() => null),
      adminApi.getUserActivity(userId).then((d: unknown) => (d as { activities?: ActivityEntry[] })?.activities ?? (Array.isArray(d) ? d : [])),
    ])
      .then(([p, ov, a]) => {
        if (cancelled) return;
        const raw = p && typeof p === 'object' && 'id' in p && 'email' in p ? (p as Record<string, unknown>) : null;
        const err = !raw && p && typeof p === 'object' && 'error' in p ? (p as { error?: string }).error : null;
        if (err) setError(err);
        // API returns nested profile: { profile: { firstName, lastName, phoneNumber }, tag, ... }; flatten for display
        const nested = raw?.profile as { firstName?: string; lastName?: string; phoneNumber?: string } | undefined;
        const profileObj: UserProfile | null = raw
          ? {
              ...raw,
              firstName: (raw.firstName as string) ?? nested?.firstName ?? '',
              lastName: (raw.lastName as string) ?? nested?.lastName ?? '',
              tag: (raw.tag as string | undefined) ?? undefined,
              phoneNumber: (raw.phoneNumber as string | null) ?? nested?.phoneNumber ?? null,
            } as UserProfile
          : null;
        setProfile(profileObj);
        setOverview(ov && typeof ov === 'object' && 'balance' in ov ? (ov as AdminUserOverview) : null);
        setActivity(Array.isArray(a) ? a : []);
        setKycStatus(profileObj?.kycStatus ?? '');
        try {
          const stored = localStorage.getItem('user');
          const parsed = stored ? JSON.parse(stored) : {};
          setIsCurrentAdmin(parsed.id === profileObj?.id);
        } catch {
          setIsCurrentAdmin(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message ?? 'Failed to load user');
          setProfile(null);
          setOverview(null);
          setActivity([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  const handleKycUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kycStatus || !kycReviewedBy.trim()) {
      setMessage({ type: 'err', text: 'Status and Reviewed by are required.' });
      return;
    }
    setKycSubmitting(true);
    setMessage(null);
    try {
      await adminApi.updateUserKYC(userId, {
        status: kycStatus,
        reviewedBy: kycReviewedBy.trim(),
        notes: kycNotes.trim() || undefined,
        rejectionReason: kycRejectionReason.trim() || undefined,
      });
      setMessage({ type: 'ok', text: 'KYC status updated.' });
      setProfile((prev) => (prev ? { ...prev, kycStatus } : null));
    } catch (e: unknown) {
      setMessage({ type: 'err', text: (e as { message?: string })?.message ?? 'Update failed.' });
    } finally {
      setKycSubmitting(false);
    }
  };

  const handleFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundAmount.trim()) {
      setMessage({ type: 'err', text: 'Amount is required.' });
      return;
    }
    setFundSubmitting(true);
    setMessage(null);
    try {
      await adminApi.fundUserWallet(userId, {
        amount: fundAmount.trim(),
        token: fundToken.trim() || undefined,
      });
      setMessage({ type: 'ok', text: 'Wallet fund request sent.' });
      setFundAmount('');
      setFundToken('');
      const ov = await adminApi.getUserOverview(userId);
      if (ov) setOverview(ov);
    } catch (e: unknown) {
      setMessage({ type: 'err', text: (e as { message?: string })?.message ?? 'Fund failed.' });
    } finally {
      setFundSubmitting(false);
    }
  };

  const sendPasswordReset = async () => {
    setPasswordResetSending(true);
    setMessage(null);
    try {
      await adminApi.sendPasswordReset(userId);
      setMessage({ type: 'ok', text: 'Password reset email sent.' });
    } catch (e: unknown) {
      setMessage({ type: 'err', text: (e as { message?: string })?.message ?? 'Failed to send.' });
    } finally {
      setPasswordResetSending(false);
    }
  };

  const toggleStatus = async () => {
    const next = profile!.isActive === false;
    setStatusSubmitting(true);
    setMessage(null);
    try {
      await adminApi.updateUserStatus(userId, next);
      setProfile((p) => (p ? { ...p, isActive: next } : null));
      setMessage({ type: 'ok', text: next ? 'User enabled.' : 'User disabled.' });
    } catch (e: unknown) {
      setMessage({ type: 'err', text: (e as { message?: string })?.message ?? 'Update failed.' });
    } finally {
      setStatusSubmitting(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0A0A0A]">
        <PageLoader />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <p className="text-red-400">{error ?? 'User not found'}</p>
          <Link href="/admin/users" className="mt-4 inline-block text-teal-400 hover:underline">Back to Users</Link>
        </div>
      </div>
    );
  }

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || '—';
  const isActive = profile.isActive !== false;

  return (
    <div className="flex-1 overflow-auto bg-[#0A0A0A]">
      <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-8">
        <div className="mb-6">
          <Link href="/admin/users" className="text-gray-400 hover:text-white text-sm">← Users</Link>
        </div>

        {message && (
          <div className={`mb-6 p-3 rounded-xl border ${message.type === 'ok' ? 'bg-teal-500/10 border-teal-500/30 text-teal-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            {message.text}
          </div>
        )}

        {/* Header card: banner + avatar + name + badges + ID + quick actions */}
        <div className="rounded-xl border border-gray-800 bg-[#111111] overflow-hidden mb-8">
          <div className="h-2 bg-gradient-to-r from-teal-600/80 to-cyan-600/80" />
          <div className="px-6 pb-6 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex items-center gap-4">
                <div className="relative -mt-8">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#111111] bg-gray-800 text-2xl font-semibold text-white">
                    {getInitial(fullName)}
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">{fullName}</h1>
                  <p className="text-gray-400 text-sm">{profile.email}</p>
                  {profile.tag && <span className="inline-block mt-1 text-xs text-gray-500 font-mono">{profile.tag}</span>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                <span className="rounded-full bg-gray-700/80 px-2.5 py-0.5 text-xs font-medium text-gray-300">{profile.accountType}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {isActive ? 'Active' : 'Disabled'}
                </span>
                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400">KYC: {profile.kycStatus}</span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-gray-500 text-sm">User ID</span>
              <code className="rounded bg-gray-800/80 px-2 py-1 text-xs text-gray-300 font-mono">{profile.id}</code>
              <CopyButton text={profile.id} label="Copy user ID" />
              <div className="flex flex-wrap gap-2 ml-auto">
                <button
                  type="button"
                  disabled={passwordResetSending}
                  onClick={sendPasswordReset}
                  className="rounded-lg border border-gray-600 bg-gray-800/50 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700/50 disabled:opacity-50"
                >
                  {passwordResetSending ? 'Sending…' : 'Send password reset'}
                </button>
                {!isCurrentAdmin && (
                  <button
                    type="button"
                    disabled={statusSubmitting}
                    onClick={toggleStatus}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${isActive ? 'border border-red-500/40 text-red-400 hover:bg-red-500/10' : 'bg-teal-600 text-white hover:bg-teal-500'}`}
                  >
                    {statusSubmitting ? 'Updating…' : isActive ? 'Disable user' : 'Enable user'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: section-based layout (Summary + Profile) */}
          <div className="lg:col-span-7 xl:col-span-8 min-w-0 space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Summary</h2>
              <div className="rounded-xl border border-gray-800 bg-[#111111] overflow-hidden">
                <div className="p-4">
                  <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm">
                    <div><span className="text-gray-500">Withdrawable</span><span className="ml-2 font-medium tabular-nums text-white">{overview ? overview.balance.withdrawableChains : '—'}</span><span className="text-gray-500 ml-1">chains</span></div>
                    <div><span className="text-gray-500">Locked</span><span className="ml-2 font-medium tabular-nums text-white">{overview ? overview.balance.lockedChains : '—'}</span><span className="text-gray-500 ml-1">chains</span></div>
                    <div><span className="text-gray-500">Employer</span><span className="ml-2 font-medium tabular-nums text-white">{overview ? overview.contracts.asEmployer : '—'}</span><span className="text-gray-500 ml-1">contracts</span></div>
                    <div><span className="text-gray-500">Contractor</span><span className="ml-2 font-medium tabular-nums text-white">{overview ? overview.contracts.asContractor : '—'}</span><span className="text-gray-500 ml-1">contracts</span></div>
                    <div><span className="text-gray-500">Issued</span><span className="ml-2 font-medium tabular-nums text-white">{overview ? overview.invoices.issued : '—'}</span><span className="text-gray-500 ml-1">invoices</span></div>
                    <div><span className="text-gray-500">Paying</span><span className="ml-2 font-medium tabular-nums text-white">{overview ? overview.invoices.paying : '—'}</span><span className="text-gray-500 ml-1">invoices</span></div>
                    <div><span className="text-gray-500">Receiving</span><span className="ml-2 font-medium tabular-nums text-white">{overview ? overview.invoices.receiving : '—'}</span><span className="text-gray-500 ml-1">invoices</span></div>
                    <div><span className="text-gray-500">Pending</span><span className="ml-2 font-medium tabular-nums text-white">{overview ? overview.invoices.pending : '—'}</span><span className="text-gray-500 ml-1">invoices</span></div>
                    <div><span className="text-gray-500">Paid</span><span className="ml-2 font-medium tabular-nums text-white">{overview ? overview.invoices.paid : '—'}</span><span className="text-gray-500 ml-1">invoices</span></div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Profile</h2>
              <div className="rounded-xl border border-gray-800 bg-[#111111] overflow-hidden">
                <dl className="divide-y divide-gray-800">
                  <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-gray-500 text-sm shrink-0">Email</dt><dd className="text-white text-sm text-right truncate" title={profile.email}>{profile.email}</dd></div>
                  <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-gray-500 text-sm shrink-0">Name</dt><dd className="text-white text-sm text-right">{fullName}</dd></div>
                  <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-gray-500 text-sm shrink-0">Tag / username</dt><dd className="text-white text-sm text-right font-mono">{profile.tag || '—'}</dd></div>
                  <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-gray-500 text-sm shrink-0">Phone</dt><dd className="text-white text-sm text-right">{profile.phoneNumber || '—'}</dd></div>
                  <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-gray-500 text-sm shrink-0">Email verified</dt><dd className="text-white text-sm text-right">{profile.emailVerified ? 'Yes' : 'No'}</dd></div>
                  <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-gray-500 text-sm shrink-0">Wallet address</dt><dd className="text-white text-sm text-right truncate font-mono max-w-[200px]" title={profile.walletAddress}>{profile.walletAddress || '—'}</dd></div>
                  <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-gray-500 text-sm shrink-0">Account type</dt><dd className="text-white text-sm text-right">{profile.accountType}</dd></div>
                  <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-gray-500 text-sm shrink-0">KYC status</dt><dd className="text-white text-sm text-right">{profile.kycStatus}</dd></div>
                  <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-gray-500 text-sm shrink-0">Created</dt><dd className="text-white text-sm text-right">{profile.createdAt ? new Date(profile.createdAt).toLocaleString() : '—'}</dd></div>
                </dl>
              </div>
            </section>
          </div>

          {/* Right column: actions */}
          <div className="lg:col-span-5 xl:col-span-4 min-w-0 lg:min-w-[320px] space-y-6">
            <div className="rounded-xl border border-gray-800 bg-[#111111]">
              <div className="border-b border-gray-800 px-6 py-4">
                <h2 className="text-lg font-semibold text-white">Password</h2>
              </div>
              <div className="p-6">
                <button
                  type="button"
                  disabled={passwordResetSending}
                  onClick={sendPasswordReset}
                  className="w-full rounded-lg border border-gray-600 bg-gray-800/50 py-2 text-sm text-gray-300 hover:bg-gray-700/50 disabled:opacity-50"
                >
                  {passwordResetSending ? 'Sending…' : 'Send password reset email'}
                </button>
              </div>
            </div>

            {!isCurrentAdmin && (
              <div className="rounded-xl border border-gray-800 bg-[#111111]">
                <div className="border-b border-gray-800 px-6 py-4">
                  <h2 className="text-lg font-semibold text-white">Account status</h2>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-white text-sm">{isActive ? 'Active' : 'Disabled'}</span>
                    <button
                      type="button"
                      disabled={statusSubmitting}
                      onClick={toggleStatus}
                      className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${isActive ? 'border border-red-500/40 text-red-400 hover:bg-red-500/10' : 'bg-teal-600 text-white hover:bg-teal-500'}`}
                    >
                      {statusSubmitting ? 'Updating…' : isActive ? 'Disable user' : 'Enable user'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-gray-800 bg-[#111111]">
              <div className="border-b border-gray-800 px-6 py-4">
                <h2 className="text-lg font-semibold text-white">Update KYC</h2>
              </div>
              <div className="p-6">
                <form onSubmit={handleKycUpdate} className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Status</label>
                    <select
                      value={kycStatus}
                      onChange={(e) => setKycStatus(e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      <option value="">Select</option>
                      <option value="pending">Pending</option>
                      <option value="submitted">Submitted</option>
                      <option value="under_review">Under review</option>
                      <option value="verified">Verified</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Reviewed by</label>
                    <input
                      type="text"
                      value={kycReviewedBy}
                      onChange={(e) => setKycReviewedBy(e.target.value)}
                      placeholder="Admin name/email"
                      className="w-full bg-[#0A0A0A] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Notes</label>
                    <input
                      type="text"
                      value={kycNotes}
                      onChange={(e) => setKycNotes(e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Rejection reason (if rejected)</label>
                    <input
                      type="text"
                      value={kycRejectionReason}
                      onChange={(e) => setKycRejectionReason(e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <button type="submit" disabled={kycSubmitting} className="w-full rounded-lg bg-teal-600 py-2 text-sm text-white hover:bg-teal-500 disabled:opacity-50">
                    {kycSubmitting ? 'Saving…' : 'Update KYC'}
                  </button>
                </form>
              </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-[#111111]">
              <div className="border-b border-gray-800 px-6 py-4">
                <h2 className="text-lg font-semibold text-white">Fund wallet</h2>
              </div>
              <div className="p-6">
                <form onSubmit={handleFund} className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Amount</label>
                    <input
                      type="text"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      placeholder="0.01"
                      className="w-full bg-[#0A0A0A] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Token (optional)</label>
                    <input
                      type="text"
                      value={fundToken}
                      onChange={(e) => setFundToken(e.target.value)}
                      placeholder="e.g. USDC"
                      className="w-full bg-[#0A0A0A] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <button type="submit" disabled={fundSubmitting} className="w-full rounded-lg bg-teal-600 py-2 text-sm text-white hover:bg-teal-500 disabled:opacity-50">
                    {fundSubmitting ? 'Sending…' : 'Fund wallet'}
                  </button>
                </form>
              </div>
            </div>

            <div className="rounded-xl border border-red-900/50 bg-[#111111]">
              <div className="border-b border-gray-800 px-6 py-4">
                <h2 className="text-lg font-semibold text-red-400">Delete user</h2>
              </div>
              <div className="p-6">
                {isCurrentAdmin ? (
                  <p className="text-amber-400 text-sm">You cannot delete your own account.</p>
                ) : !deleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(true)}
                    className="w-full rounded-lg border border-red-500/40 py-2 text-sm text-red-400 hover:bg-red-500/10"
                  >
                    Delete user
                  </button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <span className="text-gray-400 text-sm">Are you sure?</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={deleteSubmitting}
                        onClick={async () => {
                          setDeleteSubmitting(true);
                          setMessage(null);
                          try {
                            await adminApi.deleteUser(userId);
                            router.push('/admin/users');
                            return;
                          } catch (e: unknown) {
                            setMessage({ type: 'err', text: (e as { message?: string })?.message ?? 'Delete failed.' });
                          } finally {
                            setDeleteSubmitting(false);
                            setDeleteConfirm(false);
                          }
                        }}
                        className="flex-1 rounded-lg bg-red-600 py-2 text-sm text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        {deleteSubmitting ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button
                        type="button"
                        disabled={deleteSubmitting}
                        onClick={() => setDeleteConfirm(false)}
                        className="rounded-lg border border-gray-600 py-2 px-4 text-sm text-gray-300 hover:bg-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Activity: table */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-white mb-3">Activity</h2>
          <div className="rounded-xl border border-gray-800 bg-[#111111] overflow-hidden">
            {activity.length === 0 ? (
              <div className="p-6">
                <p className="text-gray-400 text-sm">No activity logs.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-[#0d0d0d]">
                      <th className="text-left font-medium text-gray-500 py-3 px-4">Date</th>
                      <th className="text-left font-medium text-gray-500 py-3 px-4">Type</th>
                      <th className="text-right font-medium text-gray-500 py-3 px-4">Amount</th>
                      <th className="text-left font-medium text-gray-500 py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.slice(0, 50).map((log, i) => (
                      <tr key={log.invoiceId ?? i} className="border-b border-gray-800/60 last:border-0 hover:bg-gray-800/30">
                        <td className="py-3 px-4 text-gray-400">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}</td>
                        <td className="py-3 px-4 text-white">{log.type ?? '—'}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-gray-300">{log.amount ?? '—'}</td>
                        <td className="py-3 px-4 text-gray-400">{log.status ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
