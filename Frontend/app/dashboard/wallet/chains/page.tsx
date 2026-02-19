'use client';

import { useState, useEffect } from 'react';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { useAuth } from '@/lib/contexts/AuthContext';
import { userApi } from '@/lib/api/user';
import Link from 'next/link';

interface ChainWallet {
  chainId: string;
  chainName: string;
  address: string;
  addressId: string;
  balance: {
    native: string;
    tokens?: Array<{
      symbol: string;
      balance: string;
      usdValue: string;
    }>;
  };
}

export default function MultiChainPage() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<ChainWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalValue, setTotalValue] = useState('0.00');

  useEffect(() => {
    fetchWallets();
  }, [user]);

  const fetchWallets = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await userApi.getAllWallets(user.userId);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch wallets');
      }

      setWallets(response.data);
      
      const total = response.data.reduce((sum: number, wallet: ChainWallet) => {
        const tokens = wallet.balance?.tokens || [];
        const walletTotal = tokens.reduce((tokenSum, token) => tokenSum + parseFloat(token.usdValue || '0'), 0);
        return sum + walletTotal;
      }, 0);
      setTotalValue(total.toFixed(2));
    } catch (error) {
      console.error('Error fetching wallets:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshBalances = async () => {
    setRefreshing(true);
    await fetchWallets();
    setRefreshing(false);
  };

  const getChainIcon = (chainId: string): string => {
    const icons: Record<string, string> = {
      base: '⚡',
      ethereum: '⟠',
      polygon: '🔷',
      bnb: '🟡',
      arbitrum: '🔵',
      optimism: '🔴',
      tron: '🔺',
      solana: '🟣',
      avalanche: '🔺',
      celo: '💚',
    };
    return icons[chainId] || '🔗';
  };

  const getChainColor = (chainId: string): string => {
    const colors: Record<string, string> = {
      base: 'from-blue-500 to-blue-600',
      ethereum: 'from-purple-500 to-purple-600',
      polygon: 'from-violet-500 to-violet-600',
      bnb: 'from-yellow-500 to-yellow-600',
      arbitrum: 'from-blue-400 to-blue-500',
      optimism: 'from-red-500 to-red-600',
      tron: 'from-red-400 to-red-500',
      solana: 'from-purple-400 to-purple-500',
      avalanche: 'from-red-500 to-red-600',
      celo: 'from-green-500 to-green-600',
    };
    return colors[chainId] || 'from-gray-500 to-gray-600';
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <PremiumDashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Loading multi-chain wallets...</p>
          </div>
        </div>
      </PremiumDashboardLayout>
    );
  }

  return (
    <PremiumDashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Multi-Chain Wallets</h1>
            <p className="text-gray-400">
              Manage your assets across {wallets.length} blockchain networks
            </p>
          </div>
          <button
            onClick={refreshBalances}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors disabled:opacity-50"
          >
            <svg
              className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Total Value Card */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Portfolio Value</p>
              <p className="text-3xl font-bold text-white">${totalValue}</p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/dashboard/wallet/deposit"
                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg text-white transition-colors"
              >
                Deposit
              </Link>
              <Link
                href="/dashboard/wallet/withdraw"
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
              >
                Withdraw
              </Link>
            </div>
          </div>
        </div>

        {/* Chain Wallets Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {wallets.map((wallet) => (
            <div
              key={wallet.chainId}
              className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors"
            >
              {/* Chain Header */}
              <div className={`bg-gradient-to-r ${getChainColor(wallet.chainId)} p-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{getChainIcon(wallet.chainId)}</div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{wallet.chainName}</h3>
                      <p className="text-sm text-white/80">
                        {wallet.balance?.native || '0'} gas
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(wallet.address)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title="Copy address"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Wallet Address */}
              <div className="p-4 bg-black/20 border-b border-gray-800">
                <p className="text-xs text-gray-400 mb-1">Wallet Address</p>
                <code className="text-sm text-gray-300 font-mono break-all">
                  {wallet.address}
                </code>
              </div>

              {/* Assets */}
              <div className="p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Assets</h4>
                {wallet.balance?.tokens && wallet.balance.tokens.length > 0 ? (
                  <div className="space-y-2">
                    {wallet.balance.tokens.map((token, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {token.symbol.slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-white font-medium">{token.symbol}</p>
                            <p className="text-xs text-gray-500">${token.usdValue}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-medium">{token.balance}</p>
                          <p className="text-xs text-gray-500">{token.symbol}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-500">No assets yet</p>
                    <Link
                      href="/dashboard/wallet/deposit"
                      className="inline-block mt-2 text-sm text-teal-400 hover:text-teal-300"
                    >
                      Deposit funds →
                    </Link>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 bg-black/20 border-t border-gray-800 flex gap-2">
                <Link
                  href={`/dashboard/wallet/deposit?chain=${wallet.chainId}`}
                  className="flex-1 py-2 text-center bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-white transition-colors"
                >
                  Deposit
                </Link>
                <Link
                  href={`/dashboard/wallet/withdraw?chain=${wallet.chainId}`}
                  className="flex-1 py-2 text-center bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-white transition-colors"
                >
                  Withdraw
                </Link>
                <Link
                  href={`/dashboard/transactions?chain=${wallet.chainId}`}
                  className="flex-1 py-2 text-center bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-white transition-colors"
                >
                  History
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {wallets.length === 0 && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-12 text-center">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No Wallets Found</h3>
            <p className="text-gray-400 mb-4">Contact support to set up your multi-chain wallets</p>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-blue-400 font-medium mb-1">Multi-Chain Support</h3>
              <p className="text-sm text-gray-400">
                Your wallet address works across all EVM-compatible chains. You can use the same address to receive assets on Ethereum, Base, Polygon, and more.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PremiumDashboardLayout>
  );
}
