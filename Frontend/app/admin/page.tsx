'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminSetupStatus } from '@/lib/api/admin';

export default function AdminEntryPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (typeof window === 'undefined') return;
      const token = localStorage.getItem('token');
      const userJson = localStorage.getItem('user');
      let user: { accountType?: string } | null = null;
      try {
        if (userJson) user = JSON.parse(userJson);
      } catch {
        // ignore
      }
      if (token && user?.accountType === 'admin') {
        if (!cancelled) router.replace('/admin/dashboard');
        return;
      }
      const { setupComplete } = await getAdminSetupStatus();
      if (cancelled) return;
      if (!setupComplete) {
        router.replace('/admin/onboarding');
      } else {
        router.replace('/admin/login');
      }
    };

    run().finally(() => {
      if (!cancelled) setChecking(false);
    });
    return () => { cancelled = true; };
  }, [router]);

  if (!checking) return null;
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-zinc-400 text-sm">Loading…</div>
    </div>
  );
}
