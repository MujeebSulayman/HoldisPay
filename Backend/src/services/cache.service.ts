/**
 * In-memory TTL cache for read-heavy endpoints (transactions, invoices, user profile, wallets).
 * Single process only; for multi-instance use Redis instead.
 */
const DEFAULT_TTL_MS = 60_000; // 1 minute
const MAX_KEYS = 1000;

interface Entry<T> {
  value: T;
  expiresAt: number;
}

class CacheService {
  private store = new Map<string, Entry<unknown>>();
  private keyOrder: string[] = [];

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as Entry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.keyOrder = this.keyOrder.filter((k) => k !== key);
      return undefined;
    }
    return entry.value;
  }

  set<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
    if (this.keyOrder.length >= MAX_KEYS) {
      const oldest = this.keyOrder.shift();
      if (oldest) this.store.delete(oldest);
    }
    if (!this.keyOrder.includes(key)) this.keyOrder.push(key);
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  del(key: string): void {
    this.store.delete(key);
    this.keyOrder = this.keyOrder.filter((k) => k !== key);
  }

  /** Remove all keys that start with prefix (e.g. "tx:user:abc" removes all cache for that user). */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        this.keyOrder = this.keyOrder.filter((k) => k !== key);
      }
    }
  }
}

export const cacheService = new CacheService();

/** Cache key builders (consistent prefixes for invalidation). */
export const cacheKeys = {
  userTransactions: (userId: string, opts?: string) => `tx:user:${userId}${opts ? `:${opts}` : ''}`,
  userInvoices: (userId: string, role: string) => `inv:user:${userId}:${role}`,
  invoice: (invoiceId: string) => `inv:id:${invoiceId}`,
  userProfile: (userId: string) => `user:${userId}`,
  userWallets: (userId: string) => `wallets:${userId}`,
};
