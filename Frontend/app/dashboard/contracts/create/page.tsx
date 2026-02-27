'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { paymentContractApi, type PaymentContract } from '@/lib/api/payment-contract';
import { blockchainApi, type EnabledChain, type Asset } from '@/lib/api/blockchain';
import { DatePicker } from '@/components/DatePicker';
import { FormSelectWithLogo } from '@/components/form';

const STEPS = [
  { id: 1, title: 'Who gets paid', short: 'Recipient' },
  { id: 2, title: "What's the work", short: 'Scope' },
  { id: 3, title: 'Contract value', short: 'Pay' },
  { id: 4, title: 'Where to hold funds', short: 'Network' },
  { id: 5, title: 'Review & create', short: 'Done' },
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
    startDate: '',
    chainSlug: '',
    assetSlug: '',
    jobTitle: '',
    description: '',
    contractName: '',
    recipientEmail: '',
    deliverables: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [touchedRecipient, setTouchedRecipient] = useState(false);

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
          setFormData({
            contractorAddress: c.contractor ?? '',
            paymentAmount: c.paymentAmount ?? c.totalAmount ?? '',
            startDate: startDateStr,
            chainSlug: c.chainSlug || defaultChain?.slug || '',
            assetSlug: c.assetSlug || (usdc ? usdc.slug ?? usdc.id : ''),
            jobTitle: c.jobTitle ?? '',
            description: c.description ?? '',
            contractName: c.contractName ?? '',
            recipientEmail: c.recipientEmail ?? '',
            deliverables: c.deliverables ?? '',
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
  const recipientError =
    touchedRecipient && recipientInput.length > 0 && looksLikeWallet
      ? 'Use their Holdis tag (e.g. jane-doe), not a wallet address.'
      : null;

  const displayTotal = formData.paymentAmount ? parseFloat(formData.paymentAmount) : null;

  const canProceed = () => {
    if (step === 1) return recipientInput && !recipientError;
    if (step === 2) return formData.jobTitle.trim().length > 0;
    if (step === 3) return formData.paymentAmount && parseFloat(formData.paymentAmount) > 0 && formData.startDate;
    if (step === 4) return formData.chainSlug && formData.assetSlug;
    return true;
  };

  const handleNext = () => {
    setError('');
    if (step === 1) setTouchedRecipient(true);
    if (!canProceed() && step < 5) return;
    if (step < 5) setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    setError('');
    setTouchedRecipient(true);
    if (!recipientInput) {
      setError("Enter who you're paying (their Holdis tag).");
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
      const payload = {
        ...(!editId && recipientInput && { contractorTag: recipientInput.replace(/^@/, '').trim() }),
        paymentAmount: formData.paymentAmount,
        numberOfPayments: 1,
        paymentInterval: 1,
        startDate: startTimestamp,
        releaseType: 'PROJECT_BASED' as const,
        chainSlug: formData.chainSlug,
        assetSlug: formData.assetSlug,
        jobTitle: formData.jobTitle.trim() || undefined,
        description: formData.description.trim() || undefined,
        contractName: formData.contractName.trim() || undefined,
        recipientEmail: formData.recipientEmail.trim() || undefined,
        deliverables: formData.deliverables.trim() || undefined,
      };
      if (editId) {
        const res = await paymentContractApi.updateContract(editId, payload);
        if (res.success) router.push('/dashboard/contracts?updated=true');
        else throw new Error((res as { error?: string }).error || 'Update failed');
      } else {
        const res = await paymentContractApi.createContract(payload);
        if (res.success) router.push('/dashboard/contracts?created=true');
        else throw new Error((res as { error?: string }).error || 'Create failed');
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
        <p className="text-center text-zinc-500 text-sm mb-6 sm:mb-8">
          {STEPS[step - 1].title}
        </p>

        {/* Card container */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8 shadow-xl min-h-[320px]">
          {error && (
            <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3">
              {error}
            </div>
          )}

          {/* Step 1: Who gets paid */}
          {step === 1 && (
            <>
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-1">
                Who are you paying?
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                Enter their Holdis tag so they can see the contract in their dashboard (e.g. <span className="text-zinc-300">jane-doe</span>).
              </p>
              <div>
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
              </div>
              <div className="mt-6">
                <label className={labelClass}>Their email (optional)</label>
                <input
                  type="email"
                  value={formData.recipientEmail}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, recipientEmail: e.target.value }))
                  }
                  placeholder="for notifications"
                  className={inputClass}
                />
              </div>
            </>
          )}

          {/* Step 2: What's the work */}
          {step === 2 && (
            <>
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-1">
                What's this contract for?
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                A short title is enough. Add more detail if you like.
              </p>
              <div className="space-y-4">
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
                    autoFocus
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
                    rows={4}
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
                    rows={3}
                    className={inputClass + ' resize-none'}
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 3: Contract value */}
          {step === 3 && (
            <>
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-1">
                Contract value
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                Agreed amount for the project. Funds are held in escrow until you approve the work and release payment.
              </p>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Amount (USD) *</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={formData.paymentAmount}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, paymentAmount: e.target.value }))
                    }
                    placeholder="0.00"
                    className={inputClass}
                  />
                </div>
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
                    <span className="text-zinc-400">Total project value</span>
                    <span className="text-lg font-semibold text-white">${displayTotal.toFixed(2)}</span>
                  </div>
                ) : null}
              </div>
            </>
          )}

          {/* Step 4: Network & token */}
          {step === 4 && (
            <>
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-1">
                Where should we hold the funds?
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                Pick the network and token. The money stays in escrow until payments are released.
              </p>
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
            </>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <>
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-1">
                Ready to create
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                Check the summary below. You'll fund the contract from your contracts list after this.
              </p>
              <div className="rounded-lg bg-zinc-800/60 border border-zinc-700/60 p-5 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Paying</span>
                  <span className="text-white font-medium">{recipientInput || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Title</span>
                  <span className="text-white">{formData.jobTitle || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Contract value</span>
                  <span className="text-white">
                    ${parseFloat(formData.paymentAmount || '0').toFixed(2)}
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
                    Released when you approve the work
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
          {step < 5 ? (
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
