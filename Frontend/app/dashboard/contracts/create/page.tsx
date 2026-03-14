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
    recurrenceInterval: 'NONE' as 'NONE' | 'BI_WEEKLY' | 'MONTHLY' | 'CUSTOM' | 'NEVER',
    recurrenceCustomDays: '14',
    issueDate: format(new Date(), 'yyyy-MM-dd'),
    recurrenceEndDate: '',
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
  const recipientError =
    touchedRecipient && recipientInput.length > 0 && looksLikeWallet
      ? 'Use their HoldisPay tag (e.g. jane-doe), not a wallet address.'
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
  const getFuturePayments = useCallback(() => {
    if (!formData.startDate || !amountNum) return [];
    
    // Logic: Milestone (One-time) - Paid on the target date
    if (formData.recurrenceInterval === 'NONE' || formData.recurrenceInterval === 'NEVER') {
      return [{ date: new Date(formData.startDate), amount: amountNum }];
    }

    const instances: { date: Date; amount: number }[] = [];
    let nextRelease = new Date(formData.startDate);
    const count = parseInt(formData.numberOfMonths, 10) || 1;

    for (let i = 0; i < count; i++) {
      if (formData.recurrenceInterval === 'MONTHLY') {
        nextRelease = addMonths(nextRelease, 1);
      } else if (formData.recurrenceInterval === 'BI_WEEKLY') {
        nextRelease = addDays(nextRelease, 14);
      } else if (formData.recurrenceInterval === 'CUSTOM') {
        const days = parseInt(formData.recurrenceCustomDays, 10) || 14;
        nextRelease = addDays(nextRelease, days);
      } else {
        break;
      }

      instances.push({ 
        date: new Date(nextRelease), 
        amount: amountNum 
      });
    }
    return instances;
  }, [formData.startDate, formData.recurrenceInterval, formData.numberOfMonths, formData.recurrenceCustomDays, amountNum]);

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
      <div className="w-full min-w-0 max-w-6xl mx-auto py-8 sm:py-12 px-4 sm:px-6">
        {/* Header Section */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.back()}
              className="p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-teal-400 hover:border-teal-500/30 transition-all group"
            >
              <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-1">
                <Link href="/dashboard/contracts" className="hover:text-zinc-300">Contracts</Link>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 5l7 7-7 7" strokeWidth={2} /></svg>
                <span className="text-zinc-300">{editId ? 'Edit' : 'Create'}</span>
              </nav>
              <h1 className="text-3xl font-medium text-white tracking-tight">
                {editId ? 'Edit Contract' : 'Create New Contract'}
              </h1>
            </div>
          </div>

          {/* Stepper Progress */}
          <div className="relative">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-zinc-800 -translate-y-1/2" />
            <div 
              className="absolute top-1/2 left-0 h-0.5 bg-teal-500 -translate-y-1/2 transition-all duration-500 ease-out"
              style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
            />
            <div className="relative flex justify-between items-center">
              {STEPS.map((s) => (
                <div key={s.id} className="flex flex-col items-center group">
                  <button
                    onClick={() => s.id < step && setStep(s.id)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10 ${
                      step >= s.id
                        ? 'bg-zinc-900 border-teal-500 text-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.3)]'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                    } ${s.id < step ? 'cursor-pointer hover:border-teal-400' : 'cursor-default'}`}
                  >
                    {s.id < step ? (
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-sm font-medium">{s.id}</span>
                    )}
                  </button>
                  <span className={`absolute -bottom-7 text-[11px] font-medium uppercase tracking-wider transition-colors duration-300 ${
                    step >= s.id ? 'text-teal-400' : 'text-zinc-600'
                  }`}>
                    {s.short}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-12 items-start">
          {/* Main Form Area */}
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-lg p-8 backdrop-blur-sm relative group">
              <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-teal-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="mb-8">
                <h2 className="text-xl font-medium text-white mb-2">{STEPS[step - 1].title}</h2>
                <p className="text-zinc-500 text-sm">{STEPS[step - 1].description}</p>
              </div>

              {/* Step 1: Details */}
              {step === 1 && (
                <div className="space-y-8">
                  <div className="grid gap-6">
                    <div>
                      <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3 block">User Tag</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                          <span className="text-zinc-500 font-medium">@</span>
                        </div>
                        <input
                          type="text"
                          value={formData.contractorAddress.replace(/^@/, '')}
                          onChange={(e) => {
                            setError('');
                            setFormData((prev) => ({ ...prev, contractorAddress: e.target.value }));
                          }}
                          onBlur={() => setTouchedRecipient(true)}
                          className={`${inputClass} pl-9! h-14 bg-zinc-800/30 border-zinc-700/50 hover:border-zinc-600 focus:bg-zinc-800/50`}
                          placeholder="contractor-username"
                          readOnly={!!editId}
                        />
                        <div className="absolute inset-y-0 right-4 flex items-center">
                          {looksLikeTag && tagLookup === 'checking' && (
                            <span className="flex h-2 w-2 rounded-full bg-teal-400 animate-ping" />
                          )}
                          {looksLikeTag && tagLookup === 'found' && (
                            <div className="flex items-center gap-2 text-teal-400 text-xs font-medium">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M5 13l4 4L19 7" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              <span>FOUND</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {tagDisplayName && (
                        <p className="mt-3 text-sm text-zinc-400 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                          Verified: <span className="text-white font-medium">{tagDisplayName}</span>
                        </p>
                      )}
                      {recipientError && <p className="mt-3 text-sm text-red-400">{recipientError}</p>}
                      {looksLikeTag && tagLookup === 'not_found' && recipientInput.length > 0 && (
                         <p className="mt-3 text-sm text-amber-400/80">User not found. They must have a Holdis account.</p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3 block">Job Title</label>
                      <input
                        type="text"
                        value={formData.jobTitle}
                        onChange={(e) => setFormData((prev) => ({ ...prev, jobTitle: e.target.value }))}
                        className={`${inputClass} h-14 bg-zinc-800/30 border-zinc-700/50`}
                        placeholder="e.g. Strategic Planning Consultation"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3 block">Description</label>
                      <RichTextEditor
                        value={formData.description}
                        onChange={(val) => setFormData((prev) => ({ ...prev, description: val }))}
                        placeholder="Define the project objectives and broad scope of work..."
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3 block">Deliverables / Scope</label>
                      <RichTextEditor
                        value={formData.deliverables}
                        onChange={(val) => setFormData((prev) => ({ ...prev, deliverables: val }))}
                        placeholder="List specific milestones, results, or key deliverables..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Financial Configuration */}
              {step === 2 && (
                <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  {/* Amount Configuration - The Heart of the Contract */}
                  <div className="relative p-12 rounded-[3rem] bg-zinc-900/30 border border-zinc-800/50 backdrop-blur-sm overflow-hidden group transition-all duration-500 hover:border-zinc-700/50">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-teal-500/20 to-transparent" />
                    
                    <div className="text-center space-y-8">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] block">Capital Commitment</label>
                      
                      <div className="relative inline-flex items-center justify-center gap-4 max-w-full">
                        <span className="text-5xl font-light text-zinc-700 transition-colors group-focus-within:text-teal-500/50 select-none">$</span>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.paymentAmount}
                            onChange={(e) => setFormData((prev) => ({ ...prev, paymentAmount: e.target.value }))}
                            className="bg-transparent border-none p-0 text-8xl font-medium text-white placeholder-zinc-900 focus:ring-0 focus:outline-none tracking-tighter text-center w-[300px] sm:w-[400px]"
                            placeholder="0.00"
                          />
                          <div className="absolute -bottom-2 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-zinc-800 to-transparent transition-all duration-700 group-focus-within:via-teal-500/30" />
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-3 px-5 py-2 rounded-full bg-zinc-950 border border-zinc-800/80 shadow-inner">
                          <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse shadow-[0_0_10px_rgba(20,184,166,0.6)]" />
                          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Settled via USDC Protocol</span>
                        </div>
                        <p className="text-[11px] text-zinc-600 font-medium italic">Funds secured in escape-proof Escrow</p>
                      </div>
                    </div>
                  </div>

                  {/* Settings Flow - Linear Stack */}
                  <div className="space-y-6">
                    {/* Strategy Section */}
                    <div className="p-10 rounded-[2.5rem] bg-zinc-900/20 border border-zinc-800/40 space-y-10">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Payment Protocol</label>
                        <div className="flex p-1 bg-zinc-950 rounded-xl border border-zinc-900 w-full sm:w-auto">
                          <button 
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, recurrenceInterval: 'NONE', releaseType: 'PROJECT_BASED' }))}
                            className={`flex-1 sm:px-10 py-3 rounded-lg text-xs font-bold transition-all duration-300 ${
                              formData.recurrenceInterval === 'NONE' 
                                ? 'bg-zinc-100 text-black shadow-lg' 
                                : 'text-zinc-600 hover:text-zinc-400'
                            }`}
                          >
                            Milestone
                          </button>
                          <button 
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, recurrenceInterval: 'MONTHLY', releaseType: 'TIME_BASED' }))}
                            className={`flex-1 sm:px-10 py-3 rounded-lg text-xs font-bold transition-all duration-300 ${
                              formData.recurrenceInterval !== 'NONE' 
                                ? 'bg-zinc-100 text-black shadow-lg' 
                                : 'text-zinc-600 hover:text-zinc-400'
                            }`}
                          >
                            Recurring
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-10 border-t border-zinc-800/40">
                        <div className="space-y-4">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Start Date</label>
                          <DatePicker
                            value={formData.startDate}
                            onChange={(v) => setFormData((prev) => ({ ...prev, startDate: v }))}
                            minDate={new Date()}
                            className={`${inputClass} !h-14 bg-zinc-950/50! border-zinc-800! hover:border-zinc-700! focus:border-zinc-600!`}
                            placeholder="Select execution date..."
                          />
                        </div>

                        {formData.recurrenceInterval !== 'NONE' ? (
                          <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Release Cycle Count</label>
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                value={formData.numberOfMonths}
                                onChange={(e) => setFormData((prev) => ({ ...prev, numberOfMonths: e.target.value }))}
                                className={`${inputClass} !h-14 bg-zinc-950/50! border-zinc-800! pr-24 font-bold`}
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 font-bold uppercase tracking-widest pointer-events-none">Releases</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center p-4 rounded-xl bg-zinc-950/30 border border-dashed border-zinc-800/50 h-14">
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Escrowed Milestone Payment</p>
                          </div>
                        )}
                      </div>

                      {formData.recurrenceInterval !== 'NONE' && (
                        <div className="pt-10 border-t border-zinc-800/40 space-y-10">
                          <div className="flex flex-col md:flex-row gap-10 items-start md:items-center">
                            <div className="flex-1 w-full">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 block">Interval Strategy</label>
                              <RecurrenceSelect
                                value={formData.recurrenceInterval}
                                onChange={(val) => setFormData((prev) => ({ ...prev, recurrenceInterval: val, releaseType: 'TIME_BASED' }))}
                                referenceDate={formData.startDate}
                                excludeNone
                              />
                            </div>
                            {formData.recurrenceInterval === 'CUSTOM' && (
                              <div className="w-full md:w-40 animate-in fade-in slide-in-from-right-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 block">Custom Gap (Days)</label>
                                <input
                                  type="text"
                                  value={formData.recurrenceCustomDays}
                                  onChange={(e) => setFormData((prev) => ({ ...prev, recurrenceCustomDays: e.target.value.replace(/\D/g, '') }))}
                                  className={`${inputClass} !h-14 bg-zinc-950/50! border-zinc-800! text-center font-bold`}
                                  placeholder="14"
                                />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between px-6 py-4 rounded-2xl bg-zinc-950/50 border border-zinc-800/50">
                            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Calculated Completion</span>
                            <span className="text-xs font-bold text-white tracking-widest">{formData.recurrenceEndDate ? format(new Date(formData.recurrenceEndDate), 'MMMM dd, yyyy') : '...'}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Financial Summary Card */}
                    <div className="p-10 rounded-[2.5rem] bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 shadow-xl space-y-10">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Valuation</p>
                          <p className="text-4xl font-medium text-white tracking-tight">
                            ${displayTotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.82v-1.91c-1.84-.13-3.41-.95-4.24-2.22l1.9-1.12c.49.78 1.48 1.4 2.34 1.4 1.25 0 2.04-.61 2.04-1.42 0-.67-.39-1.22-1.95-1.61-2.14-.52-3.79-1.1-3.79-3.23 0-1.74 1.34-3.04 3.25-3.32V5h2.82v1.89c1.47.16 2.76.84 3.51 1.83l-1.82 1.15c-.46-.66-1.2-1.13-2-.13-.8.29-1.42.06-1.42.84 0 .61.46 1.05 1.8 1.4 2.14.56 3.94 1.25 3.94 3.44 0 1.54-.95 2.87-2.67 3.26z"/>
                          </svg>
                        </div>
                      </div>
                      
                      <div className="pt-8 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-8">
                        <div className="space-y-1">
                          <p className="text-[9px] text-zinc-600 uppercase font-black tracking-widest">Installments</p>
                          <p className="text-sm font-bold text-zinc-300">{futurePayments.length} Payments</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] text-zinc-600 uppercase font-black tracking-widest">First Payout</p>
                          <p className="text-sm font-bold text-zinc-300">{futurePayments[0] ? format(futurePayments[0].date, 'MMM dd') : '---'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] text-zinc-600 uppercase font-black tracking-widest">Final Payout</p>
                          <p className="text-sm font-bold text-zinc-300">{futurePayments.length > 0 ? format(futurePayments[futurePayments.length - 1].date, 'MMM dd') : '---'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] text-zinc-600 uppercase font-black tracking-widest">Release Rate</p>
                          <p className="text-sm font-bold text-zinc-300">${amountNum}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Review */}
              {step === 3 && (
                <div className="space-y-8">
                  <div className="grid gap-4">
                    {[
                      { label: 'Contractor', value: tagDisplayName || recipientInput, icon: <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /> },
                      { label: 'Role / Title', value: formData.jobTitle, icon: <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /> },
                      { label: 'Frequency', value: isTimeBased ? (formData.recurrenceInterval === 'BI_WEEKLY' ? 'Every 2 weeks' : formData.recurrenceInterval === 'MONTHLY' ? 'Monthly' : formData.recurrenceInterval === 'NEVER' ? 'Never' : formData.recurrenceInterval === 'CUSTOM' ? `Every ${formData.recurrenceCustomDays}d` : 'Recurring') : 'Milestone', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /> },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-5 rounded-lg bg-zinc-800/30 border border-zinc-800/50">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              {item.icon}
                            </svg>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">{item.label}</p>
                            <p className="text-white font-medium">{item.value || '—'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-8 flex flex-col items-center text-center">
                    <p className="text-sm text-zinc-500 mb-2 uppercase tracking-widest font-medium">Total Contract Value</p>
                    <p className="text-5xl font-medium text-white mb-2">
                       ${displayTotal ? displayTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                    </p>
                    <p className="text-teal-400/80 text-sm font-medium">Secured in escape-proof Escrow</p>
                  </div>
                </div>
              )}

              {/* Step 4: Attachments */}
              {step === 4 && (
                <div className="space-y-6">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-zinc-700 bg-zinc-800/20 rounded-3xl p-12 flex flex-col items-center transition-all hover:border-teal-500/50 hover:bg-zinc-800/40 cursor-pointer group"
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
                        <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/40 border border-zinc-700 transition-all hover:border-zinc-600">
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
            <div className="flex items-center justify-between gap-4 pt-4">
              <button
                type="button"
                onClick={() => (step > 1 ? setStep((s) => s - 1) : router.back())}
                className="px-8 py-4 rounded-lg border border-zinc-800 text-white font-medium hover:bg-zinc-900 transition-colors"
              >
                {step === 1 ? 'Cancel' : 'Previous Step'}
              </button>
              
              <button
                type="button"
                onClick={step < 4 ? handleNext : handleSubmit}
                disabled={!canProceed() || isSubmitting}
                className={`px-12 py-4 rounded-lg text-black font-medium text-lg transition-all shadow-[0_4px_20px_rgba(20,184,166,0.3)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:hover:scale-100 ${
                  step === 4 ? 'bg-white shadow-[0_4px_20px_rgba(255,255,255,0.2)]' : 'bg-teal-400'
                }`}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 border-3 border-black/20 border-t-black rounded-full animate-spin" />
                    Processing...
                  </div>
                ) : (
                  step === 4 ? (editId ? 'Save Changes' : 'Confirm & Launch') : 'Continue'
                )}
              </button>
            </div>
          </div>

          {/* Sticky Contract Summary Sidebar */}
          <aside className="hidden lg:block sticky top-8 animate-in fade-in zoom-in-95 duration-700 delay-200">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-zinc-800 bg-zinc-800/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
                  <p className="text-[10px] font-medium text-teal-400 uppercase tracking-widest">LIVE PREVIEW</p>
                </div>
                <h3 className="text-xl font-medium text-white">Contract Summary</h3>
              </div>
              
              <div className="p-8 space-y-8">
                {/* Header preview */}
                <div className="flex gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 text-xl font-medium">
                    {formData.jobTitle ? formData.jobTitle.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{formData.jobTitle || 'New Contract Title'}</p>
                    <p className="text-zinc-500 text-xs">Escrow Secured · Smart Contract</p>
                  </div>
                </div>

                {/* Details list */}
                <div className="space-y-6">
                  <div className="flex justify-between items-start gap-4 text-sm">
                    <span className="text-zinc-500 font-medium">Contractor</span>
                    <span className="text-white font-medium text-right truncate">
                      {tagDisplayName || recipientInput || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-500 font-medium">Network</span>
                    <span className="text-white font-medium">
                      {enabledChains.find(c => c.slug === formData.chainSlug)?.displayName || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-500 font-medium">Token</span>
                    <span className="text-white font-medium">
                      {selectedChainAssets.find(a => (a.slug ?? a.id) === formData.assetSlug)?.symbol || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-500 font-medium">{isTimeBased ? 'Start Date' : 'Milestone Date'}</span>
                    <span className="text-white font-medium">
                      {formData.startDate ? new Date(formData.startDate).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>

                {/* Big Total */}
                <div className="bg-zinc-800/40 rounded-lg p-6 border border-zinc-700/30">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest mb-1">Total Amount</p>
                      <p className="text-2xl font-medium text-white">
                        ${displayTotal ? displayTotal.toLocaleString() : '0.00'}
                      </p>
                    </div>
                    {isTimeBased && (
                      <div className="text-right">
                        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest mb-1">Frequency</p>
                        <p className="text-sm font-medium text-zinc-300">
                          {formData.recurrenceInterval === 'BI_WEEKLY' ? 'Bi-weekly' : 
                           formData.recurrenceInterval === 'MONTHLY' ? 'Monthly' : 
                           formData.recurrenceInterval === 'NEVER' ? 'Never (Fixed Term)' : 
                           formData.recurrenceInterval === 'CUSTOM' ? `${formData.recurrenceCustomDays} Days` : 'Recurring'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-xl bg-teal-400/5 border border-teal-500/10">
                  <svg className="w-5 h-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Funds are cryptographically secured in individual escrow vaults.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PremiumDashboardLayout>
  );
}
