'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { paymentContractApi } from '@/lib/api/payment-contract';
import { blockchainApi, type EnabledChain, type Asset } from '@/lib/api/blockchain';
import {
  FormSection,
  FormLabel,
  FormInput,
  FormTextarea,
  FormSelect,
  FormError,
} from '@/components/form';
import { DatePicker } from '@/components/DatePicker';

type ReleaseType = 'TIME_BASED' | 'MILESTONE_BASED';

interface MilestoneRow {
  id: string;
  description: string;
  amount: string;
}

const inputBase =
  'w-full px-3 sm:px-4 py-2.5 bg-black/30 text-white border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-teal-500 placeholder-gray-500';
const inputError = 'border-red-500/50 focus:border-red-500';
const inputCompact = 'px-3 py-2 bg-black/30 text-white border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-teal-500';

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
      <div className="w-full max-w-4xl mx-auto py-3 px-3 sm:py-6 sm:px-6 md:py-8 md:px-8 min-w-0">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-lg font-bold text-white mb-1 sm:text-xl md:text-2xl">New payment agreement</h1>
          <p className="text-gray-400 text-xs sm:text-sm">Set the amount, schedule, and who gets paid. You will fund the contract after creating it.</p>
        </div>

        {error && <FormError message={error} />}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <FormSection title="Agreement details" subtitle="Title and who receives payments">
            <div className="space-y-3 sm:space-y-4">
              <div>
                <FormLabel htmlFor="jobTitle">Title</FormLabel>
                <FormInput id="jobTitle" name="jobTitle" value={formData.jobTitle} onChange={handleChange} placeholder="e.g. Q1 development, Design retainer" required />
              </div>
              <div>
                <FormLabel htmlFor="description" optional>Description</FormLabel>
                <FormTextarea id="description" name="description" value={formData.description} onChange={handleChange} rows={4} placeholder="Describe the work, deliverables, or any notes for this agreement" />
              </div>
              <div>
                <FormLabel htmlFor="contractorAddress">Recipient wallet address</FormLabel>
                <FormInput id="contractorAddress" name="contractorAddress" type="text" value={formData.contractorAddress} onChange={handleChange} onBlur={() => setTouchedAddress(true)} placeholder="0x..." required error={showAddressError} className="font-mono" />
                {showAddressError && <p className="mt-1.5 text-xs text-red-400">Enter a valid Ethereum address (0x + 40 hex characters)</p>}
              </div>
              <div>
                <FormLabel htmlFor="recipientEmail" optional>Recipient email</FormLabel>
                <FormInput id="recipientEmail" name="recipientEmail" type="email" value={formData.recipientEmail} onChange={handleChange} placeholder="For notifications or sending the contract link" />
              </div>
              <div>
                <FormLabel htmlFor="deliverables" optional>Deliverables / scope</FormLabel>
                <FormTextarea id="deliverables" name="deliverables" value={formData.deliverables} onChange={handleChange} rows={2} placeholder="What is in scope (for your reference)" />
              </div>
              <div>
                <FormLabel htmlFor="agreement-doc" optional>Attach agreement document</FormLabel>
                <div className="w-full min-h-14 px-3 sm:px-4 py-2.5 bg-black/30 border border-gray-800 rounded-xl flex flex-col justify-center">
                  <input type="file" id="agreement-doc" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; setUploadFile(f ?? null); }} />
                  <label htmlFor="agreement-doc" className="cursor-pointer text-sm text-teal-400 hover:text-teal-300 font-medium">{uploadFile ? uploadFile.name : 'Choose PDF or Word document'}</label>
                  {uploadFile && <button type="button" onClick={() => { setUploadFile(null); (document.getElementById('agreement-doc') as HTMLInputElement).value = ''; }} className="text-xs text-gray-500 hover:text-red-400 mt-1 text-left">Remove file</button>}
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection title="How you'll pay" subtitle="Project with an end date or recurring until you stop">
            <div className="space-y-4 sm:space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => { setError(''); setFormData((prev) => ({ ...prev, duration: 'FIXED' })); }}
                    className={`text-left p-3 sm:p-4 rounded-xl border-2 transition-all ${
                      formData.duration === 'FIXED'
                        ? 'border-teal-400 bg-teal-400/5 text-white'
                        : 'border-gray-700/80 bg-gray-800/30 text-gray-300 hover:border-gray-600 hover:bg-gray-800/50'
                    }`}
                  >
                    <span className="block font-medium text-sm sm:text-base">Project</span>
                    <span className="block text-xs sm:text-sm mt-0.5 opacity-80">Set number of payments and end date</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setError(''); setFormData((prev) => ({ ...prev, duration: 'ONGOING' })); }}
                    className={`text-left p-3 sm:p-4 rounded-xl border-2 transition-all ${
                      formData.duration === 'ONGOING'
                        ? 'border-teal-400 bg-teal-400/5 text-white'
                        : 'border-gray-700/80 bg-gray-800/30 text-gray-300 hover:border-gray-600 hover:bg-gray-800/50'
                    }`}
                  >
                    <span className="block font-medium text-sm sm:text-base">Recurring</span>
                    <span className="block text-xs sm:text-sm mt-0.5 opacity-80">No end date; you or they can stop anytime</span>
                  </button>
                </div>

                {!isOngoing && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Release method</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                        <button
                          type="button"
                          onClick={() => { setError(''); setFormData((prev) => ({ ...prev, releaseType: 'TIME_BASED' })); }}
                          className={`text-left p-2.5 sm:p-3 rounded-xl border-2 transition-all ${
                            formData.releaseType === 'TIME_BASED'
                              ? 'border-teal-400 bg-teal-400/5 text-white'
                              : 'border-gray-700/80 bg-gray-800/30 text-gray-300 hover:border-gray-600'
                          }`}
                        >
                          <span className="font-medium text-sm">On a schedule</span>
                          <span className="block text-xs mt-0.5 opacity-70">Auto every interval</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setError(''); setFormData((prev) => ({ ...prev, releaseType: 'MILESTONE_BASED' })); }}
                          className={`text-left p-2.5 sm:p-3 rounded-xl border-2 transition-all ${
                            formData.releaseType === 'MILESTONE_BASED'
                              ? 'border-teal-400 bg-teal-400/5 text-white'
                              : 'border-gray-700/80 bg-gray-800/30 text-gray-300 hover:border-gray-600'
                          }`}
                        >
                          <span className="font-medium text-sm">Milestones</span>
                          <span className="block text-xs mt-0.5 opacity-70">You approve each one</span>
                        </button>
                      </div>
                    </div>

                    {!isMilestone && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Amount per payment (USD)</label>
                          <input
                            type="number"
                            name="paymentAmount"
                            value={formData.paymentAmount}
                            onChange={handleChange}
                            required
                            min="0"
                            step="1"
                            className={inputBase}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Number of payments</label>
                          <input
                            type="number"
                            name="numberOfPayments"
                            value={formData.numberOfPayments}
                            onChange={handleChange}
                            required
                            min="1"
                            className={inputBase}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Interval (days)</label>
                          <input
                            type="number"
                            name="paymentInterval"
                            value={formData.paymentInterval}
                            onChange={handleChange}
                            required
                            min="1"
                            className={inputBase}
                          />
                        </div>
                        <div>
                          <FormLabel htmlFor="startDate-schedule">Start date</FormLabel>
                          <DatePicker
                            id="startDate-schedule"
                            value={formData.startDate}
                            onChange={(v) => setFormData((prev) => ({ ...prev, startDate: v }))}
                            minDate={new Date()}
                            placeholder="Select start date"
                          />
                        </div>
                      </div>
                    )}

                    {isMilestone && (
                      <>
                        <div>
                          <FormLabel htmlFor="startDate-milestone">Start date</FormLabel>
                          <DatePicker
                            id="startDate-milestone"
                            value={formData.startDate}
                            onChange={(v) => setFormData((prev) => ({ ...prev, startDate: v }))}
                            minDate={new Date()}
                            placeholder="Select start date"
                            className="max-w-xs"
                            compact
                          />
                        </div>
                        <div className="rounded-xl border border-gray-700/80 bg-gray-800/20 p-3 sm:p-4">
                          <div className="flex items-center justify-between mb-2 sm:mb-3">
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
                            <p className="text-xs sm:text-sm text-gray-500">Add at least one. Amounts in USD (whole numbers).</p>
                          ) : (
                            <ul className="space-y-2 sm:space-y-3">
                              {milestones.map((m) => (
                                <li key={m.id} className="flex flex-col gap-2 sm:flex-row sm:gap-3 sm:items-center">
                                  <div className="flex-1 min-w-0 w-full">
                                    <FormInput
                                      type="text"
                                      value={m.description}
                                      onChange={(e) => updateMilestone(m.id, 'description', e.target.value)}
                                      placeholder="Deliverable description"
                                      className="w-full"
                                    />
                                  </div>
                                  <div className="flex gap-2 items-center sm:contents">
                                    <div className="w-24 sm:w-24 shrink-0">
                                      <FormInput
                                        type="number"
                                        value={m.amount}
                                        onChange={(e) => updateMilestone(m.id, 'amount', e.target.value)}
                                        min={0}
                                        step={1}
                                        className="w-full text-right"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => removeMilestone(m.id)}
                                      className="p-2 shrink-0 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-400/10 transition-colors self-center sm:self-auto"
                                      aria-label="Remove"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </>
                    )}

                    {!isMilestone && formData.startDate && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Amount per payment (USD)</label>
                      <input
                        type="number"
                        name="paymentAmount"
                        value={formData.paymentAmount}
                        onChange={handleChange}
                        required
                        min="0"
                        step="1"
                        className={inputBase}
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Interval (days)</label>
                      <input
                        type="number"
                        name="paymentInterval"
                        value={formData.paymentInterval}
                        onChange={handleChange}
                        required
                        min="1"
                        className={inputBase}
                      />
                    </div>
                    <div>
                      <FormLabel htmlFor="startDate-ongoing">Start date</FormLabel>
                      <DatePicker
                        id="startDate-ongoing"
                        value={formData.startDate}
                        onChange={(v) => setFormData((prev) => ({ ...prev, startDate: v }))}
                        minDate={new Date()}
                        placeholder="Select start date"
                      />
                    </div>
                  </div>
                )}

                {(displayTotal !== null && displayTotal > 0) || (isOngoing && formData.paymentAmount) ? (
                  <div className="flex items-center justify-between py-2.5 px-3 sm:py-3 sm:px-4 rounded-xl bg-gray-800/40 border border-gray-700/60">
                    <span className="text-gray-400 text-sm">Total value</span>
                    <span className="text-base sm:text-xl font-semibold text-white">
                      {isOngoing ? 'Recurring' : `$${displayTotal != null && displayTotal > 0 ? displayTotal.toFixed(2) : '0.00'}`}
                    </span>
                  </div>
                ) : null}
            </div>
          </FormSection>

          <FormSection title="Payment method" subtitle="Network and token for escrow">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <FormLabel htmlFor="chainSlug">Network</FormLabel>
                <FormSelect id="chainSlug" name="chainSlug" value={formData.chainSlug} onChange={handleChange} required>
                  <option value="">Select network</option>
                  {enabledChains.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.displayName}</option>
                  ))}
                </FormSelect>
              </div>
              <div>
                <FormLabel htmlFor="assetSlug">Token</FormLabel>
                <FormSelect id="assetSlug" name="assetSlug" value={formData.assetSlug} onChange={handleChange} required disabled={!formData.chainSlug}>
                  <option value="">Select token</option>
                  {selectedChainAssets.map((a) => (
                    <option key={a.id} value={a.slug ?? a.id}>{a.symbol} — {a.name}</option>
                  ))}
                </FormSelect>
              </div>
            </div>
          </FormSection>

            {/* Summary + actions: mobile = in flow at end of form; desktop = sticky at viewport bottom */}
            <div className="sm:sticky sm:bottom-0 left-0 right-0 z-10 py-4 px-3 sm:py-6 sm:px-0 -mx-3 sm:mx-0 bg-gray-950/95 sm:bg-gray-950/95 backdrop-blur-sm sm:backdrop-blur-sm border-t border-gray-800/50 sm:border-t-0 sm:pt-2">
              <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="text-xs sm:text-sm text-gray-400 min-w-0 order-2 sm:order-1">
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
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 shrink-0 order-1 sm:order-2">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="w-full sm:w-auto px-4 py-2.5 sm:px-6 sm:py-3 bg-gray-800 hover:bg-gray-700 text-white text-sm sm:text-base font-medium rounded-xl border border-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-4 py-2.5 sm:px-6 sm:py-3 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm sm:text-base font-semibold rounded-xl flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating…
                      </>
                    ) : (
                      'Create agreement'
                    )}
                  </button>
                </div>
              </div>
            </div>

          </form>
      </div>
    </PremiumDashboardLayout>
  );
}
