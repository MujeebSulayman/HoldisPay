'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, LoginRequest, RegisterRequest } from '../api/auth';

interface User {
  id: string;
  email: string;
  accountType: 'individual' | 'business';
  firstName: string;
  lastName: string;
  tag?: string;
  phoneNumber: string | null;
  walletAddress: string;
  kycStatus: string;
  emailVerified: boolean;
  phoneVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (data: LoginRequest) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterRequest) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  showInactivityWarning: boolean;
  extendSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const WARNING_TIME = 2 * 60 * 1000; // Show warning 2 minutes before logout
const TOKEN_REFRESH_INTERVAL = 10 * 60 * 1000; // Refresh token every 10 minutes

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const router = useRouter();
  
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const warningTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const refreshTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const clearAllTimers = () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  };

  const logout = useCallback(() => {
    clearAllTimers();
    authApi.logout();
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    setShowInactivityWarning(false);
    router.push('/signin');
  }, [router]);

  const refreshAccessToken = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        logout();
        return;
      }

      const response = await authApi.refreshToken(refreshToken);

      if (response.success && response.data) {
        localStorage.setItem('token', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
      } else {
        logout();
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
    }
  }, [logout]);

  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowInactivityWarning(false);

    clearAllTimers();

    // Warning timer (13 minutes)
    warningTimerRef.current = setTimeout(() => {
      setShowInactivityWarning(true);
    }, INACTIVITY_TIMEOUT - WARNING_TIME);

    // Logout timer (15 minutes)
    inactivityTimerRef.current = setTimeout(() => {
      logout();
    }, INACTIVITY_TIMEOUT);
  }, [logout]);

  const extendSession = useCallback(() => {
    resetInactivityTimer();
    refreshAccessToken();
  }, [resetInactivityTimer, refreshAccessToken]);

  useEffect(() => {
    // Load user from localStorage on mount
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    const storedRefreshToken = localStorage.getItem('refreshToken');

    if (storedUser && storedToken && storedRefreshToken) {
      setUser(JSON.parse(storedUser));
      resetInactivityTimer();

      // Set up automatic token refresh every 10 minutes
      refreshTimerRef.current = setInterval(() => {
        refreshAccessToken();
      }, TOKEN_REFRESH_INTERVAL);
    }
    setLoading(false);

    return () => {
      clearAllTimers();
    };
  }, [resetInactivityTimer, refreshAccessToken]);

  useEffect(() => {
    if (!user) return;

    // Track user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

    const handleActivity = () => {
      const now = Date.now();
      // Only reset if more than 30 seconds since last activity (avoid excessive resets)
      if (now - lastActivityRef.current > 30000) {
        resetInactivityTimer();
      }
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [user, resetInactivityTimer]);

  const refreshUser = useCallback(async () => {
    const u = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (!u) return;
    try {
      const parsed = JSON.parse(u) as User;
      const { userApi } = await import('../api/user');
      const res = await userApi.getProfile(parsed.id);
      if (res.success && res.data) {
        const d = res.data as { emailVerified?: boolean; phoneVerified?: boolean };
        const updated = { ...parsed, emailVerified: d.emailVerified ?? parsed.emailVerified, phoneVerified: d.phoneVerified ?? parsed.phoneVerified };
        setUser(updated);
        if (typeof window !== 'undefined') localStorage.setItem('user', JSON.stringify(updated));
      }
    } catch {
      // ignore
    }
  }, []);

  const login = async (data: LoginRequest) => {
    try {
      const response = await authApi.login(data);

      if (response.success && response.data) {
        localStorage.setItem('token', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setUser(response.data.user);
        resetInactivityTimer();

        // Set up automatic token refresh
        refreshTimerRef.current = setInterval(() => {
          refreshAccessToken();
        }, TOKEN_REFRESH_INTERVAL);

        return { success: true };
      }

      return { success: false, error: response.error || 'Login failed' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  };

  const register = async (data: RegisterRequest) => {
    try {
      const response = await authApi.register(data);

      if (response.success && response.data) {
        localStorage.setItem('token', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setUser(response.data.user);
        resetInactivityTimer();

        // Set up automatic token refresh
        refreshTimerRef.current = setInterval(() => {
          refreshAccessToken();
        }, TOKEN_REFRESH_INTERVAL);

        return { success: true, user: response.data.user };
      }

      return { success: false, error: response.error || 'Registration failed' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, showInactivityWarning, extendSession }}>
      {children}
      
      {/* Inactivity Warning Modal */}
      {showInactivityWarning && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-500/20 rounded-full mb-4">
                <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Session Expiring Soon</h3>
              <p className="text-gray-400 text-sm">
                You've been inactive for a while. You'll be logged out in 2 minutes for security.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={logout}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
              >
                Logout Now
              </button>
              <button
                onClick={extendSession}
                className="flex-1 px-4 py-3 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg transition-colors"
              >
                Stay Logged In
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
