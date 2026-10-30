'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api/client';
import { CircleCheck, Eye, EyeOff, Loader2, ShieldCheck, Zap } from 'lucide-react';

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
    <div className="min-h-screen bg-transparent flex font-sans">

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-20 py-8 sm:py-12 relative overflow-hidden">

        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}></div>

        <div className="w-full max-w-md relative z-10">
          <div className="mb-12 animate-fade-in">
            <div className="inline-flex items-center gap-3 mb-12 group">
              <img src="/logo.png" alt="HoldisPay" className="w-14 h-14" />
            </div>

            {/* Auth mode tabs */}
            <div className="flex border-b border-white/10 mb-10">
              <span className="pb-3 px-1 mr-8 text-sm font-semibold text-white border-b-2 border-brand-500 -mb-px cursor-default">
                Sign In
              </span>
              <Link
                href="/signup"
                className="pb-3 px-1 text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200"
              >
                Create Account
              </Link>
            </div>

            <h1 className="text-4xl font-bold text-white mb-4 leading-tight">Welcome back</h1>
            <p className="text-gray-400 text-lg leading-relaxed">Sign in to manage your invoices and payments</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 animate-slide-up">
            {verified && (
              <div className="bg-brand-500/10 border border-brand-500/30 text-brand-400 px-4 py-4 rounded-lg flex items-start gap-3">
                <CircleCheck className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed">Your email is verified. You can sign in now.</p>
              </div>
            )}
            <div className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
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
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-white/10 transition-all duration-200 outline-none"
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300">
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
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-white/10 transition-all duration-200 outline-none pr-12"
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
              className="w-full bg-brand-500 hover:bg-brand-600 text-white py-4 px-4 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0a0a] focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

        </div>
      </div>


      <div className="hidden lg:flex lg:flex-1 bg-white/[0.06] items-center justify-center p-12 overflow-hidden border-l border-white/10 sticky top-0 h-screen">
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hexagons" x="0" y="0" width="100" height="87" patternUnits="userSpaceOnUse">
                <path d="M50 0L93.3 25L93.3 62L50 87L6.7 62L6.7 25L50 0Z" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hexagons)" />
          </svg>
        </div>

        <div className="max-w-lg text-white relative z-10 animate-fade-in-right">
          <div className="mb-8">
            <h2 className="text-5xl font-bold mb-6 leading-tight">
              No Complexity.<br />
              Just secure <span className="text-brand-400">invoice management</span>
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              Empower your business with blockchain-powered escrow protection. Create, track, and manage invoices with complete transparency and security.
            </p>
          </div>

          <div className="space-y-6 mt-12">
            <div className="flex items-start gap-4 p-4 glass-strong rounded-lg border border-gray-900 animate-slide-in-right" style={{ animationDelay: '0.1s' }}>
              <div className="mt-0.5 shrink-0 w-8 h-8 bg-brand-600/20 rounded-lg flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-white">Escrow Protection</h3>
                <p className="text-gray-400 text-sm">Funds secured until delivery confirmation</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 glass-strong rounded-lg border border-gray-900 animate-slide-in-right" style={{ animationDelay: '0.2s' }}>
              <div className="mt-0.5 shrink-0 w-8 h-8 bg-brand-600/20 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-white">Instant Settlement</h3>
                <p className="text-gray-400 text-sm">Accept payments with immediate processing</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 glass-strong rounded-lg border border-gray-900 animate-slide-in-right" style={{ animationDelay: '0.3s' }}>
              <div className="mt-0.5 shrink-0 w-8 h-8 bg-brand-600/20 rounded-lg flex items-center justify-center">
                <Eye className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-white">Full Transparency</h3>
                <p className="text-gray-400 text-sm">Track every transaction on the blockchain</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fade-in-right {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        .animate-slide-up {
          animation: slide-up 0.6s ease-out 0.1s both;
        }

        .animate-fade-in-right {
          animation: fade-in-right 0.8s ease-out;
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.6s ease-out both;
        }

        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
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
