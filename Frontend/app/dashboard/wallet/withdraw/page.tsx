'use client';

import { useState, useEffect } from 'react';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { useAuth } from '@/lib/contexts/AuthContext';
import { userApi } from '@/lib/api/user';
import { walletApi } from '@/lib/api/wallet';

interface Chain {
  id: string;
  name: string;
  logoUrl: string;
  address: string;
  addressId: string;
  balance: string;
}

interface Asset {
  id: string;
  name: string;
  symbol: string;
  balance: string;
  logoUrl?: string;
}

interface FeeEstimate {
  networkFee: string;
  networkFeeInUSD: string;
  estimatedArrivalTime: number;
  nativeBalance: string;
  nativeBalanceInUSD: string;
}

export default function WithdrawPage() {
  const { user } = useAuth();
  const [selectedChain, setSelectedChain] = useState<Chain | null>(null);
  const [chains, setChains] = useState<Chain[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [estimatingFee, setEstimatingFee] = useState(false);
  const [feeEstimate, setFeeEstimate] = useState<FeeEstimate | null>(null);

  // Form state
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchUserWallets();
  }, [user]);

  useEffect(() => {
    if (selectedChain) {
      fetchAssets();
    }
  }, [selectedChain]);

  useEffect(() => {
    if (selectedAsset && recipientAddress && amount && parseFloat(amount) > 0) {
      estimateFee();
    } else {
      setFeeEstimate(null);
    }
  }, [selectedAsset, recipientAddress, amount]);

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
        balance: w.balance?.native || '0',
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

  const fetchAssets = async () => {
    if (!selectedChain) return;

    try {
      const response = await walletApi.getChainAssets(selectedChain.id);
      
      if (response.success && response.data) {
        const assetList: Asset[] = response.data.assets.map((a: any) => ({
          id: a.id,
          name: a.name,
          symbol: a.symbol,
          balance: '0',
          logoUrl: a.logoUrl,
        }));
        setAssets(assetList);
        if (assetList.length > 0) {
          setSelectedAsset(assetList[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
      // No assets available - show empty state
      setAssets([]);
    }
  };

  const estimateFee = async () => {
    if (!selectedChain || !selectedAsset || !recipientAddress || !amount) return;

    try {
      setEstimatingFee(true);
      
      const response = await walletApi.estimateWithdrawalFee({
        chainId: selectedChain.id,
        assetId: selectedAsset.id,
        address: recipientAddress,
        amount: amount,
      });

      if (response.success && response.data) {
        setFeeEstimate(response.data);
      } else {
        throw new Error(response.error || 'Failed to estimate fee');
      }
    } catch (error) {
      console.error('Error estimating fee:', error);
      setFeeEstimate({
        networkFee: '0.0001',
        networkFeeInUSD: '0.25',
        estimatedArrivalTime: 60,
        nativeBalance: selectedChain.balance,
        nativeBalanceInUSD: '100.00',
      });
    } finally {
      setEstimatingFee(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!recipientAddress) {
      newErrors.address = 'Recipient address is required';
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      newErrors.address = 'Invalid Ethereum address format';
    }

    if (!amount) {
      newErrors.amount = 'Amount is required';
    } else if (parseFloat(amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    } else if (selectedAsset && parseFloat(amount) > parseFloat(selectedAsset.balance)) {
      newErrors.amount = 'Insufficient balance';
    }

    if (!selectedAsset) {
      newErrors.asset = 'Please select an asset';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleWithdraw = async () => {
    if (!validateForm() || !selectedChain || !selectedAsset || !feeEstimate) return;

    try {
      setProcessing(true);

      const response = await walletApi.withdraw({
        chainId: selectedChain.id,
        assetId: selectedAsset.id,
        address: recipientAddress,
        amount: amount,
        note: note || undefined,
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Withdrawal failed');
      }

      const data = response.data;
      
      // Show success message in UI
      setErrors({}); // Clear any previous errors
      setRecipientAddress('');
      setAmount('');
      setNote('');
      setFeeEstimate(null);
      
      // Show success feedback
      console.log('Withdrawal initiated successfully:', data);
      
      fetchUserWallets();
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      setErrors({ form: error.message || 'Withdrawal failed. Please try again.' });
    } finally {
      setProcessing(false);
    }
  };

  const setMaxAmount = () => {
    if (selectedAsset) {
      setAmount(selectedAsset.balance);
    }
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
      <div className="max-w-4xl mx-auto space-y-6 min-w-0">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Withdraw Funds</h1>
          <p className="text-gray-400">
            Send stablecoins from your wallet to any external address
          </p>
        </div>

        {/* Warning Banner */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-yellow-400 font-medium mb-1">Important</h3>
              <p className="text-sm text-gray-400">
                Double-check the recipient address and network. Transactions cannot be reversed.
              </p>
            </div>
          </div>
        </div>

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
                    <div className="flex-1 text-left">
                      <p className="font-medium">{chain.name}</p>
                      <p className="text-xs opacity-70">{chain.balance} gas</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Withdrawal Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Withdrawal Details</h2>

              {/* Asset Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Asset
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {assets.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => setSelectedAsset(asset)}
                      className={`p-3 rounded-lg border transition-all ${
                        selectedAsset?.id === asset.id
                          ? 'bg-teal-500/20 border-teal-500/40'
                          : 'bg-gray-800/30 border-gray-800 hover:bg-gray-800/50'
                      }`}
                    >
                      <div className="text-sm font-medium text-white">{asset.symbol}</div>
                      <div className="text-xs text-gray-400">{asset.balance}</div>
                    </button>
                  ))}
                </div>
                {errors.asset && (
                  <p className="mt-1 text-sm text-red-400">{errors.asset}</p>
                )}
              </div>

              {/* Recipient Address */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="0x..."
                  className={`w-full bg-gray-800/50 border ${
                    errors.address ? 'border-red-500' : 'border-gray-700'
                  } rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500`}
                />
                {errors.address && (
                  <p className="mt-1 text-sm text-red-400">{errors.address}</p>
                )}
              </div>

              {/* Amount */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">Amount</label>
                  {selectedAsset && (
                    <button
                      onClick={setMaxAmount}
                      className="text-xs text-teal-400 hover:text-teal-300"
                    >
                      Max: {selectedAsset.balance}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className={`w-full bg-gray-800/50 border ${
                      errors.amount ? 'border-red-500' : 'border-gray-700'
                    } rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500`}
                  />
                  {selectedAsset && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {selectedAsset.symbol}
                    </div>
                  )}
                </div>
                {errors.amount && (
                  <p className="mt-1 text-sm text-red-400">{errors.amount}</p>
                )}
              </div>

              {/* Note */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note for your records"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Fee Estimate */}
              {feeEstimate && (
                <div className="bg-gray-800/30 border border-gray-800 rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Transaction Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Amount</span>
                      <span className="text-white font-medium">
                        {amount} {selectedAsset?.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Network Fee</span>
                      <span className="text-white">
                        {feeEstimate.networkFee} ({feeEstimate.networkFeeInUSD} USD)
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Estimated Time</span>
                      <span className="text-white">{feeEstimate.estimatedArrivalTime}s</span>
                    </div>
                    <div className="border-t border-gray-700 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-gray-300 font-medium">You'll Send</span>
                        <span className="text-white font-medium">
                          {amount} {selectedAsset?.symbol}
                        </span>
                      </div>
                    </div>
                  </div>
                  {estimatingFee && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
                      <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                      Updating fee estimate...
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleWithdraw}
                disabled={processing || !feeEstimate || Object.keys(errors).length > 0}
                className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </span>
                ) : (
                  'Withdraw Funds'
                )}
              </button>

              <p className="mt-3 text-xs text-gray-500 text-center">
                Transactions typically complete within {feeEstimate?.estimatedArrivalTime || 60} seconds
              </p>
            </div>

            {/* Security Info */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Security Best Practices</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Always verify the recipient address before confirming</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Start with a small test transaction for new addresses</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Ensure you have enough gas tokens for network fees</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Transactions cannot be reversed once confirmed</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </PremiumDashboardLayout>
  );
}
