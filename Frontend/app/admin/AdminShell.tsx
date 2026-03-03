'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const PROTECTED_PATHS = [
  '/admin/dashboard',
  '/admin/users',
  '/admin/invoices',
  '/admin/analytics',
  '/admin/wallets',
  '/admin/transactions',
  '/admin/contracts',
  '/admin/waitlist',
];

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/invoices', label: 'Invoices' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/wallets', label: 'Wallets' },
  { href: '/admin/transactions', label: 'Transactions' },
  { href: '/admin/contracts', label: 'Contracts' },
  { href: '/admin/waitlist', label: 'Waitlist' },
];

function isProtectedPath(path: string | null): boolean {
  if (!path) return false;
  return PROTECTED_PATHS.some((p) => path === p || path.startsWith(p + '/'));
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const showShell = pathname && !['/admin', '/admin/login', '/admin/onboarding'].includes(pathname);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !pathname) return;
    if (!showShell) {
      // Not a protected route, just render children (login, onboarding, or redirect from /admin)
      return;
    }
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (!token || !user) {
      router.replace('/admin/login');
      return;
    }
    try {
      const parsed = JSON.parse(user);
      if (parsed.accountType !== 'admin') {
        router.replace('/');
      }
    } catch {
      router.replace('/admin/login');
    }
  }, [mounted, pathname, showShell, router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/admin/login');
  };

  if (!mounted) {
    return <div className="min-h-screen bg-[#0A0A0A]" />;
  }

  if (!showShell) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Sidebar */}
      <aside className="w-56 bg-[#111111] border-r border-gray-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-800">
          <Link href="/admin/dashboard" className="text-lg font-bold text-white hover:text-teal-400 transition-colors">
            hol<span className="text-teal-400">D</span>is Admin
          </Link>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || (item.href !== '/admin/dashboard' && pathname?.startsWith(item.href + '/'));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                  active ? 'bg-teal-500/20 text-teal-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>
      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>
    </div>
  );
}
