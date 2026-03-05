'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi, type AdminUserWalletSummary } from '@/lib/api/admin';
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
  const [walletSummary, setWalletSummary] = useState<AdminUserWalletSummary | null>(null);
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
      adminApi.getUserWalletSummary(userId).catch(() => null),
      adminApi.getUserActivity(userId).then((d: unknown) => (d as { activities?: ActivityEntry[] })?.activities ?? (Array.isArray(d) ? d : [])),
    ])
      .then(([p, summary, a]) => {
        if (cancelled) return;
        const profileObj = p && typeof p === 'object' && 'id' in p && 'email' in p ? (p as UserProfile) : null;
        const err = !profileObj && p && typeof p === 'object' && 'error' in p ? (p as { error?: string }).error : null;
        if (err) setError(err);
        setProfile(profileObj);
        setWalletSummary(summary && typeof summary === 'object' && 'networks' in summary ? summary : null);
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
          setWalletSummary(null);
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
      const summary = await adminApi.getUserWalletSummary(userId);
      setWalletSummary(summary);
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

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || '—';
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
          {/* Left column: Profile + Wallet */}
          <div className="lg:col-span-7 xl:col-span-8 min-w-0 space-y-6">
            <div className="rounded-xl border border-gray-800 bg-[#111111]">
              <div className="border-b border-gray-800 px-6 py-4">
                <h2 className="text-lg font-semibold text-white">Profile</h2>
                <p className="text-sm text-gray-500">User details</p>
              </div>
              <div className="p-6">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div><dt className="text-gray-500">ID</dt><dd className="text-white font-mono mt-0.5">{profile.id}</dd></div>
                  <div><dt className="text-gray-500">Email</dt><dd className="text-white mt-0.5">{profile.email}</dd></div>
                  <div><dt className="text-gray-500">Name</dt><dd className="text-white mt-0.5">{fullName}</dd></div>
                  <div><dt className="text-gray-500">Account type</dt><dd className="text-white mt-0.5">{profile.accountType}</dd></div>
                  <div><dt className="text-gray-500">Account status</dt><dd className="mt-0.5"><span className={isActive ? 'text-green-400' : 'text-red-400'}>{isActive ? 'Active' : 'Disabled'}</span></dd></div>
                  <div><dt className="text-gray-500">KYC status</dt><dd className="text-white mt-0.5">{profile.kycStatus}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-gray-500">Wallet address</dt><dd className="text-white font-mono break-all mt-0.5">{profile.walletAddress || '—'}</dd></div>
                  <div><dt className="text-gray-500">Created</dt><dd className="text-white mt-0.5">{profile.createdAt ? new Date(profile.createdAt).toLocaleString() : '—'}</dd></div>
                </dl>
              </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-[#111111]">
              <div className="border-b border-gray-800 px-6 py-4">
                <h2 className="text-lg font-semibold text-white">Networks & Wallets</h2>
                <p className="text-sm text-gray-500 mt-0.5">Networks from .env · Assets from Blockradar master wallet · User addresses and balances</p>
              </div>
              <div className="p-6">
                {!walletSummary ? (
                  <p className="text-gray-400 text-sm">Loading…</p>
                ) : walletSummary.networks.length === 0 ? (
                  <p className="text-gray-400 text-sm">No networks configured.</p>
                ) : (
                  <div className="space-y-8">
                    <section>
                      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Networks configured (.env)</h3>
                      <div className="flex flex-wrap gap-2">
                        {walletSummary.networks.map((net) => (
                          <div key={net.slug} className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2">
                            {net.logoUrl ? <img src={net.logoUrl} alt="" className="h-6 w-6 rounded-full object-cover bg-gray-800" /> : <div className="h-6 w-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-400">{(net.displayName || net.slug).slice(0, 1)}</div>}
                            <span className="text-white font-medium">{net.displayName}</span>
                            <span className="text-gray-500 text-xs font-mono">{net.slug}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section>
                      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Assets enabled in Blockradar master wallet (per network)</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {walletSummary.networks.map((net) => {
                          const assets = walletSummary.assetsByChain[net.slug] ?? [];
                          return (
                            <div key={net.slug} className="rounded-lg border border-gray-800 bg-[#0d0d0d] overflow-hidden">
                              <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-2">
                                {net.logoUrl ? <img src={net.logoUrl} alt="" className="h-5 w-5 rounded-full object-cover bg-gray-800" /> : <div className="h-5 w-5 rounded-full bg-gray-700 flex items-center justify-center text-[10px] text-gray-400">{(net.displayName || net.slug).slice(0, 1)}</div>}
                                <span className="text-white font-medium text-sm">{net.displayName}</span>
                              </div>
                              <div className="p-3 space-y-1.5 max-h-40 overflow-y-auto">
                                {assets.length === 0 ? <span className="text-gray-500 text-xs">No assets</span> : assets.map((a) => (
                                  <div key={a.id || a.symbol} className="flex items-center gap-2 text-sm">
                                    {a.logoUrl ? <img src={a.logoUrl} alt="" className="h-4 w-4 rounded-full object-cover bg-gray-800 shrink-0" /> : <div className="h-4 w-4 rounded-full bg-gray-700 flex items-center justify-center text-[9px] text-gray-400 shrink-0">{(a.symbol || '?').slice(0, 1)}</div>}
                                    <span className="text-gray-200">{a.symbol}</span>
                                    {a.name && a.name !== a.symbol && <span className="text-gray-500 text-xs truncate">{a.name}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                    <section>
                      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">User addresses & balances</h3>
                      {walletSummary.userChains.length === 0 ? (
                        <p className="text-gray-500 text-sm">No wallet addresses for this user.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                          {walletSummary.userChains.map((uc) => {
                            const bal = walletSummary.balancesByChain[uc.chainId];
                            const tokens = bal?.tokens ?? [];
                            return (
                              <div key={uc.chainId} className="rounded-lg border border-gray-800 bg-[#0d0d0d] overflow-hidden flex flex-col">
                                <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-2">
                                  <span className="text-white font-medium truncate">{uc.chainName}</span>
                                  <span className="text-gray-500 text-xs font-mono shrink-0">{uc.chainId}</span>
                                </div>
                                <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-2 min-w-0">
                                  <code className="text-gray-400 text-xs font-mono truncate flex-1">{uc.address}</code>
                                  <CopyButton text={uc.address} label="Copy address" />
                                </div>
                                <div className="p-4 flex-1 min-h-0">
                                  <div className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">Balances</div>
                                  {tokens.length === 0 ? <span className="text-gray-500 text-sm">—</span> : (
                                    <div className="space-y-2">
                                      {tokens.map((t, i) => (
                                        <div key={t.symbol + i} className="grid grid-cols-[auto_1fr_auto] gap-2 items-center text-sm">
                                          <div className="shrink-0">
                                            {t.logoUrl ? <img src={t.logoUrl} alt="" className="h-5 w-5 rounded-full object-cover bg-gray-800" /> : <div className="h-5 w-5 rounded-full bg-gray-700 flex items-center justify-center text-[10px] font-medium text-gray-400">{(t.symbol || '?').slice(0, 1)}</div>}
                                          </div>
                                          <div className="min-w-0 flex items-baseline gap-1.5 truncate">
                                            <span className="text-white font-medium shrink-0">{t.symbol}</span>
                                            <span className="text-gray-400 truncate">{t.balance}</span>
                                          </div>
                                          <div className="text-right shrink-0 text-gray-500 text-xs tabular-nums">{t.balanceUSD ? `${t.balanceUSD} USD` : '—'}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column: actions */}
          <div className="lg:col-span-5 xl:col-span-4 min-w-0 lg:min-w-[320px] space-y-6">
            <div className="rounded-xl border border-gray-800 bg-[#111111]">
              <div className="border-b border-gray-800 px-6 py-4">
                <h2 className="text-lg font-semibold text-white">Password</h2>
                <p className="text-sm text-gray-500">Send reset link by email</p>
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
                  <p className="text-sm text-gray-500">Enable or disable sign-in</p>
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
                <p className="text-sm text-gray-500">Status and reviewer</p>
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
                <p className="text-sm text-gray-500">Permanent. Cannot undo.</p>
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

        {/* Activity full width */}
        <div className="mt-8 rounded-xl border border-gray-800 bg-[#111111]">
          <div className="border-b border-gray-800 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">Activity</h2>
            <p className="text-sm text-gray-500">Recent activity logs</p>
          </div>
          <div className="p-6">
            {activity.length === 0 ? (
              <p className="text-gray-400 text-sm">No activity logs.</p>
            ) : (
              <ul className="space-y-2">
                {activity.slice(0, 50).map((log, i) => (
                  <li key={log.invoiceId ?? i} className="flex flex-wrap items-baseline gap-2 text-sm border-b border-gray-800 pb-2 last:border-0">
                    <span className="text-gray-500 shrink-0">{log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}</span>
                    <span className="text-white">{log.type ?? '—'}</span>
                    {log.amount != null && <span className="text-gray-400">{log.amount}</span>}
                    {log.status && <span className="text-gray-500">({log.status})</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
