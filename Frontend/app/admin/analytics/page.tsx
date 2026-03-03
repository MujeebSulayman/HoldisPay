'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/admin';
import { PageLoader } from '@/components/AppLoader';

type Period = 'daily' | 'weekly' | 'monthly';

export default function AdminAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'invoice' | 'revenue' | 'volume' | 'users' | 'segmentation'>('invoice');
  const [loading, setLoading] = useState(true);
  const [invoiceAnalytics, setInvoiceAnalytics] = useState<{
    totalInvoices?: number;
    totalVolume?: string;
    byStatus?: Record<string, number>;
    byToken?: Record<string, { count: number; volume: string }>;
    completionRate?: number;
  } | null>(null);
  const [revenueReport, setRevenueReport] = useState<Array<{ period: string; amount: string; count?: number }>>([]);
  const [revenueForecast, setRevenueForecast] = useState<{ forecast: Array<{ date: string; amount: string }> } | null>(null);
  const [period, setPeriod] = useState<Period>('monthly');
  const [transactionVolume, setTransactionVolume] = useState<Array<{ token: string; volume: string; count?: number }>>([]);
  const [topUsers, setTopUsers] = useState<Array<{ userId: string; email?: string; totalVolume: string }>>([]);
  const [segmentation, setSegmentation] = useState<{ active: number; inactive: number; highValue: number; atRisk: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInvoiceAnalytics = async () => {
    try {
      const data = await adminApi.getInvoiceAnalytics({});
      setInvoiceAnalytics(data as typeof invoiceAnalytics);
    } catch (e) {
      console.error(e);
      setInvoiceAnalytics(null);
    }
  };

  const loadRevenueReport = async () => {
    try {
      const data = await adminApi.getRevenueReport({ period }) as { reports?: Array<{ period: string; totalRevenue: string; transactionCount?: number }> };
      const reports = Array.isArray(data?.reports) ? data.reports : [];
      setRevenueReport(reports.map((r) => ({ period: r.period, amount: r.totalRevenue, count: r.transactionCount })));
    } catch (e) {
      console.error(e);
      setRevenueReport([]);
    }
  };

  const loadRevenueForecast = async () => {
    try {
      const data = await adminApi.getRevenueForecast(30);
      setRevenueForecast(data as typeof revenueForecast);
    } catch (e) {
      console.error(e);
      setRevenueForecast(null);
    }
  };

  const loadTransactionVolume = async () => {
    try {
      const data = await adminApi.getTransactionVolume() as Record<string, { volume?: string; count?: number }> | undefined;
      if (!data || typeof data !== 'object') {
        setTransactionVolume([]);
        return;
      }
      setTransactionVolume(
        Object.entries(data).map(([token, v]) => ({ token, volume: v.volume ?? '0', count: v.count }))
      );
    } catch (e) {
      console.error(e);
      setTransactionVolume([]);
    }
  };

  const loadTopUsers = async () => {
    try {
      const data = await adminApi.getTopUsers(10);
      const users = (data as { users?: typeof topUsers })?.users ?? (Array.isArray(data) ? data : []);
      setTopUsers(users);
    } catch (e) {
      console.error(e);
      setTopUsers([]);
    }
  };

  const loadSegmentation = async () => {
    try {
      const data = await adminApi.getUserSegmentation();
      setSegmentation(data as typeof segmentation);
    } catch (e) {
      console.error(e);
      setSegmentation(null);
    }
  };

  useEffect(() => {
    setError(null);
    setLoading(true);
    const run = async () => {
      try {
        if (activeTab === 'invoice') await loadInvoiceAnalytics();
        else if (activeTab === 'revenue') {
          await loadRevenueReport();
          await loadRevenueForecast();
        } else if (activeTab === 'volume') await loadTransactionVolume();
        else if (activeTab === 'users') await loadTopUsers();
        else if (activeTab === 'segmentation') await loadSegmentation();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'revenue') loadRevenueReport();
  }, [period]);

  const tabs = [
    { id: 'invoice' as const, label: 'Invoice analytics' },
    { id: 'revenue' as const, label: 'Revenue' },
    { id: 'volume' as const, label: 'Transaction volume' },
    { id: 'users' as const, label: 'Top users' },
    { id: 'segmentation' as const, label: 'User segmentation' },
  ];

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-white mb-6">Analytics</h2>

        <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-800 pb-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.id ? 'bg-teal-500/20 text-teal-400' : 'bg-[#111111] text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <PageLoader />
          </div>
        ) : (
          <>
            {activeTab === 'invoice' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-[#111111] border border-gray-800 rounded-lg p-4">
                    <p className="text-gray-400 text-sm">Total invoices</p>
                    <p className="text-2xl font-bold text-white">{invoiceAnalytics?.totalInvoices ?? 0}</p>
                  </div>
                  <div className="bg-[#111111] border border-gray-800 rounded-lg p-4">
                    <p className="text-gray-400 text-sm">Total volume</p>
                    <p className="text-2xl font-bold text-white">{invoiceAnalytics?.totalVolume ?? '0'}</p>
                  </div>
                  <div className="bg-[#111111] border border-gray-800 rounded-lg p-4">
                    <p className="text-gray-400 text-sm">Completion rate</p>
                    <p className="text-2xl font-bold text-white">{invoiceAnalytics?.completionRate ?? 0}%</p>
                  </div>
                </div>
                {invoiceAnalytics?.byStatus && Object.keys(invoiceAnalytics.byStatus).length > 0 && (
                  <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">By status</h3>
                    <div className="space-y-2">
                      {Object.entries(invoiceAnalytics.byStatus).map(([status, count]) => (
                        <div key={status} className="flex justify-between text-sm">
                          <span className="text-gray-400">{status}</span>
                          <span className="text-white">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {invoiceAnalytics?.byToken && Object.keys(invoiceAnalytics.byToken).length > 0 && (
                  <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">By token</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-400 border-b border-gray-800">
                            <th className="py-2">Token</th>
                            <th className="py-2">Count</th>
                            <th className="py-2">Volume</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(invoiceAnalytics.byToken).map(([token, d]) => (
                            <tr key={token} className="border-b border-gray-800/50">
                              <td className="py-2 text-white">{token}</td>
                              <td className="py-2 text-gray-300">{d.count}</td>
                              <td className="py-2 text-gray-300">{d.volume}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'revenue' && (
              <div className="space-y-6">
                <div className="flex gap-2 items-center">
                  <label className="text-gray-400 text-sm">Period</label>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as Period)}
                    className="bg-[#111111] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Revenue report</h3>
                  {revenueReport.length === 0 ? (
                    <p className="text-gray-400">No revenue data for this period.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-400 border-b border-gray-800">
                            <th className="py-2">Period</th>
                            <th className="py-2">Amount</th>
                            <th className="py-2">Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revenueReport.map((row, i) => (
                            <tr key={i} className="border-b border-gray-800/50">
                              <td className="py-2 text-white">{row.period}</td>
                              <td className="py-2 text-gray-300">{row.amount}</td>
                              <td className="py-2 text-gray-300">{row.count ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Revenue forecast (30 days)</h3>
                  {revenueForecast?.forecast?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-400 border-b border-gray-800">
                            <th className="py-2">Date</th>
                            <th className="py-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revenueForecast.forecast.slice(0, 14).map((row, i) => (
                            <tr key={i} className="border-b border-gray-800/50">
                              <td className="py-2 text-white">{row.date}</td>
                              <td className="py-2 text-gray-300">{row.amount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-400">No forecast data.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'volume' && (
              <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Transaction volume by token</h3>
                {transactionVolume.length === 0 ? (
                  <p className="text-gray-400">No volume data.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-800">
                          <th className="py-2">Token</th>
                          <th className="py-2">Volume</th>
                          <th className="py-2">Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactionVolume.map((row, i) => (
                          <tr key={i} className="border-b border-gray-800/50">
                            <td className="py-2 text-white">{row.token}</td>
                            <td className="py-2 text-gray-300">{row.volume}</td>
                            <td className="py-2 text-gray-300">{row.count ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'users' && (
              <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Top users by volume</h3>
                {topUsers.length === 0 ? (
                  <p className="text-gray-400">No user data.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-800">
                          <th className="py-2">User ID</th>
                          <th className="py-2">Email</th>
                          <th className="py-2">Total volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topUsers.map((u, i) => (
                          <tr key={i} className="border-b border-gray-800/50">
                            <td className="py-2 text-white font-mono truncate max-w-[200px]">{u.userId}</td>
                            <td className="py-2 text-gray-300">{u.email ?? '—'}</td>
                            <td className="py-2 text-gray-300">{u.totalVolume ?? '0'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'segmentation' && segmentation && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
                  <p className="text-gray-400 text-sm">Active</p>
                  <p className="text-2xl font-bold text-white">{segmentation.active}</p>
                </div>
                <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
                  <p className="text-gray-400 text-sm">Inactive</p>
                  <p className="text-2xl font-bold text-white">{segmentation.inactive}</p>
                </div>
                <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
                  <p className="text-gray-400 text-sm">High value</p>
                  <p className="text-2xl font-bold text-white">{segmentation.highValue}</p>
                </div>
                <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
                  <p className="text-gray-400 text-sm">At risk</p>
                  <p className="text-2xl font-bold text-white">{segmentation.atRisk}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
