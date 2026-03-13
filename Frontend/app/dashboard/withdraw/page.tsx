'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { userApi } from '@/lib/api/user';
import { paymentMethodsApi, type PaymentMethod } from '@/lib/api/payment-methods';
import { walletApi } from '@/lib/api/wallet';
import { getErrorMessage } from '@/lib/api/client';
import { toast } from 'sonner';
import {
  ArrowDownToLine,
  Building2,
  ChevronDown,
  PlusCircle,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

export default function WithdrawPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [withdrawableUsd, setWithdrawableUsd] = useState(0);
  const [loadingPm, setLoadingPm] = useState(true);
  const [loadingBalance, setLoadingBalance] = useState(true);

  // Bank withdrawal state
  const [amountUsdc, setAmountUsdc] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [quote, setQuote] = useState<{ amountInCurrency: number; rate: number; currency: string; fee?: number } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submittingBank, setSubmittingBank] = useState(false);
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const bankDropdownRef = useRef<HTMLDivElement>(null);

  const userId = user?.id;

  // Click outside dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(t)) setBankDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  

  useEffect(() => {
    if (!authLoading && !user) router.push('/signin');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user?.id) refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!userId) return;
    setLoadingPm(true);
    paymentMethodsApi.getPaymentMethods(userId)
      .then(res => { if (res.success && res.data) setPaymentMethods(res.data); })
      .finally(() => setLoadingPm(false));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setLoadingBalance(true);
    userApi.getConsolidatedBalance(userId)
      .then(res => {
        if (res.success && res.data?.withdrawableUsd != null) setWithdrawableUsd(res.data.withdrawableUsd);
        else setWithdrawableUsd(0);
      })
      .finally(() => setLoadingBalance(false));
  }, [userId]);

  const fetchQuote = useCallback(() => {
    const amt = amountUsdc.trim();
    if (!amt || !userId) { setQuote(null); return; }
    const num = parseFloat(amt);
    if (Number.isNaN(num) || num <= 0) { setQuote(null); return; }
    setQuoteLoading(true);
    walletApi.getNairaWithdrawQuote(amt, 'NGN')
      .then(res => {
        if (res.success && res.data) {
          setQuote({
            amountInCurrency: res.data.amountInCurrency ?? 0,
            rate: res.data.rate,
            currency: res.data.currency ?? 'NGN',
            fee: res.data.fee,
          });
        } else setQuote(null);
      })
      .catch(() => setQuote(null))
      .finally(() => setQuoteLoading(false));
  }, [amountUsdc, userId]);

  useEffect(() => {
    const t = setTimeout(fetchQuote, 400);
    return () => clearTimeout(t);
  }, [fetchQuote]);

  const handleBankSubmit = async () => {
    if (!userId || !amountUsdc.trim() || !paymentMethodId) { toast.error('Enter amount and select a bank account.'); return; }
    const num = parseFloat(amountUsdc.trim());
    if (Number.isNaN(num) || num <= 0 || Math.round(num * 100) > Math.round(withdrawableUsd * 100)) { toast.error('Insufficient balance or invalid amount.'); return; }
    setSubmittingBank(true);
    try {
      const res = await walletApi.withdrawNaira({ amountUsdc: amountUsdc.trim(), paymentMethodId });
      if (res.success) {
        toast.success('Withdrawal initiated successfully!');
        setAmountUsdc(''); setPaymentMethodId(''); setQuote(null);
        refreshUser();
      } else toast.error(getErrorMessage(res, 'Withdrawal failed'));
    } catch (e) { toast.error(getErrorMessage(e, 'Withdrawal failed')); }
    finally { setSubmittingBank(false); }
  };

  const balFmt = (n: number) => `$${(Math.floor(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const overAmount = amountUsdc.trim() && !Number.isNaN(parseFloat(amountUsdc.trim())) && Math.round(parseFloat(amountUsdc.trim()) * 100) > Math.round(withdrawableUsd * 100);
  const selectedPm = paymentMethods.find(m => m.id === paymentMethodId);

  if (authLoading || !user) {
    return (
      <PremiumDashboardLayout>
        <div className="max-w-xl mx-auto py-12 px-4 space-y-4">
          <div className="h-28 rounded-2xl bg-gray-800/40 animate-pulse" />
          <div className="h-12 rounded-xl bg-gray-800/30 animate-pulse" />
          <div className="h-64 rounded-2xl bg-gray-800/20 animate-pulse" />
        </div>
      </PremiumDashboardLayout>
    );
  }

  if (user.kycStatus !== 'verified' && user.kycStatus !== 'approved') {
    return (
      <PremiumDashboardLayout>
        <div className="max-w-md mx-auto py-16 px-4 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-6">
            <ShieldCheck className="w-9 h-9 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Verification Required</h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-sm">
            Please complete identity verification to unlock withdrawals and keep your account secure.
          </p>
          <Link href="/dashboard/settings?tab=kyc">
            <Button className="bg-teal-400 hover:bg-teal-500 text-black font-semibold gap-2 px-8">
              Complete KYC <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </PremiumDashboardLayout>
    );
  }

  return (
    <PremiumDashboardLayout>
      <div className="max-w-xl mx-auto py-6 px-4 sm:px-0 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400">
            <ArrowDownToLine className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Withdraw</h1>
            <p className="text-sm text-gray-500 mt-0.5">Move funds to your bank account via Monnify</p>
          </div>
        </div>

        {/* Balance card */}
        <div className="relative rounded-2xl overflow-hidden border border-gray-800 bg-[#0a0a0a] p-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-2">Available to withdraw</p>
          {loadingBalance ? (
            <div className="h-10 w-36 bg-gray-700/40 rounded-lg animate-pulse" />
          ) : (
            <p className="text-4xl font-bold text-white tabular-nums">{balFmt(withdrawableUsd)}</p>
          )}
          <p className="text-xs text-gray-500 mt-2">USD balance ready for withdrawal</p>
        </div>

        {/* ── BANK WITHDRAWAL PANEL ── */}
        <div className="rounded-2xl border border-gray-800 bg-[#0a0a0a] divide-y divide-gray-800/60 overflow-hidden">
          <div className="p-5 space-y-3">
            <Label className="text-sm text-gray-400">Amount (USD)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amountUsdc}
                  onChange={e => setAmountUsdc(e.target.value)}
                  className="pl-8 bg-gray-900/60 border-gray-800 text-white text-lg font-semibold h-12 focus:border-teal-500/50 focus:ring-teal-500/20"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAmountUsdc(withdrawableUsd <= 0 ? '0' : (Math.floor(withdrawableUsd * 100) / 100).toFixed(2))}
                className="h-12 px-4 border-gray-700 text-gray-300 hover:text-white hover:border-gray-500"
              >
                Max
              </Button>
            </div>
            {overAmount && (
              <div className="flex items-center gap-2 text-red-400 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Exceeds available balance ({balFmt(withdrawableUsd)})
              </div>
            )}
          </div>

          <div className="p-5 space-y-3 bg-gray-900/30">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Conversion details</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 flex items-center gap-1.5">Fee</span>
                <span className="text-gray-300">{amountUsdc.trim() && quote?.fee != null ? `${quote.fee} USD` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Exchange rate</span>
                <span className="text-gray-300">
                  {quoteLoading ? <span className="text-gray-600">Fetching…</span> : amountUsdc.trim() && quote ? `1 USD = ${quote.rate?.toLocaleString()} ${quote.currency}` : '—'}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-800/80">
                <span className="text-white font-medium">You receive</span>
                <span className="text-teal-400 font-bold text-base">
                  {quoteLoading ? (
                    <span className="text-gray-600 text-sm animate-pulse">Calculating…</span>
                  ) : amountUsdc.trim() && quote ? (
                    `${quote.amountInCurrency?.toLocaleString()} ${quote.currency}`
                  ) : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-3">
            <Label className="text-sm text-gray-400">Recipient bank account</Label>
            {loadingPm ? (
              <div className="h-12 rounded-xl bg-gray-800/40 animate-pulse" />
            ) : paymentMethods.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-700 p-5 flex flex-col items-center text-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-400 font-medium">No bank account linked</p>
                  <p className="text-xs text-gray-600 mt-0.5">Add one to withdraw in NGN</p>
                </div>
                <Link href="/dashboard/settings?tab=payment-methods">
                  <Button size="sm" variant="outline" className="gap-2 border-gray-700 text-gray-300 hover:text-white">
                    <PlusCircle className="w-4 h-4" /> Add bank account
                  </Button>
                </Link>
              </div>
            ) : (
              <div ref={bankDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setBankDropdownOpen(o => !o)}
                  className="w-full flex items-center justify-between gap-3 h-12 px-4 rounded-xl border border-gray-800 bg-gray-900/60 text-sm text-white hover:border-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-colors"
                >
                  {selectedPm ? (
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-gray-400" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium text-white truncate">{selectedPm.bank_name}</span>
                        <span className="block text-xs text-gray-500 truncate">{selectedPm.account_name} · {selectedPm.account_number_masked}</span>
                      </span>
                    </span>
                  ) : (
                    <span className="text-gray-500">Select bank account</span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${bankDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {bankDropdownOpen && (
                  <ul className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-gray-800 bg-[#0d0d0d] shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                    {paymentMethods.map(pm => (
                      <li
                          key={pm.id}
                        onMouseDown={e => { e.preventDefault(); setPaymentMethodId(pm.id); setBankDropdownOpen(false); }}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer text-sm hover:bg-gray-800/60 transition-colors border-b border-gray-800/50 last:border-0 ${paymentMethodId === pm.id ? 'bg-gray-800/40' : ''}`}
                      >
                        <Building2 className="w-4 h-4 text-teal-400 shrink-0" />
                        <span className="min-w-0">
                          <span className="block font-medium text-white truncate">{pm.bank_name}</span>
                          <span className="block text-xs text-gray-500 truncate">{pm.account_name} · {pm.account_number_masked}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="p-5">
            <Button
              onClick={handleBankSubmit}
              disabled={submittingBank || !amountUsdc.trim() || !paymentMethodId || overAmount || (!!amountUsdc.trim() && (quoteLoading || !quote))}
              className="w-full h-12 bg-teal-400 hover:bg-teal-500 text-black font-bold text-base gap-2 disabled:opacity-40"
            >
              {submittingBank ? 'Processing…' : 'Withdraw to Bank'} &nbsp; <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 pb-2">
          Withdrawals are processed securely via Monnify. <span className="text-gray-500">Typical confirmation: 2-5 minutes.</span>
        </p>
      </div>
    </PremiumDashboardLayout>
  );
}