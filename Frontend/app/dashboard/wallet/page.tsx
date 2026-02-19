'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { userApi, ChainWallet } from '@/lib/api/user';
import { walletApi } from '@/lib/api/wallet';

const BASE_CHAIN = {
  id: 'base',
  name: 'Base Sepolia',
  displayName: 'Base',
  symbol: 'ETH',
  icon: '⬆',
  isEVM: true,
  isTestnet: true,
  blockExplorer: 'https://sepolia.basescan.org',
};

export default function WalletPage() {
  const { user, loading } = useAuth();
  const [chainWallet, setChainWallet] = useState<ChainWallet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<'send' | 'receive' | 'withdraw' | null>(null);
  const [copied, setCopied] = useState(false);

  const [sendForm, setSendForm] = useState({
    address: '',
    amount: '',
    asset: '',
  });

  const [withdrawForm, setWithdrawForm] = useState({
    address: '',
    amount: '',
    asset: '',
  });

  useEffect(() => {
    const fetchWallet = async () => {
      if (!user?.id) return;

      try {
        setIsLoading(true);
        
        const chainWalletResponse = await userApi.getChainWallet(user.id, BASE_CHAIN.id).catch(() => ({ success: false, data: null }));

        if (chainWalletResponse.success && chainWalletResponse.data) {
          setChainWallet(chainWalletResponse.data);
        } else if (user.walletAddress) {
          // Fallback to legacy wallet address for Base
          setChainWallet({
            chainId: 'base',
            chainName: 'Base Sepolia',
            addressId: '',
            address: user.walletAddress,
            balance: {
              native: '0',
              nativeUSD: '0',
              tokens: [],
            },
          });
        }
      } catch (error) {
        console.error('Failed to fetch wallet:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchWallet();
    }
  }, [user]);

  const copyAddress = async () => {
    if (!chainWallet?.address) return;
    await navigator.clipboard.writeText(chainWallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatBalance = (balance: string, decimals: number = 18) => {
    const num = parseFloat(balance) / Math.pow(10, decimals);
    if (num === 0) return '0.00';
    if (num < 0.01) return '<0.01';
    return num.toFixed(4);
  };

  const getTotalValue = () => {
    if (!chainWallet) return 0;
    const nativeUSD = parseFloat(chainWallet.balance.nativeUSD || '0');
    const tokensUSD = chainWallet.balance.tokens.reduce(
      (sum, token) => sum + parseFloat(token.balanceUSD || '0'),
      0
    );
    return nativeUSD + tokensUSD;
  };

  if (loading || !user) {
    return (
      <PremiumDashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
        </div>
      </PremiumDashboardLayout>
    );
  }

  const totalValue = getTotalValue();

  return (
    <PremiumDashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Wallet</h1>
            <p className="text-gray-400">Manage your crypto assets</p>
          </div>
        </div>

        <div className="space-y-6">
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Total Balance</p>
                  <h2 className="text-4xl font-bold text-white mb-1">
                    ${totalValue.toFixed(2)}
                  </h2>
                  <p className="text-xs text-gray-500">On Base</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveModal('send')}
                    className="px-4 py-2 bg-teal-400 hover:bg-teal-500 text-black font-medium rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                    Send
                  </button>
                  <button
                    onClick={() => setActiveModal('receive')}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                    </svg>
                    Receive
                  </button>
                </div>
              </div>

              {chainWallet && (
                <div className="bg-black/30 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">{BASE_CHAIN.icon}</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">{BASE_CHAIN.name}</p>
                        <p className="text-white font-medium">${totalValue.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={copyAddress}
                        className="p-2 text-gray-400 hover:text-teal-400 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                        title="Copy address"
                      >
                        {copied ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 font-mono truncate">
                    {chainWallet.address}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-800">
                <h3 className="text-lg font-bold text-white">Assets on {BASE_CHAIN.name}</h3>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400"></div>
                </div>
              ) : chainWallet ? (
                <div className="p-6 space-y-3">
                  <div className="flex items-center justify-between p-4 bg-black/30 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
                        {BASE_CHAIN.icon}
                      </div>
                      <div>
                        <div className="text-white font-medium">{BASE_CHAIN.symbol}</div>
                        <div className="text-sm text-gray-500">{BASE_CHAIN.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-medium">
                        {formatBalance(chainWallet.balance.native)}
                      </div>
                      <div className="text-sm text-gray-500">
                        ${parseFloat(chainWallet.balance.nativeUSD || '0').toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {chainWallet.balance.tokens.map((token, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-black/30 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {token.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-white font-medium">{token.symbol}</div>
                          <div className="text-sm text-gray-500 font-mono text-xs">
                            {token.address.slice(0, 6)}...{token.address.slice(-4)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-medium">
                          {formatBalance(token.balance)}
                        </div>
                        <div className="text-sm text-gray-500">
                          ${parseFloat(token.balanceUSD || '0').toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {chainWallet.balance.tokens.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>No tokens on this chain</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500">
                  <p>No wallet data available</p>
                </div>
              )}
            </div>

          <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Recent Activity</h3>
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No recent activity</p>
              <p className="text-sm mt-1">Your transactions will appear here</p>
            </div>
          </div>
        </div>
      </div>

      {activeModal === 'receive' && chainWallet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Receive {BASE_CHAIN.symbol}</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-white p-6 rounded-xl mb-4">
              <div className="text-center text-xs text-gray-900 font-mono break-all">
                QR Code Placeholder for: {chainWallet.address}
              </div>
            </div>

            <div className="bg-black/30 border border-gray-800 rounded-xl p-4 mb-4">
              <p className="text-xs text-gray-400 mb-2">Your {BASE_CHAIN.name} Address</p>
              <p className="text-white font-mono text-sm break-all mb-3">{chainWallet.address}</p>
              <button
                onClick={copyAddress}
                className="w-full py-2 bg-teal-400 hover:bg-teal-500 text-black font-medium rounded-lg transition-colors cursor-pointer"
              >
                {copied ? 'Copied!' : 'Copy Address'}
              </button>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
              <p className="text-yellow-400 text-sm font-medium mb-1">⚠️ Important</p>
              <p className="text-gray-400 text-xs">
                Only send {BASE_CHAIN.symbol} or {BASE_CHAIN.isEVM ? 'ERC-20 tokens' : 'compatible tokens'} to this address on {BASE_CHAIN.name}.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'send' && chainWallet && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Send Assets</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Send functionality coming soon!'); }}>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Asset
                </label>
                <select
                  value={sendForm.asset}
                  onChange={(e) => setSendForm({...sendForm, asset: e.target.value})}
                  className="w-full px-4 py-3 bg-black/30 text-white border border-gray-800 rounded-xl focus:outline-none focus:border-teal-400"
                  required
                >
                  <option value="">Select asset</option>
                  <option value={BASE_CHAIN.symbol}>{BASE_CHAIN.symbol} (Native)</option>
                  {chainWallet.balance.tokens.map((token, idx) => (
                    <option key={idx} value={token.symbol}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={sendForm.address}
                  onChange={(e) => setSendForm({...sendForm, address: e.target.value})}
                  placeholder="0x..."
                  className="w-full px-4 py-3 bg-black/30 text-white border border-gray-800 rounded-xl focus:outline-none focus:border-teal-400 font-mono text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Amount
                </label>
                <input
                  type="text"
                  value={sendForm.amount}
                  onChange={(e) => setSendForm({...sendForm, amount: e.target.value})}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-black/30 text-white border border-gray-800 rounded-xl focus:outline-none focus:border-teal-400"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-teal-400 hover:bg-teal-500 text-black font-medium rounded-xl transition-colors cursor-pointer"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </PremiumDashboardLayout>
  );
}
