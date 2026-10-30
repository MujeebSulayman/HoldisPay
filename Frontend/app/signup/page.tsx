'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { useAuth } from '@/lib/contexts/AuthContext';
import { authApi } from '@/lib/api/auth';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api/client';
import { Eye, EyeOff, Loader2, Check, Circle } from 'lucide-react';

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
    <AuthLayout mode="signup" title="Create your account" subtitle="Free to start. Set up your first invoice in minutes.">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-[var(--hp-dim)] mb-2">
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
                  className="hp-input"
                  placeholder="John"
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-[var(--hp-dim)] mb-2">
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
                  className="hp-input"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-[var(--hp-dim)] mb-2">
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
                className={`hp-input ${usernameStatus === 'taken' ? 'hp-input-error' : ''}`}
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
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-[var(--hp-dim)] mb-2">
                Phone number
              </label>
              <div className="hp-input flex !p-0 overflow-hidden">
                <span className="flex items-center justify-center px-4 shrink-0 text-[var(--hp-mute)] border-r border-[var(--hp-line)] font-medium">
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
                  className="w-full px-4 py-[13px] bg-transparent text-[var(--hp-fg)] placeholder:text-[var(--hp-mute)] outline-none"
                  placeholder="800 000 0000"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--hp-dim)] mb-2">
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
                  className="hp-input pr-12"
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
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--hp-dim)] mb-2">
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
                className={`hp-input pr-12 ${passwordsMatch ? 'hp-input-ok' : ''}`}
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
              className="hp-btn hp-btn-white w-full !h-[52px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
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
    </AuthLayout>
  );
}
