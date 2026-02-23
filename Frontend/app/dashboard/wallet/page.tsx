'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { userApi, ChainWallet } from '@/lib/api/user';

const CHAIN_COLORS: Record<string, string> = {
  base: '#14b8a6',
  ethereum: '#627eea',
  polygon: '#8247e5',
  bnb: '#f3ba2f',
  arbitrum: '#28a0f0',
  optimism: '#ff0420',
  tron: '#ff0013',
  solana: '#9945ff',
  avalanche: '#e84142',
};

function formatBalance(balance: string, decimals: number = 18): string {
  const num = parseFloat(balance) || 0;
  if (num === 0) return '0.00';
  if (num < 0.01) return '<0.01';
  return num.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 });
}

export default function WalletPage() {
  const { user, loading } = useAuth();
  const [wallets, setWallets] = useState<ChainWallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'receive' | null>(null);
  const [receiveWallet, setReceiveWallet] = useState<ChainWallet | null>(null);

  useEffect(() => {
    const fetch = async () => {
      if (!user?.id) return;
      try {
        setIsLoading(true);
        const res = await userApi.getAllWallets(user.id);
        if (res.success && Array.isArray(res.data)) setWallets(res.data);
      } catch (e) {
        console.error('Failed to fetch wallets', e);
      } finally {
        setIsLoading(false);
      }
    };
    if (user) fetch();
  }, [user]);

  const copyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const openReceive = (w: ChainWallet) => {
    setReceiveWallet(w);
    setActiveModal('receive');
  };

  const analysis = useMemo(() => {
    let totalUSD = 0;
    const byChain: { chainId: string; chainName: string; usd: number }[] = [];
    const assets: { chainId: string; chainName: string; symbol: string; balance: string; usd: number; isNative: boolean }[] = [];

    wallets.forEach((w) => {
      const nativeUSD = parseFloat(w.balance?.nativeUSD || '0');
      const tokenUSD = (w.balance?.tokens || []).reduce((s, t) => s + parseFloat(t.balanceUSD || '0'), 0);
      const chainUSD = nativeUSD + tokenUSD;
      totalUSD += chainUSD;
      if (chainUSD > 0) {
        byChain.push({ chainId: w.chainId, chainName: w.chainName, usd: chainUSD });
      }
      if (nativeUSD > 0 || parseFloat(w.balance?.native || '0') > 0) {
        assets.push({
          chainId: w.chainId,
          chainName: w.chainName,
          symbol: w.chainId === 'solana' ? 'SOL' : w.chainId === 'tron' ? 'TRX' : 'ETH',
          balance: w.balance?.native || '0',
          usd: nativeUSD,
          isNative: true,
        });
      }
      (w.balance?.tokens || []).forEach((t) => {
        const u = parseFloat(t.balanceUSD || '0');
        if (u > 0 || parseFloat(t.balance || '0') > 0) {
          assets.push({
            chainId: w.chainId,
            chainName: w.chainName,
            symbol: t.symbol,
            balance: t.balance,
            usd: u,
            isNative: false,
          });
        }
      });
    });

    byChain.sort((a, b) => b.usd - a.usd);
    assets.sort((a, b) => b.usd - a.usd);
    const maxChainUSD = Math.max(...byChain.map((c) => c.usd), 1);
    const pieTotal = byChain.reduce((s, c) => s + c.usd, 0) || 1;
    let pieAngle = 0;
    const pieSegments = byChain.map((c) => {
      const pct = (c.usd / pieTotal) * 100;
      const start = pieAngle;
      pieAngle += pct;
      return { ...c, start, end: pieAngle, pct };
    });

    return { totalUSD, byChain, assets, maxChainUSD, pieSegments };
  }, [wallets]);

  if (loading || !user) {
    return (
      <PremiumDashboardLayout>
        <PageLoader />
      </PremiumDashboardLayout>
    );
  }

  return (
    <PremiumDashboardLayout>
      <div className="space-y-6 min-w-0">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Wallet Overview</h1>
            <p className="text-gray-400 text-sm mt-0.5">Portfolio value and balances across chains</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard/wallet/deposit"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-black font-medium rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
              </svg>
              Deposit
            </Link>
            <Link
              href="/dashboard/wallet/withdraw"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl border border-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Withdraw
            </Link>
          </div>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Hero total */}
            <div className="bg-gradient-to-br from-gray-900 to-[#0a0a0a] border border-gray-800 rounded-2xl p-6 sm:p-8">
              <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Total Portfolio Value</p>
              <p className="text-3xl sm:text-4xl font-bold text-white mt-1">
                ${analysis.totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500 mt-1">Across {wallets.length} chain{wallets.length !== 1 ? 's' : ''}</p>
            </div>

            {/* Metrics */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-[#0f0f0f] border border-gray-800 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</p>
                <p className="text-lg font-semibold text-white mt-1">
                  ${analysis.totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-[#0f0f0f] border border-gray-800 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Chains</p>
                <p className="text-lg font-semibold text-white mt-1">{analysis.byChain.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">with balance</p>
              </div>
              <div className="bg-[#0f0f0f] border border-gray-800 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Assets</p>
                <p className="text-lg font-semibold text-white mt-1">{analysis.assets.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">native + tokens</p>
              </div>
              <div className="bg-[#0f0f0f] border border-gray-800 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Quick Actions</p>
                <div className="flex gap-2 mt-2">
                  <Link href="/dashboard/wallet/deposit" className="text-xs text-teal-400 hover:text-teal-300 font-medium">Deposit</Link>
                  <span className="text-gray-600">·</span>
                  <Link href="/dashboard/wallet/withdraw" className="text-xs text-teal-400 hover:text-teal-300 font-medium">Withdraw</Link>
                </div>
              </div>
            </section>

            {/* Charts row */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Bar chart: balance by chain */}
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6">
                <h3 className="text-base font-semibold text-white mb-4">Balance by Chain</h3>
                {analysis.byChain.length === 0 ? (
                  <p className="text-sm text-gray-500 py-8 text-center">No balances yet. Deposit to see breakdown.</p>
                ) : (
                  <div className="space-y-3">
                    {analysis.byChain.map((c) => (
                      <div key={c.chainId} className="flex items-center gap-3">
                        <div className="w-24 shrink-0 text-sm text-gray-300 truncate">{c.chainName}</div>
                        <div className="flex-1 h-8 bg-gray-800/80 rounded-lg overflow-hidden">
                          <div
                            className="h-full rounded-lg transition-all"
                            style={{
                              width: `${(c.usd / analysis.maxChainUSD) * 100}%`,
                              backgroundColor: CHAIN_COLORS[c.chainId] || '#14b8a6',
                            }}
                          />
                        </div>
                        <div className="w-20 text-right text-sm font-medium text-white shrink-0">
                          ${c.usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pie: allocation by chain */}
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6">
                <h3 className="text-base font-semibold text-white mb-4">Allocation by Chain</h3>
                {analysis.pieSegments.length === 0 ? (
                  <p className="text-sm text-gray-500 py-8 text-center">No allocation data yet.</p>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div
                      className="w-40 h-40 rounded-full shrink-0"
                      style={{
                        background: `conic-gradient(${analysis.pieSegments
                          .map(
                            (s) =>
                              `${CHAIN_COLORS[s.chainId] || '#14b8a6'} ${s.start}% ${s.end}%`
                          )
                          .join(', ')})`,
                      }}
                    />
                    <div className="flex-1 space-y-2 min-w-0">
                      {analysis.pieSegments.map((s) => (
                        <div key={s.chainId} className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: CHAIN_COLORS[s.chainId] || '#14b8a6' }}
                          />
                          <span className="text-sm text-gray-300 truncate">{s.chainName}</span>
                          <span className="text-sm font-medium text-white ml-auto">{s.pct.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Full assets table */}
            <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">All Assets</h3>
                <Link href="/dashboard/wallet/chains" className="text-sm text-teal-400 hover:text-teal-300">
                  View by chain →
                </Link>
              </div>
              {analysis.assets.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  <p>No assets yet. Deposit to get started.</p>
                  <Link href="/dashboard/wallet/deposit" className="inline-block mt-2 text-teal-400 hover:text-teal-300 text-sm">
                    Go to Deposit
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Chain</th>
                        <th className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
                        <th className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Balance</th>
                        <th className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Value (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.assets.map((a, i) => (
                        <tr key={`${a.chainId}-${a.symbol}-${i}`} className="border-b border-gray-800/80 hover:bg-gray-900/40">
                          <td className="py-3 px-4 text-sm text-gray-300">{a.chainName}</td>
                          <td className="py-3 px-4">
                            <span className="text-white font-medium">{a.symbol}</span>
                            {a.isNative && <span className="text-xs text-gray-500 ml-1">(native)</span>}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-300 text-right font-mono">{formatBalance(a.balance)}</td>
                          <td className="py-3 px-4 text-sm font-medium text-white text-right">${a.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Chains with addresses + receive */}
            <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Your Addresses</h3>
              <div className="space-y-3">
                {wallets.map((w) => {
                  const chainUSD = parseFloat(w.balance?.nativeUSD || '0') + (w.balance?.tokens || []).reduce((s, t) => s + parseFloat(t.balanceUSD || '0'), 0);
                  return (
                    <div
                      key={w.chainId}
                      className="flex flex-wrap items-center justify-between gap-3 p-4 bg-black/30 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {w.logoUrl ? (
                          <img src={w.logoUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white text-sm font-bold">{w.chainName.slice(0, 1)}</div>
                        )}
                        <div>
                          <p className="text-white font-medium">{w.chainName}</p>
                          <p className="text-xs text-gray-500 font-mono truncate max-w-[180px] sm:max-w-xs">{w.address}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">${chainUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        <button
                          onClick={() => copyAddress(w.address)}
                          className="p-2 text-gray-400 hover:text-teal-400 hover:bg-gray-800 rounded-lg"
                          title="Copy"
                        >
                          {copiedAddress === w.address ? (
                            <span className="text-xs text-teal-400">Copied</span>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => openReceive(w)}
                          className="px-3 py-1.5 text-sm font-medium text-teal-400 hover:bg-teal-400/10 rounded-lg border border-teal-400/30 transition-colors"
                        >
                          Receive
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {wallets.length === 0 && (
                <p className="text-sm text-gray-500">No wallet addresses yet. Complete onboarding to get addresses per chain.</p>
              )}
            </div>

            {/* Recent activity */}
            <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
                <Link href="/dashboard/transactions" className="text-sm text-teal-400 hover:text-teal-300">View all</Link>
              </div>
              <div className="text-center py-8 text-gray-500 text-sm">
                <p>Transaction history appears on the Transactions page.</p>
                <Link href="/dashboard/transactions" className="inline-block mt-2 text-teal-400 hover:text-teal-300">Go to Transactions</Link>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Receive modal */}
      {activeModal === 'receive' && receiveWallet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Receive on {receiveWallet.chainName}</h3>
              <button onClick={() => { setActiveModal(null); setReceiveWallet(null); }} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="bg-black/30 border border-gray-800 rounded-xl p-4 mb-4">
              <p className="text-xs text-gray-400 mb-2">Your {receiveWallet.chainName} address</p>
              <p className="text-white font-mono text-sm break-all mb-3">{receiveWallet.address}</p>
              <button
                onClick={() => copyAddress(receiveWallet.address)}
                className="w-full py-2.5 bg-teal-500 hover:bg-teal-600 text-black font-medium rounded-lg transition-colors"
              >
                {copiedAddress === receiveWallet.address ? 'Copied!' : 'Copy Address'}
              </button>
            </div>
            <p className="text-xs text-gray-500">Only send compatible assets to this address on {receiveWallet.chainName}.</p>
          </div>
        </div>
      )}
    </PremiumDashboardLayout>
  );
}
