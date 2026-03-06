import Redis from 'ioredis';
import { logger } from '../utils/logger';

const DEFAULT_TTL_MS = 60_000;
const MAX_KEYS = 1000;
const IN_MEMORY_MAX_KEYS = 500;

interface Entry<T> {
  value: T;
  expiresAt: number;
}

let redisClient: Redis | null | undefined = undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url || url === '') {
    redisClient = null;
    return null;
  }
  try {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });
    redisClient.on('error', (err) => logger.warn('Redis error', { err: err.message }));
    redisClient.on('connect', () => logger.info('Redis connected'));
  } catch (err) {
    logger.warn('Redis init failed, using in-memory cache', { err: err instanceof Error ? err.message : String(err) });
    redisClient = null;
  }
  return redisClient;
}

const memoryStore = new Map<string, Entry<unknown>>();
const memoryKeyOrder: string[] = [];

class CacheService {
  async get<T>(key: string): Promise<T | undefined> {
    const client = getRedis();
    if (client) {
      try {
        const raw = await client.get(key);
        if (raw == null) return undefined;
        return JSON.parse(raw) as T;
      } catch {
        return undefined;
      }
    }
    const entry = memoryStore.get(key) as Entry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      memoryStore.delete(key);
      const i = memoryKeyOrder.indexOf(key);
      if (i !== -1) memoryKeyOrder.splice(i, 1);
      return undefined;
    }
    return entry.value;
  }

  async set<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): Promise<void> {
    const client = getRedis();
    if (client) {
      try {
        const ttlSec = Math.max(1, Math.floor(ttlMs / 1000));
        await client.setex(key, ttlSec, JSON.stringify(value));
      } catch (err) {
        logger.warn('Redis set failed', { key, err: err instanceof Error ? err.message : String(err) });
      }
      return;
    }
    if (memoryKeyOrder.length >= IN_MEMORY_MAX_KEYS) {
      const oldest = memoryKeyOrder.shift();
      if (oldest) memoryStore.delete(oldest);
    }
    if (!memoryKeyOrder.includes(key)) memoryKeyOrder.push(key);
    memoryStore.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async del(key: string): Promise<void> {
    const client = getRedis();
    if (client) {
      try {
        await client.del(key);
      } catch {
        // ignore
      }
      return;
    }
    memoryStore.delete(key);
    const i = memoryKeyOrder.indexOf(key);
    if (i !== -1) memoryKeyOrder.splice(i, 1);
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    const client = getRedis();
    if (client) {
      try {
        const keys = await client.keys(`${prefix}*`);
        if (keys.length > 0) await client.del(...keys);
      } catch (err) {
        logger.warn('Redis invalidatePrefix failed', { prefix, err: err instanceof Error ? err.message : String(err) });
      }
      return;
    }
    for (const key of Array.from(memoryStore.keys())) {
      if (key.startsWith(prefix)) {
        memoryStore.delete(key);
        const i = memoryKeyOrder.indexOf(key);
        if (i !== -1) memoryKeyOrder.splice(i, 1);
      }
    }
  }
}

export const cacheService = new CacheService();

export const cacheKeys = {
  userTransactions: (userId: string, opts?: string) => `tx:user:${userId}${opts ? `:${opts}` : ''}`,
  userInvoices: (userId: string, role: string) => `inv:user:${userId}:${role}`,
  invoice: (invoiceId: string) => `inv:id:${invoiceId}`,
  userProfile: (userId: string) => `user:${userId}`,
  userWallets: (userId: string) => `wallets:${userId}`,
  admin: {
    metrics: () => 'admin:metrics',
    revenueReport: (period: string) => `admin:revenue:${period}`,
    usersGrowthReport: (periods: number) => `admin:users:growth:${periods}`,
    contractsReport: (periods: number) => `admin:contracts:report:${periods}`,
    transactionsReport: (periods: number) => `admin:transactions:report:${periods}`,
    invoicesReport: (periods: number) => `admin:invoices:report:${periods}`,
    waitlistReport: (periods: number) => `admin:waitlist:report:${periods}`,
  },
};

export const ADMIN_CACHE_TTL_MS = 60_000;
