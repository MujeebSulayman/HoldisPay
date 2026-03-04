import { apiClient } from './client';

export interface RegisterRequest {
  email: string;
  password: string;
  accountType: 'individual' | 'business';
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dateOfBirth?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    accountType: 'individual' | 'business';
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
    walletAddress: string;
    kycStatus: string;
    emailVerified: boolean;
    phoneVerified: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface SessionInfo {
  id: string;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  last_activity_at: string;
  created_at: string;
  is_active: boolean;
}

export const authApi = {
  register: (data: RegisterRequest) =>
    apiClient.post<AuthResponse>('/api/users/register', data),

  login: (data: LoginRequest) =>
    apiClient.post<AuthResponse>('/api/auth/login', data),

  refreshToken: async (refreshToken: string) => {
    return apiClient.post<RefreshTokenResponse>('/api/auth/refresh', { refreshToken });
  },

  logout: async () => {
    try {
      await apiClient.post('/api/auth/logout', {});
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
    }
  },

  logoutAllSessions: () =>
    apiClient.post('/api/auth/logout-all', {}),

  getSessions: () =>
    apiClient.get<SessionInfo[]>('/api/auth/sessions'),

  revokeSession: (sessionId: string) =>
    apiClient.delete(`/api/auth/sessions/${sessionId}`),

  requestPasswordReset: (email: string) =>
    apiClient.post('/api/auth/password-reset/request', { email }),

  resetPassword: (token: string, newPassword: string) =>
    apiClient.post('/api/auth/password-reset/reset', { token, newPassword }),

  validateResetToken: (token: string) =>
    apiClient.get<{ valid: boolean }>(`/api/auth/password-reset/validate?token=${token}`),

  verifyEmail: (token: string) =>
    apiClient.get<{ success: boolean; message?: string; data?: { user: AuthResponse['user']; accessToken: string; refreshToken: string } }>(
      `/api/auth/verify-email?token=${encodeURIComponent(token)}`
    ),

  getProfile: () => apiClient.get('/api/users/profile'),
};
