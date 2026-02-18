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

export const authApi = {
  register: (data: RegisterRequest) =>
    apiClient.post<AuthResponse>('/api/users/register', data),

  login: (data: LoginRequest) =>
    apiClient.post<AuthResponse>('/api/users/login', data),

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  },

  getProfile: () => apiClient.get('/api/users/profile'),
};
