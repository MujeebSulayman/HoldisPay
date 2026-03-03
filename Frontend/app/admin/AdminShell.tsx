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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const showShell = pathname && !['/admin', '/admin/login', '/admin/onboarding'].includes(pathname);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !pathname) return;
    if (!showShell) {
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

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/admin/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  if (!mounted) {
    return <div className="min-h-screen bg-[#0A0A0A]" />;
  }

  if (!showShell) {
    return <>{children}</>;
  }

  const navContent = (
    <>
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <Link href="/admin/dashboard" onClick={closeSidebar} className="text-lg font-bold text-white hover:text-teal-400 transition-colors">
          hol<span className="text-teal-400">D</span>is Admin
        </Link>
        <button
          type="button"
          onClick={closeSidebar}
          className="md:hidden p-2 text-gray-400 hover:text-white rounded-lg"
          aria-label="Close menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== '/admin/dashboard' && pathname?.startsWith(item.href + '/'));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeSidebar}
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
          onClick={() => {
            handleLogout();
            closeSidebar();
          }}
          className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Overlay on mobile when sidebar open */}
      {sidebarOpen && (
        <button
          type="button"
          onClick={closeSidebar}
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          aria-label="Close menu"
        />
      )}
      {/* Sidebar: drawer on mobile, always visible on md+ */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 w-56 bg-[#111111] border-r border-gray-800 flex flex-col shrink-0
          transform transition-transform duration-200 ease-out
          md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {navContent}
      </aside>
      {/* Main: header with menu button on mobile */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[#111111] border-b border-gray-800 shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-gray-400 hover:text-white rounded-lg"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link href="/admin/dashboard" className="text-lg font-bold text-white">
            hol<span className="text-teal-400">D</span>is Admin
          </Link>
        </div>
        {children}
      </main>
    </div>
  );
}
