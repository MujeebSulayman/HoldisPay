'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { invoiceApi } from '@/lib/api/invoice';

export default function CreateInvoicePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState<any>(null);
  const [formData, setFormData] = useState({
    customerEmail: '',
    customerName: '',
    amount: '',
    currency: 'USDC',
    description: '',
    dueDate: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await invoiceApi.createInvoice({
        amount: formData.amount,
        currency: formData.currency,
        customerEmail: formData.customerEmail,
        customerName: formData.customerName || undefined,
        description: formData.description,
        dueDate: formData.dueDate || undefined,
      });

      if (response.success) {
        setSuccess(true);
        setGeneratedInvoice(response.data);
      } else {
        setError(response.error || 'Failed to create invoice');
      }
    } catch (error) {
      console.error('Failed to create invoice:', error);
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAnother = () => {
    setSuccess(false);
    setGeneratedInvoice(null);
    setFormData({
      customerEmail: '',
      customerName: '',
      amount: '',
      currency: 'USDC',
      description: '',
      dueDate: '',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (success && generatedInvoice) {
    return (
      <PremiumDashboardLayout>
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="bg-gradient-to-br from-teal-500/10 via-blue-500/10 to-purple-500/10 border border-teal-400/20 rounded-3xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-teal-400/20 rounded-full mb-4">
                <svg className="w-10 h-10 text-teal-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">Invoice Created!</h2>
              <p className="text-gray-400">Your invoice has been generated and is ready to share</p>
            </div>

            <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6 space-y-4 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-500 text-sm mb-1">Invoice To</p>
                  <p className="text-white font-medium">{generatedInvoice.customer_name || 'N/A'}</p>
                  <p className="text-gray-400 text-sm">{generatedInvoice.customer_email}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500 text-sm mb-1">Amount</p>
                  <p className="text-3xl font-bold text-teal-400">{generatedInvoice.amount}</p>
                  <p className="text-gray-400 text-sm">{formData.currency}</p>
                </div>
              </div>

              <div className="border-t border-gray-800 pt-4">
                <p className="text-gray-500 text-sm mb-2">Description</p>
                <p className="text-white">{generatedInvoice.description}</p>
              </div>

              {generatedInvoice.payment_link_url && (
                <div className="border-t border-gray-800 pt-4">
                  <p className="text-gray-500 text-sm mb-2">Payment Link</p>
                  <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg p-3">
                    <input
                      type="text"
                      value={generatedInvoice.payment_link_url}
                      readOnly
                      className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedInvoice.payment_link_url);
                      }}
                      className="px-3 py-1 bg-teal-400/10 hover:bg-teal-400/20 text-teal-400 rounded-lg text-sm transition-colors cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-800 pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 mb-1">Status</p>
                    <span className="inline-flex px-3 py-1 bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 rounded-lg text-xs font-medium capitalize">
                      {generatedInvoice.status}
                    </span>
                  </div>
                  {formData.dueDate && (
                    <div>
                      <p className="text-gray-500 mb-1">Due Date</p>
                      <p className="text-white">{new Date(formData.dueDate).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCreateAnother}
                className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors cursor-pointer"
              >
                Create Another
              </button>
              <button
                onClick={() => router.push('/dashboard/invoices')}
                className="flex-1 px-6 py-3 bg-teal-400 hover:bg-teal-500 text-black font-medium rounded-xl transition-colors cursor-pointer"
              >
                View All Invoices
              </button>
            </div>
          </div>
        </div>
      </PremiumDashboardLayout>
    );
  }

  return (
    <PremiumDashboardLayout>
      <div className="max-w-5xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Create New Invoice</h2>
          <p className="text-gray-400">Generate a payment invoice and get paid in crypto</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {error && (
              <div className="mb-6 bg-red-400/10 border border-red-400/20 rounded-xl p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer Information */}
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-teal-400/10 rounded-lg">
                    <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white">Customer Details</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                      className="w-full px-4 py-3 bg-black/30 text-white border border-gray-800 rounded-xl focus:outline-none focus:border-teal-400 transition-colors"
                      placeholder="customer@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Full Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full px-4 py-3 bg-black/30 text-white border border-gray-800 rounded-xl focus:outline-none focus:border-teal-400 transition-colors"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-400/10 rounded-lg">
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white">Payment Information</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Amount *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={formData.amount}
                          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                          className="w-full px-4 py-3 bg-black/30 text-white border border-gray-800 rounded-xl focus:outline-none focus:border-teal-400 transition-colors"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Currency *
                      </label>
                      <select
                        required
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        className="w-full px-4 py-3 bg-black/30 text-white border border-gray-800 rounded-xl focus:outline-none focus:border-teal-400 transition-colors cursor-pointer"
                      >
                        <option value="USDC">USDC</option>
                        <option value="ETH">ETH</option>
                        <option value="USDT">USDT</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Description *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-3 bg-black/30 text-white border border-gray-800 rounded-xl focus:outline-none focus:border-teal-400 resize-none transition-colors"
                      placeholder="What is this invoice for? (e.g., Web development services, Product order #12345)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Due Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="w-full px-4 py-3 bg-black/30 text-white border border-gray-800 rounded-xl focus:outline-none focus:border-teal-400 transition-colors cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-400 to-blue-400 hover:from-teal-500 hover:to-blue-500 text-black font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    'Create Invoice'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Preview Sidebar */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-teal-500/10 via-blue-500/10 to-purple-500/10 border border-teal-400/20 rounded-2xl p-6 sticky top-8">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h3 className="text-lg font-bold text-white">Live Preview</h3>
              </div>

              <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 space-y-4">
                <div>
                  <p className="text-gray-500 text-xs mb-1">Billing To</p>
                  <p className="text-white font-medium text-sm">
                    {formData.customerEmail || 'customer@example.com'}
                  </p>
                  {formData.customerName && (
                    <p className="text-gray-400 text-xs">{formData.customerName}</p>
                  )}
                </div>

                <div className="border-t border-gray-800 pt-4">
                  <p className="text-gray-500 text-xs mb-2">Invoice Amount</p>
                  <p className="text-2xl font-bold text-teal-400">
                    {formData.amount || '0.00'}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">{formData.currency}</p>
                </div>

                {formData.description && (
                  <div className="border-t border-gray-800 pt-4">
                    <p className="text-gray-500 text-xs mb-2">Description</p>
                    <p className="text-white text-sm line-clamp-3">{formData.description}</p>
                  </div>
                )}

                {formData.dueDate && (
                  <div className="border-t border-gray-800 pt-4">
                    <p className="text-gray-500 text-xs mb-1">Due Date</p>
                    <p className="text-white text-sm">
                      {new Date(formData.dueDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <div>
                  <p className="text-blue-400 font-medium text-sm mb-1">Quick Tip</p>
                  <p className="text-gray-400 text-xs">
                    After creating the invoice, you'll get a payment link to share with your customer. They can pay with crypto instantly!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PremiumDashboardLayout>
  );
}
