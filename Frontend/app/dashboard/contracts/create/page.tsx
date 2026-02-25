'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { paymentContractApi } from '@/lib/api/payment-contract';
import { blockchainApi, type EnabledChain, type Asset } from '@/lib/api/blockchain';

type ReleaseType = 'TIME_BASED' | 'MILESTONE_BASED';

interface MilestoneRow {
  id: string;
  description: string;
  amount: string;
}

const inputBase =
  'w-full px-4 py-3 bg-black/40 border border-gray-700/80 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400 transition-colors';
const inputError = 'border-red-400/60 focus:ring-red-400/50 focus:border-red-400';

export default function CreateContractPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [enabledChains, setEnabledChains] = useState<EnabledChain[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedChainAssets, setSelectedChainAssets] = useState<Asset[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [formData, setFormData] = useState({
    contractorAddress: '',
    paymentAmount: '',
    numberOfPayments: '1',
    paymentInterval: '30',
    startDate: '',
    releaseType: 'TIME_BASED' as ReleaseType,
    duration: 'FIXED' as 'FIXED' | 'ONGOING',
    chainSlug: '',
    assetSlug: '',
    jobTitle: '',
    description: '',
    contractName: '',
    recipientEmail: '',
    deliverables: '',
  });
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [touchedAddress, setTouchedAddress] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [chainsFromEnv, assetsData] = await Promise.all([
          blockchainApi.getEnabledChains(),
          blockchainApi.getSupportedAssets(),
        ]);
        setEnabledChains(chainsFromEnv);
        const activeAssets = assetsData.filter((a) => a.isActive !== false);
        setAssets(activeAssets);

        if (chainsFromEnv.length > 0) {
          const defaultChain = chainsFromEnv.find((c) => c.slug === 'base') || chainsFromEnv[0];
          setFormData((prev) => ({ ...prev, chainSlug: defaultChain.slug }));
          const chainAssets = activeAssets.filter((a) => a.blockchain?.slug === defaultChain.slug);
          setSelectedChainAssets(chainAssets);
          const usdc = chainAssets.find((a) => a.symbol === 'USDC') || chainAssets[0];
          if (usdc) setFormData((prev) => ({ ...prev, assetSlug: usdc.slug ?? usdc.id }));
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load networks');
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setError('');
    if (name === 'chainSlug') {
      const chainAssets = assets.filter((a) => a.blockchain?.slug === value);
      setSelectedChainAssets(chainAssets);
      const usdc = chainAssets.find((a) => a.symbol === 'USDC') || chainAssets[0];
      setFormData((prev) => ({ ...prev, chainSlug: value, assetSlug: usdc ? (usdc.slug ?? usdc.id) : '' }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const addMilestone = () => {
    setMilestones((prev) => [...prev, { id: crypto.randomUUID(), description: '', amount: '' }]);
  };

  const updateMilestone = (id: string, field: 'description' | 'amount', value: string) => {
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const removeMilestone = (id: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  };

  const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);
  const showAddressError = touchedAddress && formData.contractorAddress.length > 0 && !isValidAddress(formData.contractorAddress);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setTouchedAddress(true);
    if (!isValidAddress(formData.contractorAddress)) {
      setError('Enter a valid recipient wallet address (0x followed by 40 hex characters).');
      return;
    }
    setIsSubmitting(true);
    try {
      if (!formData.chainSlug || !formData.assetSlug) {
        throw new Error('Select network and token');
      }
      if (!formData.startDate) {
        throw new Error('Select start date');
      }

      const releaseType = formData.releaseType as ReleaseType;
      const isOngoing = formData.duration === 'ONGOING';
      const numPayments = isOngoing ? 1000 : (parseInt(formData.numberOfPayments, 10) || 1);
      const intervalDays = parseInt(formData.paymentInterval, 10) || 30;

      let paymentAmount = formData.paymentAmount;
      let numberOfPayments = numPayments;

      if (releaseType === 'MILESTONE_BASED' && !isOngoing) {
        const valid = milestones.filter((m) => m.description.trim() && m.amount && parseFloat(m.amount) > 0);
        if (valid.length === 0) {
          throw new Error('Add at least one milestone with description and amount');
        }
        const totalMilestone = valid.reduce((s, m) => s + parseFloat(m.amount), 0);
        if (totalMilestone <= 0) throw new Error('Milestone total must be greater than 0');
        numberOfPayments = valid.length;
        paymentAmount = (totalMilestone / numberOfPayments).toFixed(2);
      }

      const startTimestamp = Math.floor(new Date(formData.startDate).getTime() / 1000);
      const payload: Parameters<typeof paymentContractApi.createContract>[0] = {
        contractorAddress: formData.contractorAddress,
        paymentAmount,
        numberOfPayments,
        paymentInterval: intervalDays,
        startDate: startTimestamp,
        releaseType: isOngoing ? 'TIME_BASED' : releaseType,
        chainSlug: formData.chainSlug,
        assetSlug: formData.assetSlug,
        jobTitle: formData.jobTitle || undefined,
        description: formData.description || undefined,
        contractName: formData.contractName || undefined,
        recipientEmail: formData.recipientEmail?.trim() || undefined,
        deliverables: formData.deliverables?.trim() || undefined,
        ongoing: isOngoing || undefined,
      };
      if (!isOngoing && formData.startDate && numberOfPayments && intervalDays) {
        const endMs = new Date(formData.startDate).getTime() + numberOfPayments * intervalDays * 24 * 60 * 60 * 1000;
        payload.endDate = Math.floor(endMs / 1000);
      }
      if (releaseType === 'MILESTONE_BASED' && !isOngoing && milestones.length > 0) {
        payload.milestones = milestones
          .filter((m) => m.description.trim() && m.amount && parseFloat(m.amount) > 0)
          .map((m) => ({ description: m.description.trim(), amount: m.amount }));
      }

      const response = await paymentContractApi.createContract(payload);
      if (response.success) {
        router.push('/dashboard/contracts?created=true');
      } else {
        throw new Error((response as { error?: string }).error || 'Failed to create contract');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create contract');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOngoing = formData.duration === 'ONGOING';
  const totalValue =
    !isOngoing && formData.paymentAmount && formData.numberOfPayments
      ? parseFloat(formData.paymentAmount) * (parseInt(formData.numberOfPayments, 10) || 0)
      : 0;
  const isMilestone = formData.releaseType === 'MILESTONE_BASED';
  const milestoneTotal =
    isMilestone && milestones.length > 0
      ? milestones
          .filter((m) => m.amount && parseFloat(m.amount) > 0)
          .reduce((s, m) => s + parseFloat(m.amount), 0)
      : 0;
  const displayTotal = isOngoing ? null : isMilestone ? milestoneTotal : totalValue;
  const networkLabel =
    formData.chainSlug && formData.assetSlug
      ? `${enabledChains.find((c) => c.slug === formData.chainSlug)?.displayName ?? formData.chainSlug} · ${selectedChainAssets.find((a) => (a.slug ?? a.id) === formData.assetSlug)?.symbol ?? formData.assetSlug}`
      : null;

  if (loading || !user || loadingData) {
    return (
      <PremiumDashboardLayout>
        <PageLoader />
      </PremiumDashboardLayout>
    );
  }

  return (
    <PremiumDashboardLayout>
      <div className="min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {/* Back */}
          <a
            href="/dashboard/contracts"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-8 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to contracts
          </a>

          {/* Headline */}
          <div className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">New payment agreement</h1>
            <p className="mt-2 text-gray-400 text-lg">
              Set the amount, schedule, and who gets paid. You’ll fund the contract after creating it.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Step 1: Agreement */}
            <section className="relative">
              <div className="flex items-center gap-3 mb-5">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-400/10 text-teal-400 text-sm font-semibold">
                  1
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-white">Agreement details</h2>
                  <p className="text-sm text-gray-500">Title and who receives payments</p>
                </div>
              </div>
              <div className="pl-11 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                  <input
                    type="text"
                    name="jobTitle"
                    value={formData.jobTitle}
                    onChange={handleChange}
                    required
                    className={inputBase}
                    placeholder="e.g. Q1 development, Design retainer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description <span className="text-gray-500 font-normal">(optional)</span></label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={4}
                    className={`${inputBase} resize-y min-h-24`}
                    placeholder="Describe the work, deliverables, or any notes for this agreement…"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Recipient wallet address</label>
                  <input
                    type="text"
                    name="contractorAddress"
                    value={formData.contractorAddress}
                    onChange={handleChange}
                    onBlur={() => setTouchedAddress(true)}
                    required
                    className={`${inputBase} font-mono text-sm ${showAddressError ? inputError : ''}`}
                    placeholder="0x..."
                  />
                  {showAddressError && (
                    <p className="mt-1.5 text-sm text-red-400">Enter a valid Ethereum address (0x + 40 hex characters)</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Recipient email <span className="text-gray-500 font-normal">(optional)</span></label>
                  <input
                    type="email"
                    name="recipientEmail"
                    value={formData.recipientEmail}
                    onChange={handleChange}
                    className={inputBase}
                    placeholder="For notifications or sending the contract link"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Deliverables / scope <span className="text-gray-500 font-normal">(optional)</span></label>
                  <textarea
                    name="deliverables"
                    value={formData.deliverables}
                    onChange={handleChange}
                    rows={2}
                    className={`${inputBase} resize-none`}
                    placeholder="What’s in scope (for your reference)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Attach agreement document <span className="text-gray-500 font-normal">(optional)</span></label>
                  <div className={`${inputBase} min-h-14 flex flex-col justify-center`}>
                    <input
                      type="file"
                      id="agreement-doc"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        setUploadFile(f ?? null);
                      }}
                    />
                    <label htmlFor="agreement-doc" className="cursor-pointer text-sm text-teal-400 hover:text-teal-300 font-medium">
                      {uploadFile ? uploadFile.name : 'Choose PDF or Word document'}
                    </label>
                    {uploadFile && (
                      <button
                        type="button"
                        onClick={() => { setUploadFile(null); (document.getElementById('agreement-doc') as HTMLInputElement).value = ''; }}
                        className="text-xs text-gray-500 hover:text-red-400 mt-1"
                      >
                        Remove file
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Step 2: Payment type */}
            <section className="relative">
              <div className="flex items-center gap-3 mb-5">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-400/10 text-teal-400 text-sm font-semibold">
                  2
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-white">How you’ll pay</h2>
                  <p className="text-sm text-gray-500">Project with an end date or recurring until you stop</p>
                </div>
              </div>
              <div className="pl-11 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setError(''); setFormData((prev) => ({ ...prev, duration: 'FIXED' })); }}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      formData.duration === 'FIXED'
                        ? 'border-teal-400 bg-teal-400/5 text-white'
                        : 'border-gray-700/80 bg-gray-800/30 text-gray-300 hover:border-gray-600 hover:bg-gray-800/50'
                    }`}
                  >
                    <span className="block font-medium">Project</span>
                    <span className="block text-sm mt-0.5 opacity-80">Set number of payments and end date</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setError(''); setFormData((prev) => ({ ...prev, duration: 'ONGOING' })); }}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      formData.duration === 'ONGOING'
                        ? 'border-teal-400 bg-teal-400/5 text-white'
                        : 'border-gray-700/80 bg-gray-800/30 text-gray-300 hover:border-gray-600 hover:bg-gray-800/50'
                    }`}
                  >
                    <span className="block font-medium">Recurring</span>
                    <span className="block text-sm mt-0.5 opacity-80">No end date; you or they can stop anytime</span>
                  </button>
                </div>

                {!isOngoing && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Release method</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => { setError(''); setFormData((prev) => ({ ...prev, releaseType: 'TIME_BASED' })); }}
                          className={`text-left p-3 rounded-xl border-2 transition-all ${
                            formData.releaseType === 'TIME_BASED'
                              ? 'border-teal-400 bg-teal-400/5 text-white'
                              : 'border-gray-700/80 bg-gray-800/30 text-gray-300 hover:border-gray-600'
                          }`}
                        >
                          <span className="font-medium">On a schedule</span>
                          <span className="block text-xs mt-0.5 opacity-70">Auto every interval</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setError(''); setFormData((prev) => ({ ...prev, releaseType: 'MILESTONE_BASED' })); }}
                          className={`text-left p-3 rounded-xl border-2 transition-all ${
                            formData.releaseType === 'MILESTONE_BASED'
                              ? 'border-teal-400 bg-teal-400/5 text-white'
                              : 'border-gray-700/80 bg-gray-800/30 text-gray-300 hover:border-gray-600'
                          }`}
                        >
                          <span className="font-medium">Milestones</span>
                          <span className="block text-xs mt-0.5 opacity-70">You approve each one</span>
                        </button>
                      </div>
                    </div>

                    {!isMilestone && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Amount per payment (USD)</label>
                          <input
                            type="number"
                            name="paymentAmount"
                            value={formData.paymentAmount}
                            onChange={handleChange}
                            required
                            min="0"
                            step="0.01"
                            className={inputBase}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Number of payments</label>
                          <input
                            type="number"
                            name="numberOfPayments"
                            value={formData.numberOfPayments}
                            onChange={handleChange}
                            required
                            min="1"
                            className={inputBase}
                            placeholder="1"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Interval (days)</label>
                          <input
                            type="number"
                            name="paymentInterval"
                            value={formData.paymentInterval}
                            onChange={handleChange}
                            required
                            min="1"
                            className={inputBase}
                            placeholder="30"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Start date</label>
                          <input
                            type="date"
                            name="startDate"
                            value={formData.startDate}
                            onChange={handleChange}
                            required
                            min={new Date().toISOString().split('T')[0]}
                            className={inputBase}
                          />
                        </div>
                      </div>
                    )}

                    {isMilestone && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Start date</label>
                          <input
                            type="date"
                            name="startDate"
                            value={formData.startDate}
                            onChange={handleChange}
                            required
                            min={new Date().toISOString().split('T')[0]}
                            className={`${inputBase} max-w-xs`}
                          />
                        </div>
                        <div className="rounded-xl border border-gray-700/80 bg-gray-800/20 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-white">Milestones</span>
                            <button
                              type="button"
                              onClick={addMilestone}
                              className="text-sm text-teal-400 hover:text-teal-300 font-medium"
                            >
                              + Add milestone
                            </button>
                          </div>
                          {milestones.length === 0 ? (
                            <p className="text-sm text-gray-500">Add at least one. Amounts define the total.</p>
                          ) : (
                            <ul className="space-y-3">
                              {milestones.map((m) => (
                                <li key={m.id} className="flex gap-2 items-center">
                                  <input
                                    type="text"
                                    value={m.description}
                                    onChange={(e) => updateMilestone(m.id, 'description', e.target.value)}
                                    placeholder="Deliverable"
                                    className={`flex-1 ${inputBase} py-2 text-sm`}
                                  />
                                  <input
                                    type="number"
                                    value={m.amount}
                                    onChange={(e) => updateMilestone(m.id, 'amount', e.target.value)}
                                    placeholder="0"
                                    min="0"
                                    step="0.01"
                                    className={`w-28 ${inputBase} py-2 text-sm`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeMilestone(m.id)}
                                    className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-400/10 transition-colors"
                                    aria-label="Remove"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </>
                    )}

                    {!isMilestone && formData.startDate && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span>Ends</span>
                        <span className="text-white">
                          {new Date(
                            new Date(formData.startDate).getTime() +
                              (parseInt(formData.numberOfPayments, 10) || 0) *
                                (parseInt(formData.paymentInterval, 10) || 0) *
                                24 * 60 * 60 * 1000
                          ).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {isOngoing && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Amount per payment (USD)</label>
                      <input
                        type="number"
                        name="paymentAmount"
                        value={formData.paymentAmount}
                        onChange={handleChange}
                        required
                        min="0"
                        step="0.01"
                        className={inputBase}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-sm font-medium text-gray-300 mb-2">Interval (days)</label>
                      <input
                        type="number"
                        name="paymentInterval"
                        value={formData.paymentInterval}
                        onChange={handleChange}
                        required
                        min="1"
                        className={inputBase}
                        placeholder="30"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Start date</label>
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        required
                        min={new Date().toISOString().split('T')[0]}
                        className={inputBase}
                      />
                    </div>
                  </div>
                )}

                {(displayTotal !== null && displayTotal > 0) || (isOngoing && formData.paymentAmount) ? (
                  <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-gray-800/40 border border-gray-700/60">
                    <span className="text-gray-400">Total value</span>
                    <span className="text-xl font-semibold text-white">
                      {isOngoing ? 'Recurring' : `$${displayTotal != null && displayTotal > 0 ? displayTotal.toFixed(2) : '0.00'}`}
                    </span>
                  </div>
                ) : null}
              </div>
            </section>

            {/* Step 3: Payment method */}
            <section className="relative">
              <div className="flex items-center gap-3 mb-5">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-400/10 text-teal-400 text-sm font-semibold">
                  3
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-white">Payment method</h2>
                  <p className="text-sm text-gray-500">Network and token for escrow</p>
                </div>
              </div>
              <div className="pl-11 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Network</label>
                  <select
                    name="chainSlug"
                    value={formData.chainSlug}
                    onChange={handleChange}
                    required
                    className={`${inputBase} cursor-pointer appearance-none bg-no-repeat bg-[length:1.25rem] bg-[right_0.75rem_center] pr-10`}
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` }}
                  >
                    <option value="">Select network</option>
                    {enabledChains.map((c) => (
                      <option key={c.slug} value={c.slug}>{c.displayName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Token</label>
                  <select
                    name="assetSlug"
                    value={formData.assetSlug}
                    onChange={handleChange}
                    required
                    disabled={!formData.chainSlug}
                    className={`${inputBase} cursor-pointer appearance-none bg-no-repeat bg-[length:1.25rem] bg-[right_0.75rem_center] pr-10 disabled:opacity-50 disabled:cursor-not-allowed`}
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` }}
                  >
                    <option value="">Select token</option>
                    {selectedChainAssets.map((a) => (
                      <option key={a.id} value={a.slug ?? a.id}>
                        {a.symbol} — {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* Summary + actions */}
            <div className="sticky bottom-0 left-0 right-0 z-10 py-6 -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-sm text-gray-400 min-w-0">
                  {formData.jobTitle && (
                    <span className="text-white font-medium">{formData.jobTitle}</span>
                  )}
                  {formData.paymentAmount && (
                    <span>
                      {formData.jobTitle && ' · '}
                      ${parseFloat(formData.paymentAmount).toFixed(2)} per payment
                      {formData.paymentInterval && ` every ${formData.paymentInterval} days`}
                    </span>
                  )}
                  {formData.duration === 'ONGOING' && formData.paymentAmount && (
                    <span className="text-teal-400/90"> · Recurring</span>
                  )}
                  {displayTotal !== null && displayTotal > 0 && !isOngoing && (
                    <span> · Total ${displayTotal.toFixed(2)}</span>
                  )}
                  {networkLabel && <span className="block sm:inline mt-0.5 sm:mt-0 sm:ml-0"> · {networkLabel}</span>}
                </div>
                <div className="flex gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-5 py-3 text-gray-400 hover:text-white transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-3 rounded-xl bg-teal-400 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        Creating…
                      </>
                    ) : (
                      'Create agreement'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-400/10 border border-red-400/20 p-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </form>
        </div>
      </div>
    </PremiumDashboardLayout>
  );
}
