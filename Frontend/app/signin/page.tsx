'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { useAuth } from '@/lib/contexts/AuthContext';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api/client';
import { CircleCheck, Eye, EyeOff, Loader2 } from 'lucide-react';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const verified = searchParams.get('verified') === '1';
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await login(formData);

    if (result.success) {
      router.push('/dashboard');
    } else {
      toast.error(getErrorMessage(result, 'Sign in failed'));
    }

    setLoading(false);
  };

  return (
    <AuthLayout mode="signin" title="Welcome back" subtitle="Sign in to manage your invoices and payments.">
          <form onSubmit={handleSubmit} className="space-y-6">
            {verified && (
              <div className="bg-brand-500/10 border border-brand-500/30 text-brand-400 px-4 py-4 rounded-lg flex items-start gap-3">
                <CircleCheck className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed">Your email is verified. You can sign in now.</p>
              </div>
            )}
            <div className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[var(--hp-dim)] mb-2">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="hp-input"
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="block text-sm font-medium text-[var(--hp-dim)]">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="hp-input pr-12"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="hp-btn hp-btn-white w-full !h-[52px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
    </AuthLayout>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-transparent flex items-center justify-center font-sans">
        <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
