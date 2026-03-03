'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api/admin';
import { userApi } from '@/lib/api/user';
import type { UserProfile, WalletDetails } from '@/lib/api/user';
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

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<WalletDetails | null>(null);
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
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      userApi.getProfile(userId).then((r: unknown) => (r as { data?: UserProfile })?.data ?? r),
      userApi.getWallet(userId).then((r: unknown) => (r as { data?: WalletDetails })?.data ?? r).catch(() => null),
      adminApi.getUserActivity(userId).then((d: unknown) => (d as { activities?: ActivityEntry[] })?.activities ?? (Array.isArray(d) ? d : [])),
    ])
      .then(([p, w, a]) => {
        if (cancelled) return;
        setProfile(p as UserProfile);
        setWallet((w as WalletDetails) ?? null);
        setActivity(Array.isArray(a) ? a : []);
        setKycStatus((p as UserProfile)?.kycStatus ?? '');
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message ?? 'Failed to load user');
          setProfile(null);
          setWallet(null);
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
      const w = await userApi.getWallet(userId).then((r: unknown) => (r as { data?: WalletDetails })?.data ?? r);
      setWallet((w as WalletDetails) ?? null);
    } catch (e: unknown) {
      setMessage({ type: 'err', text: (e as { message?: string })?.message ?? 'Fund failed.' });
    } finally {
      setFundSubmitting(false);
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

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/admin/users" className="text-gray-400 hover:text-white">← Users</Link>
          <h2 className="text-2xl font-bold text-white">User: {profile.email}</h2>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg ${message.type === 'ok' ? 'bg-teal-500/20 text-teal-400' : 'bg-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}

        <section className="bg-[#111111] border border-gray-800 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Profile</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><dt className="text-gray-400">ID</dt><dd className="text-white font-mono">{profile.id}</dd></div>
            <div><dt className="text-gray-400">Email</dt><dd className="text-white">{profile.email}</dd></div>
            <div><dt className="text-gray-400">Name</dt><dd className="text-white">{profile.firstName} {profile.lastName}</dd></div>
            <div><dt className="text-gray-400">Account type</dt><dd className="text-white">{profile.accountType}</dd></div>
            <div><dt className="text-gray-400">KYC status</dt><dd className="text-white">{profile.kycStatus}</dd></div>
            <div><dt className="text-gray-400">Wallet address</dt><dd className="text-white font-mono break-all">{profile.walletAddress || '—'}</dd></div>
            <div><dt className="text-gray-400">Created</dt><dd className="text-white">{profile.createdAt ? new Date(profile.createdAt).toLocaleString() : '—'}</dd></div>
          </dl>
        </section>

        {wallet && (
          <section className="bg-[#111111] border border-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Wallet</h3>
            <p className="text-gray-400 text-sm font-mono break-all mb-2">Address: {wallet.address}</p>
            <p className="text-white text-sm">Native balance: {wallet.balance?.nativeBalance ?? '—'} {wallet.balance?.nativeBalanceInUSD != null ? `(${wallet.balance.nativeBalanceInUSD} USD)` : ''}</p>
            {Array.isArray(wallet.balance?.tokens) && wallet.balance.tokens.length > 0 && (
              <ul className="mt-2 text-sm text-gray-300">
                {wallet.balance.tokens.map((t) => (
                  <li key={t.token}>{t.symbol}: {t.balance} {t.balanceInUSD != null ? `(${t.balanceInUSD} USD)` : ''}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="bg-[#111111] border border-gray-800 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Update KYC</h3>
          <form onSubmit={handleKycUpdate} className="space-y-3 max-w-md">
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
            <button type="submit" disabled={kycSubmitting} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-500 disabled:opacity-50">
              {kycSubmitting ? 'Saving…' : 'Update KYC'}
            </button>
          </form>
        </section>

        <section className="bg-[#111111] border border-gray-800 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Fund wallet</h3>
          <form onSubmit={handleFund} className="space-y-3 max-w-md">
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
            <button type="submit" disabled={fundSubmitting} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-500 disabled:opacity-50">
              {fundSubmitting ? 'Sending…' : 'Fund wallet'}
            </button>
          </form>
        </section>

        <section className="bg-[#111111] border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Activity</h3>
          {activity.length === 0 ? (
            <p className="text-gray-400 text-sm">No activity logs.</p>
          ) : (
            <ul className="space-y-2">
              {activity.slice(0, 50).map((log, i) => (
                <li key={log.invoiceId ?? i} className="text-sm text-gray-300 border-b border-gray-800 pb-2">
                  <span className="text-gray-500">{log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}</span>
                  {' '}<span className="text-white">{log.type ?? '—'}</span>
                  {log.amount != null && <span className="text-gray-400"> {log.amount}</span>}
                  {log.status && <span className="text-gray-500"> ({log.status})</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
