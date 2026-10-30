'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api/auth';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Check, Clock, X } from 'lucide-react';

const VERIFY_TIMEOUT_MS = 20_000;

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuth();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'timeout'>('loading');
  const [error, setError] = useState('');
  const timedOut = useRef(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid verification link');
      setStatus('error');
      return;
    }

    const timeoutId = setTimeout(() => {
      if (timedOut.current) return;
      timedOut.current = true;
      setStatus('timeout');
    }, VERIFY_TIMEOUT_MS);

    const verify = async () => {
      try {
        const res = await authApi.verifyEmail(token);
        if (timedOut.current) return;
        clearTimeout(timeoutId);
        if (res && (res as { success?: boolean }).success) {
          const data = (res as { data?: { user: unknown; accessToken: string; refreshToken: string } }).data;
          if (data?.accessToken && data?.refreshToken && data?.user) {
            setSession({
              user: data.user as { id: string; email: string; accountType: 'individual' | 'business'; firstName: string; lastName: string; tag?: string; phoneNumber: string | null; walletAddress: string; kycStatus: string; emailVerified: boolean; phoneVerified: boolean },
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
            });
          }
          setStatus('success');
          setTimeout(() => router.push('/dashboard'), 1500);
        } else {
          setError((res as { error?: string })?.error || 'Verification failed');
          setStatus('error');
        }
      } catch {
        if (timedOut.current) return;
        clearTimeout(timeoutId);
        setError('Invalid or expired link');
        setStatus('error');
      }
    };

    verify();
    return () => clearTimeout(timeoutId);
  }, [token, router, setSession]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center font-sans px-4 font-sans">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Verifying your email…</p>
        </div>
      </div>
    );
  }

  if (status === 'timeout') {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center font-sans px-4 font-sans">
        <div className="w-full max-w-md text-center">
          <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Taking longer than usual</h1>
          <p className="text-gray-400 mb-6">
            Your email may already be verified. Try opening your dashboard—if you can sign in, you&apos;re all set.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
          >
            Go to dashboard
          </Link>
          <p className="mt-4">
            <Link href="/signin" className="text-brand-400 hover:text-brand-300 text-sm">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center font-sans px-4 font-sans">
        <div className="w-full max-w-md text-center">
          <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Verification failed</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            href="/signin"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center font-sans px-4 font-sans">
      <div className="w-full max-w-md text-center">
        <div className="w-14 h-14 bg-brand-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-7 h-7 text-brand-400" />
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">Email verified</h1>
        <p className="text-gray-400 mb-6">Your email is confirmed. Taking you to your dashboard…</p>
        <Link
          href="/dashboard"
          className="text-brand-400 hover:text-brand-300 text-sm"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-transparent flex items-center justify-center font-sans">
          <div className="w-12 h-12 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
