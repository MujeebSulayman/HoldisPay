'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { userApi, type ConsolidatedBalanceResponse, type ChainWallet } from '@/lib/api/user';
import { paymentMethodsApi, type PaymentMethod } from '@/lib/api/payment-methods';
import { walletApi, type Asset } from '@/lib/api/wallet';
import { getErrorMessage } from '@/lib/api/client';
import { toast } from 'sonner';

type Tab = 'bank' | 'crypto';

export default function WithdrawPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('bank');

  const [balance, setBalance] = useState<ConsolidatedBalanceResponse | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [wallets, setWallets] = useState<ChainWallet[]>([]);
  const [chainAssets, setChainAssets] = useState<Asset[]>([]);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [loadingPm, setLoadingPm] = useState(true);
  const [loadingWallets, setLoadingWallets] = useState(false);

  const [amountUsdc, setAmountUsdc] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [ngnQuote, setNgnQuote] = useState<{ amountNgn: number; rate: number } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submittingBank, setSubmittingBank] = useState(false);
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [transferCode, setTransferCode] = useState('');
  const [otp, setOtp] = useState('');
  const [submittingOtp, setSubmittingOtp] = useState(false);

  const [chainId, setChainId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [amountCrypto, setAmountCrypto] = useState('');
  const [feeEstimate, setFeeEstimate] = useState<string | null>(null);
  const [submittingCrypto, setSubmittingCrypto] = useState(false);

  const userId = user?.id;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoadingBalance(true);
    userApi
      .getConsolidatedBalance(userId)
      .then((res) => {
        if (!cancelled && res.success && res.data) setBalance(res.data);
      })
      .finally(() => {
        if (!cancelled) setLoadingBalance(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoadingPm(true);
    paymentMethodsApi
      .getPaymentMethods(userId)
      .then((res) => {
        if (!cancelled && res.success && res.data) setPaymentMethods(res.data);
      })
      .finally(() => {
        if (!cancelled) setLoadingPm(false);
      });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setLoadingWallets(true);
    userApi
      .getAllWallets(userId)
      .then((res) => {
        if (res.success && res.data) setWallets(res.data);
      })
      .finally(() => setLoadingWallets(false));
  }, [userId]);

  useEffect(() => {
    if (!chainId) {
      setChainAssets([]);
      setAssetId('');
      return;
    }
    walletApi.getChainAssets(chainId).then((res) => {
      if (res.success && res.data?.assets) setChainAssets(res.data.assets);
      else setChainAssets([]);
      setAssetId('');
    });
  }, [chainId]);

  const availableUsdc = ((): string => {
    if (!balance?.wallet) return '0';
    let total = 0n;
    for (const chainBal of Object.values(balance.wallet)) {
      for (const t of chainBal.tokens || []) {
        if (t.symbol === 'USDC' || t.symbol === 'usdc') {
          total += BigInt(t.balance || '0');
        }
      }
    }
    return total.toString();
  })();

  const fetchQuote = useCallback(() => {
    const amt = amountUsdc.trim();
    if (!amt || !userId) {
      setNgnQuote(null);
      return;
    }
    const num = parseFloat(amt);
    if (Number.isNaN(num) || num <= 0) {
      setNgnQuote(null);
      return;
    }
    setQuoteLoading(true);
    walletApi
      .getPaystackWithdrawQuote(amt)
      .then((res) => {
        if (res.success && res.data) {
          setNgnQuote({ amountNgn: res.data.amountNgn, rate: res.data.rate });
        } else {
          setNgnQuote(null);
        }
      })
      .catch(() => setNgnQuote(null))
      .finally(() => setQuoteLoading(false));
  }, [amountUsdc, userId]);

  useEffect(() => {
    const t = setTimeout(fetchQuote, 400);
    return () => clearTimeout(t);
  }, [fetchQuote]);

  const handleBankSubmit = async () => {
    if (!userId || !amountUsdc.trim() || !paymentMethodId) {
      toast.error('Enter amount and select a bank account.');
      return;
    }
    const amountWei = BigInt(Math.round(parseFloat(amountUsdc.trim()) * 1e6));
    if (amountWei <= 0n || amountWei > BigInt(availableUsdc)) {
      toast.error('Insufficient balance or invalid amount.');
      return;
    }
    setSubmittingBank(true);
    try {
      const res = await walletApi.withdrawPaystack({
        amountUsdc: amountUsdc.trim(),
        paymentMethodId,
      });
      if (res.success && res.data?.requiresOtp && res.data?.transferCode) {
        setRequiresOtp(true);
        setTransferCode(res.data.transferCode);
        toast.info('Enter OTP to complete transfer.');
      } else if (res.success) {
        toast.success('Withdrawal initiated.');
        setAmountUsdc('');
        setPaymentMethodId('');
        userApi.getConsolidatedBalance(userId).then((r) => r.success && r.data && setBalance(r.data));
      } else {
        toast.error(getErrorMessage(res, 'Withdrawal failed'));
      }
    } catch (e) {
      toast.error(getErrorMessage(e, 'Withdrawal failed'));
    } finally {
      setSubmittingBank(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (!transferCode || !otp.trim()) {
      toast.error('Enter OTP.');
      return;
    }
    setSubmittingOtp(true);
    try {
      const res = await walletApi.finalizePaystackWithdraw({ transferCode, otp: otp.trim() });
      if (res.success) {
        toast.success('Transfer completed.');
        setRequiresOtp(false);
        setTransferCode('');
        setOtp('');
        setAmountUsdc('');
        setPaymentMethodId('');
        if (userId) userApi.getConsolidatedBalance(userId).then((r) => r.success && r.data && setBalance(r.data));
      } else {
        toast.error(getErrorMessage(res, 'Failed to finalize'));
      }
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to finalize'));
    } finally {
      setSubmittingOtp(false);
    }
  };

  const handleCryptoSubmit = async () => {
    if (!chainId || !assetId || !toAddress.trim() || !amountCrypto.trim()) {
      toast.error('Fill chain, asset, address and amount.');
      return;
    }
    setSubmittingCrypto(true);
    try {
      const res = await walletApi.withdraw({
        chainId,
        assetId,
        address: toAddress.trim(),
        amount: amountCrypto.trim(),
      });
      if (res.success && res.data) {
        toast.success('Withdrawal initiated.');
        setAmountCrypto('');
        setToAddress('');
        if (userId) userApi.getConsolidatedBalance(userId).then((r) => r.success && r.data && setBalance(r.data));
      } else {
        toast.error(getErrorMessage(res, 'Withdrawal failed'));
      }
    } catch (e) {
      toast.error(getErrorMessage(e, 'Withdrawal failed'));
    } finally {
      setSubmittingCrypto(false);
    }
  };

  if (authLoading || !user) {
    return (
      <PremiumDashboardLayout>
        <div className="max-w-4xl mx-auto min-w-0 py-8">
          <div className="animate-pulse h-8 w-48 bg-gray-800 rounded" />
          <div className="mt-6 h-32 bg-gray-800/50 rounded-lg" />
        </div>
      </PremiumDashboardLayout>
    );
  }

  return (
    <PremiumDashboardLayout>
      <div className="max-w-2xl mx-auto min-w-0 py-6 px-4 sm:px-6 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Withdraw</h1>
          <p className="mt-1 text-sm text-gray-400">Send to your bank or to an external crypto wallet.</p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Available balance</CardTitle>
            <CardDescription>Withdrawable USDC (tracked in your account)</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingBalance ? (
              <div className="h-8 w-32 bg-gray-800 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-semibold text-white">
                {availableUsdc === '0' ? '0' : (Number(availableUsdc) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex rounded-lg border border-gray-800 bg-gray-900/50 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('bank')}
            className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'bank' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            To my bank
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('crypto')}
            className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'crypto' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            To crypto wallet
          </button>
        </div>

        {activeTab === 'bank' && (
          <Card>
            <CardHeader>
              <CardTitle>Withdraw to local bank</CardTitle>
              <CardDescription>We send Naira from our Paystack account to your saved bank. Add a bank in Settings if needed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {requiresOtp ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp">OTP</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="Enter OTP from your email/SMS"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleOtpSubmit} disabled={submittingOtp}>
                      {submittingOtp ? 'Submitting…' : 'Complete transfer'}
                    </Button>
                    <Button variant="outline" onClick={() => { setRequiresOtp(false); setTransferCode(''); setOtp(''); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="amount-usdc">Amount (USDC)</Label>
                    <Input
                      id="amount-usdc"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amountUsdc}
                      onChange={(e) => setAmountUsdc(e.target.value)}
                    />
                    {quoteLoading && <p className="text-xs text-gray-500">Getting quote…</p>}
                    {ngnQuote != null && !quoteLoading && (
                      <p className="text-sm text-gray-400">You will receive ≈ {ngnQuote.amountNgn.toLocaleString()} NGN</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Bank account</Label>
                    <select
                      value={paymentMethodId}
                      onChange={(e) => setPaymentMethodId(e.target.value)}
                      className="flex h-9 w-full rounded-lg border border-gray-800 bg-[#0a0a0a] px-4 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
                    >
                      <option value="">Select bank account</option>
                      {paymentMethods.map((pm) => (
                        <option key={pm.id} value={pm.id}>
                          {pm.bank_name} — {pm.account_number_masked} ({pm.account_name})
                        </option>
                      ))}
                    </select>
                    {paymentMethods.length === 0 && !loadingPm && (
                      <p className="text-xs text-gray-500">Add a bank account in Settings → Payment methods.</p>
                    )}
                  </div>
                  <Button onClick={handleBankSubmit} disabled={submittingBank || !amountUsdc.trim() || !paymentMethodId}>
                    {submittingBank ? 'Submitting…' : 'Withdraw to bank'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'crypto' && (
          <Card>
            <CardHeader>
              <CardTitle>Withdraw to crypto wallet</CardTitle>
              <CardDescription>Send stablecoin to an external wallet address.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Network</Label>
                <select
                  value={chainId}
                  onChange={(e) => setChainId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-gray-800 bg-[#0a0a0a] px-4 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
                >
                  <option value="">Select network</option>
                  {wallets.map((w) => (
                    <option key={w.chainId} value={w.chainId}>
                      {w.chainName}
                    </option>
                  ))}
                </select>
                {wallets.length === 0 && !loadingWallets && (
                  <p className="text-xs text-gray-500">No wallets found. Connect a wallet first.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Asset</Label>
                <select
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  disabled={!chainId}
                  className="flex h-9 w-full rounded-lg border border-gray-800 bg-[#0a0a0a] px-4 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-400 disabled:opacity-50"
                >
                  <option value="">Select asset</option>
                  {chainAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.symbol} {a.name ? `(${a.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="to-address">Recipient address</Label>
                <Input
                  id="to-address"
                  type="text"
                  placeholder="0x… or wallet address"
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount-crypto">Amount</Label>
                <Input
                  id="amount-crypto"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amountCrypto}
                  onChange={(e) => setAmountCrypto(e.target.value)}
                />
                {feeEstimate != null && <p className="text-xs text-gray-500">Est. fee: {feeEstimate}</p>}
              </div>
              <Button
                onClick={handleCryptoSubmit}
                disabled={submittingCrypto || !chainId || !assetId || !toAddress.trim() || !amountCrypto.trim()}
              >
                {submittingCrypto ? 'Submitting…' : 'Withdraw to wallet'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </PremiumDashboardLayout>
  );
}
