'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api/admin';
import { PageLoader } from '@/components/AppLoader';

interface WaitlistEntry {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}

export default function AdminWaitlistPage() {
  const router = useRouter();
  const [items, setItems] = useState<WaitlistEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');
    let user: { accountType?: string } | null = null;
    try {
      if (userJson) user = JSON.parse(userJson);
    } catch {
      // ignore
    }
    if (!token || user?.accountType !== 'admin') {
      router.push('/admin/login');
      return;
    }

    const fetchWaitlist = async () => {
      try {
        const result = await adminApi.getWaitlist();
        setItems(result.items);
        setTotal(result.total);
      } catch (e) {
        console.error('Failed to load waitlist', e);
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };
    fetchWaitlist();
  }, [router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center glass-strong">
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-white">Waitlist</h2>
          <div className="flex items-center gap-3">
            <span className="px-4 py-2 bg-brand-400/10 text-brand-400 border border-brand-400/20 rounded-lg font-semibold">
              {total} {total === 1 ? 'person' : 'people'}
            </span>
          </div>
        </div>

        <div className="glass border border-white/10 rounded-lg overflow-hidden">
          {items.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No one on the waitlist yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/[0.06] border-b border-white/10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {items.map((entry, index) => (
                    <tr key={entry.id} className="hover:bg-white/[0.06] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-white">{entry.email}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {entry.name || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {new Date(entry.created_at).toLocaleString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
