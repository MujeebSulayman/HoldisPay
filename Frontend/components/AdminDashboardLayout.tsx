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
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    children: [
      { name: 'All users', href: '/admin/users' },
    ],
  },
  {
    name: 'Invoices',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    children: [
      { name: 'All invoices', href: '/admin/invoices' },
      { name: 'Failed / stuck', href: '/admin/invoices?filter=failed' },
    ],
  },
  {
    name: 'Payments',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
    children: [
      { name: 'Transactions', href: '/admin/transactions' },
    ],
  },
  {
    name: 'Contracts',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    children: [
      { name: 'All contracts', href: '/admin/contracts' },
    ],
  },
  {
    name: 'Wallets',
    href: '/admin/wallets',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
      </svg>
    ),
  },
  {
    name: 'Waitlist',
    href: '/admin/waitlist',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    name: 'Audit log',
    href: '/admin/audit-log',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    name: 'Settings',
    href: '/admin/settings',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const NO_SHELL_PATHS = ['/admin', '/admin/login', '/admin/onboarding'];

function isParentActive(item: NavigationItem, pathname: string | null): boolean {
  if (item.href && pathname === item.href) return true;
  if (item.children) {
    return item.children.some((c) => pathname === c.href || (pathname?.startsWith(c.href) && c.href !== '/admin/dashboard'));
  }
  return false;
}

function isChildActive(child: NavigationChild, pathname: string | null): boolean {
  if (pathname === child.href) return true;
  if (child.href !== '/admin/dashboard' && pathname?.startsWith(child.href)) return true;
  return false;
}

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
  const [mounted, setMounted] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const showShell = pathname && !NO_SHELL_PATHS.includes(pathname);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const next = new Set(expandedKeys);
    ADMIN_NAV.forEach((item) => {
      if (item.children && item.children.some((c) => isChildActive(c, pathname))) {
        next.add(item.name);
      }
    });
    setExpandedKeys(next);
  }, [pathname]);

  useEffect(() => {
    if (!mounted || !pathname || !showShell) return;
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');
    if (!token || !userJson) {
      router.replace('/admin/login');
      return;
    }
    try {
      const user = JSON.parse(userJson);
      if (user.accountType !== 'admin') {
        router.replace('/');
      }
    } catch {
      router.replace('/admin/login');
    }
  }, [mounted, pathname, showShell, router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setMobileMenuOpen(false);
    router.push('/admin/login');
  };

  const toggleExpand = (name: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (!mounted) {
    return <div className="min-h-screen bg-[#0A0A0A]" />;
  }

  if (!showShell) {
    return <>{children}</>;
  }

  const showLabels = !sidebarCollapsed || isMobile;

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
          <div className="p-4 flex items-center justify-between border-b border-gray-800 min-h-18">
            {showLabels && (
              <Link
                href="/admin/dashboard"
                onClick={() => isMobile && setMobileMenuOpen(false)}
                className="flex items-center gap-2 min-w-0"
              >
                <div className="w-9 h-9 bg-teal-400 rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-black font-bold text-sm">hD</span>
                </div>
                <span className="text-lg font-bold text-white truncate">
                  hol<span className="text-teal-400">D</span>is <span className="text-gray-500 text-xs font-normal">Admin</span>
                </span>
              </Link>
            )}
            {!isMobile && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer shrink-0"
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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

          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
            {ADMIN_NAV.map((item) => {
              const hasChildren = item.children && item.children.length > 0;
              const isOpen = expandedKeys.has(item.name);
              const active = isParentActive(item, pathname);

              if (hasChildren) {
                const firstHref = item.children![0].href;
                const collapsedNav = sidebarCollapsed && !isMobile;
                if (collapsedNav) {
                  return (
                    <Link
                      key={item.name}
                      href={firstHref}
                      title={item.name}
                      className={`relative flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all ${
                        active ? 'bg-teal-400/10 text-teal-400' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                      }`}
                    >
                      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-teal-400 rounded-r-full" />}
                      <div className="w-5 h-5 shrink-0">{item.icon}</div>
                    </Link>
                  );
                }
                return (
                  <div key={item.name} className="rounded-lg overflow-hidden">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.name)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left min-w-0 ${
                          active ? 'bg-teal-400/10 text-teal-400' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                        }`}
                      >
                        {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-teal-400 rounded-r-full" />}
                        <div className="w-5 h-5 shrink-0 flex items-center justify-center">{item.icon}</div>
                        <span className="font-medium truncate flex-1">{item.name}</span>
                        <svg
                          className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    {isOpen && item.children && (
                      <div className="ml-4 pl-3 border-l border-gray-800 space-y-0.5 py-1">
                        {item.children.map((child) => {
                          const childActive = isChildActive(child, pathname);
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => isMobile && setMobileMenuOpen(false)}
                              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                                childActive
                                  ? 'bg-teal-400/10 text-teal-400 font-medium'
                                  : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/50'
                              }`}
                            >
                              {child.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const linkActive = item.href && (pathname === item.href || (pathname?.startsWith(item.href + '/') && item.href !== '/admin/dashboard'));
              return (
                <Link
                  key={item.name}
                  href={item.href ?? '#'}
                  onClick={() => isMobile && setMobileMenuOpen(false)}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    linkActive ? 'bg-teal-400/10 text-teal-400 border border-teal-400/20' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                  }`}
                >
                  {linkActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-teal-400 rounded-r-full" />
                  )}
                  <div className="w-5 h-5 shrink-0">{item.icon}</div>
                  {showLabels && <span className="font-medium">{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-gray-800 p-3 shrink-0">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              {showLabels && <span className="text-sm font-medium">Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      <div className={`transition-all duration-300 ${isMobile ? 'ml-0' : sidebarCollapsed ? 'ml-20' : 'ml-72'}`}>
        <header className="sticky top-0 z-30 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-gray-800">
          <div className="px-4 md:px-6 py-3">
            <div className="flex items-center justify-between">
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors md:hidden"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </button>
              )}
              <div className="hidden md:block md:ml-auto">
                <span className="text-sm text-gray-500">Admin</span>
              </div>
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
