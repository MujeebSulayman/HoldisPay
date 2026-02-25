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
    contractName: '',
    recipientEmail: '',
    deliverables: '',
    outOfScope: '',
    reviewPeriodDays: '14',
    noticePeriodDays: '14',
    priority: 'MEDIUM' as 'HIGH' | 'MEDIUM' | 'LOW',
    contractReference: '',
  });
  const [showSettlement, setShowSettlement] = useState(false);
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
        throw new Error('Invalid recipient address');
      }

      if (!formData.chainSlug || !formData.assetSlug) {
        throw new Error('Please select a blockchain and asset');
      }

      const startTimestamp = Math.floor(new Date(formData.startDate).getTime() / 1000);
      const numPayments = parseInt(formData.numberOfPayments) || 0;
      const intervalDays = parseInt(formData.paymentInterval) || 0;

      const payload: Parameters<typeof paymentContractApi.createContract>[0] = {
        contractorAddress: formData.contractorAddress,
        paymentAmount: formData.paymentAmount,
        numberOfPayments: numPayments,
        paymentInterval: intervalDays,
        startDate: startTimestamp,
        releaseType: formData.releaseType as 'TIME_BASED' | 'MILESTONE_BASED',
        chainSlug: formData.chainSlug,
        assetSlug: formData.assetSlug,
        jobTitle: formData.jobTitle || undefined,
        description: formData.description || undefined,
        contractName: formData.contractName || undefined,
        recipientEmail: formData.recipientEmail || undefined,
        deliverables: formData.deliverables || undefined,
        outOfScope: formData.outOfScope || undefined,
        reviewPeriodDays: formData.reviewPeriodDays ? parseInt(formData.reviewPeriodDays) : undefined,
        noticePeriodDays: formData.noticePeriodDays ? parseInt(formData.noticePeriodDays) : undefined,
        priority: formData.priority,
        contractReference: formData.contractReference || undefined,
      };
      if (formData.startDate && numPayments && intervalDays) {
        const endMs = new Date(formData.startDate).getTime() + numPayments * intervalDays * 24 * 60 * 60 * 1000;
        payload.endDate = Math.floor(endMs / 1000);
      }

      const response = await paymentContractApi.createContract(payload);

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
              className="text-gray-400 hover:text-white transition-colors shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </a>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Create Payment Contract</h1>
          </div>
          <p className="text-gray-400 text-sm sm:text-base">Set up a recurring payment agreement with a recipient</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contract Details */}
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-white">Contract Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Contract Name</label>
                <input
                  type="text"
                  name="contractName"
                  value={formData.contractName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                  placeholder="e.g., Q1 Dev Agreement"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                >
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">Job Title *</label>
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
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                  placeholder="Describe the work and expectations..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Deliverables / Scope</label>
                <textarea
                  name="deliverables"
                  value={formData.deliverables}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                  placeholder="What must be delivered before payment..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Out of Scope</label>
                <textarea
                  name="outOfScope"
                  value={formData.outOfScope}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                  placeholder="What is not included..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Contract Reference</label>
                <input
                  type="text"
                  name="contractReference"
                  value={formData.contractReference}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                  placeholder="PO number, internal ref..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Currency</label>
                <p className="px-4 py-3 bg-black/50 border border-gray-800 rounded-xl text-gray-400">USD</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Recipient Address *</label>
                <input
                  type="text"
                  name="contractorAddress"
                  value={formData.contractorAddress}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors font-mono text-sm"
                  placeholder="0x..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Recipient Email</label>
                <input
                  type="email"
                  name="recipientEmail"
                  value={formData.recipientEmail}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                  placeholder="for notifications"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Start Date *</label>
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
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Contract End</label>
                <p className="px-4 py-3 bg-black/50 border border-gray-800 rounded-xl text-gray-400 text-sm">
                  {formData.startDate && formData.numberOfPayments && formData.paymentInterval
                    ? (() => {
                        const start = new Date(formData.startDate);
                        const n = parseInt(formData.numberOfPayments) || 0;
                        const days = parseInt(formData.paymentInterval) || 0;
                        const end = new Date(start.getTime() + n * days * 24 * 60 * 60 * 1000);
                        return end.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                      })()
                    : '—'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Review Period (days)</label>
                <input
                  type="number"
                  name="reviewPeriodDays"
                  value={formData.reviewPeriodDays}
                  onChange={handleChange}
                  min={0}
                  max={90}
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                  placeholder="14"
                />
                <p className="text-xs text-gray-500 mt-1">Auto-release if not disputed</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Termination Notice (days)</label>
                <input
                  type="number"
                  name="noticePeriodDays"
                  value={formData.noticePeriodDays}
                  onChange={handleChange}
                  min={0}
                  max={365}
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                  placeholder="14"
                />
              </div>
            </div>
          </div>

          {/* Payment Terms */}
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-white">Payment Terms</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Payment Amount (USD) *</label>
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
                <label className="block text-sm font-medium text-gray-300 mb-2">Number of Payments *</label>
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
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Payment Interval (Days) *</label>
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
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Release Type *</label>
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
                  {formData.releaseType === 'TIME_BASED' ? 'Auto by interval' : 'When milestones approved'}
                </p>
              </div>
            </div>

            {/* Payment Schedule Preview */}
            {formData.startDate && formData.paymentAmount && formData.numberOfPayments && formData.paymentInterval && (
              <div className="bg-black/30 border border-gray-800 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-400 mb-2">Payment Schedule</p>
                <ul className="space-y-1 text-sm text-gray-300 max-h-32 overflow-y-auto">
                  {Array.from({ length: Math.min(parseInt(formData.numberOfPayments) || 0, 12) }, (_, i) => {
                    const start = new Date(formData.startDate);
                    const days = (parseInt(formData.paymentInterval) || 0) * (i + 1);
                    const d = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
                    return (
                      <li key={i}>
                        Payment {i + 1}: {d.toLocaleDateString('en-US')} – ${parseFloat(formData.paymentAmount).toFixed(2)}
                      </li>
                    );
                  })}
                  {(parseInt(formData.numberOfPayments) || 0) > 12 && (
                    <li className="text-gray-500">... +{(parseInt(formData.numberOfPayments) || 0) - 12} more</li>
                  )}
                </ul>
              </div>
            )}

            {/* Total */}
            {formData.paymentAmount && formData.numberOfPayments && (
              <div className="bg-black/30 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Total Contract Value</span>
                  <span className="text-2xl font-bold text-white">
                    ${(parseFloat(formData.paymentAmount) * parseInt(formData.numberOfPayments)).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 text-sm text-gray-500">
                  <span>{formData.numberOfPayments} × ${parseFloat(formData.paymentAmount).toFixed(2)}</span>
                  {formData.paymentInterval && (
                    <span>~{(parseInt(formData.numberOfPayments) * parseInt(formData.paymentInterval)) / 30} months</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Settlement (how you'll pay) – collapsible */}
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSettlement(!showSettlement)}
              className="w-full px-6 py-4 flex items-center justify-between text-left text-white hover:bg-gray-800/50 transition-colors"
            >
              <span className="font-medium">Settlement (blockchain & token)</span>
              <svg className={`w-5 h-5 transition-transform ${showSettlement ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showSettlement && (
              <div className="px-6 pb-6 pt-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-800">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Blockchain Network *</label>
                  <select
                    name="chainSlug"
                    value={formData.chainSlug}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                  >
                    <option value="">Select...</option>
                    {blockchains.map(chain => (
                      <option key={chain.id} value={chain.slug}>{chain.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Payment Token *</label>
                  <select
                    name="assetSlug"
                    value={formData.assetSlug}
                    onChange={handleChange}
                    required
                    disabled={!formData.chainSlug || selectedChainAssets.length === 0}
                    className="w-full px-4 py-3 bg-black border border-gray-800 rounded-xl text-white focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors disabled:opacity-50"
                  >
                    <option value="">Select...</option>
                    {selectedChainAssets.map(asset => (
                      <option key={asset.id} value={asset.slug}>{asset.symbol}</option>
                    ))}
                  </select>
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
              <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <div className="space-y-1">
                <p className="text-sm text-blue-400 font-medium">Important Information</p>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• You'll need to fund the contract before payments can be released</li>
                  <li>• Recipient can claim payments after each interval period</li>
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
