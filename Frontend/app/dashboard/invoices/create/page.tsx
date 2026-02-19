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
  const [paymentLinkUrl, setPaymentLinkUrl] = useState('');
  const [copied, setCopied] = useState(false);
  
  const [formData, setFormData] = useState({
    payerAddress: '',
    receiverAddress: '',
    amount: '',
    tokenAddress: '',
    requiresDelivery: false,
    description: '',
    attachmentHash: '',
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
        userId: user!.id,
        payer: formData.payerAddress,
        receiver: formData.receiverAddress || user!.walletAddress,
        amount: (parseFloat(formData.amount) * 1e18).toString(),
        tokenAddress: formData.tokenAddress || '0x0000000000000000000000000000000000000000',
        requiresDelivery: formData.requiresDelivery,
        description: formData.description,
        attachmentHash: formData.attachmentHash || '',
      });

      if (response.success && response.data) {
        setPaymentLinkUrl(response.data.payment_link_url || '');
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

  const copyLink = () => {
    if (paymentLinkUrl) {
      navigator.clipboard.writeText(paymentLinkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <PremiumDashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </PremiumDashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  if (paymentLinkUrl) {
    return (
      <PremiumDashboardLayout>
        <div className="max-w-3xl mx-auto py-8 px-4">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-500/20 rounded-full mb-4">
                <svg className="w-8 h-8 text-teal-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Invoice Created Successfully</h2>
              <p className="text-gray-400">Share this payment link with your customer</p>
            </div>

            <div className="bg-black/40 border border-gray-800 rounded-xl p-6 mb-6">
              <label className="block text-sm font-medium text-gray-400 mb-3">Payment Link</label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={paymentLinkUrl}
                  readOnly
                  className="flex-1 bg-gray-800/50 text-white px-4 py-3 rounded-lg border border-gray-700 focus:outline-none font-mono text-sm"
                />
                <button
                  onClick={copyLink}
                  className="px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg transition-colors"
                >
                  {copied ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Copied
                    </span>
                  ) : (
                    'Copy Link'
                  )}
                </button>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <div className="text-sm text-gray-300">
                  <p className="font-medium text-blue-400 mb-1">Next Steps</p>
                  <p>Send this link to your customer. They can pay with crypto directly through the Blockradar payment gateway. You'll be notified once payment is received.</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPaymentLinkUrl('');
                  setFormData({
                    payerAddress: '',
                    receiverAddress: '',
                    amount: '',
                    tokenAddress: '',
                    requiresDelivery: false,
                    description: '',
                    attachmentHash: '',
                  });
                }}
                className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors"
              >
                Create Another
              </button>
              <button
                onClick={() => router.push('/dashboard/invoices')}
                className="flex-1 px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-xl transition-colors"
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
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Create Invoice</h1>
          <p className="text-gray-400">Generate a crypto payment invoice with automated settlement</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-5">Payment Details</h3>
            
            <div className="space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Amount (USDC) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-4 py-3 bg-black/30 text-white border border-gray-800 rounded-xl focus:outline-none focus:border-teal-500 transition-colors"
                    placeholder="100.00"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Token Address (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.tokenAddress}
                    onChange={(e) => setFormData({ ...formData, tokenAddress: e.target.value })}
                    className="w-full px-4 py-3 bg-black/30 text-white border border-gray-800 rounded-xl focus:outline-none focus:border-teal-500 transition-colors font-mono text-sm"
                    placeholder="0x... (Leave empty for native token)"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty to accept native token (ETH)</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Description *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-black/30 text-white border border-gray-800 rounded-xl focus:outline-none focus:border-teal-500 resize-none transition-colors"
                  placeholder="Brief description of services or products"
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-5">Recipient Information</h3>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Payer Wallet Address *
                </label>
                <input
                  type="text"
                  required
                  value={formData.payerAddress}
                  onChange={(e) => setFormData({ ...formData, payerAddress: e.target.value })}
                  className="w-full px-4 py-3 bg-black/30 text-white border border-gray-800 rounded-xl focus:outline-none focus:border-teal-500 transition-colors font-mono text-sm"
                  placeholder="0x..."
                />
                <p className="text-xs text-gray-500 mt-1">Customer's wallet address who will pay</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Receiver Wallet Address (Optional)
                </label>
                <input
                  type="text"
                  value={formData.receiverAddress}
                  onChange={(e) => setFormData({ ...formData, receiverAddress: e.target.value })}
                  className="w-full px-4 py-3 bg-black/30 text-white border border-gray-800 rounded-xl focus:outline-none focus:border-teal-500 transition-colors font-mono text-sm"
                  placeholder={user?.walletAddress || '0x...'}
                />
                <p className="text-xs text-gray-500 mt-1">Defaults to your wallet address</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-5">Additional Options</h3>
            
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.requiresDelivery}
                  onChange={(e) => setFormData({ ...formData, requiresDelivery: e.target.checked })}
                  className="mt-1 w-5 h-5 bg-black/30 border border-gray-800 rounded cursor-pointer checked:bg-teal-500 checked:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-colors"
                />
                <div className="flex-1">
                  <span className="text-white font-medium group-hover:text-teal-400 transition-colors">Requires Delivery Confirmation</span>
                  <p className="text-sm text-gray-500 mt-1">
                    Enable if payment should be held in escrow until delivery is confirmed by the payer
                  </p>
                </div>
              </label>

              {formData.requiresDelivery && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Attachment Hash (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.attachmentHash}
                    onChange={(e) => setFormData({ ...formData, attachmentHash: e.target.value })}
                    className="w-full px-4 py-3 bg-black/30 text-white border border-gray-800 rounded-xl focus:outline-none focus:border-teal-500 transition-colors font-mono text-sm"
                    placeholder="IPFS hash or document reference"
                  />
                  <p className="text-xs text-gray-500 mt-1">Hash of delivery proof documents or agreements</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors border border-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-teal-500 hover:bg-teal-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating Invoice...
                </span>
              ) : (
                'Create Invoice & Generate Payment Link'
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 bg-gray-900/30 border border-gray-800 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-teal-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-teal-400 mb-2">How It Works</p>
              <ul className="text-sm text-gray-400 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-teal-400 mt-0.5">•</span>
                  <span>Invoice is created on-chain with smart contract escrow</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-400 mt-0.5">•</span>
                  <span>Payment link is generated via Blockradar payment gateway</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-400 mt-0.5">•</span>
                  <span>Customer pays through secure hosted page</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-400 mt-0.5">•</span>
                  <span>Funds are automatically settled based on delivery requirements</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </PremiumDashboardLayout>
  );
}
