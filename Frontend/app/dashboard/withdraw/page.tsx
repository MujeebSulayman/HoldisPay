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
  Scan,
  Copy,
  QrCode,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import QRScanner from '@/components/QRScanner';

type WithdrawTab = 'bank' | 'crypto';

// Map every backend-supported chain slug to a logo image
const CHAIN_LOGOS: Record<string, string> = {
  base:                'https://cryptologos.cc/logos/usd-base-coin-usdb-logo.png',
  ethereum:            'https://cryptologos.cc/logos/ethereum-eth-logo.png',
  polygon:             'https://cryptologos.cc/logos/polygon-matic-logo.png',
  'bnb-smart-chain':   'https://cryptologos.cc/logos/bnb-bnb-logo.png',
  arbitrum:            'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
  optimism:            'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png',
  tron:                'https://cryptologos.cc/logos/tron-trx-logo.png',
  solana:              'https://cryptologos.cc/logos/solana-sol-logo.png',
};

function ChainLogo({ chainId, name, logoUrl }: { chainId: string; name: string; logoUrl?: string }) {
  const slug = chainId.toLowerCase();
  
  if (logoUrl) {
    return <img src={logoUrl} alt={name} className="w-6 h-6 rounded-full object-contain shrink-0" />;
  }

  const src = CHAIN_LOGOS[slug];
  if (src) {
    return <img src={src} alt={name} className="w-6 h-6 rounded-full object-contain shrink-0" />;
  }

  return (
    <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function AssetLogo({ logoUrl, name }: { logoUrl?: string; name?: string }) {
  const [err, setErr] = useState(false);
  const safeName = name ?? '';
  if (logoUrl && !err) {
    return <img src={logoUrl} alt={safeName} onError={() => setErr(true)} className="w-7 h-7 rounded-full object-contain bg-gray-800 shrink-0" />;
  }
  return (
    <span className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 shrink-0">
      {safeName.slice(0, 2).toUpperCase() || '??'}
    </span>
  );
}

export default function WithdrawPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<WithdrawTab>('bank');

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [wallets, setWallets] = useState<ChainWallet[]>([]);
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

  // Crypto (Gateway) withdrawal state
  const [chainId, setChainId] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [amountCrypto, setAmountCrypto] = useState('');
  const [feeEstimate, setFeeEstimate] = useState<{ networkFee: string; networkFeeInUSD: string } | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [submittingCrypto, setSubmittingCrypto] = useState(false);
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false);
  const networkDropdownRef = useRef<HTMLDivElement>(null);

  const [qrOpen, setQrOpen] = useState(false);

  const userId = user?.id;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setToAddress(text);
    } catch (err) {
      toast.error('Unable to access clipboard');
    }
  };

  // Click outside dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(t)) setBankDropdownOpen(false);
      if (networkDropdownRef.current && !networkDropdownRef.current.contains(t)) setNetworkDropdownOpen(false);
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

  // Reset fee when chain changes
  useEffect(() => {
    setFeeEstimate(null);
  }, [chainId]);

  // Gateway Fee Estimation
  useEffect(() => {
    if (!chainId || !amountCrypto || isNaN(Number(amountCrypto)) || Number(amountCrypto) <= 0 || !toAddress.trim()) {
      setFeeEstimate(null);
      return;
    }

    const timer = setTimeout(() => {
      setFeeLoading(true);
      walletApi.gatewayWithdrawFee({
        blockchain: chainId,
        amount: amountCrypto,
        address: toAddress.trim()
      })
      .then(res => {
        if (res.success && res.data) setFeeEstimate(res.data);
      })
      .finally(() => setFeeLoading(false));
    }, 600);

    return () => clearTimeout(timer);
  }, [chainId, amountCrypto, toAddress]);

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

  const handleCryptoSubmit = async () => {
    if (!chainId || !toAddress.trim() || !amountCrypto.trim()) { toast.error('Fill blockchain, address and amount.'); return; }
    setSubmittingCrypto(true);
    try {
      const res = await walletApi.gatewayWithdraw({
        blockchain: chainId,
        address: toAddress.trim(),
        amount: amountCrypto.trim(),
        metadata: { source: 'web_dashboard' }
      });
      if (res.success) {
        toast.success('Gateway withdrawal initiated. USDC will arrive shortly.');
        setAmountCrypto(''); setToAddress('');
        refreshUser();
      } else {
        toast.error(res.error || 'Failed to initiate withdrawal');
      }
    } catch (err: any) {
      toast.error(err.message || 'Withdrawal failed');
    } finally {
      setSubmittingCrypto(false);
    }
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
        )}

        {/* ── CRYPTO (GATEWAY) PANEL ── */}
        {tab === 'crypto' && (
          <div className="rounded-2xl border border-gray-800 bg-[#0a0a0a] divide-y divide-gray-800/60 overflow-hidden">
            {/* Asset Selection (USDC Only) */}
            <div className="p-5 space-y-3">
              <Label className="text-sm text-gray-400">Select Asset</Label>
              <div className="w-full flex items-center gap-3 h-12 px-4 rounded-xl border border-gray-800 bg-gray-900/60 text-sm text-white">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <AssetLogo logoUrl="https://res.cloudinary.com/blockradar/image/upload/v1716800083/crypto-assets/usd-coin-usdc-logo_fs9mhv.png" name="USDC" />
                  <span className="block font-medium text-white truncate">USDC (USD Coin)</span>
                </div>
                <div className="bg-teal-500/10 text-teal-400 text-[10px] font-bold px-2 py-0.5 rounded border border-teal-500/20 uppercase">Primary</div>
              </div>
            </div>

            {/* Blockchain Selection */}
            <div className="p-5 space-y-3 bg-gray-900/10">
              <Label className="text-sm text-gray-400">Destination Blockchain</Label>
              <div ref={networkDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setNetworkDropdownOpen(o => !o)}
                  className="w-full flex items-center justify-between gap-3 h-12 px-4 rounded-xl border border-gray-800 bg-gray-900/60 text-sm text-white hover:border-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-colors"
                >
                  {chainId ? (
                    <span className="flex items-center gap-3 min-w-0">
                      <ChainLogo chainId={chainId} name={wallets.find(w => w.chainId === chainId)?.chainName || chainId} logoUrl={wallets.find(w => w.chainId === chainId)?.logoUrl} />
                      <span className="block font-medium text-white truncate">
                        {wallets.find(w => w.chainId === chainId)?.chainName || chainId}
                      </span>
                    </span>
                  ) : <span className="text-gray-500">Select network</span>}
                  <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${networkDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {networkDropdownOpen && (
                  <ul className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-gray-800 bg-[#0d0d0d] shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                    {wallets.map(w => (
                      <li
                        key={w.chainId}
                        onMouseDown={e => { e.preventDefault(); setChainId(w.chainId); setNetworkDropdownOpen(false); }}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer text-sm hover:bg-gray-800/60 transition-colors border-b border-gray-800/50 last:border-0 ${chainId === w.chainId ? 'bg-gray-800/40' : ''}`}
                      >
                        <ChainLogo chainId={w.chainId} name={w.chainName || w.chainId} logoUrl={w.logoUrl} />
                        <span className="block font-medium text-white truncate">{w.chainName || w.chainId}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Recipient Address */}
            <div className="p-5 space-y-3">
              <Label className="text-sm text-gray-400 font-medium">Recipient Address</Label>
              <div className="relative group">
                <Input
                  type="text"
                  placeholder="Paste or Enter destination USDC address"
                  value={toAddress}
                  onChange={e => setToAddress(e.target.value)}
                  className="h-12 bg-gray-900/60 border-gray-800 text-white font-mono text-xs pr-24 group-focus-within:border-teal-500/30 transition-all"
                />
                <div className="absolute right-1 top-1 bottom-1 flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handlePaste}
                    className="h-full w-10 text-gray-500 hover:text-teal-400 hover:bg-teal-500/5"
                    title="Paste address"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setQrOpen(true)}
                    className="h-full w-10 text-gray-500 hover:text-teal-400 hover:bg-teal-500/5"
                    title="Scan QR"
                  >
                    <QrCode className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Amount Selection */}
            <div className="p-5 space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm text-gray-400">Amount (USD)</Label>
                <div className="bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded text-[10px] text-teal-400 font-bold uppercase tracking-tighter">Gateway Hub</div>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amountCrypto}
                    onChange={e => setAmountCrypto(e.target.value)}
                    className="pl-8 flex-1 h-12 bg-gray-900/60 border-gray-800 text-white text-lg font-semibold focus:border-teal-500/30 transition-all"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAmountCrypto(withdrawableUsd <= 0 ? '0' : (Math.floor(withdrawableUsd * 100) / 100).toFixed(2))}
                  className="h-12 px-4 border-gray-700 text-gray-300 hover:text-white"
                >
                  Max
                </Button>
              </div>
              {amountCrypto.trim() && !isNaN(parseFloat(amountCrypto)) && parseFloat(amountCrypto) > withdrawableUsd && (
                <p className="text-xs text-red-400">Exceeds available balance</p>
              )}
            </div>

            {/* Conversion Details (New!) */}
            {(chainId && amountCrypto && toAddress.trim()) && (
              <div className="p-5 space-y-3 bg-gray-900/30">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Conversion details</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Network Fee</span>
                    <span className="text-gray-300">
                      {feeLoading ? (
                        <span className="animate-pulse">Estimating…</span>
                      ) : feeEstimate ? (
                        <span className="text-teal-400">{feeEstimate.networkFeeInUSD}</span>
                      ) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Exchange rate</span>
                    <span className="text-gray-300">1 USD = 1.00 USDC</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-800/80">
                    <span className="text-white font-medium">You receive</span>
                    <span className="text-teal-400 font-bold text-base">
                      {feeLoading ? (
                        <span className="animate-pulse">…</span>
                      ) : feeEstimate && amountCrypto ? (
                        `${(parseFloat(amountCrypto) - parseFloat(feeEstimate.networkFeeInUSD.replace('$', ''))).toFixed(2)} USDC`
                      ) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="p-5">
              <Button
                onClick={handleCryptoSubmit}
                disabled={submittingCrypto || !chainId || !toAddress.trim() || !amountCrypto.trim() || feeLoading || (!!amountCrypto.trim() && parseFloat(amountCrypto) > withdrawableUsd)}
                className="w-full h-12 bg-teal-400 hover:bg-teal-500 text-black font-bold text-base gap-2 disabled:opacity-40 transition-all shadow-lg shadow-teal-500/10"
              >
                {submittingCrypto ? 'Processing…' : 'Finalize Withdrawal'} &nbsp; <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-600 pb-2">
          Withdrawals are processed securely. <span className="text-gray-500">Typical confirmation: 2-5 minutes.</span>
        </p>
      </div>
    </PremiumDashboardLayout>
  );
}