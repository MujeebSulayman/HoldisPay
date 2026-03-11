'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { userApi, type ChainWallet } from '@/lib/api/user';
import { paymentMethodsApi, type PaymentMethod } from '@/lib/api/payment-methods';
import { walletApi, type Asset } from '@/lib/api/wallet';
import { getErrorMessage } from '@/lib/api/client';
import { toast } from 'sonner';
import { ArrowDownToLine, Wallet, Building2, Wallet as WalletIcon, ChevronDown, PlusCircle, HelpCircle } from 'lucide-react';

export default function WithdrawPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [wallets, setWallets] = useState<ChainWallet[]>([]);
  const [chainAssets, setChainAssets] = useState<Asset[]>([]);
  const [withdrawableUsd, setWithdrawableUsd] = useState(0);
  const [loadingPm, setLoadingPm] = useState(true);
  const [loadingWallets, setLoadingWallets] = useState(true);
  const [loadingBalance, setLoadingBalance] = useState(true);

  const [amountUsdc, setAmountUsdc] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [recipientCurrency, setRecipientCurrency] = useState('NGN');
  const [quote, setQuote] = useState<{
    amountInCurrency: number;
    rate: number;
    currency: string;
    fee?: number;
  } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submittingBank, setSubmittingBank] = useState(false);

  const [chainId, setChainId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [amountCrypto, setAmountCrypto] = useState('');
  const [feeEstimate, setFeeEstimate] = useState<string | null>(null);
  const [submittingCrypto, setSubmittingCrypto] = useState(false);

  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const bankDropdownRef = useRef<HTMLDivElement>(null);

  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false);
  const networkDropdownRef = useRef<HTMLDivElement>(null);

  const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
  const assetDropdownRef = useRef<HTMLDivElement>(null);

  const userId = user?.id;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(target)) {
        setBankDropdownOpen(false);
      }
      if (networkDropdownRef.current && !networkDropdownRef.current.contains(target)) {
        setNetworkDropdownOpen(false);
      }
      if (assetDropdownRef.current && !assetDropdownRef.current.contains(target)) {
        setAssetDropdownOpen(false);
      }
    };
    if (bankDropdownOpen || networkDropdownOpen || assetDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [bankDropdownOpen, networkDropdownOpen, assetDropdownOpen]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin');
    }
  }, [authLoading, user, router]);

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
    if (!userId) return;
    setLoadingBalance(true);
    userApi
      .getConsolidatedBalance(userId)
      .then((res) => {
        if (res.success && res.data?.withdrawableUsd != null) {
          setWithdrawableUsd(res.data.withdrawableUsd);
        } else {
          setWithdrawableUsd(0);
        }
      })
      .finally(() => setLoadingBalance(false));
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

  // Auto-fetch fee estimate when all crypto withdrawal fields are filled
  useEffect(() => {
    if (!chainId || !assetId || !toAddress.trim() || !amountCrypto.trim()) {
      setFeeEstimate(null);
      return;
    }
    const timer = setTimeout(() => {
      walletApi
        .estimateWithdrawalFee({ chainId, assetId, address: toAddress.trim(), amount: amountCrypto.trim() })
        .then((res) => {
          if (res.success && res.data) {
            const fee = res.data.networkFeeInUSD
              ? `$${parseFloat(res.data.networkFeeInUSD).toFixed(4)}`
              : res.data.networkFee || null;
            setFeeEstimate(fee);
          } else {
            setFeeEstimate(null);
          }
        })
        .catch(() => setFeeEstimate(null));
    }, 600);
    return () => clearTimeout(timer);
  }, [chainId, assetId, toAddress, amountCrypto]);

  const availableUsdDisplay = withdrawableUsd;

  const { balanceByChain } = ((): {
    balanceByChain: Array<{ chainId: string; chainName: string; usdValue: number }>;
  } => {
    if (!wallets?.length) return { balanceByChain: [] };
    const byChain: Array<{ chainId: string; chainName: string; usdValue: number }> = [];
    for (const w of wallets) {
      const nativeUsd = parseFloat(w.balance?.nativeUSD || '0');
      let chainUsd = nativeUsd;
      for (const t of w.balance?.tokens || []) {
        chainUsd += parseFloat(t.balanceUSD || '0');
      }
      if (chainUsd > 0) {
        byChain.push({
          chainId: w.chainId,
          chainName: w.chainName || w.chainId,
          usdValue: chainUsd,
        });
      }
    }
    return { balanceByChain: byChain };
  })();

  const fetchQuote = useCallback(() => {
    const amt = amountUsdc.trim();
    if (!amt || !userId) {
      setQuote(null);
      return;
    }
    const num = parseFloat(amt);
    if (Number.isNaN(num) || num <= 0) {
      setQuote(null);
      return;
    }
    setQuoteLoading(true);
    walletApi
      .getNairaWithdrawQuote(amt, recipientCurrency)
      .then((res) => {
        if (res.success && res.data) {
          setQuote({
            amountInCurrency: res.data.amountInCurrency ?? (res.data as { amountNgn?: number }).amountNgn ?? 0,
            rate: res.data.rate,
            currency: res.data.currency ?? recipientCurrency,
            fee: res.data.fee,
          });
        } else {
          setQuote(null);
        }
      })
      .catch(() => setQuote(null))
      .finally(() => setQuoteLoading(false));
  }, [amountUsdc, userId, recipientCurrency]);

  useEffect(() => {
    const t = setTimeout(fetchQuote, 400);
    return () => clearTimeout(t);
  }, [fetchQuote]);

  const handleBankSubmit = async () => {
    if (!userId || !amountUsdc.trim() || !paymentMethodId) {
      toast.error('Enter amount and select a bank account.');
      return;
    }
    const num = parseFloat(amountUsdc.trim());
    if (Number.isNaN(num) || num <= 0 || Math.round(num * 100) > Math.round(availableUsdDisplay * 100)) {
      toast.error('Insufficient balance or invalid amount.');
      return;
    }
    setSubmittingBank(true);
    try {
      const res = await walletApi.withdrawNaira({
        amountUsdc: amountUsdc.trim(),
        paymentMethodId,
      });
      if (res.success) {
        toast.success('Withdrawal initiated successfully!');
        setAmountUsdc('');
        setPaymentMethodId('');
        setQuote(null);
        if (userId) {
          userApi.getConsolidatedBalance(userId).then((r) => {
            if (r.success && r.data?.withdrawableUsd != null) setWithdrawableUsd(r.data.withdrawableUsd);
          });
          userApi.getAllWallets(userId).then((r) => {
            if (r.success && r.data) setWallets(r.data);
          });
        }
        router.refresh();
      } else {
        toast.error(getErrorMessage(res, 'Withdrawal failed'));
      }
    } catch (e) {
      toast.error(getErrorMessage(e, 'Withdrawal failed'));
    } finally {
      setSubmittingBank(false);
    }
  };

  const handleCryptoSubmit = async () => {
    if (!chainId || !assetId || !toAddress.trim() || !amountCrypto.trim()) {
      toast.error('Fill chain, asset, address and amount.');
      return;
    }
    const asset = chainAssets.find((a) => a.id === assetId);
    const tokenAddress = asset?.address && asset.symbol?.toLowerCase() !== 'eth' ? asset.address : null;
    setSubmittingCrypto(true);
    try {
      const res = await walletApi.withdraw({
        chainId,
        assetId,
        address: toAddress.trim(),
        amount: amountCrypto.trim(),
        tokenAddress,
      });
      if (res.success && res.data) {
        toast.success('Withdrawal initiated.');
        setAmountCrypto('');
        setToAddress('');
        if (userId) {
          userApi.getAllWallets(userId).then((r) => r.success && r.data && setWallets(r.data));
          userApi.getConsolidatedBalance(userId).then((r) => r.success && r.data?.withdrawableUsd != null && setWithdrawableUsd(r.data.withdrawableUsd));
        }
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
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400">
            <ArrowDownToLine className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Withdraw</h1>
            <p className="text-sm text-gray-400 mt-0.5">Send to your bank or crypto wallet</p>
          </div>
        </div>

        {user.kycStatus !== 'verified' && user.kycStatus !== 'approved' ? (
          <Card className="border-gray-800 bg-[#0a0a0a] overflow-hidden mt-6">
            <CardContent className="p-8 sm:p-12 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-orange-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-white mb-3">Identity Verification Required</h2>
              <p className="text-gray-400 text-sm mb-8 max-w-md leading-relaxed">
                Please verify your identity to unlock withdrawals. This helps us ensure the security of your account and funds.
              </p>
              <Link href="/dashboard/settings?tab=kyc" passHref legacyBehavior>
                <Button className="bg-teal-400 hover:bg-teal-500 text-black font-medium">
                  Complete Verification
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-gray-800">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-gray-400" />
              <CardTitle className="text-base">Available balance</CardTitle>
            </div>
            <p className="text-xs text-gray-500 mt-1">Ready to withdraw</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingBalance ? (
              <div className="h-8 w-32 bg-gray-800 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-semibold text-white">
                ${(Math.floor(availableUsdDisplay * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-gray-800 hover:border-gray-700 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <CardTitle className="text-base">To my bank</CardTitle>
              </div>
              <p className="text-sm text-gray-500">Send to your Nigerian bank in Naira (NGN)</p>
            </CardHeader>
            <CardContent>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full">Withdraw to bank</Button>
                </SheetTrigger>
                <SheetContent side="right" className="overflow-y-auto overflow-x-hidden w-full sm:max-w-md">
                  <SheetHeader>
                    <SheetTitle>Withdraw to bank</SheetTitle>
                  </SheetHeader>
                  <div className="grid min-w-0 flex-1 auto-rows-min gap-6 py-6">
                    <>
                        <div className="space-y-1 text-sm text-gray-400">
                          <p>Send from</p>
                          <p className="font-medium text-white">Balance</p>
                          <p className="text-xs">Available: ${(Math.floor(availableUsdDisplay * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="grid gap-3">
                          <Label htmlFor="amount-usd">You send</Label>
                          <div className="flex gap-2">
                            <Input
                              id="amount-usd"
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={amountUsdc}
                              onChange={(e) => setAmountUsdc(e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setAmountUsdc(availableUsdDisplay <= 0 ? '0' : (Math.floor(availableUsdDisplay * 100) / 100).toFixed(2))}
                            >
                              Max
                            </Button>
                          </div>
                          {amountUsdc.trim() && (() => {
                            const num = parseFloat(amountUsdc.trim());
                            if (!Number.isNaN(num) && Math.round(num * 100) > Math.round(availableUsdDisplay * 100)) {
                              return (
                                <p className="text-sm text-red-400">
                                  Available balance: ${(Math.floor(availableUsdDisplay * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 space-y-2 text-sm">
                          <p className="font-medium text-white">Conversion details</p>
                          <div className="flex justify-between text-gray-400">
                            <span className="inline-flex items-center gap-1.5">
                              − Fee
                              <span
                                className="group relative inline-flex"
                                title="This covers the cost of your transaction, primarily for currency conversion and transaction fee"
                              >
                                <HelpCircle
                                  className="w-4 h-4 text-gray-500 hover:text-gray-400 cursor-help shrink-0"
                                  aria-hidden
                                />
                                <span className="pointer-events-none absolute top-full left-0 mt-1.5 px-2.5 py-1.5 min-w-0 max-w-[min(14rem,calc(100vw-3rem))] w-56 text-xs font-normal text-gray-200 bg-gray-800 border border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-10">
                                  This covers the cost of your transaction, primarily for currency conversion and transaction fee
                                </span>
                              </span>
                            </span>
                            <span>{amountUsdc.trim() && quote?.fee != null ? `${quote.fee} USD` : '0 USD'}</span>
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span>= Total we&apos;ll convert</span>
                            <span>{amountUsdc.trim() ? `${amountUsdc.trim()} USD` : '—'}</span>
                          </div>
                          {amountUsdc.trim() ? (
                            quote != null && !quoteLoading ? (
                              <>
                                <div className="flex justify-between text-gray-400">
                                  <span>× Rate</span>
                                  <span>1 USD = {quote.rate?.toLocaleString() ?? '—'} {quote.currency}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-gray-800">
                                  <span className="text-gray-300">Recipient gets</span>
                                  <span className="font-semibold text-teal-400">{quote.amountInCurrency?.toLocaleString() ?? '—'} {quote.currency}</span>
                                </div>
                              </>
                            ) : (
                              <p className="text-xs text-gray-500">{quoteLoading ? 'Getting rate…' : '—'}</p>
                            )
                          ) : (
                            <div className="flex justify-between text-gray-500 pt-2 border-t border-gray-800">
                              <span>× Rate</span>
                              <span className="text-xs">Enter amount to see rate</span>
                            </div>
                          )}
                        </div>
                        <div className="grid gap-3">
                          <Label>Bank account</Label>
                          {loadingPm ? (
                            <div className="h-10 w-full rounded-lg border border-gray-800 bg-[#0a0a0a] animate-pulse" />
                          ) : paymentMethods.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/30 p-4 text-center">
                              <p className="text-sm text-gray-400 mb-3">No bank account yet. Add one to withdraw to NGN.</p>
                              <Link href="/dashboard/settings?tab=payment-methods">
                                <Button type="button" variant="outline" size="sm" className="gap-2">
                                  <PlusCircle className="w-4 h-4" />
                                  Add bank account
                                </Button>
                              </Link>
                              <p className="text-xs text-gray-500 mt-2">Opens Settings → Payment methods</p>
                            </div>
                          ) : (
                            <div ref={bankDropdownRef} className="relative w-full min-w-0">
                              <button
                                type="button"
                                onClick={() => setBankDropdownOpen((o) => !o)}
                                className="flex h-auto min-h-10 w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-lg border border-gray-800 bg-[#0a0a0a] px-4 py-2.5 text-left text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-400"
                              >
                                {paymentMethodId ? (
                                  (() => {
                                    const pm = paymentMethods.find((m) => m.id === paymentMethodId);
                                    return pm ? (
                                      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                        <span className="font-medium text-white">{pm.bank_name}</span>
                                        <span className="mx-1.5 text-gray-500">·</span>
                                        <span className="text-gray-400">{pm.account_number_masked}</span>
                                        <span className="ml-1.5 text-gray-500">({pm.account_name})</span>
                                      </span>
                                    ) : (
                                      <span className="text-gray-500">Select bank account</span>
                                    );
                                  })()
                                ) : (
                                  <span className="min-w-0 flex-1 text-gray-500">Select bank account</span>
                                )}
                                <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${bankDropdownOpen ? 'rotate-180' : ''}`} />
                              </button>
                              {bankDropdownOpen && (
                                <ul
                                  className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 min-w-0 overflow-auto rounded-lg border border-gray-800 bg-[#0d0d0d] py-1 shadow-xl"
                                  role="listbox"
                                >
                                  {paymentMethods.map((pm) => (
                                    <li
                                      key={pm.id}
                                      role="option"
                                      aria-selected={paymentMethodId === pm.id}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        setPaymentMethodId(pm.id);
                                        setBankDropdownOpen(false);
                                      }}
                                      className={`cursor-pointer border-b border-gray-800/50 px-4 py-3 last:border-0 hover:bg-gray-800/80 active:bg-gray-800 ${paymentMethodId === pm.id ? 'bg-gray-800/50' : ''}`}
                                    >
                                      <p className="min-w-0 truncate font-medium text-white">{pm.bank_name}</p>
                                      <p className="min-w-0 truncate text-sm text-gray-400">{pm.account_number_masked} · {pm.account_name}</p>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                        <SheetFooter>
                          <Button
                            onClick={handleBankSubmit}
                            disabled={
                              submittingBank ||
                              !amountUsdc.trim() ||
                              !paymentMethodId ||
                              (!!amountUsdc.trim() && (quoteLoading || !quote || quote.amountInCurrency == null)) ||
                              (!!amountUsdc.trim() && Math.round(parseFloat(amountUsdc.trim()) * 100) > Math.round(availableUsdDisplay * 100))
                            }
                          >
                            {submittingBank ? 'Submitting…' : 'Continue'}
                          </Button>
                          <SheetClose asChild>
                            <Button variant="outline">Close</Button>
                          </SheetClose>
                        </SheetFooter>
                    </>
                  </div>
                </SheetContent>
              </Sheet>
            </CardContent>
          </Card>

          <Card className="border-gray-800 hover:border-gray-700 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
                  <WalletIcon className="w-5 h-5" />
                </div>
                <CardTitle className="text-base">To crypto wallet</CardTitle>
              </div>
              <p className="text-sm text-gray-500">Send USDC to any wallet address</p>
            </CardHeader>
            <CardContent>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full">Withdraw to wallet</Button>
                </SheetTrigger>
                <SheetContent side="right" className="overflow-y-auto w-full sm:max-w-md">
                  <SheetHeader>
                    <SheetTitle>Withdraw to wallet</SheetTitle>
                  </SheetHeader>
                  <div className="grid flex-1 auto-rows-min gap-6 py-6">
                    {/* Available balance summary */}
                    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 space-y-1">
                      <p className="text-xs text-gray-500">Available balance</p>
                      <p className="text-lg font-semibold text-white">
                        ${(Math.floor(availableUsdDisplay * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>

                    {/* Network selector with balance per chain */}
                    <div className="grid gap-3">
                      <Label>Network</Label>
                      <div ref={networkDropdownRef} className="relative w-full min-w-0">
                        <button
                          type="button"
                          onClick={() => setNetworkDropdownOpen((o) => !o)}
                          className="flex h-10 w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-lg border border-gray-800 bg-[#0a0a0a] px-4 py-2 text-left text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-400"
                        >
                          {chainId ? (
                            (() => {
                              const w = wallets.find((w) => w.chainId === chainId);
                              const bc = balanceByChain.find((b) => b.chainId === chainId);
                              const usd = bc ? `$${bc.usdValue.toFixed(2)}` : '';
                              return w ? (
                                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                  {w.chainName}{usd ? ` — ${usd}` : ''}
                                </span>
                              ) : (
                                <span className="text-gray-500">Select network</span>
                              );
                            })()
                          ) : (
                            <span className="min-w-0 flex-1 text-gray-500">Select network</span>
                          )}
                          <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${networkDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {networkDropdownOpen && (
                          <ul
                            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 min-w-0 overflow-auto rounded-lg border border-gray-800 bg-[#0d0d0d] py-1 shadow-xl"
                            role="listbox"
                          >
                            {wallets.map((w) => {
                              const bc = balanceByChain.find((b) => b.chainId === w.chainId);
                              const usd = bc ? `$${bc.usdValue.toFixed(2)}` : '';
                              return (
                                <li
                                  key={w.chainId}
                                  role="option"
                                  aria-selected={chainId === w.chainId}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setChainId(w.chainId);
                                    setNetworkDropdownOpen(false);
                                  }}
                                  className={`cursor-pointer px-4 py-2.5 text-sm hover:bg-gray-800/80 active:bg-gray-800 text-white ${chainId === w.chainId ? 'bg-gray-800/50' : ''}`}
                                >
                                  {w.chainName}{usd ? <span className="text-gray-400 ml-1.5">— {usd}</span> : ''}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                      {chainId && (() => {
                        const bc = balanceByChain.find((b) => b.chainId === chainId);
                        return bc ? (
                          <p className="text-xs text-gray-400">
                            Balance on {bc.chainName}: <span className="text-white font-medium">${bc.usdValue.toFixed(2)}</span>
                          </p>
                        ) : null;
                      })()}
                      {wallets.length === 0 && !loadingWallets && (
                        <p className="text-xs text-gray-500">No wallets found. Connect a wallet first.</p>
                      )}
                    </div>

                    {/* Asset selector */}
                    <div className="grid gap-3">
                      <Label>Asset</Label>
                      <div ref={assetDropdownRef} className="relative w-full min-w-0">
                        <button
                          type="button"
                          disabled={!chainId}
                          onClick={() => setAssetDropdownOpen((o) => !o)}
                          className="flex h-10 w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-lg border border-gray-800 bg-[#0a0a0a] px-4 py-2 text-left text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-400 disabled:opacity-50"
                        >
                          {assetId ? (
                            (() => {
                              const a = chainAssets.find((a) => a.id === assetId);
                              return a ? (
                                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                  {a.symbol} {a.name ? `(${a.name})` : ''}
                                </span>
                              ) : (
                                <span className="text-gray-500">Select asset</span>
                              );
                            })()
                          ) : (
                            <span className="min-w-0 flex-1 text-gray-500">Select asset</span>
                          )}
                          <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${assetDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {assetDropdownOpen && (
                          <ul
                            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 min-w-0 overflow-auto rounded-lg border border-gray-800 bg-[#0d0d0d] py-1 shadow-xl"
                            role="listbox"
                          >
                            {chainAssets.map((a) => (
                              <li
                                key={a.id}
                                role="option"
                                aria-selected={assetId === a.id}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setAssetId(a.id);
                                  setAssetDropdownOpen(false);
                                }}
                                className={`cursor-pointer px-4 py-2.5 text-sm hover:bg-gray-800/80 active:bg-gray-800 text-white ${assetId === a.id ? 'bg-gray-800/50' : ''}`}
                              >
                                {a.symbol} {a.name ? <span className="text-gray-400">({a.name})</span> : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* Recipient address */}
                    <div className="grid gap-3">
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

                    {/* Amount with Max button */}
                    <div className="grid gap-3">
                      <Label htmlFor="amount-crypto">Amount</Label>
                      <div className="flex gap-2">
                        <Input
                          id="amount-crypto"
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={amountCrypto}
                          onChange={(e) => setAmountCrypto(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const bc = balanceByChain.find((b) => b.chainId === chainId);
                            if (bc && bc.usdValue > 0) {
                              setAmountCrypto((Math.floor(bc.usdValue * 1e6)).toString());
                            }
                          }}
                          disabled={!chainId}
                        >
                          Max
                        </Button>
                      </div>
                      {feeEstimate != null && (
                        <p className="text-xs text-gray-400">
                          Est. network fee: <span className="text-white">{feeEstimate}</span>
                        </p>
                      )}
                    </div>

                    {/* Summary before submit */}
                    {chainId && assetId && amountCrypto.trim() && toAddress.trim() && (
                      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 space-y-2 text-sm">
                        <p className="font-medium text-white">Summary</p>
                        <div className="flex justify-between text-gray-400">
                          <span>Network</span>
                          <span className="text-white">{wallets.find((w) => w.chainId === chainId)?.chainName || chainId}</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                          <span>Asset</span>
                          <span className="text-white">{chainAssets.find((a) => a.id === assetId)?.symbol || '—'}</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                          <span>Amount</span>
                          <span className="text-white">{amountCrypto}</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                          <span>To</span>
                          <span className="text-white font-mono text-xs truncate max-w-[60%]" title={toAddress}>{toAddress.slice(0, 8)}…{toAddress.slice(-6)}</span>
                        </div>
                      </div>
                    )}

                    <SheetFooter>
                      <Button
                        onClick={handleCryptoSubmit}
                        disabled={submittingCrypto || !chainId || !assetId || !toAddress.trim() || !amountCrypto.trim()}
                        className="gap-2"
                      >
                        {submittingCrypto ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            Processing…
                          </>
                        ) : (
                          'Withdraw to wallet'
                        )}
                      </Button>
                      <SheetClose asChild>
                        <Button variant="outline">Close</Button>
                      </SheetClose>
                    </SheetFooter>
                  </div>
                </SheetContent>
              </Sheet>
            </CardContent>
          </Card>
        </div>
        </>
        )}
      </div>
    </PremiumDashboardLayout>
  );
}
