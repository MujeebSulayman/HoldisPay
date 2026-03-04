const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const GET_CACHE_TTL_MS = 60_000; // 1 minute
const GET_CACHE_MAX_KEYS = 200;

/** Timeout for login/register so cold-start backends (e.g. Render free) have time to wake. */
const AUTH_COLD_START_TIMEOUT_MS = 90_000;
const AUTH_RETRY_DELAY_MS = 3_000;

function isAuthColdStartEndpoint(endpoint: string): boolean {
  return (
    endpoint.includes('/api/auth/login') ||
    endpoint.includes('/api/users/register')
  );
}

/** Register is not idempotent — do not retry on timeout/network or we may get "email already exists". */
function isRegisterEndpoint(endpoint: string): boolean {
  return endpoint.includes('/api/users/register');
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

function isRefreshEndpoint(endpoint: string): boolean {
  return endpoint.includes('/api/auth/refresh');
}

function shouldSkipGetCache(endpoint: string): boolean {
  return (
    endpoint.includes('/api/auth/') ||
    endpoint.includes('/logout') ||
    endpoint.includes('/sessions')
  );
}

interface CacheEntry<T> {
  data: ApiResponse<T>;
  expiresAt: number;
}

class ApiClient {
  private baseUrl: string;
  private getCache = new Map<string, CacheEntry<unknown>>();
  private getCacheKeyOrder: string[] = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getCached<T>(endpoint: string): ApiResponse<T> | undefined {
    if (shouldSkipGetCache(endpoint)) return undefined;
    const entry = this.getCache.get(endpoint) as CacheEntry<T> | undefined;
    if (!entry || Date.now() > entry.expiresAt) {
      if (entry) {
        this.getCache.delete(endpoint);
        this.getCacheKeyOrder = this.getCacheKeyOrder.filter((k) => k !== endpoint);
      }
      return undefined;
    }
    return entry.data;
  }

  private setGetCache<T>(endpoint: string, data: ApiResponse<T>): void {
    if (shouldSkipGetCache(endpoint)) return;
    if (this.getCacheKeyOrder.length >= GET_CACHE_MAX_KEYS) {
      const oldest = this.getCacheKeyOrder.shift();
      if (oldest) this.getCache.delete(oldest);
    }
    if (!this.getCacheKeyOrder.includes(endpoint)) this.getCacheKeyOrder.push(endpoint);
    this.getCache.set(endpoint, { data, expiresAt: Date.now() + GET_CACHE_TTL_MS });
  }

  /** Invalidate GET cache for endpoints that start with prefix (e.g. '/api/invoices'). */
  invalidateGetCache(prefix: string): void {
    for (const key of this.getCache.keys()) {
      if (key.startsWith(prefix)) {
        this.getCache.delete(key);
        this.getCacheKeyOrder = this.getCacheKeyOrder.filter((k) => k !== key);
      }
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Don't timeout register: it can take 10–30s (multi-chain wallets). Aborting would show a confusing error and the user may already exist.
    const timeoutMs =
      isAuthColdStartEndpoint(endpoint) && !isRegisterEndpoint(endpoint)
        ? AUTH_COLD_START_TIMEOUT_MS
        : undefined;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (timeoutMs && controller) {
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller?.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));

      if (response.status === 401 && typeof window !== 'undefined' && !isRetry && !isRefreshEndpoint(endpoint)) {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const { authApi } = await import('./auth');
          const refresh = await authApi.refreshToken(refreshToken);
          if (refresh.success && refresh.data) {
            localStorage.setItem('token', refresh.data.accessToken);
            localStorage.setItem('refreshToken', refresh.data.refreshToken);
            return this.request<T>(endpoint, options, true);
          }
        }
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/signin';
        return { success: false, error: (data && (data.message || data.error)) || 'Session expired' };
      }

      if (response.status === 503 && !isRetry) {
        await new Promise((r) => setTimeout(r, 800));
        return this.request<T>(endpoint, options, true);
      }

      if (!response.ok) {
        return {
          success: false,
          error: (data && (data.message || data.error)) || 'Request failed',
        };
      }

      if (options.method === 'GET' || !options.method) {
        this.setGetCache(endpoint, data);
      }
      return data;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      const isTimeoutOrNetwork =
        error instanceof Error &&
        (error.name === 'AbortError' || error.message?.includes('fetch') || error.message === 'Network error');
      if (
        isTimeoutOrNetwork &&
        isAuthColdStartEndpoint(endpoint) &&
        !isRegisterEndpoint(endpoint) &&
        !isRetry
      ) {
        await new Promise((r) => setTimeout(r, AUTH_RETRY_DELAY_MS));
        return this.request<T>(endpoint, options, true);
      }
      const rawMessage = error instanceof Error ? error.message : 'Network error';
      const isAborted = error instanceof Error && (error.name === 'AbortError' || /abort/i.test(rawMessage));
      if (isRegisterEndpoint(endpoint) && isAborted) {
        return {
          success: false,
          error:
            'Request was cancelled or took too long. If you already signed up, try signing in or check your email for the verification link.',
        };
      }
      return {
        success: false,
        error: rawMessage,
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const cached = this.getCached<T>(endpoint);
    if (cached !== undefined) return cached;
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    const res = await this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.success && endpoint.startsWith('/api/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const prefix = '/' + (parts[0] && parts[1] ? `${parts[0]}/${parts[1]}` : parts[0] || '');
      this.invalidateGetCache(prefix);
    }
    return res;
  }

  async put<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    const res = await this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (res.success && endpoint.startsWith('/api/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const prefix = '/' + (parts[0] && parts[1] ? `${parts[0]}/${parts[1]}` : parts[0] || '');
      this.invalidateGetCache(prefix);
    }
    return res;
  }

  async patch<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    const res = await this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (res.success && endpoint.startsWith('/api/')) {
      const prefix = endpoint.split('/').slice(0, 4).join('/');
      this.invalidateGetCache(prefix);
    }
    return res;
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    const res = await this.request<T>(endpoint, { method: 'DELETE' });
    if (res.success && endpoint.startsWith('/api/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const prefix = '/' + (parts[0] && parts[1] ? `${parts[0]}/${parts[1]}` : parts[0] || '');
      this.invalidateGetCache(prefix);
    }
    return res;
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
