'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';

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
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
        </svg>
      ),
    },
    {
      name: 'Contracts',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
        </svg>
      ),
      children: [
        { name: 'All Contracts', href: '/dashboard/contracts' },
        { name: 'Create Contract', href: '/dashboard/contracts/create' },
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
        { name: 'All Invoices', href: '/dashboard/invoices' },
        { name: 'Create Invoice', href: '/dashboard/invoices/create' },
      ],
    },
    {
      name: 'Withdraw',
      href: '/dashboard/withdraw',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      ),
    },
    {
      name: 'Transactions',
      href: '/dashboard/transactions',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      ),
    },
    {
      name: 'Settings',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
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
    <div className="min-h-screen bg-black font-sans">
      {/* Mobile overlay */}
      {isMobile && mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
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
        className={`fixed top-0 left-0 z-40 transition-all duration-300 border-r border-gray-800 bg-[#0a0a0a] ${isMobile
            ? `max-h-dvh h-dvh w-72 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`
            : `h-screen ${sidebarCollapsed ? 'w-20' : 'w-72'}`
          }`}
      >
        <div className="h-full flex flex-col min-h-0">
          <div className="shrink-0 p-4 sm:p-6 flex items-center justify-between border-b border-gray-800">
            {(!sidebarCollapsed || isMobile) && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-teal-400 rounded-lg flex items-center justify-center">
                  <span className="text-black font-bold text-sm">hD</span>
                </div>
                <span className="text-xl font-bold text-white">
                  hol<span className="text-teal-400">D</span>is
                </span>
              </div>
            )}
            {!isMobile && (
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
              >
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''
                    }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                  />
                </svg>
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
                          }
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative ${hasActiveChild
                            ? 'bg-teal-400/10 text-teal-400 border border-teal-400/20'
                            : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                          }`}
                      >
                        {hasActiveChild && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-teal-400 rounded-r-full" />
                        )}
                        <div className="w-5 h-5 min-w-5 min-h-5 shrink-0 flex items-center justify-center [&_svg]:size-5 [&_svg]:min-w-5 [&_svg]:min-h-5 [&_svg]:shrink-0 [&_svg]:block">{item.icon}</div>
                        {(!sidebarCollapsed || isMobile) ? (
                          <>
                            <span className="font-medium flex-1 text-left">{item.name}</span>
                            <svg
                              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </>
                        ) : (
                          <div className="absolute left-full ml-4 px-3 py-2 bg-gray-900 border border-gray-800 text-teal-400 text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-[0_0_20px_rgba(0,0,0,0.5)] translate-x-[-10px] group-hover:translate-x-0 pointer-events-none">
                            {item.name}
                          </div>
                        )}
                      </button>
                    ) : (
                      <a
                        href={item.href}
                        onClick={() => isMobile && setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative ${isActive
                            ? 'bg-teal-400/10 text-teal-400 border border-teal-400/20'
                            : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                          }`}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-teal-400 rounded-r-full" />
                        )}
                        <div className="w-5 h-5 min-w-5 min-h-5 shrink-0 flex items-center justify-center [&_svg]:size-5 [&_svg]:min-w-5 [&_svg]:min-h-5 [&_svg]:shrink-0 [&_svg]:block">{item.icon}</div>
                        {(!sidebarCollapsed || isMobile) ? (
                          <span className="font-medium">{item.name}</span>
                        ) : (
                          <div className="absolute left-full ml-4 px-3 py-2 bg-gray-900 border border-gray-800 text-teal-400 text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-[0_0_20px_rgba(0,0,0,0.5)] translate-x-[-10px] group-hover:translate-x-0 pointer-events-none">
                            {item.name}
                          </div>
                        )}
                      </a>
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
                                  ? 'text-teal-400 bg-teal-400/5'
                                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
                                }`}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${isChildActive ? 'bg-teal-400' : 'bg-gray-600'}`} />
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
              className="shrink-0 border-t border-gray-800 bg-[#0a0a0a] px-3 pt-3 space-y-1"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-800/50 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-teal-400 flex items-center justify-center shrink-0">
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
                      className="flex items-center gap-1.5 mt-0.5 text-xs text-teal-400 font-mono hover:text-teal-300 transition-colors cursor-pointer py-1 -ml-1 pl-1 pr-1 rounded touch-manipulation"
                    >
                      <span className="truncate">@{user.tag}</span>
                      {tagCopied ? (
                        <svg className="w-3.5 h-3.5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
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
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className={`transition-all duration-300 ${isMobile ? 'ml-0' : sidebarCollapsed ? 'ml-20' : 'ml-72'}`}>
        <header className="sticky top-0 z-30 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-gray-800">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Mobile: only hamburger (profile/sign out live in sidebar) */}
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

              {/* Desktop: notifications + profile dropdown in header */}
              <div className="hidden md:flex items-center gap-4 ml-auto">
                <button className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                  <span className="absolute top-1 right-1 w-2 h-2 bg-teal-400 rounded-full"></span>
                </button>

                <div className="relative group">
                  <button className="flex items-center gap-3 px-3 py-2 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer">
                    <div className="w-8 h-8 bg-teal-400 rounded-lg flex items-center justify-center">
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
                    <svg className="w-4 h-4 text-gray-400 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <div className="absolute right-0 top-full mt-2 w-56 bg-[#111111] border border-gray-800 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="p-2">
                      {user?.tag && (
                        <button
                          type="button"
                          onClick={copyTag}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors cursor-pointer border-b border-gray-800 mb-1"
                        >
                          <span className="text-sm font-mono text-teal-400">@{user.tag}</span>
                          {tagCopied ? (
                            <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-gray-500 hover:text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                            </svg>
                          )}
                        </button>
                      )}
                      <a
                        href="/dashboard/settings"
                        className="flex items-center gap-3 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        <span className="text-sm">Profile</span>
                      </a>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                        </svg>
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
