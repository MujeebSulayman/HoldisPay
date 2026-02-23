'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import Link from 'next/link';
import { PageLoader } from '@/components/AppLoader';

interface SessionInfo {
  id: string;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  last_activity_at: string;
  created_at: string;
  is_active: boolean;
}

export default function SecuritySettingsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await apiClient.get<SessionInfo[]>('/api/auth/sessions');
      if (response.success && response.data) {
        setSessions(response.data);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to end this session?')) return;

    setRevoking(sessionId);
    try {
      const response = await apiClient.delete(`/api/auth/sessions/${sessionId}`);
      if (response.success) {
        setSessions(sessions.filter(s => s.id !== sessionId));
      }
    } catch (error) {
      console.error('Failed to revoke session:', error);
    } finally {
      setRevoking(null);
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm('This will log you out from all devices. Continue?')) return;

    try {
      await apiClient.post('/api/auth/logout-all', {});
      window.location.href = '/signin';
    } catch (error) {
      console.error('Failed to logout all sessions:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getDeviceIcon = (deviceName: string | null) => {
    const device = deviceName?.toLowerCase() || '';
    if (device.includes('mobile') || device.includes('phone')) {
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
      </svg>
    );
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-teal-400 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Settings
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Security Settings</h1>
          <p className="text-gray-400">Manage your active sessions and account security</p>
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Active Sessions</h2>
              <p className="text-sm text-gray-400">
                These devices are currently logged into your account. Remove any sessions you don't recognize.
              </p>
            </div>
            <button
              onClick={handleLogoutAll}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl font-medium transition-colors"
            >
              Logout All Devices
            </button>
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <p className="text-gray-400">No active sessions found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-black/30 border border-gray-800 rounded-xl p-4 flex items-start justify-between"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gray-800 rounded-xl text-gray-400">
                      {getDeviceIcon(session.device_name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-medium">
                          {session.browser || 'Unknown Browser'} on {session.os || 'Unknown OS'}
                        </h3>
                        {session.is_active && (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-gray-400">
                        {session.ip_address && (
                          <p>IP: {session.ip_address}</p>
                        )}
                        <p>Last active: {formatDate(session.last_activity_at)}</p>
                        <p className="text-xs">Started: {formatDate(session.created_at)}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeSession(session.id)}
                    disabled={revoking === session.id}
                    className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 text-gray-400 border border-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {revoking === session.id ? 'Revoking...' : 'Revoke'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <div>
              <p className="text-sm text-gray-300">
                <span className="font-medium text-white">Security tip:</span> If you see any unfamiliar sessions, revoke them immediately and change your password.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
