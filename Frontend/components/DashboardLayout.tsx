'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ReactNode } from 'react';
import { ArrowLeftRight, CreditCard, FileText, House, LogOut, Settings } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const navigation = [
    {
      name: 'Overview',
      href: '/dashboard',
      icon: (
        <House className="w-5 h-5" />
      ),
    },
    {
      name: 'Invoices',
      href: '/dashboard/invoices',
      icon: (
        <FileText className="w-5 h-5" />
      ),
    },
    {
      name: 'Withdraw',
      href: '/dashboard/wallet/withdraw',
      icon: (
        <CreditCard className="w-5 h-5" />
      ),
    },
    {
      name: 'Transactions',
      href: '/dashboard/transactions',
      icon: (
        <ArrowLeftRight className="w-5 h-5" />
      ),
    },
    {
      name: 'Settings',
      href: '/dashboard/settings',
      icon: (
        <Settings className="w-5 h-5" />
      ),
    },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-transparent flex">
      {/* Sidebar */}
      <aside className="w-64 glass border-r border-white/10 sticky top-0 h-screen">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-white/10">
            <a href={process.env.NEXT_PUBLIC_SITE_URL ?? 'https://holdispay.xyz'} className="flex items-center gap-3 group">
              <img src="/logo.png" alt="HoldisPay" className="w-12 h-12" />
            </a>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive(item.href)
                    ? 'bg-brand-400/10 text-brand-400 border border-brand-400/20'
                    : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {item.icon}
                <span className="font-medium">{item.name}</span>
              </Link>
            ))}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-white/10">
            <div className="bg-white/[0.06] rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-brand-400/10 rounded-full flex items-center justify-center">
                  <span className="text-brand-400 font-semibold">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-zinc-500 text-xs truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full px-3 py-2 glass hover:bg-[#0f0f0f] text-zinc-400 hover:text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
