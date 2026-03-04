'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { adminApi } from '@/lib/api/admin';
import { PageLoader } from '@/components/AppLoader';
import { format } from 'date-fns';

interface PlatformMetrics {
  users: { total: number; active: number; newThisMonth: number; newThisWeek?: number; newToday?: number };
  invoices: { total: number; completed: number; pending: number; totalVolume: string };
  revenue: { total: string; thisMonth: string; lastMonth: string };
  contracts?: { total: number; active: number; completed: number; cancelled: number; disputed: number };
}

/** On-chain invoice as returned by GET /api/admin/invoices (bigints serialized as strings). */
interface AdminInvoiceRow {
  id?: string | number;
  issuer?: string;
  payer?: string;
  receiver?: string;
  amount?: string | number;
  status?: number;
  createdAt?: string | number;
  tokenAddress?: string;
  [key: string]: unknown;
}

const CHART_COLORS = {
  revenue: { primary: '#059669', hover: '#10b981' },
  users: { primary: '#2563eb', hover: '#3b82f6' },
  grid: '#374151',
  tick: '#9ca3af',
  tooltipBg: '#1f2937',
  tooltipBorder: '#374151',
} as const;

function formatAmount(value: string | number | null | undefined): string {
  if (value == null || value === '') return '0';
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (Number.isNaN(n)) return '0';
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatBigNumber(value: string | number | null | undefined): string {
  if (value == null || value === '') return '0';
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (Number.isNaN(n)) return '0';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [revenueReport, setRevenueReport] = useState<Array<{ period: string; amount: string; count?: number }>>([]);
  const [usersGrowthReport, setUsersGrowthReport] = useState<Array<{ period: string; count: number }>>([]);
  const [recentInvoices, setRecentInvoices] = useState<AdminInvoiceRow[]>([]);
  const [areaTimeRange, setAreaTimeRange] = useState<'90d' | '30d' | '7d'>('90d');

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
        const [metricsRes, revenuePayload, growthPayload, invoicesPayload] = await Promise.all([
          adminApi.getMetrics(),
          adminApi.getRevenueReport({ period: 'monthly' }).then(({ reports }) =>
            reports.map((r) => ({
              period: String(r.period ?? ''),
              amount: String(r.totalRevenue ?? '0'),
              count: r.transactionCount,
            }))
          ).catch(() => []),
          adminApi.getUsersGrowthReport({ periods: 12 }).then(({ reports }) => reports).catch(() => []),
          adminApi.getAllInvoices({}).then((d: unknown) => {
            const payload = d as { invoices?: AdminInvoiceRow[] };
            const list = Array.isArray(payload?.invoices) ? payload.invoices : [];
            return list.slice(0, 15);
          }).catch(() => []),
        ]);
        setMetrics(metricsRes ?? null);
        setRevenueReport(Array.isArray(revenuePayload) ? revenuePayload : []);
        setUsersGrowthReport(Array.isArray(growthPayload) ? growthPayload : []);
        setRecentInvoices(Array.isArray(invoicesPayload) ? invoicesPayload : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [router]);

  const thisMonthRev = parseFloat(metrics?.revenue?.thisMonth ?? '0') || 0;
  const lastMonthRev = parseFloat(metrics?.revenue?.lastMonth ?? '0') || 0;
  const revenueChange =
    lastMonthRev > 0
      ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100
      : (thisMonthRev > 0 ? 100 : null);

  const revenueChartData = revenueReport
    .slice(0, 12)
    .reverse()
    .map((r) => ({
      period: r.period,
      revenue: parseFloat(r.amount) || 0,
      count: r.count ?? 0,
    }));
  const usersGrowthChartData = usersGrowthReport.slice(0, 12);
  const usersChartToShow = usersGrowthChartData.length > 0 ? usersGrowthChartData : [{ period: '—', count: 0 }];
  const hasUsersGrowthData = usersGrowthChartData.length > 0;

  const areaChartPoints = areaTimeRange === '7d' ? 1 : areaTimeRange === '30d' ? 3 : 6;
  const areaChartData = revenueChartData.slice(-Math.max(areaChartPoints, 1));
  const areaChartToShow = areaChartData.length > 0 ? areaChartData : [{ period: '—', revenue: 0, count: 0 }];

  const statusLabel = (s: number | undefined) => {
    const map: Record<number, string> = { 0: 'Pending', 1: 'Funded', 2: 'Delivered', 3: 'Completed', 4: 'Cancelled' };
    return s !== undefined ? (map[s] ?? String(s)) : '—';
  };
  const transactionsRows = recentInvoices.map((inv) => {
    const amt = Number(inv.amount ?? 0);
    const isCompleted = inv.status === 3;
    const dateTs = inv.createdAt != null ? (typeof inv.createdAt === 'number' ? inv.createdAt : Number(inv.createdAt)) : null;
    const dateStr = dateTs ? (dateTs > 1e12 ? format(new Date(dateTs), 'yyyy-MM-dd HH:mm') : format(new Date(dateTs * 1000), 'yyyy-MM-dd HH:mm')) : '—';
    return {
      name: `Invoice #${inv.id ?? '—'}`,
      date: dateStr,
      type: (isCompleted ? 'Income' : 'Pending') as 'Income' | 'Pending',
      amount: isCompleted ? `+$${formatAmount(amt)}` : `-$${formatAmount(amt)}`,
      status: statusLabel(inv.status),
    };
  });

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
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-8">Dashboard</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Row 1: Four metric cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-[#111111] border border-gray-800 rounded-xl p-6 shadow-xl shadow-black/20 hover:border-gray-700 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-400">My Balance</h3>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-teal-500/20 text-teal-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white">${formatBigNumber(metrics?.invoices?.totalVolume)}</p>
            <p className="mt-2 text-sm font-medium">
              {revenueChange != null ? (
                <span className={revenueChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {revenueChange >= 0 ? '+' : ''}{revenueChange.toFixed(1)}%
                </span>
              ) : (
                <span className="text-gray-500">—</span>
              )}{' '}
              vs last month
            </p>
          </div>
          <div className="bg-[#111111] border border-gray-800 rounded-xl p-6 shadow-xl shadow-black/20 hover:border-gray-700 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-400">Net Profit</h3>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/20 text-green-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white">${formatBigNumber(metrics?.revenue?.total)}</p>
            <p className="mt-2 text-sm font-medium">
              {revenueChange != null ? (
                <span className={revenueChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {revenueChange >= 0 ? '+' : ''}{revenueChange.toFixed(1)}%
                </span>
              ) : (
                <span className="text-gray-500">—</span>
              )}{' '}
              vs last month
            </p>
          </div>
          <div className="bg-[#111111] border border-gray-800 rounded-xl p-6 shadow-xl shadow-black/20 hover:border-gray-700 transition-colors">
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
          <div className="bg-[#111111] border border-gray-800 rounded-xl p-6 shadow-xl shadow-black/20 hover:border-gray-700 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-400">User growth</h3>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/20 text-blue-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white">{metrics?.users?.total ?? 0}</p>
            <p className="mt-2 text-sm text-gray-500">
              Today: {metrics?.users?.newToday ?? 0} · Week: {metrics?.users?.newThisWeek ?? 0} · Month: {metrics?.users?.newThisMonth ?? 0}
            </p>
          </div>
        </div>

        {/* Revenue over time – full width */}
        <div className="bg-[#111111] border border-gray-800 rounded-xl p-6 shadow-xl shadow-black/20 hover:border-gray-700 transition-colors mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Revenue over time</h3>
              <p className="text-sm text-gray-500">Revenue by period</p>
            </div>
            <select
              value={areaTimeRange}
              onChange={(e) => setAreaTimeRange(e.target.value as '90d' | '30d' | '7d')}
              className="bg-[#1f2937] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              aria-label="Time range"
            >
              <option value="90d">Last 6 months</option>
              <option value="30d">Last 3 months</option>
              <option value="7d">Last month</option>
            </select>
          </div>
          <div className="h-[280px] w-full min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaChartToShow} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.revenue.primary} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={CHART_COLORS.revenue.primary} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fill: CHART_COLORS.tick, fontSize: 12 }}
                  axisLine={{ stroke: CHART_COLORS.grid }}
                  tickLine={false}
                  tickFormatter={(v) => (String(v).length > 10 ? `${String(v).slice(0, 7)}…` : String(v))}
                />
                <YAxis
                  tick={{ fill: CHART_COLORS.tick, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    Number(v) >= 1e6 ? `${(Number(v) / 1e6).toFixed(1)}M` : Number(v) >= 1e3 ? `${(Number(v) / 1e3).toFixed(0)}k` : String(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: CHART_COLORS.tooltipBg,
                    border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#e5e7eb' }}
                  formatter={(value: number | undefined) => [`$${formatAmount(value)}`, 'Revenue']}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={CHART_COLORS.revenue.primary}
                  strokeWidth={2}
                  fill="url(#fillRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User signups by month – full width */}
        <div className="bg-[#111111] border border-gray-800 rounded-xl p-6 shadow-xl shadow-black/20 hover:border-gray-700 transition-colors mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">User signups by month</h3>
              <p className="text-sm text-gray-500">
                {hasUsersGrowthData ? 'Last 12 months (real data)' : 'No signup data yet'}
              </p>
            </div>
            <Link href="/admin/users" className="text-sm text-teal-400 hover:text-teal-300 font-medium">
              View Users
            </Link>
          </div>
          <div className="h-[280px] w-full min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usersChartToShow} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fill: CHART_COLORS.tick, fontSize: 12 }}
                  axisLine={{ stroke: CHART_COLORS.grid }}
                  tickLine={false}
                  tickFormatter={(v) => (String(v).length > 10 ? `${String(v).slice(0, 7)}…` : String(v))}
                />
                <YAxis
                  tick={{ fill: CHART_COLORS.tick, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: CHART_COLORS.tooltipBg,
                    border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#e5e7eb' }}
                  formatter={(value: number | undefined) => [String(value ?? 0), 'Signups']}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Bar dataKey="count" fill={CHART_COLORS.users.primary} radius={[4, 4, 0, 0]} name="Signups" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Contract counts */}
        {metrics?.contracts && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-[#111111] border border-gray-800 rounded-xl p-4 shadow-lg shadow-black/10 hover:border-gray-700 transition-colors">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Contracts total</p>
              <p className="text-xl font-bold text-white mt-1">{metrics.contracts.total}</p>
            </div>
            <div className="bg-[#111111] border border-gray-800 rounded-xl p-4 shadow-lg shadow-black/10 hover:border-gray-700 transition-colors">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Active</p>
              <p className="text-xl font-bold text-teal-400 mt-1">{metrics.contracts.active}</p>
            </div>
            <div className="bg-[#111111] border border-gray-800 rounded-xl p-4 shadow-lg shadow-black/10 hover:border-gray-700 transition-colors">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Completed</p>
              <p className="text-xl font-bold text-green-400 mt-1">{metrics.contracts.completed}</p>
            </div>
            <div className="bg-[#111111] border border-gray-800 rounded-xl p-4 shadow-lg shadow-black/10 hover:border-gray-700 transition-colors">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Cancelled</p>
              <p className="text-xl font-bold text-gray-400 mt-1">{metrics.contracts.cancelled}</p>
            </div>
            <div className="bg-[#111111] border border-gray-800 rounded-xl p-4 shadow-lg shadow-black/10 hover:border-gray-700 transition-colors">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Disputed</p>
              <p className="text-xl font-bold text-amber-400 mt-1">{metrics.contracts.disputed}</p>
            </div>
          </div>
        )}

        {/* Recent invoices (table only; charts above are Revenue and User signups) */}
        <div className="bg-[#111111] border border-gray-800 rounded-xl p-6 shadow-xl shadow-black/20 hover:border-gray-700 transition-colors mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Recent invoices</h3>
              <p className="text-sm text-gray-500">Latest invoice activity</p>
            </div>
            <Link href="/admin/invoices" className="text-sm text-teal-400 hover:text-teal-300 font-medium">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-800">
                  <th className="pb-2 pr-2">Name</th>
                  <th className="pb-2 pr-2">Date</th>
                  <th className="pb-2 pr-2">Type</th>
                  <th className="pb-2 pr-2">Status</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactionsRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">
                      No recent invoices.
                    </td>
                  </tr>
                ) : (
                  transactionsRows.map((row, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-3 pr-2">
                        <span className="inline-block w-2 h-2 rounded-full mr-2 bg-teal-400" />
                        <span className="text-white">{row.name}</span>
                      </td>
                      <td className="py-3 pr-2 text-gray-400">{row.date}</td>
                      <td className="py-3 pr-2">
                        <span className={row.type === 'Income' ? 'text-green-400' : 'text-amber-400'}>{row.type}</span>
                      </td>
                      <td className="py-3 pr-2 text-gray-400 text-sm">{row.status}</td>
                      <td
                        className={`py-3 text-right font-medium ${row.type === 'Income' ? 'text-green-400' : 'text-red-400'}`}
                      >
                        {row.amount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
