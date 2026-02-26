'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { paymentContractApi, type PaymentContract } from '@/lib/api/payment-contract';
import { blockchainApi, type EnabledChain, type Asset } from '@/lib/api/blockchain';
import {
  FormSection,
  FormLabel,
  FormInput,
  FormTextarea,
  FormSelectWithLogo,
  FormError,
} from '@/components/form';
import { DatePicker } from '@/components/DatePicker';
import { PaymentScheduleSection } from '@/components/contracts/PaymentScheduleSection';

const inputBase =
  'w-full px-3 sm:px-4 py-2.5 bg-black/30 text-white border border-gray-800 rounded-xl text-sm focus:outline-none focus:border-teal-500 placeholder-gray-500';
const inputError = 'border-red-500/50 focus:border-red-500';
const inputCompact = 'px-3 py-2 bg-black/30 text-white border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-teal-500';

export default function CreateContractPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id') || undefined;
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
    releaseType: 'TIME_BASED' as const,
    duration: 'FIXED' as 'FIXED' | 'ONGOING',
    chainSlug: '',
    assetSlug: '',
    jobTitle: '',
    description: '',
    contractName: '',
    recipientEmail: '',
    deliverables: '',
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [touchedAddress, setTouchedAddress] = useState(false);

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
            c.startDate != null
              ? new Date(c.startDate * 1000).toISOString().slice(0, 10)
              : '';
          const numPayments = c.numberOfPayments ? String(c.numberOfPayments) : '1';
          const chainSlug = c.chainSlug || defaultChain?.slug || '';
          const chainAssets = chainSlug ? activeAssets.filter((a) => a.blockchain?.slug === chainSlug) : defaultChainAssets;
          const assetSlug = c.assetSlug || (usdc ? usdc.slug ?? usdc.id : '');
          setFormData({
            contractorAddress: c.contractor ?? '',
            paymentAmount: c.paymentAmount ?? '',
            numberOfPayments: numPayments,
            paymentInterval: c.paymentInterval ?? '30',
            startDate: startDateStr,
            releaseType: 'TIME_BASED',
            duration: c.isOngoing ? 'ONGOING' : 'FIXED',
            chainSlug,
            assetSlug,
            jobTitle: c.jobTitle ?? '',
            description: c.description ?? '',
            contractName: c.contractName ?? '',
            recipientEmail: c.recipientEmail ?? '',
            deliverables: c.deliverables ?? '',
          });
          setSelectedChainAssets(chainAssets.length > 0 ? chainAssets : defaultChainAssets);
        } else {
          setError('Contract not found or not editable');
        }
      } else if (chainsFromEnv.length > 0) {
        setFormData((prev) => ({
          ...prev,
          chainSlug: defaultChain?.slug ?? '',
          assetSlug: usdc ? (usdc.slug ?? usdc.id) : '',
        }));
        setSelectedChainAssets(defaultChainAssets);
      }
    } catch (err) {
      console.error(err);
      setError(editId ? 'Failed to load contract' : 'Failed to load networks');
    } finally {
      setLoadingData(false);
    }
  }, [editId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const recipientInput = formData.contractorAddress.trim();
  const isWalletAddress = /^0x[a-fA-F0-9]{40}$/.test(recipientInput);
  const isTag = recipientInput.length > 0 && !recipientInput.startsWith('0x');
  const showAddressError =
    touchedAddress &&
    recipientInput.length > 0 &&
    recipientInput.startsWith('0x') &&
    !isWalletAddress;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setTouchedAddress(true);
    if (!recipientInput) {
      setError('Enter the recipient\'s tag (e.g. jane-doe) or wallet address.');
      return;
    }
    if (recipientInput.startsWith('0x') && !isWalletAddress) {
      setError('Enter a valid wallet address (0x followed by 40 hex characters).');
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

      const isOngoing = formData.duration === 'ONGOING';
      const numPayments = isOngoing ? 1000 : (parseInt(formData.numberOfPayments, 10) || 1);
      const intervalDays = parseInt(formData.paymentInterval, 10) || 30;
      const paymentAmount = formData.paymentAmount;

      const startTimestamp = Math.floor(new Date(formData.startDate).getTime() / 1000);
      const payload: Parameters<typeof paymentContractApi.createContract>[0] = {
        ...(isWalletAddress ? { contractorAddress: recipientInput } : { contractorTag: recipientInput.replace(/^@/, '') }),
        paymentAmount,
        numberOfPayments: numPayments,
        paymentInterval: intervalDays,
        startDate: startTimestamp,
        releaseType: 'TIME_BASED',
        chainSlug: formData.chainSlug,
        assetSlug: formData.assetSlug,
        jobTitle: formData.jobTitle || undefined,
        description: formData.description || undefined,
        contractName: formData.contractName || undefined,
        recipientEmail: formData.recipientEmail?.trim() || undefined,
        deliverables: formData.deliverables?.trim() || undefined,
        ongoing: isOngoing || undefined,
      };
      if (!isOngoing && formData.startDate && numPayments && intervalDays) {
        const endMs = new Date(formData.startDate).getTime() + numPayments * intervalDays * 24 * 60 * 60 * 1000;
        payload.endDate = Math.floor(endMs / 1000);
      }

      if (editId) {
        const response = await paymentContractApi.updateContract(editId, payload);
        if (response.success) {
          router.push('/dashboard/contracts?updated=true');
        } else {
          throw new Error((response as { error?: string }).error || 'Failed to update contract');
        }
      } else {
        const response = await paymentContractApi.createContract(payload);
        if (response.success) {
          router.push('/dashboard/contracts?created=true');
        } else {
          throw new Error((response as { error?: string }).error || 'Failed to create contract');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : editId ? 'Failed to update contract' : 'Failed to create contract');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOngoing = formData.duration === 'ONGOING';
  const totalValue =
    !isOngoing && formData.paymentAmount && formData.numberOfPayments
      ? parseFloat(formData.paymentAmount) * (parseInt(formData.numberOfPayments, 10) || 0)
      : 0;
  const displayTotal = isOngoing ? null : totalValue;
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
      <div className="w-full max-w-4xl mx-auto pt-3 px-3 pb-5 sm:pt-6 sm:px-6 sm:pb-6 md:pt-8 md:px-8 md:pb-8 min-w-0">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-lg font-bold text-white mb-1 sm:text-xl md:text-2xl">
            {editId ? 'Edit payment agreement' : 'New payment agreement'}
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm">
            {editId
              ? 'Update the details below. Only draft contracts can be edited.'
              : 'Set the amount, schedule, and who gets paid. You will fund the contract after creating it.'}
          </p>
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
                <FormLabel htmlFor="contractorAddress">Recipient (tag or wallet)</FormLabel>
                <FormInput id="contractorAddress" name="contractorAddress" type="text" value={formData.contractorAddress} onChange={handleChange} onBlur={() => setTouchedAddress(true)} placeholder="e.g. jane-doe or 0x..." required error={showAddressError} className={isWalletAddress ? 'font-mono' : ''} />
                <p className="mt-1.5 text-xs text-gray-500">Use their @tag so they see the contract in their dashboard, or paste a wallet address</p>
                {showAddressError && <p className="mt-1.5 text-xs text-red-400">Enter a valid wallet address (0x + 40 hex characters)</p>}
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

          <PaymentScheduleSection
            value={{
              duration: formData.duration,
              paymentAmount: formData.paymentAmount,
              numberOfPayments: formData.numberOfPayments,
              paymentInterval: formData.paymentInterval,
              startDate: formData.startDate,
            }}
            onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
            onClearError={() => setError('')}
            inputClassName={inputBase}
            displayTotal={displayTotal}
            isOngoing={isOngoing}
          />

          <FormSection title="Payment method" subtitle="Network and token for escrow">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <FormLabel htmlFor="chainSlug">Network</FormLabel>
                <FormSelectWithLogo
                  id="chainSlug"
                  name="chainSlug"
                  value={formData.chainSlug}
                  onChange={(value) => {
                    setError('');
                    const chainAssets = assets.filter((a) => a.blockchain?.slug === value);
                    setSelectedChainAssets(chainAssets);
                    const usdc = chainAssets.find((a) => a.symbol === 'USDC') || chainAssets[0];
                    setFormData((prev) => ({
                      ...prev,
                      chainSlug: value,
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
                />
              </div>
              <div>
                <FormLabel htmlFor="assetSlug">Token</FormLabel>
                <FormSelectWithLogo
                  id="assetSlug"
                  name="assetSlug"
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
                />
              </div>
            </div>
          </FormSection>

            {/* Summary + actions: mobile = in flow at end of form; desktop = sticky at viewport bottom */}
            <div className="sm:sticky sm:bottom-0 left-0 right-0 z-10 py-4 px-3 sm:py-4 sm:px-0 -mx-3 sm:mx-0 bg-gray-950/95 sm:bg-gray-950/95 backdrop-blur-sm sm:backdrop-blur-sm border-t border-gray-800/50 sm:border-t-0 sm:pt-2">
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
                        {editId ? 'Saving…' : 'Creating…'}
                      </>
                    ) : (
                      editId ? 'Save changes' : 'Create agreement'
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
