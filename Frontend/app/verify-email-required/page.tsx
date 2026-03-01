'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function VerifyEmailRequiredPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    const fromUrl = searchParams.get('email');
    if (fromUrl) {
      setEmail(fromUrl);
      return;
    }
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { email?: string };
          setEmail(parsed.email ?? '');
        } catch {
          //
        }
      }
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-14 h-14 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-7 h-7 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">Verify your email</h1>
        <p className="text-gray-400 mb-2">
          We sent a verification link to {email ? <span className="text-white font-medium">{email}</span> : 'your email'}.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Click the link in that email to continue. It may take a minute to arrive.
        </p>
        <Link
          href="/signin"
          className="inline-flex items-center justify-center px-5 py-2.5 bg-white/10 text-gray-300 rounded-lg hover:bg-white/15 transition-colors text-sm"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
