import AdminDashboardLayout from '@/components/AdminDashboardLayout';

export const dynamic = 'force-dynamic';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminDashboardLayout>{children}</AdminDashboardLayout>;
}
