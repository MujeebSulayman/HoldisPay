'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { invoiceApi } from '@/lib/api/invoice';
import { DatePicker } from '@/components/DatePicker';
import { FormSection, FormLabel, FormInput, FormError, FormActions } from '@/components/form';
import { Calendar, List, Clock, Repeat, AlertCircle } from 'lucide-react';
import { addDays, addWeeks, addMonths, format, isAfter, isBefore } from 'date-fns';
import RecurrenceSelect from '@/components/RecurrenceSelect';

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

const defaultLineItem = (): LineItem => ({
  id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
  description: '',
  quantity: '1',
  unitPrice: '',
});

function formatCurrency(num: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(num);
}

const inputClass =
  'w-full px-4 py-3 rounded-lg border border-gray-800 bg-black/30 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition';
const labelClass = 'block text-sm font-medium text-gray-400 mb-2';

export default function CreateInvoicePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([defaultLineItem()]);
  const [vatPercent, setVatPercent] = useState('');
  const [processingFeePercent, setProcessingFeePercent] = useState('');
  const [issueDate, setIssueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState('');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState<'NONE' | 'BI_WEEKLY' | 'MONTHLY' | 'CUSTOM'>('NONE');
  const [recurrenceCustomDays, setRecurrenceCustomDays] = useState('14');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    } else if (user?.email) {
      setBusinessName(user.email);
    }
  }, [user, loading, router]);

  const addLineItem = () => setLineItems((prev) => [...prev, defaultLineItem()]);
  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };
  const updateLineItem = (id: string, field: keyof LineItem, value: string) => {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const subtotal = lineItems.reduce((sum, item) => {
    const q = parseFloat(item.quantity) || 0;
    const u = parseFloat(item.unitPrice) || 0;
    return sum + q * u;
  }, 0);
  const vatP = parseFloat(vatPercent) || 0;
  const feeP = parseFloat(processingFeePercent) || 0;
  const vatAmount = (subtotal * vatP) / 100;
  const feeAmount = (subtotal * feeP) / 100;
  const grandTotal = subtotal + vatAmount + feeAmount;

  const buildDescription = (): string => {
    const parts = lineItems
      .filter((item) => item.description.trim())
      .map((item) => {
        const q = parseFloat(item.quantity) || 1;
        const u = parseFloat(item.unitPrice) || 0;
        return `${item.description.trim()}${q !== 1 ? ` (${q} × ${formatCurrency(u)})` : ''}`;
      });
    return parts.length ? parts.join('; ') : 'Invoice items';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (grandTotal <= 0) {
      setError('Add at least one item with a valid quantity and unit price.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const lineItemsPayload = lineItems
        .filter((item) => item.description.trim())
        .map((item) => {
          const q = parseFloat(item.quantity) || 0;
          const u = parseFloat(item.unitPrice) || 0;
          return {
            description: item.description.trim(),
            quantity: String(q),
            unitPrice: String(u),
            amount: q * u,
          };
        });
      if (!dueDate.trim()) {
        setError('Please select a date (expire date is required).');
        setIsSubmitting(false);
        return;
      }
      const expiry = new Date(dueDate.trim());
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      if (expiry < tomorrow) {
        setError('Expiry date must be tomorrow or later. Choosing today would make the invoice expire immediately.');
        setIsSubmitting(false);
        return;
      }
      const response = await invoiceApi.createInvoice({
        userId: user!.id,
        amount: grandTotal.toFixed(2),
        description: buildDescription(),
        customerEmail: customerEmail.trim() || undefined,
        customerName: customerName.trim() || undefined,
        dueDate: dueDate.trim(),
        businessName: businessName.trim() || undefined,
        businessAddress: businessAddress.trim() || undefined,
        lineItems: lineItemsPayload.length ? lineItemsPayload : undefined,
        vatPercent: vatP ? vatP : undefined,
        processingFeePercent: feeP ? feeP : undefined,
        currency: 'USD',
        isRecurring: recurrenceInterval !== 'NONE',
        recurrenceInterval: recurrenceInterval,
        recurrenceCustomDays: recurrenceInterval === 'CUSTOM' ? parseInt(recurrenceCustomDays, 10) || 14 : undefined,
        recurrenceEndDate: recurrenceEndDate || undefined,
        issueDate: issueDate,
      });
      if (response.success && response.data) {
        setCreatedInvoiceId(response.data.invoice_id?.toString() ?? null);
      } else {
        setError(response.error || 'Failed to create invoice');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || (typeof window !== 'undefined' ? window.location.origin : '');
  const invoiceLink = baseUrl && createdInvoiceId ? `${baseUrl.replace(/\/$/, '')}/invoices/${createdInvoiceId}` : '';

  const copyInvoiceLink = () => {
    if (invoiceLink) {
      navigator.clipboard.writeText(invoiceLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetForm = () => {
    setCreatedInvoiceId(null);
    setBusinessName('');
    setBusinessAddress('');
    setCustomerName('');
    setCustomerEmail('');
    setLineItems([defaultLineItem()]);
    setVatPercent('');
    setVatPercent('');
    setProcessingFeePercent('');
    setDueDate('');
    setRecurrenceEndDate('');
    setIssueDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const getFutureInvoices = () => {
    if (recurrenceInterval === 'NONE' || !dueDate || !recurrenceEndDate) return [];
    
    const instances: { date: Date; amount: number }[] = [];
    let current = new Date(dueDate);
    const end = new Date(recurrenceEndDate);
    const interval = recurrenceInterval === 'BI_WEEKLY' ? 14 : recurrenceInterval === 'MONTHLY' ? 30 : parseInt(recurrenceCustomDays) || 14;

    // Show up to 12 instances to prevent infinite loops or UI clutter
    while (isBefore(current, end) && instances.length < 12) {
      instances.push({ date: new Date(current), amount: grandTotal });
      if (recurrenceInterval === 'MONTHLY') {
        current = addMonths(current, 1);
      } else {
        current = addDays(current, interval);
      }
    }
    return instances;
  };

  const futureInvoices = getFutureInvoices();

  if (loading || !user) {
    return (
      <PremiumDashboardLayout>
        <PageLoader />
      </PremiumDashboardLayout>
    );
  }
  if (!user) return null;

  if (createdInvoiceId) {
    return (
      <PremiumDashboardLayout>
        <div className="max-w-2xl mx-auto py-8">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white mb-6">Invoice created</h2>
            <div className="flex flex-col gap-3 mb-6 sm:flex-row">
              <input
                type="text"
                value={invoiceLink}
                readOnly
                className="min-w-0 flex-1 bg-black/30 text-white px-4 py-3 rounded-lg border border-gray-700 text-sm font-mono"
              />
              <button
                onClick={copyInvoiceLink}
                className="w-full sm:w-auto px-5 py-3 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg shrink-0"
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => router.push(`/dashboard/invoices/${createdInvoiceId}`)} className="w-full sm:flex-1 py-3 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg">
              View invoice
            </button>
            <button type="button" onClick={() => router.push('/dashboard/invoices')} className="w-full sm:flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg">
              View all invoices
            </button>
            </div>
          </div>
        </div>
      </PremiumDashboardLayout>
    );
  }

  return (
    <PremiumDashboardLayout>
      <div className="w-full max-w-4xl mx-auto py-4 sm:py-6 md:py-8 min-w-0">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl font-bold text-white mb-1 sm:text-2xl">Create invoice</h1>
          <p className="text-gray-400 text-sm">Professional invoice with line items. Your customer pays via secure link; funds are held in escrow until completion.</p>
        </div>

        {error && <FormError message={error} />}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* From / To */}
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-white mb-4">From (your business)</h3>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Business email</label>
                  <input
                    type="email"
                    value={businessName}
                    readOnly
                    className={inputClass + ' opacity-70 cursor-not-allowed'}
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className={labelClass}>Address (optional)</label>
                  <input
                    type="text"
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. 23 Allen Avenue, Ikeja, Lagos"
                  />
                </div>
              </div>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-white mb-4">To (bill to)</h3>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Customer name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Folake Adeyemi"
                  />
                </div>
                <div>
                  <label className={labelClass}>Customer email</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. ngozi@company.com"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 sm:p-5 md:p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Invoice items</h3>
              <button
                type="button"
                onClick={addLineItem}
                className="text-sm font-medium text-teal-400 hover:text-teal-300 touch-manipulation"
              >
                + Add line
              </button>
            </div>
            <div className="overflow-x-auto -mx-1">
              <div className="space-y-3 min-w-[280px]">
              <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium">
                <div className="col-span-5 sm:col-span-6">Service / Description</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-3 sm:col-span-2 text-right">Unit price</div>
                <div className="col-span-2 text-right">Amount</div>
                <div className="col-span-1" />
              </div>
              {lineItems.map((item) => {
                const q = parseFloat(item.quantity) || 0;
                const u = parseFloat(item.unitPrice) || 0;
                const lineTotal = q * u;
                return (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5 sm:col-span-6">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                        className={inputClass}
                        placeholder="e.g. Consulting, design work, ad slot"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                        className={inputClass + ' text-right'}
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(item.id, 'unitPrice', e.target.value)}
                        className={inputClass + ' text-right'}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="col-span-2 text-right text-sm text-white font-medium">
                      {formatCurrency(lineTotal)}
                    </div>
                    <div className="col-span-1">
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        disabled={lineItems.length <= 1}
                        className="p-1.5 text-gray-500 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Remove line"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>

            {/* Totals */}
            <div className="mt-6 pt-4 border-t border-gray-800 max-w-xs ml-auto space-y-1.5">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Sub total</span>
                <span className="text-white">{formatCurrency(subtotal)}</span>
              </div>
              {vatP > 0 && (
                <div className="flex justify-between text-sm text-gray-400">
                  <span>VAT ({vatP}%)</span>
                  <span className="text-white">{formatCurrency(vatAmount)}</span>
                </div>
              )}
              {feeP > 0 && (
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Processing fee ({feeP}%)</span>
                  <span className="text-white">{formatCurrency(feeAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-gray-700 mt-2">
                <span>Grand total</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Recurring & Dates Redesign */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-white mb-6 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400" />
              Scheduling & Recurrence
            </h3>
            
            <div className="flex flex-wrap gap-6 mb-8">
              <div className="w-full sm:w-[240px]">
                <label className={labelClass}>Issue date</label>
                <DatePicker
                  value={issueDate}
                  onChange={setIssueDate}
                  placeholder="Select issue date"
                  className="py-3"
                />
              </div>
              <div className="w-full sm:w-[240px]">
                <label className={labelClass}>Due date</label>
                <DatePicker
                  value={dueDate}
                  onChange={setDueDate}
                  minDate={new Date(issueDate)}
                  placeholder="Select due date"
                  className="py-3"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6 mb-8">
              <div className="w-full sm:w-[240px]">
                <label className={labelClass}>Repeats</label>
                <RecurrenceSelect
                  value={recurrenceInterval}
                  onChange={setRecurrenceInterval}
                  referenceDate={dueDate}
                />
              </div>

              {recurrenceInterval === 'CUSTOM' && (
                <div className="w-full sm:w-[120px]">
                  <label className={labelClass}>Custom Days</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={recurrenceCustomDays}
                      onChange={(e) => setRecurrenceCustomDays(e.target.value.replace(/\D/g, ''))}
                      className={inputClass + ' pr-10'}
                      placeholder="14"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500 uppercase">Days</span>
                  </div>
                </div>
              )}
              
              {recurrenceInterval !== 'NONE' && (
                <div className="w-full sm:w-[240px] animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className={labelClass}>Ends</label>
                  <DatePicker
                    value={recurrenceEndDate}
                    onChange={setRecurrenceEndDate}
                    minDate={dueDate ? new Date(dueDate) : new Date()}
                    placeholder="Select end date"
                    className="py-3"
                  />
                </div>
              )}
            </div>

            {/* Preview Timeline */}
            {recurrenceInterval !== 'NONE' && futureInvoices.length > 0 && (
              <div className="mt-8 border border-gray-800 rounded-xl bg-black/40 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-sm">{futureInvoices.length}</span>
                    <span className="text-gray-400 text-sm">future invoices</span>
                  </div>
                  <div className="flex p-1 bg-black/40 rounded-lg border border-gray-800">
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-teal-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('calendar')}
                      className={`p-1.5 rounded-md transition-all ${viewMode === 'calendar' ? 'bg-teal-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {viewMode === 'list' ? (
                    <div className="space-y-6 relative before:absolute before:inset-0 before:left-[11px] before:w-[2px] before:bg-gray-800 before:pointer-events-none">
                      {futureInvoices.map((inv, idx) => (
                        <div key={idx} className="flex items-center justify-between group relative pl-8">
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-900 border-2 border-gray-800 flex items-center justify-center z-10 group-hover:border-teal-500 transition-colors">
                            <span className="text-[10px] font-bold text-gray-400 group-hover:text-teal-400">{idx + 1}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-white group-hover:text-teal-400 transition-colors">
                              {format(inv.date, 'eee, MMM d')} <span className="text-gray-500 font-normal">{format(inv.date, 'yyyy')}</span>
                            </span>
                          </div>
                          <div className="text-sm font-bold text-white">
                            {formatCurrency(inv.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Calendar className="w-12 h-12 text-gray-700 mx-auto mb-3 opacity-20" />
                      <p className="text-gray-500 text-sm">Visual calendar view coming soon...</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {recurrenceInterval !== 'NONE' && !recurrenceEndDate && (
              <div className="mt-4 p-4 rounded-lg bg-teal-500/5 border border-teal-500/20 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <p className="text-xs text-teal-400/80 leading-relaxed">
                  Select an <strong className="text-teal-400">Ends</strong> date to activate the recurring schedule and see the timeline of future payments.
                </p>
              </div>
            )}
          </div>

          {/* VAT, fee (optional) */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-white mb-6">Tax & Fees</h3>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>VAT (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={vatPercent}
                  onChange={(e) => setVatPercent(e.target.value)}
                  className={inputClass}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelClass}>Processing fee (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={processingFeePercent}
                  onChange={(e) => setProcessingFeePercent(e.target.value)}
                  className={inputClass}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <FormActions
            onCancel={() => router.back()}
            submitLabel="Create invoice & get payment link"
            isSubmitting={isSubmitting}
            submitDisabled={grandTotal <= 0 || !dueDate}
          />
        </form>
      </div>
    </PremiumDashboardLayout>
  );
}
