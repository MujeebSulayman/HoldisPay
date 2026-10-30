'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import Link from 'next/link';
import { PageLoader } from '@/components/AppLoader';
import { ArrowLeft, Info, Monitor, ShieldCheck, Smartphone } from 'lucide-react';

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

export default function SecuritySettingsContent() {
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
        setSessions(sessions.filter((s) => s.id !== sessionId));
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
        <Smartphone className="w-5 h-5" />
      );
    }
    return (
      <Monitor className="w-5 h-5" />
    );
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-400 transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Settings
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Security Settings</h1>
          <p className="text-gray-400">Manage your active sessions and account security</p>
        </div>

        <div className="glass border border-white/10 rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Active Sessions</h2>
              <p className="text-sm text-gray-400">
                These devices are currently logged into your account. Remove any sessions you don't recognize.
              </p>
            </div>
            <button
              onClick={handleLogoutAll}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg font-medium transition-colors"
            >
              Logout All Devices
            </button>
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <ShieldCheck className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No active sessions found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-black/30 border border-white/10 rounded-lg p-4 flex items-start justify-between"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-white/[0.08] rounded-lg text-gray-400">
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
                        {session.ip_address && <p>IP: {session.ip_address}</p>}
                        <p>Last active: {formatDate(session.last_activity_at)}</p>
                        <p className="text-xs">Started: {formatDate(session.created_at)}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeSession(session.id)}
                    disabled={revoking === session.id}
                    className="px-3 py-1.5 text-sm bg-white/[0.08] hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 text-gray-400 border border-white/15 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {revoking === session.id ? 'Revoking...' : 'Revoke'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
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
