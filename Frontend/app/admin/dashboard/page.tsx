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
  Line,
  LineChart,
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
  invoice: { primary: '#0d9488', hover: '#14b8a6' },
  contract: { primary: '#6366f1', hover: '#818cf8' },
  transactions: { primary: '#7c3aed', hover: '#8b5cf6' },
  waitlist: { primary: '#d97706', hover: '#f59e0b' },
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

/** Format period "YYYY-MM" for chart X-axis (e.g. "Apr '25"). */
function formatPeriodLabel(period: string): string {
  if (!period || period === '—') return period;
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (!m) return period.length > 8 ? `${period.slice(0, 7)}…` : period;
  const [, year, month] = m;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(month, 10) - 1;
  const shortYear = year.length >= 2 ? `'${year.slice(-2)}` : year;
  return `${monthNames[monthIdx] ?? month} ${shortYear}`;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [revenueReport, setRevenueReport] = useState<Array<{ period: string; amount: string; count?: number }>>([]);
  const [usersGrowthReport, setUsersGrowthReport] = useState<Array<{ period: string; count: number }>>([]);
  const [recentInvoices, setRecentInvoices] = useState<AdminInvoiceRow[]>([]);
  const [recentContracts, setRecentContracts] = useState<Array<{ id: string; jobTitle?: string; status?: string; createdAt?: number; totalAmount?: string }>>([]);
  const [transactionsReport, setTransactionsReport] = useState<Array<{ period: string; count: number }>>([]);
  const [invoicesReport, setInvoicesReport] = useState<Array<{ period: string; count: number }>>([]);
  const [contractsReport, setContractsReport] = useState<Array<{ period: string; count: number }>>([]);
  const [waitlistReport, setWaitlistReport] = useState<Array<{ period: string; count: number }>>([]);

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
        const results = await Promise.allSettled([
          adminApi.getMetrics(),
          adminApi.getRevenueReport({ period: 'monthly' }).then(({ reports }) =>
            (reports ?? []).map((r: { period?: string; totalRevenue?: string; transactionCount?: number }) => ({
              period: String(r.period ?? ''),
              amount: String(r.totalRevenue ?? '0'),
              count: r.transactionCount ?? 0,
            }))
          ),
          adminApi.getUsersGrowthReport({ periods: 12 }).then(({ reports }) => reports ?? []),
          adminApi.getAllInvoices({}).then((d: unknown) => {
            const payload = d as { invoices?: AdminInvoiceRow[] };
            const list = Array.isArray(payload?.invoices) ? payload.invoices : [];
            return list.slice(0, 6);
          }),
          adminApi.getContracts({ limit: 6, excludeDraft: true }).then(({ contracts }) =>
            (contracts as Array<{ id: string; jobTitle?: string; status?: string; createdAt?: number; totalAmount?: string }>)?.slice(0, 6) ?? []
          ),
          adminApi.getTransactionsReport({ periods: 12 }).then(({ reports }) => reports ?? []),
          adminApi.getInvoicesReport({ periods: 12 }).then(({ reports }) => reports ?? []),
          adminApi.getContractsReport({ periods: 12 }).then(({ reports }) => reports ?? []),
          adminApi.getWaitlistReport({ periods: 12 }).then(({ reports }) => reports ?? []),
        ]);
        const metricsRes = results[0].status === 'fulfilled' ? (results[0].value as PlatformMetrics | null) : null;
        const revenuePayload = results[1].status === 'fulfilled' ? (results[1].value as Array<{ period: string; amount: string; count?: number }>) : null;
        const growthPayload = results[2].status === 'fulfilled' ? (results[2].value as Array<{ period: string; count: number }>) : null;
        const invoicesPayload = results[3].status === 'fulfilled' ? (results[3].value as AdminInvoiceRow[]) : null;
        const recentContractsList = results[4].status === 'fulfilled' ? (results[4].value as Array<{ id: string; jobTitle?: string; status?: string; createdAt?: number; totalAmount?: string }>) : null;
        const transactionsPayload = results[5].status === 'fulfilled' ? (results[5].value as Array<{ period: string; count: number }>) : null;
        const invoicesReportPayload = results[6].status === 'fulfilled' ? (results[6].value as Array<{ period: string; count: number }>) : null;
        const contractsPayload = results[7].status === 'fulfilled' ? (results[7].value as Array<{ period: string; count: number }>) : null;
        const waitlistPayload = results[8].status === 'fulfilled' ? (results[8].value as Array<{ period: string; count: number }>) : null;
        if (metricsRes == null && results[0].status === 'rejected') {
          setError(results[0].reason instanceof Error ? results[0].reason.message : 'Failed to load metrics');
        }
        setMetrics(metricsRes ?? null);
        setRevenueReport(Array.isArray(revenuePayload) ? revenuePayload : []);
        setUsersGrowthReport(Array.isArray(growthPayload) ? growthPayload : []);
        setRecentInvoices(Array.isArray(invoicesPayload) ? invoicesPayload : []);
        setRecentContracts(Array.isArray(recentContractsList) ? recentContractsList : []);
        setTransactionsReport(Array.isArray(transactionsPayload) ? transactionsPayload : []);
        setInvoicesReport(Array.isArray(invoicesReportPayload) ? invoicesReportPayload : []);
        setContractsReport(Array.isArray(contractsPayload) ? contractsPayload : []);
        setWaitlistReport(Array.isArray(waitlistPayload) ? waitlistPayload : []);
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

  const invoiceBarData = invoicesReport.length > 0 ? invoicesReport.slice(0, 12) : [{ period: '—', count: 0 }];
  const contractBarData = contractsReport.length > 0 ? contractsReport : [{ period: '—', count: 0 }];
  const transactionsLineData = transactionsReport.length > 0 ? transactionsReport : [{ period: '—', count: 0 }];
  const waitlistAreaData = waitlistReport.length > 0 ? waitlistReport : [{ period: '—', count: 0 }];

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
    <div className="flex-1 overflow-auto w-full flex flex-col items-center">
      <div className="w-full max-w-[1600px] mx-auto px-2 sm:px-4 lg:px-6 py-5 sm:py-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-6 sm:mb-8">Dashboard</h1>

        {error && (
          <div className="mb-6 p-3 sm:p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs sm:text-sm">
            {error}
          </div>
        )}

        {/* Row 1: Four metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-[#111111] border border-gray-800 rounded-xl px-3 py-4 sm:p-6 shadow-xl shadow-black/20 hover:border-gray-700 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-xs sm:text-sm font-medium text-gray-400">My Balance</h3>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-teal-500/20 text-teal-400">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">${formatAmount(Number(metrics?.invoices?.totalVolume ?? 0))}</p>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm font-medium">
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
          <div className="bg-[#111111] border border-gray-800 rounded-xl px-3 py-4 sm:p-6 shadow-xl shadow-black/20 hover:border-gray-700 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-xs sm:text-sm font-medium text-gray-400">Net Profit</h3>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-green-500/20 text-green-400">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">${formatBigNumber(metrics?.revenue?.total)}</p>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm font-medium">
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
          <div className="bg-[#111111] border border-gray-800 rounded-xl px-3 py-4 sm:p-6 shadow-xl shadow-black/20 hover:border-gray-700 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-xs sm:text-sm font-medium text-gray-400">Expenses</h3>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-amber-500/20 text-amber-400">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2h-2m-4-1V7a2 2 0 012-2h2a2 2 0 012 2v1" />
              </svg>
              </div>
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">{metrics?.invoices?.pending ?? 0}</p>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-500">Pending invoices</p>
          </div>
          <div className="bg-[#111111] border border-gray-800 rounded-xl px-3 py-4 sm:p-6 shadow-xl shadow-black/20 hover:border-gray-700 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-xs sm:text-sm font-medium text-gray-400">User growth</h3>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-blue-500/20 text-blue-400">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              </div>
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">{metrics?.users?.total ?? 0}</p>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-500">
              Today: {metrics?.users?.newToday ?? 0} · Week: {metrics?.users?.newThisWeek ?? 0} · Month: {metrics?.users?.newThisMonth ?? 0}
            </p>
          </div>
        </div>

        {/* Transactions by month – full width (top chart) */}
        <div className="bg-[#111111] border border-gray-800 rounded-xl px-3 py-4 sm:p-6 shadow-xl shadow-black/20 hover:border-gray-700 transition-colors mb-6 sm:mb-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-white">Transactions by month</h3>
              <p className="text-xs sm:text-sm text-gray-500">Transaction count per period (last 12 months)</p>
            </div>
            <Link href="/admin/transactions" className="text-xs sm:text-sm text-teal-400 hover:text-teal-300 font-medium py-2 sm:py-0 -my-2 sm:my-0 min-h-[44px] sm:min-h-0 flex items-center justify-end sm:justify-start" aria-label="View transactions">
              View Transactions
            </Link>
          </div>
          <div className="h-[220px] sm:h-[280px] w-full min-h-[200px] sm:min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={transactionsLineData} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
                  axisLine={{ stroke: CHART_COLORS.grid }}
                  tickLine={false}
                  tickMargin={6}
                  minTickGap={24}
                  interval="preserveStartEnd"
                  tickFormatter={(v) => formatPeriodLabel(String(v))}
                />
                <YAxis tick={{ fill: CHART_COLORS.tick, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: CHART_COLORS.tooltipBg,
                    border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#e5e7eb' }}
                  formatter={(value: number | undefined) => [String(value ?? 0), 'Transactions']}
                  labelFormatter={(label) => `Period: ${formatPeriodLabel(String(label))}`}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={CHART_COLORS.transactions.primary}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.transactions.primary, r: 3 }}
                  name="Transactions"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User signups by month – full width */}
        <div className="bg-[#111111] border border-gray-800 rounded-xl px-3 py-4 sm:p-6 shadow-xl shadow-black/20 hover:border-gray-700 transition-colors mb-6 sm:mb-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-white">User signups by month</h3>
              <p className="text-xs sm:text-sm text-gray-500">
                {hasUsersGrowthData ? 'Last 12 months (real data)' : 'No signup data yet'}
              </p>
            </div>
            <Link href="/admin/users" className="text-xs sm:text-sm text-teal-400 hover:text-teal-300 font-medium py-2 sm:py-0 -my-2 sm:my-0 min-h-[44px] sm:min-h-0 flex items-center justify-end sm:justify-start" aria-label="View users">
              View Users
            </Link>
          </div>
          <div className="h-[220px] sm:h-[280px] w-full min-h-[200px] sm:min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usersChartToShow} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
                  axisLine={{ stroke: CHART_COLORS.grid }}
                  tickLine={false}
                  tickMargin={6}
                  minTickGap={24}
                  interval="preserveStartEnd"
                  tickFormatter={(v) => formatPeriodLabel(String(v))}
                />
                <YAxis tick={{ fill: CHART_COLORS.tick, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: CHART_COLORS.tooltipBg,
                    border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#e5e7eb' }}
                  formatter={(value: number | undefined) => [String(value ?? 0), 'Signups']}
                  labelFormatter={(label) => `Period: ${formatPeriodLabel(String(label))}`}
                />
                <Bar dataKey="count" fill={CHART_COLORS.users.primary} radius={[4, 4, 0, 0]} name="Signups" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Invoice (bar) + Contract (bar) side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-[#111111] border border-gray-800 rounded-xl px-3 py-4 sm:p-6 shadow-xl shadow-black/20 hover:border-gray-700 transition-colors">
            <div className="mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-white">Invoices (completed) by month</h3>
              <p className="text-xs sm:text-sm text-gray-500">Completed invoices per period</p>
            </div>
            <div className="h-[200px] sm:h-[240px] w-full min-h-[180px] sm:min-h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={invoiceBarData} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
                    axisLine={{ stroke: CHART_COLORS.grid }}
                    tickLine={false}
                    tickMargin={6}
                    minTickGap={24}
                    interval="preserveStartEnd"
                    tickFormatter={(v) => formatPeriodLabel(String(v))}
                  />
                  <YAxis tick={{ fill: CHART_COLORS.tick, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: CHART_COLORS.tooltipBg,
                      border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#e5e7eb' }}
                    formatter={(value: number | undefined) => [String(value ?? 0), 'Invoices']}
                    labelFormatter={(label) => `Period: ${formatPeriodLabel(String(label))}`}
                  />
                  <Bar dataKey="count" fill={CHART_COLORS.invoice.primary} radius={[4, 4, 0, 0]} name="Invoices" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-[#111111] border border-gray-800 rounded-xl px-3 py-4 sm:p-6 shadow-xl shadow-black/20 hover:border-gray-700 transition-colors">
            <div className="mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-white">Contracts by month</h3>
              <p className="text-xs sm:text-sm text-gray-500">New contracts created per period</p>
            </div>
            <div className="h-[200px] sm:h-[240px] w-full min-h-[180px] sm:min-h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={contractBarData} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
                    axisLine={{ stroke: CHART_COLORS.grid }}
                    tickLine={false}
                    tickMargin={6}
                    minTickGap={24}
                    interval="preserveStartEnd"
                    tickFormatter={(v) => formatPeriodLabel(String(v))}
                  />
                  <YAxis tick={{ fill: CHART_COLORS.tick, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: CHART_COLORS.tooltipBg,
                      border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#e5e7eb' }}
                    formatter={(value: number | undefined) => [String(value ?? 0), 'Contracts']}
                    labelFormatter={(label) => `Period: ${formatPeriodLabel(String(label))}`}
                  />
                  <Bar dataKey="count" fill={CHART_COLORS.contract.primary} radius={[4, 4, 0, 0]} name="Contracts" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Waitlist – area chart full width */}
        <div className="bg-[#111111] border border-gray-800 rounded-xl px-3 py-4 sm:p-6 shadow-xl shadow-black/20 hover:border-gray-700 transition-colors mb-6 sm:mb-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-white">Waitlist signups by month</h3>
              <p className="text-xs sm:text-sm text-gray-500">New waitlist signups per period</p>
            </div>
            <Link href="/admin/waitlist" className="text-xs sm:text-sm text-teal-400 hover:text-teal-300 font-medium py-2 sm:py-0 -my-2 sm:my-0 min-h-[44px] sm:min-h-0 flex items-center justify-end sm:justify-start" aria-label="View waitlist">
              View Waitlist
            </Link>
          </div>
          <div className="h-[220px] sm:h-[280px] w-full min-h-[200px] sm:min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={waitlistAreaData} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                <defs>
                  <linearGradient id="fillWaitlist" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.waitlist.primary} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={CHART_COLORS.waitlist.primary} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
                  axisLine={{ stroke: CHART_COLORS.grid }}
                  tickLine={false}
                  tickMargin={6}
                  minTickGap={24}
                  interval="preserveStartEnd"
                  tickFormatter={(v) => formatPeriodLabel(String(v))}
                />
                <YAxis tick={{ fill: CHART_COLORS.tick, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: CHART_COLORS.tooltipBg,
                    border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#e5e7eb' }}
                  formatter={(value: number | undefined) => [String(value ?? 0), 'Signups']}
                  labelFormatter={(label) => `Period: ${formatPeriodLabel(String(label))}`}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={CHART_COLORS.waitlist.primary}
                  strokeWidth={2}
                  fill="url(#fillWaitlist)"
                  name="Waitlist"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent invoices + Recent contracts side by side (6 each) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-[#111111] border border-gray-800 rounded-xl px-3 py-4 sm:p-6 shadow-xl shadow-black/20 hover:border-gray-700 transition-colors">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white">Recent invoices</h3>
                <p className="text-xs sm:text-sm text-gray-500">Latest invoice activity</p>
              </div>
              <Link href="/admin/invoices" className="text-xs sm:text-sm text-teal-400 hover:text-teal-300 font-medium py-2 sm:py-0 -my-2 sm:my-0 min-h-[44px] sm:min-h-0 flex items-center justify-end sm:justify-start" aria-label="View all invoices">
                View all
              </Link>
            </div>
            <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 overflow-y-visible" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-xs sm:text-sm min-w-[360px]">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-800">
                    <th className="pb-1.5 sm:pb-2 pr-1.5 sm:pr-2">Name</th>
                    <th className="pb-1.5 sm:pb-2 pr-1.5 sm:pr-2">Date</th>
                    <th className="pb-1.5 sm:pb-2 pr-1.5 sm:pr-2">Type</th>
                    <th className="pb-1.5 sm:pb-2 pr-1.5 sm:pr-2">Status</th>
                    <th className="pb-1.5 sm:pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionsRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">
                        No recent invoices.
                      </td>
                    </tr>
                  ) : (
                    transactionsRows.map((row, i) => (
                      <tr key={i} className="border-b border-gray-800/50">
                        <td className="py-2 sm:py-3 pr-1.5 sm:pr-2">
                          <span className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full mr-1.5 sm:mr-2 bg-teal-400" />
                          <span className="text-white">{row.name}</span>
                        </td>
                        <td className="py-2 sm:py-3 pr-1.5 sm:pr-2 text-gray-400">{row.date}</td>
                        <td className="py-2 sm:py-3 pr-1.5 sm:pr-2">
                          <span className={row.type === 'Income' ? 'text-green-400' : 'text-amber-400'}>{row.type}</span>
                        </td>
                        <td className="py-2 sm:py-3 pr-1.5 sm:pr-2 text-gray-400 text-xs sm:text-sm">{row.status}</td>
                        <td
                          className={`py-2 sm:py-3 text-right font-medium text-xs sm:text-sm ${row.type === 'Income' ? 'text-green-400' : 'text-red-400'}`}
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
          <div className="bg-[#111111] border border-gray-800 rounded-xl px-3 py-4 sm:p-6 shadow-xl shadow-black/20 hover:border-gray-700 transition-colors">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white">Recent contracts</h3>
                <p className="text-xs sm:text-sm text-gray-500">Latest contract activity</p>
              </div>
              <Link href="/admin/contracts" className="text-xs sm:text-sm text-teal-400 hover:text-teal-300 font-medium py-2 sm:py-0 -my-2 sm:my-0 min-h-[44px] sm:min-h-0 flex items-center justify-end sm:justify-start" aria-label="View all contracts">
                View all
              </Link>
            </div>
            <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 overflow-y-visible" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-xs sm:text-sm min-w-[320px]">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-800">
                    <th className="pb-1.5 sm:pb-2 pr-1.5 sm:pr-2">Title</th>
                    <th className="pb-1.5 sm:pb-2 pr-1.5 sm:pr-2">Date</th>
                    <th className="pb-1.5 sm:pb-2 pr-1.5 sm:pr-2">Status</th>
                    <th className="pb-1.5 sm:pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentContracts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">
                        No recent contracts.
                      </td>
                    </tr>
                  ) : (
                    recentContracts.map((c) => {
                      const dateStr = c.createdAt != null
                        ? (c.createdAt > 1e12 ? format(new Date(c.createdAt), 'yyyy-MM-dd') : format(new Date(c.createdAt * 1000), 'yyyy-MM-dd'))
                        : '—';
                      return (
                        <tr key={c.id} className="border-b border-gray-800/50">
                          <td className="py-2 sm:py-3 pr-1.5 sm:pr-2">
                            <Link href={`/admin/contracts/${c.id}`} className="inline-flex items-center gap-1.5 text-white hover:text-teal-400 transition-colors">
                              <span className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-indigo-400 shrink-0" />
                              <span className="truncate max-w-[120px] sm:max-w-[180px]">{c.jobTitle || 'Untitled'}</span>
                            </Link>
                          </td>
                          <td className="py-2 sm:py-3 pr-1.5 sm:pr-2 text-gray-400">{dateStr}</td>
                          <td className="py-2 sm:py-3 pr-1.5 sm:pr-2">
                            <span className="text-gray-400 text-xs sm:text-sm">{c.status ?? '—'}</span>
                          </td>
                          <td className="py-2 sm:py-3 text-right font-medium text-xs sm:text-sm text-teal-400">
                            ${formatAmount(c.totalAmount)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
