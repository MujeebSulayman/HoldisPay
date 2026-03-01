import VerifyEmailGuard from './VerifyEmailGuard';

export const dynamic = 'force-dynamic';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VerifyEmailGuard>{children}</VerifyEmailGuard>;
}
