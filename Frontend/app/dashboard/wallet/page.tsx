'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WalletPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/wallet/deposit');
  }, [router]);
  return null;
}
