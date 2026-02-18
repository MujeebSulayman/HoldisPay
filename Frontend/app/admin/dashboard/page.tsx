'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';

interface PlatformMetrics {
  users: {
    total: number;
    active: number;
    newThisMonth: number;
  };
  invoices: {
    total: number;
    completed: number;
    pending: number;
    totalVolume: string;
  };
  revenue: {
    total: string;
    thisMonth: string;
    lastMonth: string;
  };
}

export default function AdminDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (!token || !user) {
      router.push('/admin/login');
      return;
    }

    const parsedUser = JSON.parse(user);
    if (parsedUser.accountType !== 'admin') {
      router.push('/');
      return;
    }

    fetchMetrics();
  }, [router]);

  const fetchMetrics = async () => {
    try {
      const response = await apiClient.get<PlatformMetrics>('/api/admin/metrics');
      if (response.data) {
        setMetrics(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-teal-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <div className="bg-[#111111] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-white">
              hol<span className="text-teal-400">D</span>is Admin
            </h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-white mb-6">Platform Overview</h2>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Users */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-400 text-sm">Total Users</h3>
              <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-white">{metrics?.users?.total || 0}</p>
            <p className="text-sm text-gray-500 mt-1">{metrics?.users?.active || 0} active</p>
          </div>

          {/* Total Invoices */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-400 text-sm">Total Invoices</h3>
              <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-white">{metrics?.invoices?.total || 0}</p>
            <p className="text-sm text-gray-500 mt-1">{metrics?.invoices?.completed || 0} completed</p>
          </div>

          {/* Total Volume */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-400 text-sm">Total Volume</h3>
              <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-white">${metrics?.invoices?.totalVolume || '0'}</p>
            <p className="text-sm text-gray-500 mt-1">USD equivalent</p>
          </div>

          {/* Platform Revenue */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-400 text-sm">Platform Revenue</h3>
              <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-white">${metrics?.revenue?.total || '0'}</p>
            <p className="text-sm text-gray-500 mt-1">${metrics?.revenue?.thisMonth || '0'} this month</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button 
            onClick={() => router.push('/admin/users')}
            className="bg-[#111111] border border-gray-800 rounded-lg p-6 hover:border-teal-400 transition-colors text-left"
          >
            <h3 className="text-lg font-semibold text-white mb-2">Manage Users</h3>
            <p className="text-gray-400 text-sm">View and manage user accounts</p>
          </button>

          <button 
            onClick={() => router.push('/admin/invoices')}
            className="bg-[#111111] border border-gray-800 rounded-lg p-6 hover:border-teal-400 transition-colors text-left"
          >
            <h3 className="text-lg font-semibold text-white mb-2">View Invoices</h3>
            <p className="text-gray-400 text-sm">Monitor all platform invoices</p>
          </button>

          <button 
            onClick={() => router.push('/admin/analytics')}
            className="bg-[#111111] border border-gray-800 rounded-lg p-6 hover:border-teal-400 transition-colors text-left"
          >
            <h3 className="text-lg font-semibold text-white mb-2">Analytics</h3>
            <p className="text-gray-400 text-sm">View detailed platform analytics</p>
          </button>
        </div>
      </div>
    </div>
  );
}
