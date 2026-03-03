'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api/admin';
import { apiClient } from '@/lib/api/client';
import { PageLoader } from '@/components/AppLoader';
import { format, endOfMonth, startOfMonth, subMonths } from 'date-fns';

interface PlatformMetrics {
  users: { total: number; active: number; newThisMonth: number };
  invoices: { total: number; completed: number; pending: number; totalVolume: string };
  revenue: { total: string; thisMonth: string; lastMonth: string };
}

const SOURCE_COLORS = ['#22d3ee', '#a78bfa', '#f59e0b', '#10b981', '#ef4444', '#6366f1'];

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [revenueReport, setRevenueReport] = useState<Array<{ period: string; amount: string; count?: number }>>([]);
  const [transactionVolume, setTransactionVolume] = useState<Array<{ token: string; volume: string; count?: number }>>([]);
  const [dateRange] = useState(() => ({
    start: startOfMonth(subMonths(new Date(), 5)),
    end: endOfMonth(subMonths(new Date(), 0)),
  }));

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (!token || !user) {
      router.push('/admin/login');
      return;
    }
    try {
      const parsedUser = JSON.parse(user);
      if (parsedUser.accountType !== 'admin') {
        router.push('/');
        return;
      }
    } catch {
      router.push('/admin/login');
      return;
    }

    const run = async () => {
      setError(null);
      setLoading(true);
      try {
        const [metricsRes, revenueData, volumeData] = await Promise.all([
          apiClient.get<PlatformMetrics>('/api/admin/metrics').then((r) =>
            r && (r as { success?: boolean }).success && (r as { data?: PlatformMetrics }).data
              ? (r as { data: PlatformMetrics }).data
              : null
          ),
          adminApi.getRevenueReport({ period: 'monthly' }).then((d: unknown) => {
            const reports = (d as { reports?: Array<{ period: string; totalRevenue: string; transactionCount?: number }> })?.reports ?? (Array.isArray(d) ? d : []);
            return Array.isArray(reports)
              ? reports.map((r: { period?: string; totalRevenue?: string; transactionCount?: number }) => ({
                period: r.period ?? '',
                amount: r.totalRevenue ?? '0',
                count: r.transactionCount,
              }))
              : [];
          }).catch(() => []),
          adminApi.getTransactionVolume().then((d: unknown) => {
            const raw = d as Record<string, { volume?: string; count?: number }>;
            if (!raw || typeof raw !== 'object') return [];
            return Object.entries(raw).map(([token, v]) => ({ token, volume: v.volume ?? '0', count: v.count }));
          }).catch(() => []),
        ]);
        setMetrics(metricsRes ?? null);
        setRevenueReport(Array.isArray(revenueData) ? revenueData : []);
        setTransactionVolume(Array.isArray(volumeData) ? volumeData : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [router]);

  const revenueChange =
    metrics?.revenue?.thisMonth != null &&
      metrics?.revenue?.lastMonth != null &&
      parseFloat(metrics.revenue.lastMonth) > 0
      ? ((parseFloat(metrics.revenue.thisMonth) - parseFloat(metrics.revenue.lastMonth)) /
        parseFloat(metrics.revenue.lastMonth)) *
      100
      : null;

  const last6Months = revenueReport.slice(-6);
  const maxBar = Math.max(1, ...last6Months.map((r) => parseFloat(r.amount) || 0));
  const summarySegments =
    transactionVolume.length > 0
      ? transactionVolume.map((t, i) => ({
        label: t.token,
        value: parseFloat(t.volume) || 0,
        color: SOURCE_COLORS[i % SOURCE_COLORS.length],
      }))
      : [{ label: 'No data', value: 1, color: '#4b5563' }];
  const summaryTotal = summarySegments.reduce((s, x) => s + x.value, 0);
  const incomeSources = transactionVolume.slice(0, 6).map((t, i) => ({
    name: t.token,
    amount: `$${parseFloat(t.volume).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    color: SOURCE_COLORS[i % SOURCE_COLORS.length],
  }));

  const transactionsRows = [
    ...revenueReport
      .slice(-5)
      .reverse()
      .map((r) => ({ name: `Revenue — ${r.period}`, date: r.period, type: 'Income' as const, amount: `$${r.amount}` })),
    {
      name: 'Platform fees',
      date: new Date().toISOString().slice(0, 7),
      type: 'Expenses' as const,
      amount: `-$${metrics?.revenue?.total ?? '0'}`,
    },
  ].slice(0, 7);

  const savingTarget = 10000;
  const savingCurrent = parseFloat(metrics?.invoices?.totalVolume ?? '0') || 0;
  const savingPct = savingTarget > 0 ? Math.min(100, (savingCurrent / savingTarget) * 100) : 0;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Finance Dashboard</h1>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search..."
              className="bg-[#111111] border border-gray-800 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 w-40 sm:w-48"
            />
            <div className="flex items-center gap-2 bg-[#111111] border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>
                {format(dateRange.start, 'dd MMM yyyy')} – {format(dateRange.end, 'dd MMM yyyy')}
              </span>
            </div>
            <button
              type="button"
              className="p-2 rounded-lg border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800/50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Row 1: Four metric cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-[#111111] border border-gray-800 rounded-xl p-6">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-400">My Balance</h3>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-teal-500/20 text-teal-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white">${metrics?.invoices?.totalVolume ?? '0'}</p>
            <p className="mt-2 text-sm text-green-400 font-medium">
              {revenueChange != null ? `+${revenueChange.toFixed(1)}%` : '—'} vs last month
            </p>
          </div>
          <div className="bg-[#111111] border border-gray-800 rounded-xl p-6">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-400">Net Profit</h3>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/20 text-green-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white">${metrics?.revenue?.total ?? '0'}</p>
            <p className="mt-2 text-sm text-green-400 font-medium">
              {revenueChange != null ? `+${revenueChange.toFixed(1)}%` : '—'} vs last month
            </p>
          </div>
          <div className="bg-[#111111] border border-gray-800 rounded-xl p-6">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-400">Expenses</h3>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/20 text-amber-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2h-2m-4-1V7a2 2 0 012-2h2a2 2 0 012 2v1" />
                </svg>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white">{metrics?.invoices?.pending ?? 0}</p>
            <p className="mt-2 text-sm text-gray-500">Pending invoices</p>
          </div>
          <div className="bg-[#111111] border border-gray-800 rounded-xl p-6">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-400">Pending Invoices</h3>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-500/20 text-red-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white">${metrics?.revenue?.thisMonth ?? '0'}</p>
            {Number(metrics?.invoices?.pending) > 0 && (
              <p className="mt-2 text-sm text-red-400 font-medium">{metrics?.invoices?.pending} overdue</p>
            )}
          </div>
        </div>

        {/* Row 2: Income Sources | Monthly Revenue | Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#111111] border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-1">Income Sources</h3>
            <p className="text-2xl font-bold text-white mb-1">${metrics?.invoices?.totalVolume ?? '0'}</p>
            <p className="text-sm text-green-400 font-medium mb-4">
              {revenueChange != null ? `+${revenueChange.toFixed(1)}%` : '—'} compared to last month
            </p>
            <div className="space-y-3">
              {incomeSources.length > 0 ? (
                incomeSources.map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-gray-300">{s.name}</span>
                    </div>
                    <span className="text-white font-medium">{s.amount}</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No volume data by token.</p>
              )}
            </div>
            <p className="text-gray-500 text-xs mt-4">Platform volume by token. Revenue from completed invoices.</p>
          </div>

          <div className="bg-[#111111] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Monthly Revenue</h3>
                <p className="text-sm text-gray-500">Last 6 periods</p>
              </div>
              <button type="button" className="text-sm text-teal-400 hover:text-teal-300 font-medium">
                View Report
              </button>
            </div>
            <div className="h-48 flex items-end gap-2">
              {last6Months.length > 0 ? (
                last6Months.map((r, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-red-500/80 rounded-t min-h-[4px] transition-all"
                      style={{ height: `${((parseFloat(r.amount) || 0) / maxBar) * 100}%` }}
                    />
                    <span className="text-xs text-gray-500 truncate w-full text-center">{r.period}</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm w-full text-center py-8">No revenue data.</p>
              )}
            </div>
            <p className="text-gray-500 text-xs mt-3">Trending by period. Showing last 6 months.</p>
          </div>

          <div className="bg-[#111111] border border-gray-800 rounded-xl p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">Summary</h3>
              <p className="text-sm text-gray-500">Volume by token</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative w-36 h-36 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  {summarySegments.map((seg, i) => {
                    const pct = summaryTotal > 0 ? (seg.value / summaryTotal) * 100 : 100 / summarySegments.length;
                    const dash = (pct / 100) * 100;
                    const offset = summarySegments
                      .slice(0, i)
                      .reduce((s, x) => s + (summaryTotal > 0 ? (x.value / summaryTotal) * 100 : 0), 0);
                    return (
                      <circle
                        key={i}
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="6"
                        strokeDasharray={`${dash} ${100 - dash}`}
                        strokeDashoffset={-offset}
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-white">
                    $
                    {summaryTotal >= 1e6
                      ? `${(summaryTotal / 1e6).toFixed(1)}M`
                      : summaryTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                {summarySegments.map((seg, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                    <span className="text-gray-400 text-sm truncate">{seg.label}</span>
                    <span className="text-white text-sm font-medium ml-auto">
                      {summaryTotal > 0 ? ((seg.value / summaryTotal) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Transactions | Volume Goal | Platform Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#111111] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Transactions</h3>
              <Link href="/admin/invoices" className="text-sm text-teal-400 hover:text-teal-300 font-medium">
                View All
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-800">
                    <th className="pb-2 pr-2">Name</th>
                    <th className="pb-2 pr-2">Date</th>
                    <th className="pb-2 pr-2">Type</th>
                    <th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionsRows.map((row, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-3 pr-2">
                        <span className="inline-block w-2 h-2 rounded-full mr-2 bg-teal-400" />
                        <span className="text-white">{row.name}</span>
                      </td>
                      <td className="py-3 pr-2 text-gray-400">{row.date}</td>
                      <td className="py-3 pr-2">
                        <span className={row.type === 'Income' ? 'text-green-400' : 'text-red-400'}>{row.type}</span>
                      </td>
                      <td
                        className={`py-3 text-right font-medium ${row.type === 'Income' ? 'text-green-400' : 'text-red-400'}`}
                      >
                        {row.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#111111] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Volume Goal</h3>
              <button type="button" className="text-sm text-teal-400 hover:text-teal-300 font-medium">
                View Report
              </button>
            </div>
            <p className="text-2xl font-bold text-white mb-1">{savingPct.toFixed(0)}% Progress</p>
            <p className="text-gray-400 text-sm mb-4">
              ${savingCurrent.toLocaleString('en-US', { maximumFractionDigits: 0 })} of $
              {savingTarget.toLocaleString()}
            </p>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${savingPct}%` }} />
            </div>
          </div>

          <div className="bg-[#111111] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Platform Overview</h3>
              <Link href="/admin/wallets" className="text-sm text-teal-400 hover:text-teal-300 font-medium">
                + View Wallets
              </Link>
            </div>
            <p className="text-sm text-gray-500 mb-4">Key platform metrics</p>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-gradient-to-br from-teal-500/20 to-teal-600/10 border border-teal-500/30">
                <p className="text-xs text-gray-400 mb-1">Total Volume</p>
                <p className="text-xl font-bold text-white">${metrics?.invoices?.totalVolume ?? '0'}</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30">
                <p className="text-xs text-gray-400 mb-1">Active Users</p>
                <p className="text-xl font-bold text-white">{metrics?.users?.active ?? 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Users', path: '/admin/users' },
            { label: 'Invoices', path: '/admin/invoices' },
            { label: 'Wallets', path: '/admin/wallets' },
            { label: 'Transactions', path: '/admin/transactions' },
            { label: 'Contracts', path: '/admin/contracts' },
            { label: 'Waitlist', path: '/admin/waitlist' },
          ].map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className="bg-[#111111] border border-gray-800 rounded-lg px-4 py-3 text-center text-sm font-medium text-gray-300 hover:text-white hover:border-teal-500/50 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
