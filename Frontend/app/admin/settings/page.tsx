'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/admin';
import { PageLoader } from '@/components/AppLoader';

export default function AdminSettingsPage() {
  const [health, setHealth] = useState<{ database: string; timestamp: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setError(null);
      setLoading(true);
    }, 0);
    adminApi
      .getSystemHealth()
      .then(setHealth)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load system health'))
      .finally(() => {
        clearTimeout(id);
        setLoading(false);
      });
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400 text-sm mb-6">System status and configuration.</p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <PageLoader />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-[#111111] border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">System health</h2>
              <dl className="space-y-3">
                <div className="flex justify-between items-center">
                  <dt className="text-gray-400">Database</dt>
                  <dd>
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        health?.database === 'ok'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {health?.database ?? 'unknown'}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-gray-400">Last checked</dt>
                  <dd className="text-gray-300 text-sm">
                    {health?.timestamp ? new Date(health.timestamp).toLocaleString() : '—'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
