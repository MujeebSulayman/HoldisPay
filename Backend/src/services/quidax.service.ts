/**
 * Quidax rate integration.
 * Docs: https://docs.quidax.com/reference/list-market-tickers
 * GET /markets/tickers returns all markets; we use USDT/NGN for USD→NGN rate.
 */
import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const USDTNGN_MARKET = 'usdtngn';
const TIMEOUT_MS = 20000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

export type QuidaxTicker = {
  buy: string;
  sell: string;
  low: string;
  high: string;
  open: string;
  last: string;
  vol: string;
};

export type QuidaxTickersResponse = {
  status?: string;
  message?: string;
  data?: Record<string, { at?: number; ticker?: QuidaxTicker }>;
};

function createClient(): AxiosInstance {
  const baseURL = (env.QUIDAX_BASE_URL || 'https://app.quidax.io/api/v1').replace(/\/$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.QUIDAX_API_KEY) {
    headers['Authorization'] = `Bearer ${env.QUIDAX_API_KEY}`;
  }
  return axios.create({
    baseURL,
    headers,
    timeout: TIMEOUT_MS,
  });
}

function isRetryable(err: unknown): boolean {
  const e = err as { code?: string; message?: string; response?: { status?: number } };
  if (e?.code === 'ECONNABORTED' || e?.message?.toLowerCase().includes('timeout')) return true;
  const status = e?.response?.status;
  return status != null && status >= 500 && status < 600;
}

function getRateType(): 'last' | 'buy' | 'sell' {
  const t = env.QUIDAX_NGN_RATE_TYPE;
  return t === 'buy' || t === 'sell' ? t : 'last';
}

/**
 * Fetches USDT/NGN ticker from Quidax (List market tickers).
 * USDC ≈ USDT ≈ USD, so this gives USD→NGN rate.
 */
async function fetchTickersOnce(): Promise<QuidaxTicker> {
  const client = createClient();
  const res = await client.get<QuidaxTickersResponse>('/markets/tickers');

  if (res.data?.status !== 'success' && res.data?.status != null) {
    throw new Error(`Quidax: status ${res.data.status} - ${res.data.message ?? 'Unknown'}`);
  }

  const data = res.data?.data;
  if (!data || typeof data !== 'object') {
    throw new Error('Quidax tickers: no data in response');
  }

  const market = data[USDTNGN_MARKET] ?? data['USDTNGN'];
  if (!market?.ticker) {
    throw new Error('Quidax tickers: USDTNGN market or ticker missing');
  }

  return market.ticker;
}

function parseRate(ticker: QuidaxTicker): number {
  const rateType = getRateType();
  const raw = ticker[rateType] ?? ticker.last;
  if (raw == null || raw === '') {
    throw new Error(`Quidax: missing ${rateType} price in USDTNGN ticker`);
  }
  const rate = parseFloat(String(raw));
  if (Number.isNaN(rate) || rate <= 0) {
    throw new Error(`Quidax: invalid USDTNGN ${rateType} price: ${raw}`);
  }
  return rate;
}

export async function getUsdtNgnRate(): Promise<number> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ticker = await fetchTickersOnce();
      const rate = parseRate(ticker);
      logger.debug('Quidax USDT/NGN rate fetched', { rate, type: getRateType() });
      return rate;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES && isRetryable(err)) {
        logger.warn('Quidax getUsdtNgnRate retry', {
          attempt: attempt + 1,
          message: (err as Error)?.message,
        });
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      break;
    }
  }

  const e = lastErr as { response?: { status?: number; data?: { message?: string } }; message?: string };
  const status = e?.response?.status;
  const msg = e?.response?.data?.message ?? e?.message ?? 'Unknown error';
  logger.error('Quidax getUsdtNgnRate failed after retries', { status, message: msg });
  const out = new Error(status != null ? `Quidax API ${status}: ${msg}` : msg) as Error & {
    status?: number;
    body?: unknown;
  };
  out.status = status;
  out.body = e?.response?.data;
  throw out;
}
