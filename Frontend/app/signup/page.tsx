'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import { authApi } from '@/lib/api/auth';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api/client';
import { Eye, EyeOff, Loader2, ShieldCheck, Zap, Check, Circle } from 'lucide-react';

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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen bg-transparent flex font-sans">

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-20 py-8 sm:py-12 relative overflow-hidden">

        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `radial-gradient(circle, #fff 1px, transparent 1px)`,
          backgroundSize: '30px 30px'
        }}></div>

        <div className="w-full max-w-lg relative z-10">

          <div className="mb-12 animate-fade-in">
            <div className="inline-flex items-center gap-3 mb-12 group">
              <img src="/logo.png" alt="HoldisPay" className="w-12 h-12" />
            </div>


            <div className="flex border-b border-white/10 mb-10">
              <Link
                href="/signin"
                className="pb-3 px-1 mr-8 text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200"
              >
                Sign In
              </Link>
              <span className="pb-3 px-1 text-sm font-semibold text-white border-b-2 border-brand-500 -mb-px cursor-default">
                Create Account
              </span>
            </div>

            <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
              Get started with HoldisPay
            </h1>
            <p className="text-gray-400 text-lg leading-relaxed">
              Create your free account and start managing invoices securely
            </p>
          </div>


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
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-white/10 transition-all duration-200 outline-none"
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
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-white/10 transition-all duration-200 outline-none"
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
                className={`w-full px-4 py-3.5 bg-white/5 border rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-white/10 transition-all duration-200 outline-none ${usernameStatus === 'taken' ? 'border-red-500/60' : 'border-white/10'
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
                <p className="mt-1 text-xs text-brand-400">{usernameMessage ?? 'Available'}</p>
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
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-white/10 transition-all duration-200 outline-none"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-300 mb-2">
                Phone number
              </label>
              <div className="flex bg-white/5 border border-white/10 rounded-lg transition-all duration-200 focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-transparent focus-within:bg-white/10 overflow-hidden">
                <span className="flex items-center justify-center px-4 shrink-0 bg-black/20 text-gray-400 border-r border-white/10 font-medium">
                  +234
                </span>
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  autoComplete="tel"
                  required
                  maxLength={10}
                  value={formData.phoneNumber.replace(/^\+234/, '')}
                  onKeyDown={(e) => {
                    if (!/[\d\b]/.test(e.key) && !['ArrowLeft', 'ArrowRight', 'Tab', 'Delete', 'Backspace'].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData({ ...formData, phoneNumber: '+234' + val });
                  }}
                  className="w-full px-4 py-3.5 bg-transparent text-white placeholder-gray-500 outline-none"
                  placeholder="800 000 0000"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-white/10 transition-all duration-200 outline-none pr-12"
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full ${i <= strength ? (strength <= 2 ? 'bg-red-500' : strength <= 4 ? 'bg-amber-500' : 'bg-brand-500') : 'bg-white/10'}`}
                    />
                  ))}
                </div>
                <ul className="text-xs text-gray-500 space-y-0.5">
                  <li className={`flex items-center gap-1.5 ${rules.length ? 'text-brand-400' : ''}`}>{rules.length ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />} At least {MIN_PASSWORD_LENGTH} characters</li>
                  <li className={`flex items-center gap-1.5 ${rules.uppercase ? 'text-brand-400' : ''}`}>{rules.uppercase ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />} One uppercase letter</li>
                  <li className={`flex items-center gap-1.5 ${rules.lowercase ? 'text-brand-400' : ''}`}>{rules.lowercase ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />} One lowercase letter</li>
                  <li className={`flex items-center gap-1.5 ${rules.number ? 'text-brand-400' : ''}`}>{rules.number ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />} One number</li>
                  <li className={`flex items-center gap-1.5 ${rules.symbol ? 'text-brand-400' : ''}`}>{rules.symbol ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />} One symbol (!@#$% etc.)</li>
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
                className={`w-full px-4 py-3.5 bg-white/5 border rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-white/10 transition-all duration-200 outline-none pr-12 ${passwordsMatch ? 'border-brand-500/50' : 'border-white/10'}`}
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
              className="w-full bg-brand-500 hover:bg-brand-600 text-white py-4 px-4 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0a0a] focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Creating your account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>

            <p className="text-xs text-gray-500 text-center leading-relaxed pt-2">
              By creating an account, you agree to our{' '}
              <Link href="/terms" className="text-brand-400 hover:text-brand-300 transition-colors">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-brand-400 hover:text-brand-300 transition-colors">
                Privacy Policy
              </Link>
            </p>
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
