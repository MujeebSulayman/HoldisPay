'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAdminSetupStatus, createFirstAdmin } from '@/lib/api/admin';

const MIN_PASSWORD_LENGTH = 12;

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

export default function AdminOnboardingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [requiresSetupSecret, setRequiresSetupSecret] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    setupSecret: '',
    acceptedTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const rules = useMemo(() => passwordRules(formData.password), [formData.password]);
  const allRulesPass = rules.length && rules.uppercase && rules.lowercase && rules.number && rules.symbol;
  const strength = strengthScore(formData.password);
  const passwordsMatch = formData.password === formData.confirmPassword && formData.confirmPassword.length > 0;

  useEffect(() => {
    let cancelled = false;
    getAdminSetupStatus()
      .then(({ setupComplete, requiresSetupSecret: req }) => {
        if (!cancelled) {
          setAllowed(!setupComplete);
          setRequiresSetupSecret(req);
          if (setupComplete) router.replace('/admin/login');
        }
      })
      .catch(() => {
        if (!cancelled) setAllowed(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => { cancelled = true; };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.acceptedTerms) {
      setError('You must accept the administrative access acknowledgment.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!allRulesPass) {
      setError('Password does not meet all requirements.');
      return;
    }
    if (requiresSetupSecret && !formData.setupSecret.trim()) {
      setError('Setup secret is required. Set ADMIN_SETUP_SECRET on the server to require this.');
      return;
    }
    setLoading(true);
    const result = await createFirstAdmin({
      email: formData.email.trim(),
      password: formData.password,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      setupSecret: formData.setupSecret.trim() || undefined,
    });
    setLoading(false);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => router.push('/admin/login?created=1'), 2000);
    } else {
      setError(result.error ?? 'Setup failed');
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-zinc-400">Checking setup…</div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="text-center text-zinc-400">
          <p>Admin setup is already complete.</p>
          <Link href="/admin/login" className="mt-4 inline-block text-teal-400 hover:text-teal-300">Go to sign in</Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Admin account created</h1>
          <p className="text-zinc-400 text-sm">Redirecting you to sign in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Create admin account</h1>
          <p className="text-zinc-400 text-sm">Set up the first administrator for HoldisPay. Use a strong password and keep credentials secure.</p>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-zinc-300 mb-1.5">First name</label>
                <input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData((d) => ({ ...d, firstName: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-zinc-800/80 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Jane"
                  required
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-zinc-300 mb-1.5">Last name</label>
                <input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData((d) => ({ ...d, lastName: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-zinc-800/80 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
                className="w-full px-4 py-2.5 bg-zinc-800/80 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="admin@holdispay.xyz"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-1.5">Password</label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData((d) => ({ ...d, password: e.target.value }))}
                className="w-full px-4 py-2.5 bg-zinc-800/80 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                required
                minLength={MIN_PASSWORD_LENGTH}
              />
              <div className="mt-2 space-y-1.5">
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full ${i <= strength ? (strength <= 2 ? 'bg-red-500' : strength <= 4 ? 'bg-amber-500' : 'bg-teal-500') : 'bg-zinc-700'}`}
                    />
                  ))}
                </div>
                <ul className="text-xs text-zinc-500 space-y-0.5">
                  <li className={rules.length ? 'text-teal-400' : ''}>{rules.length ? '✓' : '○'} At least {MIN_PASSWORD_LENGTH} characters</li>
                  <li className={rules.uppercase ? 'text-teal-400' : ''}>{rules.uppercase ? '✓' : '○'} One uppercase letter</li>
                  <li className={rules.lowercase ? 'text-teal-400' : ''}>{rules.lowercase ? '✓' : '○'} One lowercase letter</li>
                  <li className={rules.number ? 'text-teal-400' : ''}>{rules.number ? '✓' : '○'} One number</li>
                  <li className={rules.symbol ? 'text-teal-400' : ''}>{rules.symbol ? '✓' : '○'} One symbol (!@#$% etc.)</li>
                </ul>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-300 mb-1.5">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData((d) => ({ ...d, confirmPassword: e.target.value }))}
                className={`w-full px-4 py-2.5 bg-zinc-800/80 border rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent ${passwordsMatch ? 'border-teal-500/50' : 'border-zinc-700'}`}
                placeholder="Repeat password"
                required
              />
              {formData.confirmPassword.length > 0 && !passwordsMatch && (
                <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
              )}
            </div>

            <div>
              <label htmlFor="setupSecret" className="block text-sm font-medium text-zinc-300 mb-1.5">
                Setup secret {requiresSetupSecret ? '(required)' : '(optional)'}
              </label>
              <input
                id="setupSecret"
                type="password"
                value={formData.setupSecret}
                onChange={(e) => setFormData((d) => ({ ...d, setupSecret: e.target.value }))}
                className="w-full px-4 py-2.5 bg-zinc-800/80 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder={requiresSetupSecret ? 'Enter the setup secret from your server env' : 'Only if ADMIN_SETUP_SECRET is set on server'}
                required={requiresSetupSecret}
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.acceptedTerms}
                onChange={(e) => setFormData((d) => ({ ...d, acceptedTerms: e.target.checked }))}
                className="mt-1 rounded border-zinc-600 bg-zinc-800 text-teal-500 focus:ring-teal-500"
              />
              <span className="text-sm text-zinc-400">
                I understand that this account will have full administrative access to the platform. I will keep the credentials secure and use them only for authorized administration.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !allRulesPass || !passwordsMatch || !formData.acceptedTerms || (requiresSetupSecret && !formData.setupSecret.trim())}
              className="w-full py-3 rounded-lg bg-teal-500 text-black font-semibold hover:bg-teal-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating…' : 'Create admin account'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-zinc-500 text-sm">
          Already have an account?{' '}
          <Link href="/admin/login" className="text-teal-400 hover:text-teal-300">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
