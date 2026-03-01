'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api/client';

interface LoginResponse {
  user: {
    id: string;
    email: string;
    accountType: string;
    walletAddress: string;
  };
  accessToken: string;
  refreshToken: string;
}

export default function AdminLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const created = useMemo(() => searchParams.get('created') === '1', [searchParams]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post<LoginResponse>('/api/users/login', {
        email,
        password,
      });

      const data = response && typeof response === 'object' && 'data' in response ? (response as { data: LoginResponse }).data : null;
      if (!data?.user || !data?.accessToken) {
        setError((response as { error?: string })?.error ?? 'Invalid response from server');
        setLoading(false);
        return;
      }

      const { user, accessToken } = data;

      if (user.accountType !== 'admin') {
        setError('Access denied. Admin credentials required.');
        setLoading(false);
        return;
      }

      localStorage.setItem('token', accessToken);
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      router.push('/admin/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            HoldisPay Admin
          </h1>
          <p className="text-gray-400">Sign in to access the admin panel</p>
        </div>

        <div className="bg-[#111111] rounded-lg p-8 border border-gray-800">
          {created && (
            <div className="mb-6 rounded-lg bg-teal-500/10 border border-teal-500/30 p-3 text-teal-400 text-sm">
              Admin account created. Sign in below.
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal-400 transition-colors"
                placeholder="admin@holdispay.xyz"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal-400 transition-colors"
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-400 text-black font-semibold py-3 rounded-lg hover:bg-teal-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
