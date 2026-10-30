'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  Check,
  ChevronsLeft,
  ChevronsUpDown,
  Copy,
  FileSignature,
  FileText,
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  Settings,
  User,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { ThemeScope, ThemeToggle } from '@/components/landing/ThemeToggle';

type NavItem = { name: string; href: string; icon: LucideIcon; exact?: boolean };

const NAV: { section?: string; items: NavItem[] }[] = [
  { items: [{ name: 'Overview', href: '/dashboard', icon: LayoutGrid, exact: true }] },
  {
    section: 'Payments',
    items: [
      { name: 'Invoices', href: '/dashboard/invoices', icon: FileText },
      { name: 'Contracts', href: '/dashboard/contracts', icon: FileSignature },
      { name: 'Transactions', href: '/dashboard/transactions', icon: ArrowLeftRight },
      { name: 'Withdraw', href: '/dashboard/withdraw', icon: ArrowUpRight },
    ],
  },
  { section: 'Account', items: [{ name: 'Settings', href: '/dashboard/settings', icon: Settings }] },
];

const CREATE = [
  { name: 'New invoice', hint: 'Bill a client with a payment link', href: '/dashboard/invoices/create', icon: FileText },
  { name: 'New contract', hint: 'Escrow with milestones or a schedule', href: '/dashboard/contracts/create', icon: FileSignature },
];

// Mobile bottom bar: the most used destinations, with "New" in the middle.
const TABS: NavItem[] = [
  { name: 'Overview', href: '/dashboard', icon: LayoutGrid, exact: true },
  { name: 'Invoices', href: '/dashboard/invoices', icon: FileText },
  { name: 'Contracts', href: '/dashboard/contracts', icon: FileSignature },
  { name: 'Activity', href: '/dashboard/transactions', icon: ArrowLeftRight },
];

const COLLAPSE_KEY = 'hp-sidebar-collapsed';

const isActive = (pathname: string, item: NavItem) =>
  item.exact ? pathname.replace(/\/$/, '') === item.href : pathname.startsWith(item.href);

/** Title for the top bar, from the most specific matching route. */
function pageTitle(pathname: string) {
  const p = pathname.replace(/\/$/, '');
  if (p.endsWith('/invoices/create')) return 'New invoice';
  if (p.endsWith('/contracts/create')) return 'New contract';
  const item = NAV.flatMap((g) => g.items)
    .filter((i) => isActive(p, i))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return item?.name ?? 'Dashboard';
}

/** Closes a popover on outside click or Escape. */
function useDismiss<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

export default function PremiumDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/dashboard';
  const router = useRouter();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [tagCopied, setTagCopied] = useState(false);

  // Restore the collapsed sidebar preference after mount (localStorage isn't available on the server).
  useEffect(() => {
    const id = requestAnimationFrame(() => setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1'));
    return () => cancelAnimationFrame(id);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      return !c;
    });
  };

  // Close the drawer and menus whenever the route changes.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setDrawerOpen(false);
      setCreateOpen(false);
      setUserOpen(false);
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const createRef = useDismiss<HTMLDivElement>(createOpen, () => setCreateOpen(false));
  const userRef = useDismiss<HTMLDivElement>(userOpen, () => setUserOpen(false));

  const copyTag = () => {
    if (!user?.tag) return;
    navigator.clipboard.writeText(user.tag);
    setTagCopied(true);
    setTimeout(() => setTagCopied(false), 2000);
  };

  const handleLogout = () => {
    logout();
    router.push('/signin');
  };

  const initials = `${user?.firstName?.charAt(0) ?? ''}${user?.lastName?.charAt(0) ?? ''}` || '?';
  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

  const avatar = (size: string) => (
    <span className={`grid shrink-0 place-items-center rounded-full bg-brand-500 font-semibold text-black ${size}`}>{initials}</span>
  );

  /** Sidebar body, shared by the desktop rail and the mobile drawer. */
  const sidebar = (mini: boolean) => (
    <div className="flex h-full min-h-0 flex-col">
      {/* Brand + collapse */}
      <div className={`flex h-16 shrink-0 items-center gap-2 ${mini ? 'justify-center px-2' : 'px-4'}`}>
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5" aria-label="HoldisPay dashboard">
          <img src="/logo.png" alt="" className="h-8 w-8 shrink-0 rounded-lg" />
          {!mini && <span className="truncate font-heading text-[16px] font-semibold tracking-tight text-white">HoldisPay</span>}
        </Link>
        {!mini && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Collapse sidebar"
            className="ml-auto hidden h-8 w-8 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-white lg:grid"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* New */}
      <div ref={createRef} className={`relative shrink-0 pb-2 ${mini ? 'px-2' : 'px-3'}`}>
        <button
          type="button"
          onClick={() => setCreateOpen((o) => !o)}
          aria-expanded={createOpen}
          aria-label="Create new"
          className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-sm font-semibold text-black shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] transition-[filter] hover:brightness-110`}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          {!mini && 'New'}
        </button>
        {createOpen && (
          <div className={`glass-strong absolute z-30 mt-2 w-64 rounded-2xl border border-white/10 p-1.5 ${mini ? 'left-full top-0 ml-2 mt-0' : 'left-3 right-3 w-auto'}`}>
            {CREATE.map(({ name, hint, href, icon: Icon }) => (
              <Link key={href} href={href} className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.06]">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                <span>
                  <span className="block text-sm font-medium text-white">{name}</span>
                  <span className="block text-xs text-zinc-500">{hint}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto pb-4 ${mini ? 'px-2' : 'px-3'}`} aria-label="Dashboard">
        {NAV.map((group, gi) => (
          <div key={gi} className="mt-4 first:mt-2">
            {group.section &&
              (mini ? (
                <div className="mx-auto mb-2 h-px w-6 bg-white/10" aria-hidden />
              ) : (
                <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">{group.section}</p>
              ))}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      title={mini ? item.name : undefined}
                      className={`group flex h-10 items-center gap-3 rounded-xl text-[14px] font-medium transition-colors ${
                        mini ? 'justify-center' : 'px-3'
                      } ${active ? 'bg-white/[0.08] text-white' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'}`}
                    >
                      <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-brand-400' : ''}`} strokeWidth={active ? 2.2 : 1.8} />
                      {!mini && <span className="truncate">{item.name}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: theme + user */}
      <div
        className={`shrink-0 space-y-1 border-t border-white/[0.08] p-2 ${mini ? '' : 'px-3'}`}
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <ThemeToggle
          showLabel={!mini}
          className={`flex h-10 w-full items-center gap-3 rounded-xl text-[14px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-white ${mini ? 'justify-center' : 'px-3'}`}
        />

        <div ref={userRef} className="relative">
          <button
            type="button"
            onClick={() => setUserOpen((o) => !o)}
            aria-expanded={userOpen}
            aria-label="Account menu"
            className={`flex w-full items-center gap-3 rounded-xl py-2 transition-colors hover:bg-white/[0.04] ${mini ? 'justify-center' : 'px-2'}`}
          >
            {avatar('h-8 w-8 text-xs')}
            {!mini && (
              <>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium text-white">{fullName || 'Your account'}</span>
                  {user?.tag && <span className="block truncate text-xs text-zinc-500">@{user.tag}</span>}
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-zinc-500" />
              </>
            )}
          </button>

          {userOpen && (
            <div className={`glass-strong absolute bottom-full z-30 mb-2 w-60 rounded-2xl border border-white/10 p-1.5 ${mini ? 'left-0' : 'left-0 right-0 w-auto'}`}>
              <div className="px-3 pb-2 pt-1.5">
                <p className="truncate text-sm font-medium text-white">{fullName || 'Your account'}</p>
                <p className="truncate text-xs text-zinc-500">{user?.email}</p>
              </div>
              {user?.tag && (
                <button
                  type="button"
                  onClick={copyTag}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <span className="font-mono text-brand-400">@{user.tag}</span>
                  {tagCopied ? <Check className="h-4 w-4 text-success-400" /> : <Copy className="h-4 w-4 text-zinc-500" />}
                </button>
              )}
              <Link
                href="/dashboard/settings"
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <User className="h-4 w-4" />
                Profile &amp; settings
              </Link>
              <div className="my-1 h-px bg-white/[0.08]" />
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-400/10"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-theme min-h-screen bg-transparent font-sans text-white">
      <ThemeScope />

      {/* Desktop sidebar */}
      <aside
        className={`glass-strong fixed inset-y-0 left-0 z-40 hidden border-r border-white/[0.08] transition-[width] duration-300 lg:block ${
          collapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        {sidebar(collapsed)}
        {collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Expand sidebar"
            className="glass-strong absolute -right-3 top-5 grid h-6 w-6 place-items-center rounded-full border border-white/10 text-zinc-400 hover:text-white"
          >
            <ChevronsLeft className="h-3.5 w-3.5 rotate-180" />
          </button>
        )}
      </aside>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-50 lg:hidden ${drawerOpen ? '' : 'pointer-events-none'}`} aria-hidden={!drawerOpen}>
        <div
          className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setDrawerOpen(false)}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-[min(18rem,85vw)] border-r border-white/[0.08] bg-zinc-950 shadow-2xl transition-transform duration-300 ease-out ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="absolute right-3 top-4 z-10 grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
          {sidebar(false)}
        </aside>
      </div>

      <div className={`transition-[padding] duration-300 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-64'}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-zinc-950/70 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:h-16">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="-ml-2 grid h-10 w-10 place-items-center rounded-xl text-zinc-400 hover:bg-white/[0.06] hover:text-white lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="flex min-w-0 items-center gap-2 text-sm">
              <span className="hidden text-zinc-500 sm:inline">Dashboard</span>
              <span className="hidden text-zinc-600 sm:inline" aria-hidden>/</span>
              <span className="truncate font-medium text-white">{pageTitle(pathname)}</span>
            </p>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                aria-label="Notifications"
                className="grid h-10 w-10 place-items-center rounded-xl text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <Bell className="h-[18px] w-[18px]" />
              </button>
              <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Account" className="ml-1 lg:hidden">
                {avatar('h-8 w-8 text-xs')}
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-[1400px] px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-8">{children}</main>
      </div>

      {/* Mobile bottom bar */}
      <nav
        className="glass-strong fixed inset-x-3 bottom-3 z-40 flex items-center rounded-[22px] border border-white/10 p-1.5 md:hidden"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Quick navigation"
      >
        {TABS.slice(0, 2).map((t) => (
          <TabLink key={t.href} item={t} active={isActive(pathname, t)} />
        ))}
        <Link
          href="/dashboard/invoices/create"
          aria-label="New invoice"
          className="mx-1 grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-500 text-black shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]"
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} />
        </Link>
        {TABS.slice(2).map((t) => (
          <TabLink key={t.href} item={t} active={isActive(pathname, t)} />
        ))}
      </nav>
    </div>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10.5px] font-medium transition-colors ${
        active ? 'bg-white/[0.08] text-white' : 'text-zinc-500'
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? 'text-brand-400' : ''}`} strokeWidth={active ? 2.2 : 1.8} />
      {item.name}
    </Link>
  );
}
