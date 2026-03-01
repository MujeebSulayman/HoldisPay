'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

interface NavigationChild {
  name: string;
  href: string;
}

interface NavigationItem {
  name: string;
  href?: string;
  icon: React.ReactNode;
  children?: NavigationChild[];
}

const ADMIN_NAV: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/admin/dashboard',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
  },
  {
    name: 'Users',
    href: '/admin/users',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    name: 'Waitlist',
    href: '/admin/waitlist',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
];

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [adminUser, setAdminUser] = useState<{ email?: string; firstName?: string; lastName?: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');
    let user: { accountType?: string; email?: string; firstName?: string; lastName?: string } | null = null;
    try {
      if (userJson) user = JSON.parse(userJson);
    } catch {
      // ignore
    }
    if (!token || user?.accountType !== 'admin') {
      router.replace('/admin/login');
      return;
    }
    setAdminUser(user);
    setAuthChecked(true);
  }, [router]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) setMobileMenuOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/admin/login');
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-zinc-400 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {isMobile && mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 border-r border-gray-800 bg-[#0a0a0a] ${
          isMobile
            ? mobileMenuOpen
              ? 'translate-x-0 w-72'
              : '-translate-x-full w-72'
            : sidebarCollapsed
            ? 'w-20'
            : 'w-72'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center justify-between border-b border-gray-800">
            {(!sidebarCollapsed || isMobile) && (
              <Link href="/admin/dashboard" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-teal-400 rounded-lg flex items-center justify-center">
                  <span className="text-black font-bold text-sm">hD</span>
                </div>
                <span className="text-xl font-bold text-white">
                  hol<span className="text-teal-400">D</span>is <span className="text-gray-500 text-sm font-normal">Admin</span>
                </span>
              </Link>
            )}
            {!isMobile && (
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
              >
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto py-6 px-3">
            <nav className="space-y-1">
              {ADMIN_NAV.map((item) => {
                const isActive = item.href ? pathname === item.href : false;
                return (
                  <div key={item.name}>
                    <Link
                      href={item.href ?? '#'}
                      onClick={() => isMobile && setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative ${
                        isActive
                          ? 'bg-teal-400/10 text-teal-400 border border-teal-400/20'
                          : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-teal-400 rounded-r-full" />
                      )}
                      <div className="w-5 h-5 shrink-0">{item.icon}</div>
                      {(!sidebarCollapsed || isMobile) && (
                        <span className="font-medium">{item.name}</span>
                      )}
                    </Link>
                  </div>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-gray-800 p-3 shrink-0">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800/50 mb-2">
              <div className="w-10 h-10 bg-teal-400 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-black font-semibold text-sm">
                  {adminUser?.firstName?.charAt(0)}
                  {adminUser?.lastName?.charAt(0)}
                </span>
              </div>
              {(!sidebarCollapsed || isMobile) && (
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {adminUser?.firstName} {adminUser?.lastName}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{adminUser?.email}</p>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              {(!sidebarCollapsed || isMobile) && (
                <span className="text-sm font-medium">Sign Out</span>
              )}
            </button>
          </div>
        </div>
      </aside>

      <div className={`transition-all duration-300 ${isMobile ? 'ml-0' : sidebarCollapsed ? 'ml-20' : 'ml-72'}`}>
        <header className="sticky top-0 z-30 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-gray-800">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center justify-between">
              {isMobile && (
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors md:hidden"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </button>
              )}
              <div className="flex-1" />
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 min-w-0 w-full max-w-[1600px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
