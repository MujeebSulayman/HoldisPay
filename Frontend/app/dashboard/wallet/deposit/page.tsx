'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { useAuth } from '@/lib/contexts/AuthContext';
import { userApi } from '@/lib/api/user';

interface Chain {
  id: string;
  name: string;
  logoUrl: string;
  address: string;
  addressId: string;
}

export default function DepositPage() {
  const { user } = useAuth();
  const [selectedChain, setSelectedChain] = useState<Chain | null>(null);
  const [chains, setChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [balanceSummary, setBalanceSummary] = useState<{ withdrawableChains: number; lockedChains: number } | null>(null);

  useEffect(() => {
    fetchUserWallets();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    userApi.getConsolidatedBalance(user.id).then((res) => {
      if (res.success && res.data) {
        const walletChains = Object.keys(res.data.wallet).filter(
          (cid) => res.data!.wallet[cid].native !== '0' || (res.data!.wallet[cid].tokens?.length ?? 0) > 0
        );
        const lockedChains = Object.keys(res.data.inContracts).filter(
          (cid) =>
            res.data!.inContracts[cid].native !== '0' ||
            (res.data!.inContracts[cid].tokens?.length ?? 0) > 0
        );
        setBalanceSummary({ withdrawableChains: walletChains.length, lockedChains: lockedChains.length });
      }
    }).catch(() => {});
  }, [user]);

  const fetchUserWallets = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await userApi.getAllWallets(user.id);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch wallets');
      }

      const walletData = response.data;

      const chainList: Chain[] = walletData.map((w: any) => ({
        id: w.chainId,
        name: w.chainName,
        logoUrl: w.logoUrl,
        address: w.address,
        addressId: w.addressId,
      }));

      setChains(chainList);
      if (chainList.length > 0) {
        setSelectedChain(chainList[0]);
      }
    } catch (error) {
      console.error('Error fetching wallets:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <PremiumDashboardLayout>
        <PageLoader />
      </PremiumDashboardLayout>
    );
  }

  return (
    <PremiumDashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 min-w-0">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Deposit Funds</h1>
        </div>

        {balanceSummary && (balanceSummary.withdrawableChains > 0 || balanceSummary.lockedChains > 0) && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 flex flex-wrap items-center gap-4 text-sm text-gray-400">
            <span>Withdrawable: {balanceSummary.withdrawableChains} chain(s) <Link href="/dashboard/wallet/withdraw" className="text-teal-400 hover:underline">Withdraw</Link></span>
            {balanceSummary.lockedChains > 0 && <span>Locked: {balanceSummary.lockedChains} chain(s)</span>}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Chain Selection */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Select Network</h2>
              <div className="space-y-2">
                {chains.map((chain) => (
                  <button
                    key={chain.id}
                    onClick={() => setSelectedChain(chain)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                      selectedChain?.id === chain.id
                        ? 'bg-teal-500/20 border border-teal-500/40 text-teal-400'
                        : 'bg-gray-800/30 border border-gray-800 text-gray-400 hover:bg-gray-800/50 hover:text-gray-300'
                    }`}
                  >
                    <img src={chain.logoUrl} alt={chain.name} className="w-8 h-8 rounded-full" />
                    <span className="font-medium">{chain.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Deposit Details */}
          <div className="lg:col-span-2">
            {selectedChain ? (
              <div className="space-y-6">
                {/* Address Card */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Deposit Address</h2>
                    <div className="flex items-center gap-2 text-sm">
                      <img src={selectedChain.logoUrl} alt={selectedChain.name} className="w-6 h-6 rounded-full" />
                      <span className="text-gray-400">{selectedChain.name}</span>
                    </div>
                  </div>

                  <div className="bg-black/40 border border-gray-800 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between gap-3">
                      <code className="text-teal-400 font-mono text-sm break-all">
                        {selectedChain.address}
                      </code>
                      <button
                        onClick={() => copyToClipboard(selectedChain.address)}
                        className="shrink-0 p-2 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        {copied ? (
                          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="text-sm text-gray-500">Auto-sweep enabled</div>
                </div>

                {/* Supported Assets */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Supported Stablecoins</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {['USDC', 'USDT', 'DAI', 'EURC', 'cNGN', 'BUSD'].map((token) => (
                      <div
                        key={token}
                        className="flex items-center gap-2 p-3 bg-gray-800/30 border border-gray-800 rounded-lg"
                      >
                        <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {token.slice(0, 2)}
                        </div>
                        <span className="text-sm font-medium text-white">{token}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-4">Stablecoins only.</p>
                </div>

              </div>
            ) : (
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-12 text-center">
                <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No Wallets Found</h3>
                <p className="text-gray-400">Please contact support to set up your wallets</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Testnet faucets</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <a
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-gray-800/30 hover:bg-gray-800/50 border border-gray-800 rounded-lg transition-colors group"
            >
              <div>
                <p className="text-white font-medium">Circle Faucet</p>
                <p className="text-xs text-gray-500">Stablecoins on multiple chains</p>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-teal-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
            <a
              href="https://www.bnbchain.org/en/testnet-faucet"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 bg-gray-800/30 hover:bg-gray-800/50 border border-gray-800 rounded-lg transition-colors group"
            >
              <div>
                <p className="text-white font-medium">BNB Chain Faucet</p>
                <p className="text-xs text-gray-500">USDT on BNB testnet</p>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-teal-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </PremiumDashboardLayout>
  );
}
