import Redis from 'ioredis';
import { logger } from '../utils/logger';

const DEFAULT_TTL_MS = 60_000;

let redisClient: Redis | null | undefined = undefined;

function isRedisConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
  return (
    msg.includes('Connection is closed') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNRESET') ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET'
  );
}

function markRedisDown(): void {
  if (redisClient) {
    try {
      redisClient.disconnect();
    } catch {
      // ignore
    }
    redisClient = null;
    logger.warn('Redis connection lost');
  }
}

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url || url === '') {
    redisClient = null;
    logger.warn('REDIS_URL not set, cache disabled');
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
    redisClient.on('error', (err) => {
      if (redisClient === null) return;
      const msg = err?.message ?? String(err);
      if (msg) logger.warn('Redis error', { err: msg });
    });
    redisClient.on('connect', () => logger.info('Redis connected'));
  } catch (err) {
    logger.warn('Redis init failed, cache disabled', { err: err instanceof Error ? err.message : String(err) });
    redisClient = null;
  }
  return redisClient;
}

class CacheService {
  async get<T>(key: string): Promise<T | undefined> {
    const client = getRedis();
    if (!client) return undefined;
    try {
      const raw = await client.get(key);
      if (raw == null) return undefined;
      return JSON.parse(raw) as T;
    } catch (err) {
      if (isRedisConnectionError(err)) markRedisDown();
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): Promise<void> {
    const client = getRedis();
    if (!client) return;
    try {
      const ttlSec = Math.max(1, Math.floor(ttlMs / 1000));
      await client.setex(key, ttlSec, JSON.stringify(value));
    } catch (err) {
      if (isRedisConnectionError(err)) markRedisDown();
    }
  }

  async del(key: string): Promise<void> {
    const client = getRedis();
    if (!client) return;
    try {
      await client.del(key);
    } catch (err) {
      if (isRedisConnectionError(err)) markRedisDown();
    }
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    const client = getRedis();
    if (!client) return;
    try {
      const keys = await client.keys(`${prefix}*`);
      if (keys.length > 0) await client.del(...keys);
    } catch (err) {
      if (isRedisConnectionError(err)) markRedisDown();
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
