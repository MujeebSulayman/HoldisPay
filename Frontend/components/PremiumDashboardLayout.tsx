'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import { ArrowLeftRight, Bell, Check, ChevronDown, ChevronsLeft, ClipboardList, Copy, FileText, LogOut, Menu, Presentation, Settings, Upload, User } from 'lucide-react';

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

export default function PremiumDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [tagCopied, setTagCopied] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const touchStartedOnOverlayRef = useRef(false);

  const copyTag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user?.tag) return;
    navigator.clipboard.writeText(user.tag);
    setTagCopied(true);
    setTimeout(() => setTagCopied(false), 2000);
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setMobileMenuOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile && mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, mobileMenuOpen]);

  // Auto-expand parent if child is active
  useEffect(() => {
    const itemsToExpand: string[] = [];
    navigation.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some(child => {
          if (child.href.includes('?')) {
            const [path, query] = child.href.split('?');
            const childParams = new URLSearchParams(query);
            const currentTab = searchParams.get('tab') || 'general';
            return pathname === path && currentTab === childParams.get('tab');
          }
          return pathname === child.href;
        });
        if (hasActiveChild && !expandedItems.includes(item.name)) {
          itemsToExpand.push(item.name);
        }
      }
    });
    if (itemsToExpand.length > 0) {
      setExpandedItems(prev => [...prev, ...itemsToExpand]);
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev =>
      prev.includes(itemName)
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    );
  };

  const navigation: NavigationItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: (
        <Presentation />
      ),
    },

    {
      name: 'Invoices',
      icon: (
        <FileText />
      ),
      children: [
        { name: 'All Invoices', href: '/dashboard/invoices' },
        { name: 'Create Invoice', href: '/dashboard/invoices/create' },
      ],
    },
    {
      name: 'Contracts',
      icon: (
        <ClipboardList />
      ),
      children: [
        { name: 'All Contracts', href: '/dashboard/contracts' },
        { name: 'Create Contract', href: '/dashboard/contracts/create' },
      ],
    },
    {
      name: 'Withdraw',
      href: '/dashboard/withdraw',
      icon: (
        <Upload />
      ),
    },
    {
      name: 'Transactions',
      href: '/dashboard/transactions',
      icon: (
        <ArrowLeftRight />
      ),
    },
    {
      name: 'Settings',
      icon: (
        <Settings />
      ),
      children: [
        { name: 'Profile', href: '/dashboard/settings?tab=general' },
        { name: 'Payment Methods', href: '/dashboard/settings?tab=payment-methods' },
        { name: 'Security', href: '/dashboard/settings?tab=security' },
        { name: 'KYC Verification', href: '/dashboard/settings?tab=kyc' },
      ],
    },
  ];

  const handleLogout = () => {
    logout();
    router.push('/signin');
  };

  return (
    <div className="min-h-screen bg-transparent font-sans">
      {/* Mobile overlay */}
      {isMobile && mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] md:hidden"
          onTouchStart={() => { touchStartedOnOverlayRef.current = true; }}
          onClick={() => {
            if (touchStartedOnOverlayRef.current) setMobileMenuOpen(false);
            touchStartedOnOverlayRef.current = false;
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        onTouchStart={() => { touchStartedOnOverlayRef.current = false; }}
        className={`fixed top-0 left-0 z-[70] transition-all duration-300 border-r border-white/10 glass-strong ${isMobile
          ? `max-h-dvh h-dvh w-72 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`
          : `h-screen ${sidebarCollapsed ? 'w-20' : 'w-72'}`
          }`}
      >
        <div className="h-full flex flex-col min-h-0">
          <div className="shrink-0 p-4 sm:p-6 flex items-center justify-between border-b border-white/10">
            {(!sidebarCollapsed || isMobile) && (
              <img src="/logo.png" alt="HoldisPay" className="h-12 w-12" />
            )}
            {!isMobile && (
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer"
              >
                <ChevronsLeft className={`w-5 h-5 text-zinc-400 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''
                    }`} />
              </button>
            )}
          </div>

          <div className={`flex-1 min-h-0 py-6 px-3 ${sidebarCollapsed && !isMobile ? 'overflow-visible' : 'overflow-y-auto'}`}>
            <nav className="space-y-1">
              {navigation.map((item) => {
                const isActive = item.href && pathname === item.href;
                const isExpanded = expandedItems.includes(item.name);
                const hasChildren = item.children && item.children.length > 0;
                const hasActiveChild = hasChildren && item.children?.some(child => {
                  if (child.href.includes('?')) {
                    const [path, query] = child.href.split('?');
                    const childParams = new URLSearchParams(query);
                    const currentTab = searchParams.get('tab') || 'general';
                    return pathname === path && currentTab === childParams.get('tab');
                  }
                  return pathname === child.href;
                });

                return (
                  <div key={item.name}>
                    {/* Parent Item */}
                    {hasChildren ? (
                      <button
                        onClick={() => {
                          if (!sidebarCollapsed || isMobile) {
                            toggleExpanded(item.name);
                          } else if (item.children?.[0]?.href) {
                            router.push(item.children[0].href);
                          }
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative cursor-pointer ${hasActiveChild
                          ? 'bg-brand-400/10 text-brand-400 border border-brand-400/20'
                          : 'text-zinc-400 hover:bg-white/[.06] hover:text-zinc-200'
                          }`}
                      >
                        {hasActiveChild && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand-400 rounded-r-full" />
                        )}
                        <div className="w-5 h-5 min-w-5 min-h-5 shrink-0 flex items-center justify-center [&_svg]:size-5 [&_svg]:min-w-5 [&_svg]:min-h-5 [&_svg]:shrink-0 [&_svg]:block">{item.icon}</div>
                        {(!sidebarCollapsed || isMobile) ? (
                          <>
                            <span className="font-medium flex-1 text-left">{item.name}</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </>
                        ) : (
                          <div className="absolute left-full ml-4 px-3 py-2 glass-strong border border-white/10 text-brand-400 text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-[0_0_20px_rgba(0,0,0,0.5)] translate-x-[-10px] group-hover:translate-x-0 pointer-events-none">
                            {item.name}
                          </div>
                        )}
                      </button>
                    ) : (
                      <Link
                        href={item.href || '#'}
                        onClick={() => isMobile && setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative ${isActive
                          ? 'bg-brand-400/10 text-brand-400 border border-brand-400/20'
                          : 'text-zinc-400 hover:bg-white/[.06] hover:text-zinc-200'
                          }`}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-brand-400 rounded-r-full" />
                        )}
                        <div className="w-5 h-5 min-w-5 min-h-5 shrink-0 flex items-center justify-center [&_svg]:size-5 [&_svg]:min-w-5 [&_svg]:min-h-5 [&_svg]:shrink-0 [&_svg]:block">{item.icon}</div>
                        {(!sidebarCollapsed || isMobile) ? (
                          <span className="font-medium">{item.name}</span>
                        ) : (
                          <div className="absolute left-full ml-4 px-3 py-2 glass-strong border border-white/10 text-brand-400 text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-[0_0_20px_rgba(0,0,0,0.5)] translate-x-[-10px] group-hover:translate-x-0 pointer-events-none">
                            {item.name}
                          </div>
                        )}
                      </Link>
                    )}

                    {/* Children Items */}
                    {hasChildren && isExpanded && (!sidebarCollapsed || isMobile) && (
                      <div className="mt-1 ml-8 space-y-1">
                        {item.children?.map((child) => {
                          let isChildActive = false;
                          if (child.href.includes('?')) {
                            const [path, query] = child.href.split('?');
                            const childParams = new URLSearchParams(query);
                            const currentTab = searchParams.get('tab') || 'general';
                            isChildActive = pathname === path && currentTab === childParams.get('tab');
                          } else {
                            isChildActive = pathname === child.href;
                          }
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => isMobile && setMobileMenuOpen(false)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all relative ${isChildActive
                                ? 'text-brand-400 bg-brand-400/5'
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[.04]'
                                }`}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${isChildActive ? 'bg-brand-400' : 'bg-zinc-600'}`} />
                              <span>{child.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Mobile: profile + sign out in sidebar — sticky at bottom, safe-area aware */}
          {isMobile && (
            <div
              className="shrink-0 border-t border-white/10 px-3 pt-3 space-y-1"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[.06] min-w-0">
                <div className="w-10 h-10 rounded-lg bg-brand-400 flex items-center justify-center shrink-0">
                  <span className="text-black font-semibold text-sm">
                    {user?.firstName?.charAt(0)}
                    {user?.lastName?.charAt(0)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  {user?.tag && (
                    <button
                      type="button"
                      onClick={copyTag}
                      className="flex items-center gap-1.5 mt-0.5 text-xs text-brand-400 font-mono hover:text-brand-300 transition-colors cursor-pointer py-1 -ml-1 pl-1 pr-1 rounded touch-manipulation"
                    >
                      <span className="truncate">@{user.tag}</span>
                      {tagCopied ? (
                        <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer text-left min-h-[44px]"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className={`transition-all duration-300 ${isMobile ? 'ml-0' : sidebarCollapsed ? 'ml-20' : 'ml-72'}`}>
        <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/10">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Mobile: only hamburger (profile/sign out live in sidebar) */}
              {isMobile && (
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors md:hidden"
                >
                  <Menu className="w-6 h-6" />
                </button>
              )}

              {/* Desktop: notifications + profile dropdown in header */}
              <div className="hidden md:flex items-center gap-4 ml-auto">
                <button className="relative p-2 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-brand-400 rounded-full"></span>
                </button>

                <div className="relative group">
                  <button className="flex items-center gap-3 px-3 py-2 bg-white/[.06] hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer">
                    <div className="w-8 h-8 bg-brand-400 rounded-lg flex items-center justify-center">
                      <span className="text-black font-semibold text-sm">
                        {user?.firstName?.charAt(0)}
                        {user?.lastName?.charAt(0)}
                      </span>
                    </div>
                    <div className="text-left hidden sm:block">
                      <div className="text-sm font-medium text-white">
                        {user?.firstName} {user?.lastName}
                      </div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-zinc-400 hidden sm:block" />
                  </button>

                  <div className="absolute right-0 top-full mt-2 w-56 glass-strong border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="p-2">
                      {user?.tag && (
                        <button
                          type="button"
                          onClick={copyTag}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left rounded-lg text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer border-b border-white/10 mb-1"
                        >
                          <span className="text-sm font-mono text-brand-400">@{user.tag}</span>
                          {tagCopied ? (
                            <Check className="w-4 h-4 text-green-400 shrink-0" />
                          ) : (
                            <Copy className="w-4 h-4 text-zinc-500 hover:text-brand-400 shrink-0" />
                          )}
                        </button>
                      )}
                      <Link
                        href="/dashboard/settings"
                        className="flex items-center gap-3 px-3 py-2 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors"
                      >
                        <User className="w-4 h-4" />
                        <span className="text-sm">Profile</span>
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm">Sign Out</span>
                      </button>
                    </div>
                  </div>
                </div>
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
