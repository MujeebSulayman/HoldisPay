'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { userApi, type ChainWallet } from '@/lib/api/user';
import { paymentMethodsApi, type PaymentMethod } from '@/lib/api/payment-methods';
import { walletApi, type Asset } from '@/lib/api/wallet';
import { getErrorMessage } from '@/lib/api/client';
import { toast } from 'sonner';
import {
  ArrowDownToLine,
  Building2,
  Wallet,
  ChevronDown,
  PlusCircle,
  HelpCircle,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

type WithdrawTab = 'bank' | 'crypto';

export default function WithdrawPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<WithdrawTab>('bank');

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [wallets, setWallets] = useState<ChainWallet[]>([]);
  const [chainAssets, setChainAssets] = useState<Asset[]>([]);
  const [withdrawableUsd, setWithdrawableUsd] = useState(0);
  const [loadingPm, setLoadingPm] = useState(true);
  const [loadingWallets, setLoadingWallets] = useState(true);
  const [loadingBalance, setLoadingBalance] = useState(true);

  // Bank withdrawal state
  const [amountUsdc, setAmountUsdc] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [quote, setQuote] = useState<{ amountInCurrency: number; rate: number; currency: string; fee?: number } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submittingBank, setSubmittingBank] = useState(false);
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const bankDropdownRef = useRef<HTMLDivElement>(null);

  // Crypto withdrawal state
  const [chainId, setChainId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [amountCrypto, setAmountCrypto] = useState('');
  const [feeEstimate, setFeeEstimate] = useState<string | null>(null);
  const [submittingCrypto, setSubmittingCrypto] = useState(false);
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false);
  const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
  const networkDropdownRef = useRef<HTMLDivElement>(null);
  const assetDropdownRef = useRef<HTMLDivElement>(null);

  const userId = user?.id;

  // Click outside dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(t)) setBankDropdownOpen(false);
      if (networkDropdownRef.current && !networkDropdownRef.current.contains(t)) setNetworkDropdownOpen(false);
      if (assetDropdownRef.current && !assetDropdownRef.current.contains(t)) setAssetDropdownOpen(false);
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
    setLoadingWallets(true);
    userApi.getAllWallets(userId)
      .then(res => { if (res.success && res.data) setWallets(res.data); })
      .finally(() => setLoadingWallets(false));
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

  useEffect(() => {
    if (!chainId) { setChainAssets([]); setAssetId(''); return; }
    walletApi.getChainAssets(chainId).then(res => {
      if (res.success && res.data?.assets) setChainAssets(res.data.assets);
      else setChainAssets([]);
      setAssetId('');
    });
  }, [chainId]);

  useEffect(() => {
    if (!chainId || !assetId || !toAddress.trim() || !amountCrypto.trim()) { setFeeEstimate(null); return; }
    const t = setTimeout(() => {
      walletApi.estimateWithdrawalFee({ chainId, assetId, address: toAddress.trim(), amount: amountCrypto.trim() })
        .then(res => {
          if (res.success && res.data) {
            setFeeEstimate(res.data.networkFeeInUSD ? `$${parseFloat(res.data.networkFeeInUSD).toFixed(4)}` : res.data.networkFee || null);
          } else setFeeEstimate(null);
        }).catch(() => setFeeEstimate(null));
    }, 600);
    return () => clearTimeout(t);
  }, [chainId, assetId, toAddress, amountCrypto]);

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
            amountInCurrency: res.data.amountInCurrency ?? (res.data as any).amountNgn ?? 0,
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
        if (userId) {
          userApi.getConsolidatedBalance(userId).then(r => { if (r.success && r.data?.withdrawableUsd != null) setWithdrawableUsd(r.data.withdrawableUsd); });
          userApi.getAllWallets(userId).then(r => { if (r.success && r.data) setWallets(r.data); });
        }
        router.refresh();
      } else toast.error(getErrorMessage(res, 'Withdrawal failed'));
    } catch (e) { toast.error(getErrorMessage(e, 'Withdrawal failed')); }
    finally { setSubmittingBank(false); }
  };

  const handleCryptoSubmit = async () => {
    if (!chainId || !assetId || !toAddress.trim() || !amountCrypto.trim()) { toast.error('Fill chain, asset, address and amount.'); return; }
    const asset = chainAssets.find(a => a.id === assetId);
    const tokenAddress = asset?.address && asset.symbol?.toLowerCase() !== 'eth' ? asset.address : null;
    setSubmittingCrypto(true);
    try {
      const res = await walletApi.withdraw({ chainId, assetId, address: toAddress.trim(), amount: amountCrypto.trim(), tokenAddress });
      if (res.success && res.data) {
        toast.success('Withdrawal initiated.');
        setAmountCrypto(''); setToAddress('');
        if (userId) {
          userApi.getAllWallets(userId).then(r => r.success && r.data && setWallets(r.data));
          userApi.getConsolidatedBalance(userId).then(r => r.success && r.data?.withdrawableUsd != null && setWithdrawableUsd(r.data.withdrawableUsd));
        }
      } else toast.error(getErrorMessage(res, 'Withdrawal failed'));
    } catch (e) { toast.error(getErrorMessage(e, 'Withdrawal failed')); }
    finally { setSubmittingCrypto(false); }
  };

  const balanceByChain = (() => {
    if (!wallets?.length) return [];
    return wallets.map(w => {
      const nativeUsd = parseFloat(w.balance?.nativeUSD || '0');
      let total = nativeUsd;
      for (const t of w.balance?.tokens || []) total += parseFloat(t.balanceUSD || '0');
      return { chainId: w.chainId, chainName: w.chainName || w.chainId, usdValue: total };
    }).filter(b => b.usdValue > 0);
  })();

  const selectedPm = paymentMethods.find(m => m.id === paymentMethodId);
  const balFmt = (n: number) => `$${(Math.floor(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const overAmount = amountUsdc.trim() && !Number.isNaN(parseFloat(amountUsdc.trim())) && Math.round(parseFloat(amountUsdc.trim()) * 100) > Math.round(withdrawableUsd * 100);

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

  // KYC gate
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
            <p className="text-sm text-gray-500 mt-0.5">Move funds to your bank or crypto wallet</p>
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

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 rounded-xl bg-gray-900/80 border border-gray-800">
          {(['bank', 'crypto'] as WithdrawTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                tab === t
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'bank' ? <Building2 className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
              {t === 'bank' ? 'To Bank (NGN)' : 'To Crypto Wallet'}
            </button>
          ))}
        </div>

        {/* ── BANK WITHDRAWAL PANEL ── */}
        {tab === 'bank' && (
          <div className="rounded-2xl border border-gray-800 bg-[#0a0a0a] divide-y divide-gray-800/60 overflow-hidden">

            {/* Amount input */}
            <div className="p-5 space-y-3">
              <Label className="text-sm text-gray-400">Amount (USD)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium select-none">$</span>
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

            {/* Conversion summary */}
            <div className="p-5 space-y-3 bg-gray-900/30">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Conversion details</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    Fee
                    <span className="group relative inline-flex">
                      <HelpCircle className="w-3.5 h-3.5 text-gray-600 cursor-help" />
                      <span className="pointer-events-none absolute bottom-full left-0 mb-2 px-2.5 py-1.5 w-52 text-xs text-gray-200 bg-gray-800 border border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-10">
                        Covers currency conversion and transaction costs
                      </span>
                    </span>
                  </span>
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

            {/* Bank account selector */}
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
                          <span className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-gray-400" />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium text-white truncate">{pm.bank_name}</span>
                            <span className="block text-xs text-gray-500 truncate">{pm.account_name} · {pm.account_number_masked}</span>
                          </span>
                          {paymentMethodId === pm.id && <span className="ml-auto w-2 h-2 rounded-full bg-teal-400 shrink-0" />}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="p-5">
              <Button
                onClick={handleBankSubmit}
                disabled={
                  submittingBank || !amountUsdc.trim() || !paymentMethodId || overAmount ||
                  (!!amountUsdc.trim() && (quoteLoading || !quote))
                }
                className="w-full h-12 bg-teal-400 hover:bg-teal-500 text-black font-bold text-base gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submittingBank ? (
                  <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Processing…</>
                ) : (
                  <>Withdraw to Bank <ArrowRight className="w-4 h-4" /></>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── CRYPTO WITHDRAWAL PANEL ── */}
        {tab === 'crypto' && (
          <div className="rounded-2xl border border-gray-800 bg-[#0a0a0a] divide-y divide-gray-800/60 overflow-hidden">

            {/* Network selector */}
            <div className="p-5 space-y-3">
              <Label className="text-sm text-gray-400">Network</Label>
              <div ref={networkDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setNetworkDropdownOpen(o => !o)}
                  className="w-full flex items-center justify-between gap-3 h-12 px-4 rounded-xl border border-gray-800 bg-gray-900/60 text-sm text-white hover:border-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-colors"
                >
                  {chainId ? (
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                        <Wallet className="w-4 h-4 text-violet-400" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium text-white truncate">
                          {wallets.find(w => w.chainId === chainId)?.chainName || chainId}
                        </span>
                        {(() => { const bc = balanceByChain.find(b => b.chainId === chainId); return bc ? <span className="block text-xs text-gray-500">${bc.usdValue.toFixed(2)} available</span> : null; })()}
                      </span>
                    </span>
                  ) : <span className="text-gray-500">Select network</span>}
                  <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${networkDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {networkDropdownOpen && (
                  <ul className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-gray-800 bg-[#0d0d0d] shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                    {wallets.length === 0 && !loadingWallets ? (
                      <li className="px-4 py-3 text-sm text-gray-500">No wallets found.</li>
                    ) : wallets.map(w => {
                      const bc = balanceByChain.find(b => b.chainId === w.chainId);
                      return (
                        <li
                          key={w.chainId}
                          onMouseDown={e => { e.preventDefault(); setChainId(w.chainId); setNetworkDropdownOpen(false); }}
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer text-sm hover:bg-gray-800/60 transition-colors border-b border-gray-800/50 last:border-0 ${chainId === w.chainId ? 'bg-gray-800/40' : ''}`}
                        >
                          <span className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                            <Wallet className="w-4 h-4 text-violet-400" />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium text-white truncate">{w.chainName || w.chainId}</span>
                            {bc && <span className="block text-xs text-gray-500">${bc.usdValue.toFixed(2)} available</span>}
                          </span>
                          {chainId === w.chainId && <span className="ml-auto w-2 h-2 rounded-full bg-teal-400 shrink-0" />}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Asset selector */}
            <div className="p-5 space-y-3">
              <Label className="text-sm text-gray-400">Asset</Label>
              <div ref={assetDropdownRef} className="relative">
                <button
                  type="button"
                  disabled={!chainId}
                  onClick={() => setAssetDropdownOpen(o => !o)}
                  className="w-full flex items-center justify-between gap-3 h-12 px-4 rounded-xl border border-gray-800 bg-gray-900/60 text-sm text-white hover:border-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {assetId ? (
                    (() => { const a = chainAssets.find(a => a.id === assetId); return a ? <span className="font-medium">{a.symbol} {a.name ? <span className="text-gray-400 font-normal">({a.name})</span> : ''}</span> : <span className="text-gray-500">Select asset</span>; })()
                  ) : <span className="text-gray-500">{!chainId ? 'Select a network first' : 'Select asset'}</span>}
                  <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${assetDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {assetDropdownOpen && chainAssets.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-gray-800 bg-[#0d0d0d] shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                    {chainAssets.map(a => (
                      <li
                        key={a.id}
                        onMouseDown={e => { e.preventDefault(); setAssetId(a.id); setAssetDropdownOpen(false); }}
                        className={`px-4 py-3 cursor-pointer text-sm hover:bg-gray-800/60 transition-colors border-b border-gray-800/50 last:border-0 flex items-center justify-between ${assetId === a.id ? 'bg-gray-800/40' : ''}`}
                      >
                        <span className="font-medium text-white">{a.symbol} {a.name && <span className="text-gray-400 font-normal text-xs">({a.name})</span>}</span>
                        {assetId === a.id && <span className="w-2 h-2 rounded-full bg-teal-400" />}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Recipient address */}
            <div className="p-5 space-y-3">
              <Label className="text-sm text-gray-400">Recipient address</Label>
              <Input
                type="text"
                placeholder="0x… or wallet address"
                value={toAddress}
                onChange={e => setToAddress(e.target.value)}
                className="h-12 bg-gray-900/60 border-gray-800 text-white font-mono text-sm focus:border-teal-500/50 focus:ring-teal-500/20"
              />
            </div>

            {/* Amount */}
            <div className="p-5 space-y-3">
              <Label className="text-sm text-gray-400">Amount</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amountCrypto}
                  onChange={e => setAmountCrypto(e.target.value)}
                  className="flex-1 h-12 bg-gray-900/60 border-gray-800 text-white text-lg font-semibold focus:border-teal-500/50 focus:ring-teal-500/20"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!chainId}
                  onClick={() => {
                    const bc = balanceByChain.find(b => b.chainId === chainId);
                    if (bc && bc.usdValue > 0) setAmountCrypto((Math.floor(bc.usdValue * 1e6)).toString());
                  }}
                  className="h-12 px-4 border-gray-700 text-gray-300 hover:text-white hover:border-gray-500"
                >
                  Max
                </Button>
              </div>
              {feeEstimate && (
                <p className="text-xs text-gray-500">Est. network fee: <span className="text-gray-300">{feeEstimate}</span></p>
              )}
            </div>

            {/* Summary */}
            {chainId && assetId && amountCrypto.trim() && toAddress.trim() && (
              <div className="px-5 py-4 bg-gray-900/30 space-y-2 text-sm">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-3">Summary</p>
                <div className="flex justify-between"><span className="text-gray-500">Network</span><span className="text-white">{wallets.find(w => w.chainId === chainId)?.chainName || chainId}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Asset</span><span className="text-white">{chainAssets.find(a => a.id === assetId)?.symbol || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="text-white">{amountCrypto}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">To</span><span className="text-white font-mono text-xs">{toAddress.slice(0, 10)}…{toAddress.slice(-8)}</span></div>
              </div>
            )}

            {/* Submit */}
            <div className="p-5">
              <Button
                onClick={handleCryptoSubmit}
                disabled={submittingCrypto || !chainId || !assetId || !toAddress.trim() || !amountCrypto.trim()}
                className="w-full h-12 bg-violet-500 hover:bg-violet-600 text-white font-bold text-base gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submittingCrypto ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing…</>
                ) : (
                  <>Withdraw to Wallet <ArrowRight className="w-4 h-4" /></>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Footer note */}
        <p className="text-center text-xs text-gray-600 pb-2">
          Withdrawals are processed securely. <span className="text-gray-500">Crypto withdrawals typically confirm within minutes.</span>
        </p>
      </div>
    </PremiumDashboardLayout>
  );
}
