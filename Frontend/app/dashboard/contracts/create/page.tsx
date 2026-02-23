'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { paymentContractApi } from '@/lib/api/payment-contract';
import { blockchainApi, Blockchain, Asset } from '@/lib/api/blockchain';

export default function CreateContractPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [blockchains, setBlockchains] = useState<Blockchain[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedChainAssets, setSelectedChainAssets] = useState<Asset[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [formData, setFormData] = useState({
    contractorAddress: '',
    paymentAmount: '',
    numberOfPayments: '',
    paymentInterval: '',
    startDate: '',
    releaseType: 'TIME_BASED',
    chainSlug: '',
    assetSlug: '',
    jobTitle: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [chainsData, assetsData] = await Promise.all([
          blockchainApi.getSupportedBlockchains(),
          blockchainApi.getSupportedAssets(),
        ]);
        
        setBlockchains(chainsData.filter(chain => chain.isActive));
        setAssets(assetsData.filter(asset => asset.isActive));
        
        if (chainsData.length > 0) {
          const defaultChain = chainsData.find(c => c.slug === 'base') || chainsData[0];
          setFormData(prev => ({ ...prev, chainSlug: defaultChain.slug }));
          
          const chainAssets = assetsData.filter(
            asset => asset.blockchain.slug === defaultChain.slug
          );
          setSelectedChainAssets(chainAssets);
          
          const usdcAsset = chainAssets.find(a => a.symbol === 'USDC') || chainAssets[0];
          if (usdcAsset) {
            setFormData(prev => ({ ...prev, assetSlug: usdcAsset.slug }));
          }
        }
      } catch (err) {
        console.error('Failed to load blockchains/assets', err);
        setError('Failed to load available chains and assets');
      } finally {
        setLoadingData(false);
      }
    };
    
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (!formData.contractorAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new Error('Invalid contractor address');
      }

      if (!formData.chainSlug || !formData.assetSlug) {
        throw new Error('Please select a blockchain and asset');
      }

      const startTimestamp = Math.floor(new Date(formData.startDate).getTime() / 1000);

      const response = await paymentContractApi.createContract({
        contractorAddress: formData.contractorAddress,
        paymentAmount: formData.paymentAmount,
        numberOfPayments: parseInt(formData.numberOfPayments),
        paymentInterval: parseInt(formData.paymentInterval),
        startDate: startTimestamp,
        releaseType: formData.releaseType as 'TIME_BASED' | 'MILESTONE_BASED',
        chainSlug: formData.chainSlug,
        assetSlug: formData.assetSlug,
        jobTitle: formData.jobTitle,
        description: formData.description,
      });

      if (response.success) {
        router.push('/dashboard/contracts?created=true');
      } else {
        throw new Error(response.error || 'Failed to create contract');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create contract');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'chainSlug') {
      const chainAssets = assets.filter(asset => asset.blockchain.slug === value);
      setSelectedChainAssets(chainAssets);
      
      const usdcAsset = chainAssets.find(a => a.symbol === 'USDC') || chainAssets[0];
      setFormData({
        ...formData,
        chainSlug: value,
        assetSlug: usdcAsset?.slug || '',
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  if (loading || !user || loadingData) {
    return (
      <PremiumDashboardLayout>
        <PageLoader />
      </PremiumDashboardLayout>
    );
  }

  return (
    <PremiumDashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 min-w-0 p-4 sm:p-0">
        {/* Header */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
            <a
              href="/dashboard/contracts"
              className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </a>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Create Payment Contract</h1>
          </div>
          <p className="text-gray-400 text-sm sm:text-base">Set up a recurring payment agreement with a contractor</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contract Details */}
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Contract Details</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Job Title *
                </label>
                <input
                  type="text"
                  name="jobTitle"
                  value={formData.jobTitle}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                  placeholder="e.g., Full Stack Developer"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                  placeholder="Describe the work and expectations..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Contractor Address *
                </label>
                <input
                  type="text"
                  name="contractorAddress"
                  value={formData.contractorAddress}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors font-mono text-sm"
                  placeholder="0x..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Wallet address of the contractor who will receive payments
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Start Date *
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Payment Structure */}
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Payment Structure</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Blockchain Network *
                </label>
                <select
                  name="chainSlug"
                  value={formData.chainSlug}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                >
                  <option value="">Select blockchain...</option>
                  {blockchains.map(chain => (
                    <option key={chain.id} value={chain.slug}>
                      {chain.name} ({chain.symbol.toUpperCase()})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Choose which blockchain to use</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Payment Token *
                </label>
                <select
                  name="assetSlug"
                  value={formData.assetSlug}
                  onChange={handleChange}
                  required
                  disabled={!formData.chainSlug || selectedChainAssets.length === 0}
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors disabled:opacity-50"
                >
                  <option value="">Select token...</option>
                  {selectedChainAssets.map(asset => (
                    <option key={asset.id} value={asset.slug}>
                      {asset.symbol} - {asset.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedChainAssets.length === 0 && formData.chainSlug 
                    ? 'No assets available for this chain' 
                    : 'Stablecoin to use for payments'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Payment Amount (USD) *
                </label>
                <input
                  type="number"
                  name="paymentAmount"
                  value={formData.paymentAmount}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                  placeholder="1000.00"
                />
                <p className="text-xs text-gray-500 mt-1">Amount per payment cycle</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Number of Payments *
                </label>
                <input
                  type="number"
                  name="numberOfPayments"
                  value={formData.numberOfPayments}
                  onChange={handleChange}
                  required
                  min="1"
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                  placeholder="12"
                />
                <p className="text-xs text-gray-500 mt-1">Total number of payment cycles</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Payment Interval (Days) *
                </label>
                <input
                  type="number"
                  name="paymentInterval"
                  value={formData.paymentInterval}
                  onChange={handleChange}
                  required
                  min="1"
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                  placeholder="30"
                />
                <p className="text-xs text-gray-500 mt-1">Days between each payment</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Release Type *
                </label>
                <select
                  name="releaseType"
                  value={formData.releaseType}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                >
                  <option value="TIME_BASED">Time-Based</option>
                  <option value="MILESTONE_BASED">Milestone-Based</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.releaseType === 'TIME_BASED'
                    ? 'Payments release automatically based on time intervals'
                    : 'Payments release when milestones are completed'}
                </p>
              </div>
            </div>

            {/* Total Calculation */}
            {formData.paymentAmount && formData.numberOfPayments && (
              <div className="bg-black/30 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Total Contract Value:</span>
                  <span className="text-2xl font-bold text-white">
                    ${(parseFloat(formData.paymentAmount) * parseInt(formData.numberOfPayments)).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span className="text-gray-500">
                    {formData.numberOfPayments} payments × ${parseFloat(formData.paymentAmount).toFixed(2)}
                  </span>
                  {formData.paymentInterval && (
                    <span className="text-gray-500">
                      Duration: ~{(parseInt(formData.numberOfPayments) * parseInt(formData.paymentInterval)) / 30} months
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-teal-400 hover:bg-teal-500 disabled:bg-gray-800 disabled:text-gray-500 text-black font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                  Creating Contract...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Create Contract
                </>
              )}
            </button>
          </div>

          {/* Info Box */}
          <div className="bg-blue-400/5 border border-blue-400/20 rounded-xl p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <div className="space-y-1">
                <p className="text-sm text-blue-400 font-medium">Important Information</p>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• You'll need to fund the contract before payments can be released</li>
                  <li>• Contractor can claim payments after each interval period</li>
                  <li>• Contract can be paused or terminated at any time</li>
                  <li>• A small platform fee (1%) is deducted from each payment</li>
                </ul>
              </div>
            </div>
          </div>
        </form>
      </div>
    </PremiumDashboardLayout>
  );
}
