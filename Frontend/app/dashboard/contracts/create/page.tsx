'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { paymentContractApi, type CreateContractRequest, type PaymentContract } from '@/lib/api/payment-contract';
import { blockchainApi, type EnabledChain, type Asset } from '@/lib/api/blockchain';
import { DatePicker } from '@/components/DatePicker';
import { FormSelectWithLogo } from '@/components/form';
import RichTextEditor from '@/components/RichTextEditor';
import { Calendar, List, Clock, Repeat, AlertCircle } from 'lucide-react';
import { addDays, addWeeks, addMonths, format, isAfter, isBefore } from 'date-fns';
import RecurrenceSelect from '@/components/RecurrenceSelect';

const STEPS = [
  { id: 1, title: 'Details', short: 'Details', description: 'Who you\'re paying and what the work is.' },
  { id: 2, title: 'Payment', short: 'Payment', description: 'Amount, schedule, and network.' },
  { id: 3, title: 'Review', short: 'Review', description: 'Confirm everything before creating.' },
  { id: 4, title: 'Attachments', short: 'Attachments', description: 'Add documents (optional).' },
];

const inputClass =
  'w-full px-4 py-3 rounded-lg border border-gray-800 bg-black/30 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition';
const labelClass = 'block text-sm font-medium text-gray-400 mb-2';

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
    recurrenceInterval: 'NONE' as 'NONE' | 'BI_WEEKLY' | 'MONTHLY' | 'CUSTOM' | 'NEVER',
    recurrenceCustomDays: '14',
    issueDate: format(new Date(), 'yyyy-MM-dd'),
    recurrenceEndDate: '',
    distributionType: 'EQUAL' as 'EQUAL' | 'CUSTOM',
    milestones: [] as { amount: string; description: string; percentage?: number }[],
  });
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
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
            recurrenceInterval: 'NONE',
            recurrenceCustomDays: '14',
            issueDate: startDateStr || new Date().toISOString().slice(0, 10),
            recurrenceEndDate: '',
            distributionType: c.milestones && c.milestones.length > 0 ? 'CUSTOM' : 'EQUAL',
            milestones: c.milestones ?? [],
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
          issueDate: new Date().toISOString().slice(0, 10),
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const recipientInput = formData.contractorAddress.trim();
  const looksLikeWallet = recipientInput.startsWith('0x');
  const looksLikeTag = recipientInput.length > 0 && !looksLikeWallet;
  const isOwnTag = !!user?.tag && recipientInput.toLowerCase().replace(/^@/, '') === user.tag.toLowerCase();
  const recipientError =
    isOwnTag
      ? "You cannot create a contract with yourself."
      : touchedRecipient && recipientInput.length > 0 && looksLikeWallet
      ? 'Use their HoldisPay tag (e.g. jane-doe), not a wallet address.'
      : null;

  // Debounced tag lookup when user types a tag (no 0x)
  useEffect(() => {
    if (!looksLikeTag || editId || isOwnTag) {
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
  const amountNum = formData.paymentAmount ? parseFloat(formData.paymentAmount) : 0;

  const getFuturePayments = useCallback(() => {
    if (!formData.startDate || !amountNum) return [];

    // Logic: Milestone (Tranches)
    if (formData.recurrenceInterval === 'NONE') {
      const count = parseInt(formData.numberOfMonths, 10) || 1;

      if (formData.distributionType === 'CUSTOM' && formData.milestones.length > 0) {
        return formData.milestones.map((m) => ({
          date: new Date(formData.startDate),
          amount: parseFloat(m.amount) || 0,
          description: m.description
        }));
      }

      const trancheAmount = amountNum / count;
      return Array.from({ length: count }).map((_, i) => ({
        date: new Date(formData.startDate), // Dates are illustrative for milestones
        amount: trancheAmount
      }));
    }

    // Logic: "Never" Recurring - Paid once at the end of the term (Arrears)
    if (formData.recurrenceInterval === 'NEVER') {
      const termMonths = parseInt(formData.numberOfMonths, 10) || 1;
      return [{ date: addMonths(new Date(formData.startDate), termMonths), amount: amountNum }];
    }

    const instances: { date: Date; amount: number }[] = [];
    let nextRelease = new Date(formData.startDate);
    const count = parseInt(formData.numberOfMonths, 10) || 1;

    for (let i = 0; i < count; i++) {
      if (formData.recurrenceInterval === 'MONTHLY') {
        nextRelease = addMonths(nextRelease, 1);
      } else if (formData.recurrenceInterval === 'BI_WEEKLY') {
        nextRelease = addDays(nextRelease, 14);
      } else {
        break;
      }

      instances.push({
        date: new Date(nextRelease),
        amount: amountNum
      });
    }
    return instances;
  }, [formData.startDate, formData.recurrenceInterval, formData.numberOfMonths, amountNum]);

  const futurePayments = getFuturePayments();

  // New Effect: Synchronize End Date automatically
  useEffect(() => {
    if (isTimeBased && futurePayments.length > 0) {
      const lastPayment = futurePayments[futurePayments.length - 1].date;
      const formattedEnd = format(lastPayment, 'yyyy-MM-dd');
      if (formData.recurrenceEndDate !== formattedEnd) {
        setFormData(prev => ({ ...prev, recurrenceEndDate: formattedEnd }));
      }
    }
  }, [futurePayments, isTimeBased, formData.recurrenceEndDate]);
  const displayTotal = isTimeBased
    ? (futurePayments.length * amountNum)
    : amountNum;

  const summaryParts: string[] = [];
  if (formData.jobTitle.trim()) summaryParts.push(formData.jobTitle.trim());
  if (formData.paymentAmount && amountNum > 0 && formData.assetSlug) {
    const symbol = selectedChainAssets.find((a) => (a.slug ?? a.id) === formData.assetSlug)?.symbol ?? formData.assetSlug;
    if (isTimeBased) {
      const freqLabel = formData.recurrenceInterval === 'BI_WEEKLY' ? 'Every 2 weeks' :
        formData.recurrenceInterval === 'MONTHLY' ? 'Monthly' :
          formData.recurrenceInterval === 'CUSTOM' ? `Every ${formData.recurrenceCustomDays}d` : 'Recurring';
      summaryParts.push(`${amountNum.toFixed(2)} ${symbol} · ${freqLabel}`);
    } else {
      summaryParts.push(`${amountNum.toFixed(2)} ${symbol}`);
    }
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
      if (isTimeBased && !formData.recurrenceEndDate) return false;

      if (formData.releaseType === 'PROJECT_BASED' && formData.distributionType === 'CUSTOM') {
        const total = formData.milestones.reduce((acc, m) => acc + (parseFloat(m.amount) || 0), 0);
        if (Math.abs(total - amountNum) > 0.01) return false;
        if (formData.milestones.some(m => !m.amount || parseFloat(m.amount) <= 0)) return false;
      }
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
      setError("Enter who you're paying (their HoldisPay tag).");
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

      let intervalDays = 1;
      if (isTime) {
        if (formData.recurrenceInterval === 'BI_WEEKLY') intervalDays = 14;
        else if (formData.recurrenceInterval === 'MONTHLY') intervalDays = 30;
        else if (formData.recurrenceInterval === 'CUSTOM') intervalDays = parseInt(formData.recurrenceCustomDays, 10) || 14;
      }
      const numPayments = futurePayments.length || 1;
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
        recurrenceFrequency: formData.recurrenceInterval,
        milestoneCount: parseInt(formData.numberOfMonths, 10) || 1,
        milestones: formData.distributionType === 'CUSTOM' ? formData.milestones.map(m => ({
          amount: m.amount,
          description: m.description
        })) : undefined,
        ...(numPayments > 0 && {
          endDate: futurePayments[futurePayments.length - 1]?.date
            ? Math.floor(futurePayments[futurePayments.length - 1].date.getTime() / 1000)
            : startTimestamp,
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
      <div className="w-full max-w-4xl mx-auto py-4 sm:py-6 md:py-8 min-w-0 px-4 sm:px-0">
        {/* Minimal Stepper & Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
            {editId ? 'Edit' : 'Create'} contract
          </h1>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-gray-400 text-sm">
              Step {step} of 4 · {STEPS[step - 1].title}
            </p>

            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => s < step && setStep(s)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${step === s ? 'w-8 bg-teal-500' : (step > s ? 'w-4 bg-gray-600 cursor-pointer hover:bg-gray-500' : 'w-2 bg-gray-800')
                    }`}
                  aria-label={`Go to step ${s}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Main Form Area */}
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 min-w-0">
            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5 sm:p-8 backdrop-blur-sm relative overflow-hidden">

              <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-md blur-[120px] -mr-32 -mt-32" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/5 rounded-md blur-[120px] -ml-32 -mb-32" />

              <div className="relative">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center">
                    <span className="text-xs font-bold text-teal-400">{step}</span>
                  </div>
                  <div className="h-px w-6 bg-gray-800" />
                  <h2 className="text-lg font-semibold text-white">{STEPS[step - 1].title}</h2>
                </div>

                {/* Step 1: Details */}
                {step === 1 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="grid gap-8">
                      <div className="space-y-3">
                        <label className={labelClass}>Recipient Identity *</label>
                        <div className="relative group/input">
                          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-gray-500 transition-colors group-focus-within/input:text-teal-500">
                            <span className="text-xl font-light italic">@</span>
                          </div>
                          <input
                            type="text"
                            value={formData.contractorAddress.replace(/^@/, '')}
                            onChange={(e) => {
                              setError('');
                              setFormData((prev) => ({ ...prev, contractorAddress: e.target.value }));
                            }}
                            onBlur={() => setTouchedRecipient(true)}
                            className={`${inputClass} pl-12! h-14! font-medium`}
                            placeholder="HoldisPay tag..."
                            readOnly={!!editId}
                          />
                          <div className="absolute inset-y-0 right-5 flex items-center">
                            {looksLikeTag && tagLookup === 'checking' && (
                              <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                            )}
                            {looksLikeTag && tagLookup === 'found' && (
                              <div className="h-7 px-2.5 rounded-lg bg-teal-400/10 border border-teal-400/20 flex items-center gap-1.5 text-teal-400 text-[10px] font-black uppercase tracking-widest animate-in zoom-in-95 duration-300">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path d="M5 13l4 4L19 7" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span>VERIFIED</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {tagDisplayName && (
                          <p className="mt-3 text-xs font-semibold text-gray-400 flex items-center gap-2 bg-gray-800/40 p-2.5 rounded-lg border border-gray-700/30 w-fit">
                            <div className="w-5 h-5 rounded-full bg-teal-500/10 flex items-center justify-center text-[10px] text-teal-500">
                              {tagDisplayName.charAt(0).toUpperCase()}
                            </div>
                            Designated: <span className="text-white">{tagDisplayName}</span>
                          </p>
                        )}
                        {recipientError && <p className="mt-2 text-sm text-red-400">{recipientError}</p>}
                      </div>

                      <div className="space-y-3">
                        <label className={labelClass}>Contract Title *</label>
                        <input
                          type="text"
                          value={formData.jobTitle}
                          onChange={(e) => setFormData((prev) => ({ ...prev, jobTitle: e.target.value }))}
                          className={`${inputClass} h-14! font-medium`}
                          placeholder="e.g. Website Redesign"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className={labelClass}>Objective & Scope <span className="text-gray-500 font-normal">(optional)</span></label>
                        <div className="rounded-lg border border-gray-800 bg-black/20 overflow-hidden focus-within:border-teal-500/50 transition-all">
                          <RichTextEditor
                            value={formData.description}
                            onChange={(val) => setFormData((prev) => ({ ...prev, description: val }))}

                            placeholder="Define the primary mission and project goals..."
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className={labelClass}>Project Deliverables <span className="text-gray-500 font-normal">(optional)</span></label>
                        <div className="rounded-lg border border-gray-800 bg-black/20 overflow-hidden focus-within:border-teal-500/50 transition-all">
                          <RichTextEditor
                            value={formData.deliverables}
                            onChange={(val) => setFormData((prev) => ({ ...prev, deliverables: val }))}
                            placeholder="List key outcomes, milestones, and technical requirements..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Payment Details */}
                {step === 2 && (
                  <div className="w-full max-w-2xl mx-auto space-y-8 sm:space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500 px-4 sm:px-0">
                    {/* Amount Section - Project Brand Integrated */}
                    <div className="space-y-4">
                      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Contract Value</label>
                      <div className="relative flex items-center group">
                        <div className="absolute left-4 sm:left-6 text-xl sm:text-2xl font-light text-zinc-500 select-none">$</div>
                        <input
                          type="number"
                          value={formData.paymentAmount}
                          onChange={(e) => {
                            const newAmount = e.target.value;
                            const numAmt = parseFloat(newAmount) || 0;
                            
                            setFormData((prev) => {
                              const nextState = { ...prev, paymentAmount: newAmount };
                              
                              // Real-time update logic: if CUSTOM distribution, maintain the percentages and update $ amounts
                              if (prev.distributionType === 'CUSTOM' && prev.milestones.length > 0) {
                                nextState.milestones = prev.milestones.map((ms) => {
                                  const pct = ms.percentage || 0;
                                  return {
                                    ...ms,
                                    amount: numAmt > 0 ? ((pct / 100) * numAmt).toFixed(2) : '0'
                                  };
                                });
                              }
                              
                              return nextState;
                            });
                          }}
                          className="w-full font-heading bg-zinc-900 border border-zinc-800 p-4 sm:p-6 pl-10 sm:pl-12 text-3xl sm:text-5xl font-semibold text-white placeholder:text-sm placeholder:text-gray-500 transition-all focus:border-teal-500/50 focus:ring-4 focus:ring-teal-500/5 rounded-2xl outline-none"
                          placeholder="0.00"
                        />
                      </div>

                    </div>

                    {/* Payment Configuration Flow */}
                    <div className="space-y-8 sm:space-y-10">
                      {/* Protocol Selection */}
                      <div className="p-6 sm:p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Payout Protocol</label>
                          <div className="flex p-1 bg-zinc-950 rounded-xl border border-zinc-900 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, recurrenceInterval: 'NONE', releaseType: 'PROJECT_BASED' }))}
                              className={`flex-1 sm:px-8 py-2.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${formData.recurrenceInterval === 'NONE'
                                  ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/10'
                                  : 'text-zinc-600 hover:text-zinc-400'
                                }`}
                            >
                              Milestone
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, recurrenceInterval: 'MONTHLY', releaseType: 'TIME_BASED' }))}
                              className={`flex-1 sm:px-8 py-2.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${formData.recurrenceInterval !== 'NONE'
                                  ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/10'
                                  : 'text-zinc-600 hover:text-zinc-400'
                                }`}
                            >
                              Recurring
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 pt-6 sm:pt-8 border-t border-zinc-800/60">
                          <div className="space-y-3">
                            <label className="text-xs font-semibold text-zinc-400">
                              {formData.recurrenceInterval === 'NONE' ? 'Start Date' : 'Work Starts'}
                            </label>
                            <DatePicker
                              value={formData.startDate}
                              onChange={(v) => setFormData((prev) => ({ ...prev, startDate: v }))}
                              minDate={new Date()}
                              className="w-full! h-12 sm:h-14! bg-zinc-900! border-zinc-800! hover:border-zinc-700! focus:border-teal-500! rounded-xl!"
                              placeholder="Select date..."
                            />
                          </div>

                          <div className="space-y-3 animate-in fade-in">
                            <label className="text-xs font-semibold text-zinc-400">
                              {formData.recurrenceInterval === 'NONE' ? 'Milestone Count' : 'Total Duration'}
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                value={formData.numberOfMonths}
                                onChange={(e) => {
                                  const newCountStr = e.target.value;
                                  const newCount = parseInt(newCountStr, 10);
                                  
                                  setFormData((prev) => {
                                    const nextState = { ...prev, numberOfMonths: newCountStr };
                                    
                                    // Real-time update logic: sync the milestones array length with the count
                                    if (prev.distributionType === 'CUSTOM' && !isNaN(newCount) && newCount > 0) {
                                      const currentMilestones = [...prev.milestones];
                                      const currentCount = currentMilestones.length;
                                      
                                      if (newCount > currentCount) {
                                        const additions = Array.from({ length: newCount - currentCount }).map((_, i) => ({
                                          amount: '0',
                                          description: `Milestone ${currentCount + i + 1}`,
                                          percentage: 0
                                        }));
                                        nextState.milestones = [...currentMilestones, ...additions];
                                      } else if (newCount < currentCount) {
                                        nextState.milestones = currentMilestones.slice(0, newCount);
                                      }
                                    }
                                    
                                    return nextState;
                                  });
                                }}
                                className="w-full bg-zinc-900 border border-zinc-800 h-12 sm:h-14 px-4 pr-20 rounded-xl text-white font-semibold outline-none focus:border-teal-500/50"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] sm:text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                                {formData.recurrenceInterval === 'NONE' ? 'Parts' : 'Months'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Milestone Distribution Toggle */}
                        {formData.recurrenceInterval === 'NONE' && (
                          <div className="pt-8 border-t border-zinc-800/60 animate-in fade-in slide-in-from-top-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                              <div>
                                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Disbursement Logic</p>
                                <p className="text-[10px] text-zinc-500">Choose how the total contract value is split across milestones.</p>
                              </div>
                              <div className="flex p-1 bg-zinc-950 rounded-xl border border-zinc-900">
                                <button
                                  type="button"
                                  onClick={() => setFormData(p => ({ ...p, distributionType: 'EQUAL' }))}
                                  className={`px-5 py-2 rounded-lg text-[10px] font-bold transition-all ${formData.distributionType === 'EQUAL'
                                      ? 'bg-zinc-800 text-teal-400'
                                      : 'text-zinc-600 hover:text-zinc-400'
                                    }`}
                                >
                                  Equal Splits
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const count = parseInt(formData.numberOfMonths, 10) || 1;
                                    const baseAmount = amountNum / count;
                                    const initials = Array.from({ length: count }).map((_, i) => ({
                                      amount: baseAmount.toFixed(2),
                                      description: `Milestone ${i + 1}`,
                                      percentage: 100 / count
                                    }));
                                    setFormData(p => ({ ...p, distributionType: 'CUSTOM', milestones: initials }));
                                  }}
                                  className={`px-5 py-2 rounded-lg text-[10px] font-bold transition-all ${formData.distributionType === 'CUSTOM'
                                      ? 'bg-zinc-800 text-teal-400'
                                      : 'text-zinc-600 hover:text-zinc-400'
                                    }`}
                                >
                                  Flexible Breakdown
                                </button>
                              </div>
                            </div>

                            {formData.distributionType === 'CUSTOM' && (
                              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                                {formData.milestones.map((ms, idx) => (
                                  <div key={idx} className="group relative flex flex-col lg:flex-row gap-3 p-3.5 sm:p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/80 focus-within:border-teal-500/40 focus-within:bg-zinc-900/40 transition-all shadow-sm">
                                    <div className="flex-1 min-w-0">
                                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5 ml-1">Milestone {idx + 1}</label>
                                      <input
                                        type="text"
                                        value={ms.description}
                                        onChange={(e) => {
                                          const next = [...formData.milestones];
                                          next[idx].description = e.target.value;
                                          setFormData(p => ({ ...p, milestones: next }));
                                        }}
                                        placeholder="e.g. Design handoff"
                                        className="w-full bg-zinc-900/50 border border-zinc-800/80 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-teal-500/50 transition-colors"
                                      />
                                    </div>
                                    <div className="flex items-end gap-2 lg:gap-3 w-full lg:w-auto">
                                      <div className="flex-1 lg:w-32">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5 ml-1">Amount</label>
                                        <div className="relative">
                                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
                                          <input
                                            type="number"
                                            value={ms.amount}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              const num = parseFloat(val) || 0;
                                              const next = [...formData.milestones];
                                              next[idx].amount = val;
                                              next[idx].percentage = amountNum > 0 ? (num / amountNum) * 100 : 0;
                                              setFormData(p => ({ ...p, milestones: next }));
                                            }}
                                            className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-lg pl-7 pr-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-teal-500/50 transition-colors"
                                            placeholder="0.00"
                                          />
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-center pb-3 px-1 text-zinc-600 hidden sm:block">=</div>
                                      <div className="w-24 lg:w-28">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1.5 ml-1">Percent</label>
                                        <div className="relative">
                                          <input
                                            type="number"
                                            value={ms.percentage ? parseFloat(Number(ms.percentage).toFixed(2)) : ''}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              const pct = parseFloat(val) || 0;
                                              const next = [...formData.milestones];
                                              next[idx].percentage = pct;
                                              next[idx].amount = amountNum > 0 ? ((pct / 100) * amountNum).toFixed(2) : '0';
                                              setFormData(p => ({ ...p, milestones: next }));
                                            }}
                                            className="w-full bg-teal-500/5 border border-teal-500/20 rounded-lg pl-3 pr-7 py-2.5 text-sm font-semibold text-teal-400 outline-none focus:border-teal-500/50 transition-colors"
                                            placeholder="0"
                                          />
                                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-500/50 font-medium">%</span>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = formData.milestones.filter((_, i) => i !== idx);
                                          setFormData(p => ({ ...p, milestones: next, numberOfMonths: String(next.length) }));
                                        }}
                                        className="h-10 w-10 sm:h-[42px] sm:w-[42px] flex items-center justify-center rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition-all shrink-0"
                                        title="Remove milestone"
                                      >
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      </button>
                                    </div>
                                  </div>
                                ))}

                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 mt-2 bg-zinc-950/80 border border-zinc-800 rounded-xl">
                                  <div className="flex-1 flex flex-col w-full">
                                    {(() => {
                                      const total = formData.milestones.reduce((acc, m) => acc + (parseFloat(m.amount) || 0), 0);
                                      const totalPct = formData.milestones.reduce((acc, m) => acc + (m.percentage || 0), 0);
                                      const diff = amountNum - total;
                                      const isBalanced = Math.abs(diff) < 0.01 && amountNum > 0;
                                      
                                      return (
                                        <>
                                          <div className="flex items-center justify-between mb-2">
                                            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Allocation Status</span>
                                            <span className={`text-xs font-bold ${isBalanced ? 'text-teal-400' : 'text-amber-400'}`}>
                                              {totalPct.toFixed(1)}% / 100%
                                            </span>
                                          </div>
                                          <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden flex">
                                            <div className={`h-full transition-all duration-500 ${isBalanced ? 'bg-teal-500' : totalPct > 100 ? 'bg-red-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(totalPct, 100)}%` }} />
                                          </div>
                                          <div className="flex flex-col items-end gap-1.5 mt-2">
                                            <div className="w-full flex items-center justify-between">
                                              <span className={`text-xs font-medium ${isBalanced ? 'text-zinc-400' : 'text-amber-400/80'}`}>
                                                ${total.toFixed(2)} allocated out of ${amountNum.toFixed(2)}
                                              </span>
                                              <div className="flex items-center gap-4">
                                                {formData.milestones.length > 0 && amountNum > 0 && (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const next = [...formData.milestones];
                                                      const equalShare = Math.floor((amountNum / next.length) * 100) / 100;
                                                      const remainder = amountNum - (equalShare * next.length);
                                                      
                                                      for (let i = 0; i < next.length; i++) {
                                                        let share = equalShare;
                                                        if (i === next.length - 1) {
                                                          share += remainder;
                                                        }
                                                        next[i] = { 
                                                          ...next[i], 
                                                          amount: share.toFixed(2), 
                                                          percentage: (share / amountNum) * 100
                                                        };
                                                      }
                                                      setFormData(p => ({ ...p, milestones: next }));
                                                    }}
                                                    className="text-[10px] text-teal-400 hover:text-teal-300 underline underline-offset-2 transition-colors"
                                                  >
                                                    Distribute Evenly
                                                  </button>
                                                )}
                                                {!isBalanced && Math.abs(diff) > 0.001 && (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      if (formData.milestones.length === 0) return;
                                                      const next = [...formData.milestones];
                                                      const equalShare = Math.trunc((diff / next.length) * 100) / 100;
                                                      const remainder = diff - (equalShare * next.length);
                                                      
                                                      for (let i = 0; i < next.length; i++) {
                                                        const currentAmt = parseFloat(next[i].amount) || 0;
                                                        let amountToAdd = equalShare;
                                                        if (i === next.length - 1) {
                                                          amountToAdd += remainder; // Handle rounding errors symmetrically
                                                        }
                                                        const newAmt = Math.max(currentAmt + amountToAdd, 0); // clamp at 0 visually, though it might break exact math if drastically over-weighted, standard UX applies
                                                        next[i] = { 
                                                          ...next[i], 
                                                          amount: newAmt.toFixed(2), 
                                                          percentage: amountNum > 0 ? (newAmt / amountNum) * 100 : 0 
                                                        };
                                                      }
                                                      
                                                      setFormData(p => ({ ...p, milestones: next }));
                                                    }}
                                                    className={`text-[10px] underline underline-offset-2 transition-colors ${diff > 0 ? 'text-amber-400 hover:text-amber-300' : 'text-red-400 hover:text-red-300'}`}
                                                  >
                                                    Auto-fix (${Math.abs(diff).toFixed(2)} {diff > 0 ? 'remaining' : 'over-allocated'})
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>

                                  <div className="w-full sm:w-auto shrink-0 flex items-center justify-end border-t sm:border-t-0 border-zinc-800/60 pt-4 sm:pt-0 sm:pl-4">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const total = formData.milestones.reduce((acc, m) => acc + (parseFloat(m.amount) || 0), 0);
                                        const diff = Math.max(amountNum - total, 0);
                                        const next = [
                                          ...formData.milestones,
                                          { 
                                            amount: diff > 0 ? diff.toFixed(2) : '0', 
                                            description: `Milestone ${formData.milestones.length + 1}`, 
                                            percentage: amountNum > 0 ? (diff / amountNum) * 100 : 0 
                                          }
                                        ];
                                        setFormData(p => ({ ...p, milestones: next, numberOfMonths: String(next.length) }));
                                      }}
                                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition-colors border border-white/5 hover:border-white/10"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v16m8-8H4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                                      Add Milestone
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Schedule Section (Only for Recurring) */}
                      {formData.recurrenceInterval !== 'NONE' && (
                        <div className="p-6 sm:p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-6 sm:space-y-8 animate-in slide-in-from-top-4">
                          <div className="space-y-4">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block">Billing Frequency</label>
                            <RecurrenceSelect
                              value={formData.recurrenceInterval}
                              onChange={(val) => setFormData((prev) => ({ ...prev, recurrenceInterval: val, releaseType: 'TIME_BASED' }))}
                              referenceDate={formData.startDate}
                              excludeNone
                            />
                          </div>

                          <div className="pt-6 border-t border-zinc-800/60 flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="text-[9px] sm:text-[10px] text-zinc-500 font-bold uppercase tracking-widest">First Release</p>
                              <p className="text-xs sm:text-sm font-semibold text-zinc-300">
                                {futurePayments[0] ? format(futurePayments[0].date, 'MMM dd, yyyy') : '---'}
                              </p>
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-[9px] sm:text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Maturity Date</p>
                              <p className="text-xs sm:text-sm font-semibold text-teal-500">
                                {formData.recurrenceEndDate ? format(new Date(formData.recurrenceEndDate), 'MMM dd, yyyy') : '---'}
                              </p>
                            </div>
                          </div>
                          {formData.recurrenceInterval === 'NEVER' && (
                            <div className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/10">
                              <p className="text-[10px] sm:text-[11px] text-teal-400 font-medium leading-relaxed italic">
                                * Arrears Protocol: Funds released once at the term's full completion.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      {/* Project Snapshot Card */}
                      <div className="mt-16 bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-8 sm:p-12 overflow-hidden relative group animate-in fade-in zoom-in-95 duration-1000">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-[100px] -mr-32 -mt-32" />

                        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-12 relative">
                          <div className="space-y-6">
                            <div>
                              <p className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[0.3em] mb-3">Escrow Value</p>
                              <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-light text-zinc-600 transition-colors group-hover:text-teal-500/40">$</span>
                                <p className="font-heading text-6xl sm:text-8xl font-black text-white tracking-tighter leading-none">
                                  {displayTotal?.toLocaleString(undefined, { minimumFractionDigits: 0 })}<span className="text-3xl sm:text-4xl text-zinc-700">.{(displayTotal % 1).toFixed(2).split('.')[1]}</span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="h-6 px-2.5 rounded-md bg-teal-500/10 border border-teal-500/20 flex items-center gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-teal-500 animate-pulse" />
                             
                              </div>
                              <p className="text-xs text-zinc-500 font-medium">Auto-executing smart contract order.</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-x-12 gap-y-8 w-full md:w-auto pt-8 md:pt-0 border-t md:border-t-0 border-zinc-800/50">
                            <div className="space-y-1.5">
                              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Configuration</p>
                              <p className="text-lg font-bold text-white tracking-tight">
                                {formData.recurrenceInterval === 'NONE' ? 'Milestone' : 'Recurring'}
                              </p>
                              <p className="text-[10px] text-zinc-600 font-semibold">{futurePayments.length} Installment{futurePayments.length > 1 ? 's' : ''}</p>
                            </div>
                            <div className="space-y-1.5 text-right md:text-left">
                              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Timeline</p>
                              <p className="text-lg font-bold text-white tracking-tight">
                                {futurePayments[0] ? format(futurePayments[0].date, 'MMM dd, yyyy') : '---'}
                              </p>
                              <p className="text-[10px] text-zinc-600 font-semibold uppercase">Effective Start</p>
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Claim Logic</p>
                              <p className="text-lg font-bold text-white tracking-tight">
                                {formData.recurrenceInterval === 'NONE' ? 'Delivery' : 'Maturity'}
                              </p>
                              <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-tight">Auto-Release Enabled</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Review */}
                {step === 3 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="grid gap-3 sm:gap-4">                    {([
                      { label: 'Contractor', value: tagDisplayName || recipientInput, icon: <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />, color: 'teal' },
                      { label: 'Role / Title', value: formData.jobTitle, icon: <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />, color: 'zinc' },
                      {
                        label: formData.recurrenceInterval === 'NONE' ? 'Milestone Plan' : 'Frequency',
                        value: formData.recurrenceInterval === 'NONE'
                          ? `${formData.numberOfMonths} Part${parseInt(formData.numberOfMonths, 10) > 1 ? 's' : ''} • $${(amountNum / (parseInt(formData.numberOfMonths, 10) || 1)).toLocaleString()} ea`
                          : (formData.recurrenceInterval === 'BI_WEEKLY' ? 'Every 2 weeks' : formData.recurrenceInterval === 'MONTHLY' ? 'Monthly' : formData.recurrenceInterval === 'NEVER' ? 'Term Payout' : 'Recurring'),
                        icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" />,
                        color: 'zinc' as const
                      },
                    ]).map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-4 sm:p-5 rounded-xl bg-zinc-900/40 border border-zinc-800 transition-all hover:border-zinc-700">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className={`w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center ${item.color === 'teal' ? 'text-teal-400' : 'text-zinc-500'}`}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              {item.icon}
                            </svg>
                          </div>
                          <div>
                            <p className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{item.label}</p>
                            <p className="text-sm sm:text-base text-white font-medium">{item.value || '—'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    </div>

                    {/* Submission & Deliverables Review */}
                    {formData.deliverables && (
                      <div className="space-y-4">
                        <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-3">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-teal-500" />
                            Deliverables & Scope
                          </p>
                          <div
                            className="text-sm text-zinc-300 leading-relaxed prose prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: formData.deliverables }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Flexible Milestone Schedule Review */}
                    {formData.distributionType === 'CUSTOM' && formData.milestones.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Milestone Schedule</p>
                        <div className="grid gap-2">
                          {formData.milestones.map((m, i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                              <div className="flex items-center gap-3">
                                <span className="w-5 h-5 flex items-center justify-center rounded bg-zinc-800 text-[10px] font-bold text-zinc-400">
                                  {i + 1}
                                </span>
                                <p className="text-sm text-zinc-300">{m.description || `Milestone ${i + 1}`}</p>
                              </div>
                              <p className="text-sm font-mono font-bold text-teal-400">${parseFloat(m.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="rounded-[2rem] bg-zinc-950 border border-zinc-800 p-8 sm:p-12 flex flex-col items-center text-center relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-teal-500/20 to-transparent" />
                      <p className="text-[10px] sm:text-xs text-zinc-500 mb-2 sm:mb-4 uppercase tracking-[0.3em] font-black">Total Commitment</p>
                      <p className="text-4xl sm:text-6xl font-bold text-white mb-2 sm:mb-4 tracking-tighter">
                        ${displayTotal ? displayTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                      </p>
                      <div className="flex items-center gap-2 bg-teal-500/5 border border-teal-500/10 px-4 py-1.5 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                        <p className="text-teal-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest">Secured Escrow Order</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Attachments */}
                {step === 4 && (
                  <div className="space-y-6">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-zinc-800 bg-zinc-900/20 rounded-3xl p-12 flex flex-col items-center transition-all hover:border-teal-500/50 hover:bg-teal-500/5 cursor-pointer group"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={ACCEPT_FILE_TYPES}
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setSelectedFiles(prev => [...prev, ...files].slice(0, MAX_ATTACHMENTS));
                          e.target.value = '';
                        }}
                      />
                      <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <p className="text-white font-medium text-lg mb-1">Add Supporting Documents</p>
                      <p className="text-zinc-500 text-sm text-center">PDF, Images, or Text files (Max 10MB each)</p>
                    </div>

                    {selectedFiles.length > 0 && (
                      <div className="grid gap-3">
                        {selectedFiles.map((file, i) => (
                          <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 transition-all hover:border-zinc-700">
                            <div className="flex items-center gap-3">
                              <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" strokeWidth={2} />
                              </svg>
                              <div>
                                <p className="text-sm text-white font-medium truncate max-w-[200px]">{file.name}</p>
                                <p className="text-[10px] text-zinc-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedFiles(prev => prev.filter((_, idx) => idx !== i)) }}
                              className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2} /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Navigation Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-16 pt-8 border-t border-gray-800/50">
                <button
                  type="button"
                  onClick={() => (step > 1 ? setStep((s) => s - 1) : router.back())}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-md border border-gray-800 bg-transparent text-gray-300 font-semibold hover:bg-gray-800 hover:text-white hover:border-gray-700 transition-all active:scale-[0.98]"
                >
                  {step === 1 ? 'Cancel' : 'Go Back'}
                </button>

                <button
                  type="button"
                  onClick={step < 4 ? handleNext : handleSubmit}
                  disabled={!canProceed() || isSubmitting}
                  className={`w-full sm:w-auto px-10 py-3.5 rounded-md font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                    step === 4
                      ? 'bg-white text-black hover:bg-gray-200 shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_25px_rgba(255,255,255,0.25)]'
                      : 'bg-teal-500 text-black hover:bg-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.15)] hover:shadow-[0_0_25px_rgba(20,184,166,0.25)]'
                  }`}
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center gap-3">
                      <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    step === 4 ? (editId ? 'Apply Changes' : 'Confirm & Deploy') : 'Continue'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PremiumDashboardLayout>
  );
}
