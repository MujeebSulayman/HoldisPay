'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { PageLoader } from '@/components/AppLoader';
import { invoiceApi } from '@/lib/api/invoice';
import { DatePicker } from '@/components/DatePicker';
import { FormSection, FormLabel, FormInput, FormError, FormActions } from '@/components/form';

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
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/signin');
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

  const invoiceLink = typeof window !== 'undefined' && createdInvoiceId
    ? `${window.location.origin}/invoices/${createdInvoiceId}`
    : '';

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
    setProcessingFeePercent('');
    setDueDate('');
  };

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
        <div className="max-w-2xl mx-auto py-8 px-4">
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
            <button type="button" onClick={resetForm} className="w-full sm:flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg">
              Create another
            </button>
            <button type="button" onClick={() => router.push('/dashboard/invoices')} className="w-full sm:flex-1 py-3 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg">
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
      <div className="w-full max-w-4xl mx-auto py-4 px-4 sm:py-6 sm:px-6 md:py-8 md:px-8 min-w-0">
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
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Business name</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black/30 text-white border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                    placeholder="e.g. Adeola & Co."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Address (optional)</label>
                  <input
                    type="text"
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black/30 text-white border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                    placeholder="e.g. 23 Allen Avenue, Ikeja, Lagos"
                  />
                </div>
              </div>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-white mb-4">To (bill to)</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Customer name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black/30 text-white border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                    placeholder="e.g. Folake Adeyemi"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Customer email</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black/30 text-white border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-teal-500"
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
                        className="w-full px-3 py-2 bg-black/30 text-white border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-teal-500"
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
                        className="w-full px-3 py-2 bg-black/30 text-white border border-gray-800 rounded-lg text-sm text-right focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(item.id, 'unitPrice', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 text-white border border-gray-800 rounded-lg text-sm text-right focus:outline-none focus:border-teal-500"
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

          {/* VAT, fee (optional); Date (required) */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Additional details</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">VAT (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={vatPercent}
                  onChange={(e) => setVatPercent(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/30 text-white border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Processing fee (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={processingFeePercent}
                  onChange={(e) => setProcessingFeePercent(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/30 text-white border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Date <span className="text-amber-400">*</span></label>
                <DatePicker
                  value={dueDate}
                  onChange={setDueDate}
                  minDate={new Date()}
                  placeholder="Select date"
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
