'use client';

import { usePathname } from 'next/navigation';
import AdminDashboardLayout from '@/components/AdminDashboardLayout';

const NO_SIDEBAR_PATHS = ['/admin/login', '/admin/onboarding', '/admin'];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const useSidebar = pathname != null && !NO_SIDEBAR_PATHS.includes(pathname);

  if (useSidebar) {
    return <AdminDashboardLayout>{children}</AdminDashboardLayout>;
  }
  return <>{children}</>;
}
