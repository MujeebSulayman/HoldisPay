'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PremiumDashboardLayout from '@/components/PremiumDashboardLayout';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function WithdrawPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <PremiumDashboardLayout>
        <div className="max-w-4xl mx-auto min-w-0 py-8">
          <div className="animate-pulse h-8 w-48 bg-gray-800 rounded" />
          <div className="mt-6 h-32 bg-gray-800/50 rounded-lg" />
        </div>
      </PremiumDashboardLayout>
    );
  }

  return (
    <PremiumDashboardLayout>
      <div className="max-w-4xl mx-auto min-w-0 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Withdraw</h1>
          <p className="mt-1 text-sm text-gray-400">Withdrawal flow — to be designed.</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-8 text-center text-gray-500">
          Content will be planned and built here.
        </div>
      </div>
    </PremiumDashboardLayout>
  );
}
