'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftRight, ChartColumn, ChevronDown, ChevronsLeft, ClipboardList, Clock, FileText, LogOut, Menu, Presentation, Settings, User, Users, Wallet, X } from 'lucide-react';

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
      <Presentation />
    ),
  },
  {
    name: 'Users',
    href: '/admin/users',
    icon: (
      <Users />
    ),
  },

  {
    name: 'Invoices',
    icon: (
      <FileText />
    ),
    children: [
      { name: 'All invoices', href: '/admin/invoices' },
      { name: 'Create invoice', href: '/admin/invoices/create' },
    ],
  },
  {
    name: 'Contracts',
    icon: (
      <ClipboardList />
    ),
    children: [
      { name: 'All contracts', href: '/admin/contracts' },
      { name: 'Create contract', href: '/admin/contracts/create' },
    ],
  },
  {
    name: 'Transactions',
    href: '/admin/transactions',
    icon: (
      <ArrowLeftRight />
    ),
  },
  {
    name: 'Wallets',
    href: '/admin/wallets',
    icon: (
      <Wallet />
    ),
  },
  {
    name: 'Analytics',
    href: '/admin/analytics',
    icon: (
      <ChartColumn />
    ),
  },
  {
    name: 'Waitlist',
    href: '/admin/waitlist',
    icon: (
      <User />
    ),
  },
  {
    name: 'Audit log',
    href: '/admin/audit-log',
    icon: (
      <Clock />
    ),
  },
  {
    name: 'Settings',
    href: '/admin/settings',
    icon: (
      <Settings />
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
    return <div className="min-h-screen bg-transparent" />;
  }

  if (!showShell) {
    return <>{children}</>;
  }

  const showLabels = !sidebarCollapsed || isMobile;

  return (
    <div className="min-h-screen bg-transparent font-sans">
      {isMobile && mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 border-r border-white/10 glass-strong ${
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
          <div className="p-4 flex items-center justify-between border-b border-white/10 min-h-18">
            {showLabels && (
              <Link
                href="/admin/dashboard"
                onClick={() => isMobile && setMobileMenuOpen(false)}
                className="flex items-center gap-2 min-w-0"
              >
                <img src="/logo.png" alt="HoldisPay" className="h-12 w-12" />
              </Link>
            )}
            {isMobile ? (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors shrink-0"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer shrink-0"
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <ChevronsLeft className={`w-5 h-5 text-zinc-400 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>

          <nav className={`flex-1 ${sidebarCollapsed && !isMobile ? 'overflow-visible' : 'overflow-y-auto'} py-4 px-3 space-y-0.5`}>
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
                      className={`relative flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all group ${
                        active ? 'bg-brand-400/10 text-brand-400' : 'text-zinc-400 hover:bg-white/[.06] hover:text-zinc-200'
                      }`}
                    >
                      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand-400 rounded-r-full" />}
                      <div className="w-5 h-5 min-w-5 min-h-5 shrink-0 flex items-center justify-center [&_svg]:size-5 [&_svg]:min-w-5 [&_svg]:min-h-5 [&_svg]:shrink-0 [&_svg]:block">{item.icon}</div>
                      <div className="absolute left-full ml-4 px-3 py-2 glass-strong border border-white/10 text-brand-400 text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-[0_0_20px_rgba(0,0,0,0.5)] translate-x-[-10px] group-hover:translate-x-0 pointer-events-none">
                        {item.name}
                      </div>
                    </Link>
                  );
                }
                return (
                  <div key={item.name} className="rounded-lg">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.name)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left min-w-0 ${
                          active ? 'bg-brand-400/10 text-brand-400' : 'text-zinc-400 hover:bg-white/[.06] hover:text-zinc-200'
                        }`}
                      >
                        {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand-400 rounded-r-full" />}
                        <div className="w-5 h-5 min-w-5 min-h-5 shrink-0 flex items-center justify-center [&_svg]:size-5 [&_svg]:min-w-5 [&_svg]:min-h-5 [&_svg]:shrink-0 [&_svg]:block">{item.icon}</div>
                        <span className="font-medium truncate flex-1">{item.name}</span>
                        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    {isOpen && item.children && (
                      <div className="ml-4 pl-3 border-l border-white/10 space-y-0.5 py-1">
                        {item.children.map((child) => {
                          const childActive = isChildActive(child, pathname);
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => isMobile && setMobileMenuOpen(false)}
                              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                                childActive
                                  ? 'bg-brand-400/10 text-brand-400 font-medium'
                                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[.06]'
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
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
                    linkActive ? 'bg-brand-400/10 text-brand-400 border border-brand-400/20' : 'text-zinc-400 hover:bg-white/[.06] hover:text-zinc-200'
                  }`}
                >
                  {linkActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand-400 rounded-r-full" />
                  )}
                  <div className="w-5 h-5 min-w-5 min-h-5 shrink-0 flex items-center justify-center [&_svg]:size-5 [&_svg]:min-w-5 [&_svg]:min-h-5 [&_svg]:shrink-0 [&_svg]:block">{item.icon}</div>
                  {showLabels ? (
                    <span className="font-medium">{item.name}</span>
                  ) : (
                    <div className="absolute left-full ml-4 px-3 py-2 glass-strong border border-white/10 text-brand-400 text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-[0_0_20px_rgba(0,0,0,0.5)] translate-x-[-10px] group-hover:translate-x-0 pointer-events-none">
                      {item.name}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-3 shrink-0">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              {showLabels && <span className="text-sm font-medium">Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      <div className={`transition-all duration-300 ${isMobile ? 'ml-0' : sidebarCollapsed ? 'ml-20' : 'ml-72'}`}>
        <header className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-xl border-b border-white/10">
          <div className="px-2 sm:px-4 md:px-6 py-3">
            <div className="flex items-center justify-between">
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors md:hidden"
                >
                  <Menu className="w-6 h-6" />
                </button>
              )}
              <div className="hidden md:block md:ml-auto">
                <span className="text-sm text-gray-500">Admin</span>
              </div>
            </div>
          </div>
        </header>

        <main className="px-2 py-4 sm:px-4 sm:py-6 min-w-0 w-full max-w-[1600px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
