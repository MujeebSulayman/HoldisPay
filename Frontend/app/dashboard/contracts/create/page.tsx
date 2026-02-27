'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { paymentContractApi, type CreateContractRequest, type PaymentContract } from '@/lib/api/payment-contract';
import { blockchainApi, type EnabledChain, type Asset } from '@/lib/api/blockchain';
import { DatePicker } from '@/components/DatePicker';
import { FormSelectWithLogo } from '@/components/form';

const STEPS = [
  { id: 1, title: 'Details', short: 'Details', description: 'Who you\'re paying and what the work is.' },
  { id: 2, title: 'Payment', short: 'Payment', description: 'Amount, schedule, and network.' },
  { id: 3, title: 'Review', short: 'Review', description: 'Confirm everything before creating.' },
  { id: 4, title: 'Attachments', short: 'Attachments', description: 'Add documents (optional).' },
];

const inputClass =
  'w-full px-4 py-3 rounded-lg border border-zinc-700 bg-zinc-900/60 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition';
const labelClass = 'block text-sm font-medium text-zinc-300 mb-2';

export default function CreateContractPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id') || undefined;
  const [step, setStep] = useState(1);
  const [enabledChains, setEnabledChains] = useState<EnabledChain[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedChainAssets, setSelectedChainAssets] = useState<Asset[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [formData, setFormData] = useState({
    contractorAddress: '',
    paymentAmount: '',
    numberOfMonths: '1',
    startDate: '',
    chainSlug: '',
    assetSlug: '',
    jobTitle: '',
    description: '',
    contractName: '',
    deliverables: '',
    releaseType: 'PROJECT_BASED' as 'PROJECT_BASED' | 'TIME_BASED',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [touchedRecipient, setTouchedRecipient] = useState(false);
  type TagLookup = 'idle' | 'checking' | 'found' | 'not_found';
  const [tagLookup, setTagLookup] = useState<TagLookup>('idle');
  const [tagDisplayName, setTagDisplayName] = useState<string | null>(null);
  const tagDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_ATTACHMENTS = 10;
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ACCEPT_FILE_TYPES = 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp,text/plain';

  const fetchData = useCallback(async () => {
    try {
      const [chainsFromEnv, assetsData] = await Promise.all([
        blockchainApi.getEnabledChains(),
        blockchainApi.getSupportedAssets(),
      ]);
      setEnabledChains(chainsFromEnv);
      const activeAssets = assetsData.filter((a) => a.isActive !== false);
      setAssets(activeAssets);
      const defaultChain = chainsFromEnv.find((c) => c.slug === 'base') || chainsFromEnv[0];
      const defaultChainAssets = defaultChain
        ? activeAssets.filter((a) => a.blockchain?.slug === defaultChain.slug)
        : [];
      const usdc = defaultChainAssets.find((a) => a.symbol === 'USDC') || defaultChainAssets[0];
      if (editId) {
        const contractRes = await paymentContractApi.getContract(editId);
        if (
          contractRes.success &&
          contractRes.data?.contract &&
          contractRes.data.contract.status === 'DRAFT'
        ) {
          const c: PaymentContract = contractRes.data.contract;
          const startDateStr =
            c.startDate != null ? new Date(c.startDate * 1000).toISOString().slice(0, 10) : '';
          const isTimeBased = c.releaseType === 'TIME_BASED';
          const numPay = parseInt(c.numberOfPayments, 10) || 1;
          setFormData({
            contractorAddress: c.contractor ?? '',
            paymentAmount: c.paymentAmount ?? c.totalAmount ?? '',
            numberOfMonths: isTimeBased ? String(numPay) : '1',
            startDate: startDateStr,
            chainSlug: c.chainSlug || defaultChain?.slug || '',
            assetSlug: c.assetSlug || (usdc ? usdc.slug ?? usdc.id : ''),
            jobTitle: c.jobTitle ?? '',
            description: c.description ?? '',
            contractName: c.contractName ?? '',
            deliverables: c.deliverables ?? '',
            releaseType: isTimeBased ? 'TIME_BASED' : 'PROJECT_BASED',
          });
          setSelectedChainAssets(
            (c.chainSlug ? activeAssets.filter((a) => a.blockchain?.slug === c.chainSlug) : defaultChainAssets).length > 0
              ? (c.chainSlug ? activeAssets.filter((a) => a.blockchain?.slug === c.chainSlug) : defaultChainAssets)
              : defaultChainAssets
          );
        } else setError('Contract not found or not editable');
      } else if (chainsFromEnv.length > 0) {
        setFormData((prev) => ({
          ...prev,
          chainSlug: defaultChain?.slug ?? '',
          assetSlug: usdc ? (usdc.slug ?? usdc.id) : '',
          startDate: new Date().toISOString().slice(0, 10),
        }));
        setSelectedChainAssets(defaultChainAssets);
      }
    } catch {
      setError(editId ? 'Failed to load contract' : 'Failed to load options');
    } finally {
      setLoadingData(false);
    }
  }, [editId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const recipientInput = formData.contractorAddress.trim();
  const looksLikeWallet = recipientInput.startsWith('0x');
  const looksLikeTag = recipientInput.length > 0 && !looksLikeWallet;
  const recipientError =
    touchedRecipient && recipientInput.length > 0 && looksLikeWallet
      ? 'Use their holDIs tag (e.g. jane-doe), not a wallet address.'
      : null;

  // Debounced tag lookup when user types a tag (no 0x)
  useEffect(() => {
    if (!looksLikeTag || editId) {
      setTagLookup('idle');
      setTagDisplayName(null);
      return;
    }
    const tag = recipientInput.toLowerCase().replace(/^@/, '');
    if (!tag) {
      setTagLookup('idle');
      setTagDisplayName(null);
      return;
    }
    if (tagDebounceRef.current) clearTimeout(tagDebounceRef.current);
    setTagLookup('checking');
    setTagDisplayName(null);
    tagDebounceRef.current = setTimeout(async () => {
      tagDebounceRef.current = null;
      try {
        const res = await paymentContractApi.validateContractorTag(tag) as { exists?: boolean; displayName?: string };
        const exists = res?.exists ?? false;
        setTagLookup(exists ? 'found' : 'not_found');
        setTagDisplayName(exists && res?.displayName ? res.displayName : null);
      } catch {
        setTagLookup('not_found');
        setTagDisplayName(null);
      }
    }, 400);
    return () => {
      if (tagDebounceRef.current) clearTimeout(tagDebounceRef.current);
    };
  }, [recipientInput, looksLikeTag, editId]);

  const isTimeBased = formData.releaseType === 'TIME_BASED';
  const months = parseInt(formData.numberOfMonths, 10) || 0;
  const amountNum = formData.paymentAmount ? parseFloat(formData.paymentAmount) : 0;
  const displayTotal = isTimeBased ? (months > 0 ? amountNum * months : null) : (formData.paymentAmount ? amountNum : null);

  const summaryParts: string[] = [];
  if (formData.jobTitle.trim()) summaryParts.push(formData.jobTitle.trim());
  if (formData.paymentAmount && amountNum > 0 && formData.assetSlug) {
    const symbol = selectedChainAssets.find((a) => (a.slug ?? a.id) === formData.assetSlug)?.symbol ?? formData.assetSlug;
    if (isTimeBased && months > 0) summaryParts.push(`${amountNum.toFixed(2)} ${symbol}/mo × ${months} mo`);
    else summaryParts.push(`${amountNum.toFixed(2)} ${symbol}`);
  }
  if (recipientInput) summaryParts.push(tagDisplayName || recipientInput.replace(/^@/, ''));
  if (formData.startDate) {
    summaryParts.push(new Date(formData.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
  }
  const summaryLine = summaryParts.length > 0 ? summaryParts.join(' · ') : null;

  const canProceed = () => {
    if (step === 1) {
      if (!recipientInput || recipientError) return false;
      if (looksLikeTag && tagLookup !== 'found') return false;
      return formData.jobTitle.trim().length > 0;
    }
    if (step === 2) {
      if (!formData.paymentAmount || amountNum <= 0 || !formData.startDate || !formData.chainSlug || !formData.assetSlug) return false;
      if (isTimeBased && months < 1) return false;
      return true;
    }
    return true;
  };

  const handleNext = () => {
    setError('');
    if (step === 1) setTouchedRecipient(true);
    if (!canProceed() && step < 4) return;
    if (step < 4) setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    setError('');
    setTouchedRecipient(true);
    if (!recipientInput) {
      setError("Enter who you're paying (their holDIs tag).");
      return;
    }
    if (recipientError) return;
    if (!formData.chainSlug || !formData.assetSlug || !formData.startDate) {
      setError('Complete all steps first.');
      return;
    }
    setIsSubmitting(true);
    try {
      const startTimestamp = Math.floor(new Date(formData.startDate).getTime() / 1000);
      const isTime = formData.releaseType === 'TIME_BASED';
      const numPayments = isTime ? (parseInt(formData.numberOfMonths, 10) || 1) : 1;
      const intervalDays = isTime ? 30 : 1;
      const payload: CreateContractRequest = {
        ...(!editId && recipientInput && { contractorTag: recipientInput.replace(/^@/, '').trim() }),
        paymentAmount: formData.paymentAmount,
        numberOfPayments: numPayments,
        paymentInterval: intervalDays,
        startDate: startTimestamp,
        releaseType: formData.releaseType,
        chainSlug: formData.chainSlug,
        assetSlug: formData.assetSlug,
        jobTitle: formData.jobTitle.trim() || undefined,
        description: formData.description.trim() || undefined,
        contractName: formData.contractName.trim() || undefined,
        deliverables: formData.deliverables.trim() || undefined,
        ...(isTime && numPayments >= 1 && {
          endDate: Math.floor(new Date(formData.startDate).getTime() / 1000 + numPayments * 30 * 24 * 60 * 60),
        }),
      };
      if (editId) {
        const res = await paymentContractApi.updateContract(editId, payload);
        if (res.success) router.push('/dashboard/contracts?updated=true');
        else throw new Error((res as { error?: string }).error || 'Update failed');
      } else {
        const res = await paymentContractApi.createContract(payload);
        if (!res.success) throw new Error((res as { error?: string }).error || 'Create failed');
        const newId = (res as { data?: { id?: string } }).data?.id;
        if (newId && selectedFiles.length > 0) {
          let uploadFailed = 0;
          for (const file of selectedFiles) {
            const up = await paymentContractApi.uploadAttachment(newId, file);
            if (!up.success) uploadFailed += 1;
          }
          const query = uploadFailed > 0 ? `?uploads_failed=${uploadFailed}` : '';
          router.push(`/dashboard/contracts/${newId}${query}`);
        } else if (newId) {
          router.push(`/dashboard/contracts/${newId}`);
        } else {
          router.push('/dashboard/contracts?created=true');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
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
      <div className="w-full min-w-0 max-w-[1680px] mx-auto min-h-screen px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Full-width header */}
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <a
              href="/dashboard/contracts"
              className="flex items-center justify-center w-10 h-10 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 hover:bg-zinc-800/60 transition shrink-0"
              aria-label="Back to contracts"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
                {editId ? 'Edit contract' : 'New contract'}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                Step {step} of 4 · {STEPS[step - 1].title}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6 sm:gap-8 xl:gap-10">
          {/* Main form column — uses full width on desktop */}
          <div className="min-w-0">
            {error && (
              <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3">
                {error}
              </div>
            )}

            {/* Tabs — full width, scroll on small screens */}
            <div className="border-b border-zinc-800 mb-4 sm:mb-6 -mx-4 sm:mx-0 px-4 sm:px-0">
              <nav className="flex gap-0 overflow-x-auto scrollbar-none -mb-px min-w-0" aria-label="Contract steps">
                {STEPS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStep(s.id)}
                    className={`shrink-0 px-3 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-medium transition border-b-2 whitespace-nowrap ${
                      step === s.id
                        ? 'border-teal-500 text-teal-400'
                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
              </nav>
            </div>

            {/* Form content — single column on desktop for clarity */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6 lg:p-8 min-h-[320px] sm:min-h-[360px]">
              {/* Step intro (desktop: show for all steps) */}
              <p className="text-zinc-500 text-sm mb-6 hidden sm:block">
                {STEPS[step - 1].description}
              </p>

              {/* Step 1: Details — single column with sections */}
              {step === 1 && (
                <div className="max-w-2xl space-y-8">
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Recipient</h3>
                    <div>
                      <label className={labelClass}>holDIs tag *</label>
                      <input
                        type="text"
                        value={formData.contractorAddress}
                        onChange={(e) => {
                          setError('');
                          setFormData((prev) => ({ ...prev, contractorAddress: e.target.value }));
                        }}
                        onBlur={() => setTouchedRecipient(true)}
                        placeholder="e.g. jane-doe"
                        className={inputClass}
                        autoFocus
                        readOnly={!!editId}
                        aria-readonly={!!editId}
                      />
                      {editId && (
                        <p className="mt-2 text-xs text-zinc-500">Recipient can&apos;t be changed when editing.</p>
                      )}
                      {recipientError && (
                        <p className="mt-2 text-sm text-red-400">{recipientError}</p>
                      )}
                      {looksLikeTag && tagLookup === 'checking' && (
                        <p className="mt-2 text-sm text-zinc-500">Checking user…</p>
                      )}
                      {looksLikeTag && tagLookup === 'found' && (
                        <p className="mt-2 text-sm text-teal-400">
                          User found{tagDisplayName ? `: ${tagDisplayName}` : ''}
                        </p>
                      )}
                      {looksLikeTag && tagLookup === 'not_found' && recipientInput.length > 0 && (
                        <p className="mt-2 text-sm text-red-400">No user with this tag. They need to sign up first and share their tag.</p>
                      )}
                    </div>
                  </section>
                  <section className="space-y-4 pt-2 border-t border-zinc-800">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Work details</h3>
                    <div>
                      <label className={labelClass}>Title *</label>
                      <textarea
                        value={formData.jobTitle}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, jobTitle: e.target.value }))
                        }
                        placeholder="e.g. Website redesign, Monthly retainer"
                        rows={2}
                        className={inputClass + ' resize-none'}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Description <span className="text-zinc-500 font-normal">(optional)</span></label>
                      <textarea
                        value={formData.description}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, description: e.target.value }))
                        }
                        placeholder="What work is included?"
                        rows={3}
                        className={inputClass + ' resize-y min-h-[88px]'}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Deliverables / scope <span className="text-zinc-500 font-normal">(optional)</span></label>
                      <textarea
                        value={formData.deliverables}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, deliverables: e.target.value }))
                        }
                        placeholder="What they need to deliver"
                        rows={2}
                        className={inputClass + ' resize-y min-h-[72px]'}
                      />
                    </div>
                  </section>
                </div>
              )}

          {/* Step 2: Payment */}
          {step === 2 && (
            <div className="max-w-2xl space-y-8">
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Contract type</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, releaseType: 'PROJECT_BASED', numberOfMonths: '1' }))}
                    className={`py-3.5 px-4 rounded-lg border-2 text-left transition ${
                      formData.releaseType === 'PROJECT_BASED'
                        ? 'border-teal-500 bg-teal-500/10 text-white'
                        : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <span className="font-medium block text-sm">Project-based</span>
                    <span className="text-xs opacity-80 mt-0.5">Single scope, approve then release</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, releaseType: 'TIME_BASED' }))}
                    className={`py-3.5 px-4 rounded-lg border-2 text-left transition ${
                      formData.releaseType === 'TIME_BASED'
                        ? 'border-teal-500 bg-teal-500/10 text-white'
                        : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <span className="font-medium block text-sm">Time-based</span>
                    <span className="text-xs opacity-80 mt-0.5">Recurring, e.g. monthly</span>
                  </button>
                </div>
              </section>
              <section className="space-y-4 pt-2 border-t border-zinc-800">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Amount</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>{isTimeBased ? 'Per month (USD) *' : 'Amount (USD) *'}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.paymentAmount}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, paymentAmount: e.target.value }))
                      }
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </div>
                  {isTimeBased && (
                    <div>
                      <label className={labelClass}>Number of months *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.numberOfMonths}
                        onChange={(e) => setFormData((prev) => ({ ...prev, numberOfMonths: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
                        placeholder="e.g. 3"
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
                {displayTotal !== null && displayTotal > 0 && (
                  <div className="rounded-lg bg-teal-500/10 border border-teal-500/30 px-4 py-3 flex justify-between items-center">
                    <span className="text-zinc-400 text-sm">Total value</span>
                    <span className="font-semibold text-teal-400">${displayTotal.toFixed(2)}</span>
                  </div>
                )}
              </section>
              <section className="space-y-3 pt-2 border-t border-zinc-800">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Schedule</h3>
                <div>
                  <label className={labelClass}>Start date *</label>
                  <DatePicker
                    value={formData.startDate}
                    onChange={(v) => setFormData((prev) => ({ ...prev, startDate: v }))}
                    minDate={new Date()}
                    placeholder="When the contract starts"
                    className={inputClass}
                  />
                </div>
              </section>
              <section className="space-y-4 pt-2 border-t border-zinc-800">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Network & token</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Network *</label>
                    <FormSelectWithLogo
                      value={formData.chainSlug}
                      onChange={(slug) => {
                          setError('');
                          const chainAssets = assets.filter((a) => a.blockchain?.slug === slug);
                          setSelectedChainAssets(chainAssets);
                          const usdc = chainAssets.find((a) => a.symbol === 'USDC') || chainAssets[0];
                          setFormData((prev) => ({
                            ...prev,
                            chainSlug: slug,
                            assetSlug: usdc ? (usdc.slug ?? usdc.id) : '',
                          }));
                        }}
                      options={enabledChains.map((c) => ({
                        value: c.slug,
                        label: c.displayName,
                        logoUrl: c.logoUrl,
                      }))}
                      placeholder="Select network"
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Token *</label>
                    <FormSelectWithLogo
                      value={formData.assetSlug}
                      onChange={(value) => setFormData((prev) => ({ ...prev, assetSlug: value }))}
                      options={selectedChainAssets.map((a) => ({
                        value: a.slug ?? a.id,
                        label: `${a.symbol} — ${a.name}`,
                        logoUrl: a.logoUrl,
                      }))}
                      placeholder="Select token"
                      required
                      disabled={!formData.chainSlug}
                      className={inputClass}
                    />
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Step 3: Review — grouped sections, single column */}
          {step === 3 && (
            <div className="max-w-2xl space-y-6">
              <section className="rounded-lg border border-zinc-700/80 bg-zinc-800/30 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">Parties & type</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Type</dt>
                    <dd className="text-white font-medium">{formData.releaseType === 'TIME_BASED' ? 'Time-based' : 'Project-based'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Paying</dt>
                    <dd className="text-white font-medium">{tagDisplayName || recipientInput || '—'}</dd>
                  </div>
                </dl>
              </section>
              <section className="rounded-lg border border-zinc-700/80 bg-zinc-800/30 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">Work</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Title</dt>
                    <dd className="text-white text-right max-w-[70%]">{formData.jobTitle || '—'}</dd>
                  </div>
                </dl>
              </section>
              <section className="rounded-lg border border-zinc-700/80 bg-zinc-800/30 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">Payment</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">{isTimeBased ? 'Per month / total' : 'Amount'}</dt>
                    <dd className="text-white font-medium">
                      {isTimeBased && months >= 1
                        ? `$${amountNum.toFixed(2)} × ${months} mo = $${(amountNum * months).toFixed(2)}`
                        : `$${parseFloat(formData.paymentAmount || '0').toFixed(2)}`}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Starts</dt>
                    <dd className="text-white">
                      {formData.startDate
                        ? new Date(formData.startDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </dd>
                  </div>
                  <div className="pt-3 border-t border-zinc-700/60">
                    <p className="text-zinc-400 text-sm">
                      {isTimeBased ? 'Paid automatically on schedule (e.g. monthly).' : 'You approve submitted work, then release payment.'}
                    </p>
                  </div>
                </dl>
              </section>
              <section className="rounded-lg border border-zinc-700/80 bg-zinc-800/30 p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">Network</h3>
                <p className="text-white text-sm">
                  Funds held on <span className="font-medium">{enabledChains.find((c) => c.slug === formData.chainSlug)?.displayName ?? formData.chainSlug}</span>
                  {' · '}
                  <span className="font-medium">{selectedChainAssets.find((a) => (a.slug ?? a.id) === formData.assetSlug)?.symbol ?? formData.assetSlug}</span>
                </p>
              </section>
            </div>
          )}

          {/* Step 4: Attachments — single column, clear section */}
          {step === 4 && !editId && (
            <div className="max-w-2xl space-y-4">
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Documents</h3>
                <p className="text-sm text-zinc-500 mb-4">Add contracts, SOWs, or reference files. PDF, DOC, DOCX, PNG, JPG, WEBP, TXT. Max 10MB per file, up to {MAX_ATTACHMENTS} files.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT_FILE_TYPES}
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const valid: File[] = [];
                    for (const f of files) {
                      if (f.size > MAX_FILE_SIZE) continue;
                      if (valid.length + selectedFiles.length >= MAX_ATTACHMENTS) break;
                      valid.push(f);
                    }
                    setSelectedFiles((prev) => [...prev, ...valid].slice(0, MAX_ATTACHMENTS));
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 px-4 rounded-lg border-2 border-dashed border-zinc-600 text-zinc-400 hover:border-teal-500/50 hover:text-zinc-300 transition text-sm font-medium"
                >
                  Choose files
                </button>
                {selectedFiles.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {selectedFiles.map((f, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 px-3 py-2 text-sm text-zinc-300">
                        <span className="truncate min-w-0">{f.name}</span>
                        <span className="text-zinc-500 shrink-0 text-xs">{(f.size / 1024).toFixed(1)} KB</span>
                        <button
                          type="button"
                          onClick={() => setSelectedFiles((prev) => prev.filter((_, j) => j !== i))}
                          className="shrink-0 text-red-400 hover:text-red-300 text-xs font-medium"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {step === 4 && editId && (
            <div className="max-w-2xl">
              <p className="text-sm text-zinc-500">Click below to save your edits.</p>
            </div>
          )}
            </div>
          </div>

          {/* Right sidebar — contract summary panel */}
          <aside className="xl:order-2 w-full xl:max-w-[400px]">
            <div className="xl:sticky xl:top-6 rounded-lg border border-zinc-700/80 bg-zinc-900/80 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-800/40">
                <h2 className="text-sm font-semibold text-white">Contract summary</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Updates as you complete each step</p>
              </div>
              <div className="p-5">
                {!summaryLine && !recipientInput && !formData.chainSlug && (
                  <p className="text-sm text-zinc-500 py-2">Complete the form to see your contract summary here.</p>
                )}
                {(summaryLine || recipientInput || formData.chainSlug) ? (
                  <div className="space-y-5 text-sm">
                    {summaryLine && (
                      <p className="text-zinc-300 leading-relaxed border-b border-zinc-800 pb-4">
                        {summaryLine}
                      </p>
                    )}
                    <section className="space-y-3">
                      <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Overview</h3>
                      <dl className="space-y-2.5">
                        <div className="flex justify-between gap-3">
                          <dt className="text-zinc-500 shrink-0">Type</dt>
                          <dd className="text-white font-medium text-right">{formData.releaseType === 'TIME_BASED' ? 'Time-based' : 'Project-based'}</dd>
                        </div>
                        {recipientInput && (
                          <div className="flex justify-between gap-3">
                            <dt className="text-zinc-500 shrink-0">Recipient</dt>
                            <dd className="text-white text-right truncate" title={tagDisplayName || recipientInput.replace(/^@/, '')}>
                              {tagDisplayName || recipientInput.replace(/^@/, '')}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </section>
                    {(formData.paymentAmount && amountNum > 0) && (
                      <section className="space-y-3 pt-1 border-t border-zinc-800">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Payment</h3>
                        <dl className="space-y-2.5">
                          <div className="flex justify-between gap-3">
                            <dt className="text-zinc-500 shrink-0">{isTimeBased ? 'Per month' : 'Amount'}</dt>
                            <dd className="text-white font-medium text-right">${amountNum.toFixed(2)}</dd>
                          </div>
                          {isTimeBased && months >= 1 && (
                            <div className="flex justify-between gap-3">
                              <dt className="text-zinc-500 shrink-0">Total</dt>
                              <dd className="text-teal-400 font-semibold text-right">${(amountNum * months).toFixed(2)}</dd>
                            </div>
                          )}
                        </dl>
                      </section>
                    )}
                    {formData.chainSlug && (
                      <section className="space-y-3 pt-1 border-t border-zinc-800">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Network</h3>
                        <dl className="space-y-2.5">
                          <div className="flex justify-between gap-3">
                            <dt className="text-zinc-500 shrink-0">Chain</dt>
                            <dd className="text-white text-right">{enabledChains.find((c) => c.slug === formData.chainSlug)?.displayName ?? formData.chainSlug}</dd>
                          </div>
                          {formData.assetSlug && (
                            <div className="flex justify-between gap-3">
                              <dt className="text-zinc-500 shrink-0">Token</dt>
                              <dd className="text-white font-medium text-right">
                                {selectedChainAssets.find((a) => (a.slug ?? a.id) === formData.assetSlug)?.symbol ?? formData.assetSlug}
                              </dd>
                            </div>
                          )}
                        </dl>
                      </section>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </div>

        {/* Footer — full width */}
        <div className="mt-8 sm:mt-10 pt-4 sm:pt-6 border-t border-zinc-800 flex flex-col-reverse sm:flex-row gap-3 sm:justify-between sm:items-center">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep((s) => s - 1) : router.back())}
            className="w-full sm:w-auto py-3.5 px-6 rounded-lg border border-zinc-600 text-zinc-400 text-sm font-medium hover:bg-zinc-800/60 transition"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              className="w-full sm:w-auto py-3.5 px-8 rounded-lg bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-semibold transition"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full sm:w-auto py-3.5 px-8 rounded-lg bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-black text-sm font-semibold flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  {editId ? 'Saving…' : 'Creating…'}
                </>
              ) : editId ? 'Save changes' : 'Create contract'}
            </button>
          )}
        </div>
      </div>
    </PremiumDashboardLayout>
  );
}
