'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WalletChainsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/withdraw');
  }, [router]);
  return null;
}
