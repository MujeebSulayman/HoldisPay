'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { paymentContractApi, type PaymentContract } from '@/lib/api/payment-contract';
import { blockchainApi, type EnabledChain, type Asset } from '@/lib/api/blockchain';
import { DatePicker } from '@/components/DatePicker';
import { FormSelectWithLogo } from '@/components/form';

const STEPS = [
  { id: 1, title: 'Who & what', short: 'Details' },
  { id: 2, title: 'Payment & network', short: 'Pay' },
  { id: 3, title: 'Review', short: 'Review' },
  { id: 4, title: 'Documents', short: 'Docs' },
];

const inputClass =
  'w-full px-4 py-3.5 rounded-lg border-2 border-zinc-700/80 bg-zinc-900/60 text-white placeholder-zinc-500 text-base focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition';
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
      const payload: Record<string, unknown> = {
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
      };
      if (isTime && numPayments >= 1) {
        const endMs = new Date(formData.startDate).getTime() + numPayments * 30 * 24 * 60 * 60 * 1000;
        payload.endDate = Math.floor(endMs / 1000);
      }
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
      <div className="min-h-screen w-full max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-8 sm:mb-10">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full text-sm font-semibold transition ${
                step === s.id
                  ? 'bg-emerald-500 text-white ring-2 ring-emerald-400/50'
                  : step > s.id
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              {s.id}
            </button>
          ))}
        </div>
        <p className="text-center text-zinc-500 text-sm mb-2">
          {STEPS[step - 1].title}
        </p>
        {summaryLine && (
          <p className="text-center text-zinc-400 text-sm mb-6 sm:mb-8 max-w-xl mx-auto font-medium">
            {summaryLine}
          </p>
        )}
        {!summaryLine && <div className="mb-6 sm:mb-8" />}

        {/* Card container */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8 shadow-xl min-h-[320px]">
          {error && (
            <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3">
              {error}
            </div>
          )}

          {/* Step 1: Who & what */}
          {step === 1 && (
            <>
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-1">
                Who & what
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                Who you're paying and what the contract is for.
              </p>
              <div className="space-y-5">
                <div>
                  <label className={labelClass}>Recipient (holDIs tag) *</label>
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
                    <p className="mt-2 text-sm text-emerald-400">
                      User found{tagDisplayName ? `: ${tagDisplayName}` : ''}
                    </p>
                  )}
                  {looksLikeTag && tagLookup === 'not_found' && recipientInput.length > 0 && (
                    <p className="mt-2 text-sm text-red-400">No user with this tag. They need to sign up first and share their tag.</p>
                  )}
                </div>
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
                  <label className={labelClass}>Description (optional)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="What work is included?"
                    rows={3}
                    className={inputClass + ' resize-none'}
                  />
                </div>
                <div>
                  <label className={labelClass}>Deliverables / scope (optional)</label>
                  <textarea
                    value={formData.deliverables}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, deliverables: e.target.value }))
                    }
                    placeholder="What they need to deliver"
                    rows={2}
                    className={inputClass + ' resize-none'}
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 2: Payment & network */}
          {step === 2 && (
            <>
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-1">
                Payment & network
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                Contract type, amount, start date, and where to hold the funds.
              </p>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Contract type</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, releaseType: 'PROJECT_BASED', numberOfMonths: '1' }))}
                      className={`flex-1 py-3.5 px-4 rounded-lg border-2 text-left transition ${
                        formData.releaseType === 'PROJECT_BASED'
                          ? 'border-emerald-500 bg-emerald-500/10 text-white'
                          : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      <span className="font-medium block">Project-based</span>
                      <span className="text-sm opacity-80">Single scope, approve work then release</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, releaseType: 'TIME_BASED' }))}
                      className={`flex-1 py-3.5 px-4 rounded-lg border-2 text-left transition ${
                        formData.releaseType === 'TIME_BASED'
                          ? 'border-emerald-500 bg-emerald-500/10 text-white'
                          : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      <span className="font-medium block">Time-based</span>
                      <span className="text-sm opacity-80">Recurring, e.g. monthly for X months</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>{isTimeBased ? 'Amount per month (USD) *' : 'Amount (USD) *'}</label>
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
                {displayTotal !== null && displayTotal > 0 ? (
                  <div className="rounded-lg bg-zinc-800/80 px-4 py-3 flex justify-between items-center">
                    <span className="text-zinc-400">{isTimeBased ? 'Total value' : 'Total project value'}</span>
                    <span className="text-lg font-semibold text-white">${displayTotal.toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
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
              </div>
            </>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <>
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-1">
                Review
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                Check the summary below. Next you can attach documents, then create.
              </p>
              <div className="rounded-lg bg-zinc-800/60 border border-zinc-700/60 p-5 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Type</span>
                  <span className="text-white font-medium">{formData.releaseType === 'TIME_BASED' ? 'Time-based' : 'Project-based'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Paying</span>
                  <span className="text-white font-medium">{recipientInput || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Title</span>
                  <span className="text-white">{formData.jobTitle || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">{isTimeBased ? 'Per month / Total' : 'Contract value'}</span>
                  <span className="text-white">
                    {isTimeBased && months >= 1
                      ? `$${amountNum.toFixed(2)} × ${months} mo = $${(amountNum * months).toFixed(2)}`
                      : `$${parseFloat(formData.paymentAmount || '0').toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Starts</span>
                  <span className="text-white">
                    {formData.startDate
                      ? new Date(formData.startDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-zinc-700/60">
                  <span className="text-zinc-500">Payment</span>
                  <span className="text-white font-semibold">
                    {isTimeBased ? 'Paid automatically on schedule (e.g. monthly)' : 'Approve submitted work → release payment'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Funds held on</span>
                  <span className="text-white">
                    {enabledChains.find((c) => c.slug === formData.chainSlug)?.displayName ?? formData.chainSlug}{' '}
                    · {selectedChainAssets.find((a) => (a.slug ?? a.id) === formData.assetSlug)?.symbol ?? formData.assetSlug}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Step 4: Documents */}
          {step === 4 && !editId && (
            <>
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-1">
                Documents
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                Optionally attach files (brief, scope, NDA). You can skip and create the contract.
              </p>
              <div>
                <label className={labelClass}>Attach documents (optional)</label>
                <p className="text-xs text-zinc-500 mb-2">PDF, DOC, DOCX, PNG, JPG, WEBP, TXT. Max 10MB per file, up to {MAX_ATTACHMENTS} files.</p>
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
                  className="w-full py-3 px-4 rounded-lg border-2 border-dashed border-zinc-600 text-zinc-400 hover:border-emerald-500/50 hover:text-zinc-300 transition text-sm font-medium"
                >
                  Choose files
                </button>
                {selectedFiles.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {selectedFiles.map((f, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-800/60 px-3 py-2 text-sm text-zinc-300">
                        <span className="truncate min-w-0">{f.name}</span>
                        <span className="text-zinc-500 shrink-0">{(f.size / 1024).toFixed(1)} KB</span>
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
              </div>
            </>
          )}

          {step === 4 && editId && (
            <>
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-1">
                Save changes
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                Click below to save your edits.
              </p>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-8 flex flex-col-reverse sm:flex-row gap-3 sm:justify-between sm:items-center">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep((s) => s - 1) : router.back())}
            className="py-3.5 px-6 rounded-lg border-2 border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800 transition"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              className="py-3.5 px-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="py-3.5 px-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
