'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import { authApi } from '@/lib/api/auth';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api/client';

const MIN_PASSWORD_LENGTH = 12;
const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

function passwordRules(password: string) {
  return {
    length: password.length >= MIN_PASSWORD_LENGTH,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
}

function strengthScore(password: string): number {
  const r = passwordRules(password);
  return [r.length, r.uppercase, r.lowercase, r.number, r.symbol].filter(Boolean).length;
}

export default function SignUpPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    username: '',
    accountType: 'individual',
    phoneNumber: '+234',
  });
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);

  const rules = useMemo(() => passwordRules(formData.password), [formData.password]);
  const allRulesPass = rules.length && rules.uppercase && rules.lowercase && rules.number && rules.symbol;
  const strength = strengthScore(formData.password);
  const passwordsMatch = formData.password === formData.confirmPassword && formData.confirmPassword.length > 0;

  const usernameValid = useMemo(() => {
    const u = formData.username.trim();
    if (u.length < USERNAME_MIN) return false;
    if (u.length > USERNAME_MAX) return false;
    return USERNAME_PATTERN.test(u);
  }, [formData.username]);

  const runUsernameCheck = useCallback(async (value: string) => {
    const u = value.trim();
    if (u.length < USERNAME_MIN || !USERNAME_PATTERN.test(u)) return;
    setUsernameStatus('checking');
    setUsernameMessage(null);
    try {
      const res = await authApi.checkUsername(u);
      const data = res && typeof res === 'object' && 'data' in res ? (res as { data?: { available: boolean; tag?: string; message?: string } }).data : undefined;
      if (data?.available) {
        setUsernameStatus('available');
        setUsernameMessage(data.tag ? `You'll be @${data.tag}` : null);
      } else {
        setUsernameStatus('taken');
        setUsernameMessage(data?.message ?? 'This name already exists');
      }
    } catch {
      setUsernameStatus('idle');
      setUsernameMessage(null);
    }
  }, []);

  useEffect(() => {
    const u = formData.username.trim();
    if (u.length === 0) {
      setUsernameStatus('idle');
      setUsernameMessage(null);
      return;
    }
    if (u.length < USERNAME_MIN || !USERNAME_PATTERN.test(u)) {
      setUsernameStatus('invalid');
      setUsernameMessage(u.length < USERNAME_MIN ? `At least ${USERNAME_MIN} characters` : 'Letters, numbers, underscore and hyphen only');
      return;
    }
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    setUsernameStatus('checking');
    setUsernameMessage(null);
    usernameDebounceRef.current = setTimeout(() => {
      usernameDebounceRef.current = null;
      runUsernameCheck(u);
    }, 300);
    return () => {
      if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    };
  }, [formData.username, runUsernameCheck]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!allRulesPass) {
      toast.error('Password does not meet all requirements.');
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    try {
      const { confirmPassword, ...rest } = formData;
      const result = await register({ ...rest, accountType: 'individual' });

      if (result.success) {
        toast.success(result.requiresEmailVerification ? 'Check your email to verify' : 'Account created');
        if (result.requiresEmailVerification) {
          const q = result.email ? `?email=${encodeURIComponent(result.email)}` : '';
          router.push(`/verify-email-required${q}`);
        } else if (result.user) {
          router.push('/dashboard');
        } else {
          router.push('/verify-email-required');
        }
      } else {
        toast.error(getErrorMessage(result, 'Sign up failed'));
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex font-sans">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-20 py-8 sm:py-12 relative overflow-hidden">
        {/* Subtle dots pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `radial-gradient(circle, #fff 1px, transparent 1px)`,
          backgroundSize: '30px 30px'
        }}></div>
        
        <div className="w-full max-w-lg relative z-10">
          {/* Header */}
          <div className="mb-12 animate-fade-in">
            <Link href="/" className="inline-flex items-center gap-3 mb-12 group">
              <div className="w-11 h-11 bg-teal-500 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20 transition-transform group-hover:scale-105">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <span className="text-2xl font-bold text-white">HoldisPay</span>
            </Link>
            
            <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
              Get started with HoldisPay
            </h1>
            <p className="text-gray-400 text-lg leading-relaxed">
              Create your free account and start managing invoices securely
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6 animate-slide-up">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-300 mb-2">
                  First name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent focus:bg-white/10 transition-all duration-200 outline-none"
                  placeholder="John"
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-300 mb-2">
                  Last name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent focus:bg-white/10 transition-all duration-200 outline-none"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                minLength={USERNAME_MIN}
                maxLength={USERNAME_MAX}
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.replace(/\s/g, '-') })}
                onBlur={() => {
                  const u = formData.username.trim();
                  if (u.length >= USERNAME_MIN && USERNAME_PATTERN.test(u)) runUsernameCheck(u);
                }}
                className={`w-full px-4 py-3.5 bg-white/5 border rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent focus:bg-white/10 transition-all duration-200 outline-none ${
                  usernameStatus === 'taken' ? 'border-red-500/60' : 'border-white/10'
                }`}
                placeholder="johndoe"
                aria-invalid={usernameStatus === 'taken' || usernameStatus === 'invalid'}
                aria-describedby={usernameStatus === 'taken' ? 'username-taken-msg' : undefined}
              />
              <p className="mt-1 text-xs text-gray-500">
                Your unique tag (e.g. @johndoe). {USERNAME_MIN}–{USERNAME_MAX} characters, letters, numbers, underscore or hyphen.
              </p>
              {usernameStatus === 'checking' && (
                <p className="mt-1 text-xs text-gray-400">Checking availability...</p>
              )}
              {usernameStatus === 'available' && (
                <p className="mt-1 text-xs text-teal-400">{usernameMessage ?? 'Available'}</p>
              )}
              {usernameStatus === 'taken' && (
                <p id="username-taken-msg" className="mt-1 text-sm text-red-400 font-medium" role="alert">
                  {usernameMessage ?? 'This name already exists'}
                </p>
              )}
              {usernameStatus === 'invalid' && formData.username.trim().length > 0 && (
                <p className="mt-1 text-xs text-red-400">{usernameMessage}</p>
              )}
            </div>

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
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent focus:bg-white/10 transition-all duration-200 outline-none"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-300 mb-2">
                Phone number
              </label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                autoComplete="tel"
                required
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent focus:bg-white/10 transition-all duration-200 outline-none"
                placeholder="+234 800 000 0000"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent focus:bg-white/10 transition-all duration-200 outline-none"
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              />
              <div className="mt-2 space-y-1.5">
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full ${i <= strength ? (strength <= 2 ? 'bg-red-500' : strength <= 4 ? 'bg-amber-500' : 'bg-teal-500') : 'bg-white/10'}`}
                    />
                  ))}
                </div>
                <ul className="text-xs text-gray-500 space-y-0.5">
                  <li className={rules.length ? 'text-teal-400' : ''}>{rules.length ? '✓' : '○'} At least {MIN_PASSWORD_LENGTH} characters</li>
                  <li className={rules.uppercase ? 'text-teal-400' : ''}>{rules.uppercase ? '✓' : '○'} One uppercase letter</li>
                  <li className={rules.lowercase ? 'text-teal-400' : ''}>{rules.lowercase ? '✓' : '○'} One lowercase letter</li>
                  <li className={rules.number ? 'text-teal-400' : ''}>{rules.number ? '✓' : '○'} One number</li>
                  <li className={rules.symbol ? 'text-teal-400' : ''}>{rules.symbol ? '✓' : '○'} One symbol (!@#$% etc.)</li>
                </ul>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className={`w-full px-4 py-3.5 bg-white/5 border rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent focus:bg-white/10 transition-all duration-200 outline-none ${passwordsMatch ? 'border-teal-500/50' : 'border-white/10'}`}
                placeholder="Confirm your password"
              />
              {formData.confirmPassword.length > 0 && !passwordsMatch && (
                <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={
                loading ||
                !allRulesPass ||
                !passwordsMatch ||
                !usernameValid ||
                usernameStatus === 'taken' ||
                usernameStatus === 'checking'
              }
              className="w-full bg-teal-500 hover:bg-teal-600 text-white py-4 px-4 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0a0a] focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating your account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>

            <p className="text-xs text-gray-500 text-center leading-relaxed pt-2">
              By creating an account, you agree to our{' '}
              <Link href="/terms" className="text-teal-400 hover:text-teal-300 transition-colors">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-teal-400 hover:text-teal-300 transition-colors">
                Privacy Policy
              </Link>
            </p>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[#0a0a0a] text-gray-500">Already have an account?</span>
              </div>
            </div>

            <Link
              href="/signin"
              className="block w-full text-center border border-white/10 text-gray-300 py-4 px-4 rounded-lg font-medium hover:bg-white/5 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0a0a] focus:ring-teal-500 transition-all duration-200"
            >
              Sign In Instead
            </Link>
          </form>
        </div>
      </div>

      {/* Right Side - Marketing */}
      <div className="hidden lg:flex lg:flex-1 bg-[#1a1a1a] items-center justify-center p-12 overflow-hidden border-l border-gray-800 sticky top-0 h-screen">
        {/* Geometric pattern background */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hexagons" x="0" y="0" width="100" height="87" patternUnits="userSpaceOnUse">
                <path d="M50 0L93.3 25L93.3 62L50 87L6.7 62L6.7 25L50 0Z" fill="none" stroke="currentColor" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hexagons)" />
          </svg>
        </div>

        <div className="max-w-lg text-white relative z-10 animate-fade-in-right">
          <div className="mb-8">
            <div className="inline-block px-3 py-1 mb-6 text-xs font-medium text-teal-400 bg-teal-950/50 rounded-full border border-teal-900">
              SECURE & TRANSPARENT
            </div>
            <h2 className="text-5xl font-bold mb-6 leading-tight">
              No Complexity.<br />
              Just secure <span className="text-teal-400">invoice management</span>
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              Empower your business with blockchain-powered escrow protection. Create, track, and manage invoices with complete transparency and security.
            </p>
          </div>

          <div className="space-y-6 mt-12">
            <div className="flex items-start gap-4 p-4 bg-[#161616] rounded-lg border border-gray-900 animate-slide-in-right" style={{ animationDelay: '0.1s' }}>
              <div className="mt-0.5 shrink-0 w-8 h-8 bg-teal-600/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-white">Escrow Protection</h3>
                <p className="text-gray-400 text-sm">Funds secured until delivery confirmation</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-[#161616] rounded-lg border border-gray-900 animate-slide-in-right" style={{ animationDelay: '0.2s' }}>
              <div className="mt-0.5 shrink-0 w-8 h-8 bg-teal-600/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-white">Instant Settlement</h3>
                <p className="text-gray-400 text-sm">Accept payments with immediate processing</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-[#161616] rounded-lg border border-gray-900 animate-slide-in-right" style={{ animationDelay: '0.3s' }}>
              <div className="mt-0.5 shrink-0 w-8 h-8 bg-teal-600/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
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
