'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/admin';
import { PageLoader } from '@/components/AppLoader';

type WalletHealthItem = {
  addressId: string;
  address: string;
  userId: string;
  balance: string;
  hasLowBalance: boolean;
  hasStuckTransactions: boolean;
  lastActivity?: string;
  issues: string[];
};

type AddressItem = {
  userId: string;
  email: string;
  addressId: string;
  address: string;
  nativeBalance: string;
  tokenBalances: Array<{ symbol: string; balance: string }>;
  totalBalanceUSD?: string;
};

type AlertItem = {
  userId: string;
  email: string;
  address: string;
  balance: string;
  belowThreshold: string;
};

type TokenBreakdownItem = {
  token: string;
  totalBalance: string;
  userCount: number;
  averageBalance: string;
};

export default function AdminWalletsPage() {
  const [activeTab, setActiveTab] = useState<'health' | 'addresses' | 'alerts' | 'tokens'>('health');
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<{ wallets: WalletHealthItem[]; total: number; criticalIssues: number } | null>(null);
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsThreshold, setAlertsThreshold] = useState('1000000000000000');
  const [tokenBreakdown, setTokenBreakdown] = useState<TokenBreakdownItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = async () => {
    try {
      const data = await adminApi.getWalletHealth() as { wallets?: WalletHealthItem[]; total?: number; criticalIssues?: number };
      setHealth({
        wallets: Array.isArray(data?.wallets) ? data.wallets : [],
        total: data?.total ?? 0,
        criticalIssues: data?.criticalIssues ?? 0,
      });
    } catch (e) {
      console.error(e);
      setHealth(null);
    }
  };

  const loadAddresses = async () => {
    try {
      const data = await adminApi.getAllAddresses() as { addresses?: AddressItem[] };
      setAddresses(Array.isArray(data?.addresses) ? data.addresses : []);
    } catch (e) {
      console.error(e);
      setAddresses([]);
    }
  };

  const loadAlerts = async () => {
    try {
      const data = await adminApi.getLowBalanceAlerts(alertsThreshold) as { alerts?: AlertItem[] };
      setAlerts(Array.isArray(data?.alerts) ? data.alerts : []);
    } catch (e) {
      console.error(e);
      setAlerts([]);
    }
  };

  const loadTokenBreakdown = async () => {
    try {
      const data = await adminApi.getTokenBreakdown();
      setTokenBreakdown(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setTokenBreakdown([]);
    }
  };

  useEffect(() => {
    setError(null);
    setLoading(true);
    const run = async () => {
      try {
        if (activeTab === 'health') await loadHealth();
        else if (activeTab === 'addresses') await loadAddresses();
        else if (activeTab === 'alerts') await loadAlerts();
        else if (activeTab === 'tokens') await loadTokenBreakdown();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'alerts') {
      setLoading(true);
      loadAlerts().finally(() => setLoading(false));
    }
  }, [alertsThreshold]);

  const tabs = [
    { id: 'health' as const, label: 'Wallet health' },
    { id: 'addresses' as const, label: 'All addresses' },
    { id: 'alerts' as const, label: 'Low balance alerts' },
    { id: 'tokens' as const, label: 'Token breakdown' },
  ];

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-white mb-6">Wallets</h2>

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

        {activeTab === 'alerts' && (
          <div className="mb-4 flex items-center gap-2">
            <label className="text-gray-400 text-sm">Threshold (wei)</label>
            <input
              type="text"
              value={alertsThreshold}
              onChange={(e) => setAlertsThreshold(e.target.value)}
              className="bg-[#111111] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono w-48"
            />
          </div>
        )}

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
            {activeTab === 'health' && health && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#111111] border border-gray-800 rounded-lg p-4">
                    <p className="text-gray-400 text-sm">Total wallets</p>
                    <p className="text-2xl font-bold text-white">{health.total}</p>
                  </div>
                  <div className="bg-[#111111] border border-gray-800 rounded-lg p-4">
                    <p className="text-gray-400 text-sm">Critical issues</p>
                    <p className="text-2xl font-bold text-red-400">{health.criticalIssues}</p>
                  </div>
                </div>
                <div className="bg-[#111111] border border-gray-800 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-800 bg-[#0A0A0A]">
                          <th className="py-3 px-4">Address</th>
                          <th className="py-3 px-4">User ID</th>
                          <th className="py-3 px-4">Balance</th>
                          <th className="py-3 px-4">Issues</th>
                          <th className="py-3 px-4">Last activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {health.wallets.map((w) => (
                          <tr key={w.addressId} className="border-b border-gray-800/50 hover:bg-[#0A0A0A]/50">
                            <td className="py-2 px-4 font-mono text-white truncate max-w-[180px]">{w.address}</td>
                            <td className="py-2 px-4 text-gray-300 truncate max-w-[120px]">{w.userId}</td>
                            <td className="py-2 px-4 text-gray-300">{w.balance}</td>
                            <td className="py-2 px-4">
                              {w.issues.length > 0 ? (
                                <span className="text-amber-400">{w.issues.join(', ')}</span>
                              ) : (
                                <span className="text-gray-500">—</span>
                              )}
                            </td>
                            <td className="py-2 px-4 text-gray-400">{w.lastActivity ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'addresses' && (
              <div className="bg-[#111111] border border-gray-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-800 bg-[#0A0A0A]">
                        <th className="py-3 px-4">Address</th>
                        <th className="py-3 px-4">User ID</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Native balance</th>
                        <th className="py-3 px-4">Tokens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {addresses.map((a) => (
                        <tr key={a.addressId} className="border-b border-gray-800/50 hover:bg-[#0A0A0A]/50">
                          <td className="py-2 px-4 font-mono text-white truncate max-w-[180px]">{a.address}</td>
                          <td className="py-2 px-4 text-gray-300 truncate max-w-[120px]">{a.userId}</td>
                          <td className="py-2 px-4 text-gray-300">{a.email}</td>
                          <td className="py-2 px-4 text-gray-300">{a.nativeBalance}</td>
                          <td className="py-2 px-4 text-gray-400">
                            {a.tokenBalances?.length
                              ? a.tokenBalances.map((t) => `${t.symbol}: ${t.balance}`).join(', ')
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'alerts' && (
              <div className="bg-[#111111] border border-gray-800 rounded-lg overflow-hidden">
                {alerts.length === 0 ? (
                  <p className="p-6 text-gray-400">No low balance alerts for this threshold.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-800 bg-[#0A0A0A]">
                          <th className="py-3 px-4">Address</th>
                          <th className="py-3 px-4">User ID</th>
                          <th className="py-3 px-4">Email</th>
                          <th className="py-3 px-4">Balance</th>
                          <th className="py-3 px-4">Below threshold</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alerts.map((a, i) => (
                          <tr key={i} className="border-b border-gray-800/50 hover:bg-[#0A0A0A]/50">
                            <td className="py-2 px-4 font-mono text-white truncate max-w-[180px]">{a.address}</td>
                            <td className="py-2 px-4 text-gray-300 truncate max-w-[120px]">{a.userId}</td>
                            <td className="py-2 px-4 text-gray-300">{a.email}</td>
                            <td className="py-2 px-4 text-amber-400">{a.balance}</td>
                            <td className="py-2 px-4 text-gray-400">{a.belowThreshold}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tokens' && (
              <div className="bg-[#111111] border border-gray-800 rounded-lg overflow-hidden">
                {tokenBreakdown.length === 0 ? (
                  <p className="p-6 text-gray-400">No token data.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400 border-b border-gray-800 bg-[#0A0A0A]">
                          <th className="py-3 px-4">Token</th>
                          <th className="py-3 px-4">Total balance</th>
                          <th className="py-3 px-4">User count</th>
                          <th className="py-3 px-4">Average balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tokenBreakdown.map((t) => (
                          <tr key={t.token} className="border-b border-gray-800/50 hover:bg-[#0A0A0A]/50">
                            <td className="py-2 px-4 text-white font-medium">{t.token}</td>
                            <td className="py-2 px-4 text-gray-300">{t.totalBalance}</td>
                            <td className="py-2 px-4 text-gray-300">{t.userCount}</td>
                            <td className="py-2 px-4 text-gray-300">{t.averageBalance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
