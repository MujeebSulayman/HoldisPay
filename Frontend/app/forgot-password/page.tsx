'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api/client';
import { Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await apiClient.post('/api/auth/password-reset/request', { email });

      if (response.success) {
        toast.success('If an account exists, we sent reset instructions to your email');
        setSubmitted(true);
      } else {
        toast.error(getErrorMessage(response, 'Failed to send reset email'));
      }
    } catch (e) {
      toast.error(getErrorMessage(e, 'An unexpected error occurred'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full glass border border-white/10 rounded-lg p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-500/20 rounded-full mb-4">
              <Mail className="w-8 h-8 text-brand-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Check Your Email</h2>
            <p className="text-gray-400 text-sm">
              If an account exists with <span className="text-white font-medium">{email}</span>, we've sent password reset instructions.
            </p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-300">
              The reset link expires in <span className="text-blue-400 font-medium">1 hour</span>.
              If you don't see the email, check your spam folder.
            </p>
          </div>

          <Link
            href="/signin"
            className="block text-center px-6 py-3 bg-white/[0.08] hover:bg-white/[0.12] text-white font-medium rounded-lg transition-colors"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
          
            <img src="/logo.png" alt="HoldisPay" className="h-12 w-auto" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Forgot Password?</h1>
          <p className="text-gray-400">No worries, we'll send you reset instructions</p>
        </div>

        <div className="glass border border-white/10 rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-black/30 text-white border border-white/10 rounded-lg focus:outline-none focus:border-brand-500 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-white/[0.12] disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all"
            >
              {isSubmitting ? 'Sending...' : 'Send Reset Instructions'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link href="/signin" className="text-sm text-gray-400 hover:text-brand-400 transition-colors">
            ← Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
