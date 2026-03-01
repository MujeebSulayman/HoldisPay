'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';

function VerifyEmailGuardInner({ children }: { children: React.ReactNode }) {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const verifiedParam = searchParams.get('verified') === '1';

  useEffect(() => {
    if (loading) return;
    if (!user) return;

    if (verifiedParam) {
      refreshUser().then(() => {
        router.replace('/dashboard');
      });
      return;
    }

    if (!user.emailVerified) {
      router.replace('/verify-email-required');
    }
  }, [loading, user, verifiedParam, refreshUser, router]);

  if (user && !user.emailVerified && !verifiedParam) {
    return null;
  }

  return <>{children}</>;
}

export default function VerifyEmailGuard({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <VerifyEmailGuardInner>{children}</VerifyEmailGuardInner>
    </Suspense>
  );
}
