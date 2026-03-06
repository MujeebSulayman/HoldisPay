import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const PAYSTACK_BASE = 'https://api.paystack.co';

export interface PaystackCountry {
  id: number;
  name: string;
  iso_code: string;
  default_currency_code: string;
}

export interface PaystackBank {
  id: number;
  name: string;
  code: string;
  slug: string;
  longcode?: string;
  gateway?: string | null;
  pay_with_bank: boolean;
  active: boolean;
  country: string;
  currency: string;
  type: string;
}

export interface PaystackResolveAccount {
  account_number: string;
  account_name: string;
  bank_id: number;
}

export interface PaystackTransferRecipientDetails {
  account_number: string;
  account_name: string | null;
  bank_code: string;
  bank_name: string;
}

export interface PaystackTransferRecipient {
  id: number;
  recipient_code: string;
  type: string;
  name: string;
  currency: string;
  details: PaystackTransferRecipientDetails;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTransferRecipientBody {
  type: string;
  name: string;
  account_number: string;
  bank_code: string;
  currency: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface PaystackTransfer {
  id: number;
  transfer_code: string;
  amount: number;
  currency: string;
  recipient: number | PaystackTransferRecipient;
  status: string;
  reason: string;
  reference?: string;
  created_at: string;
  updated_at: string;
}

function getClient(timeoutMs = 15000): AxiosInstance {
  const key = env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error('PAYSTACK_SECRET_KEY is not set');
  }
  return axios.create({
    baseURL: PAYSTACK_BASE,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    timeout: timeoutMs,
  });
}

export const paystackService = {
  async listCountries(): Promise<PaystackCountry[]> {
    const client = getClient();
    const { data } = await client.get<{ status: boolean; data: PaystackCountry[] }>('/country');
    if (!data.status || !Array.isArray(data.data)) return [];
    return data.data;
  },

  async listBanks(params: {
    country: string;
    currency?: string;
    type?: string;
    perPage?: number;
    next?: string;
    pay_with_bank_transfer?: boolean;
  }): Promise<{ data: PaystackBank[]; next?: string; previous?: string }> {
    const client = getClient();
    const query: Record<string, string | number | boolean> = {
      country: params.country,
      perPage: params.perPage ?? 100,
    };
    if (params.currency) query.currency = params.currency;
    if (params.type) query.type = params.type;
    if (params.next) query.next = params.next;
    if (params.pay_with_bank_transfer !== undefined) query.pay_with_bank_transfer = params.pay_with_bank_transfer;
    const { data } = await client.get<{
      status: boolean;
      data: PaystackBank[];
      meta?: { next?: string; previous?: string; perPage: number };
    }>('/bank', { params: query });
    if (!data.status || !Array.isArray(data.data)) {
      return { data: [] };
    }
    return {
      data: data.data,
      next: data.meta?.next,
      previous: data.meta?.previous,
    };
  },

  async listAllBanks(): Promise<PaystackBank[]> {
    const client = getClient(60000);
    const countries = await this.listCountries();
    const fetchOneCountry = async (countryName: string): Promise<PaystackBank[]> => {
      const banks: PaystackBank[] = [];
      let next: string | undefined;
      do {
        const query: Record<string, string | number> = { country: countryName, perPage: 100 };
        if (next) query.next = next;
        const { data } = await client.get<{
          status: boolean;
          data: PaystackBank[];
          meta?: { next?: string };
        }>('/bank', { params: query });
        if (data.status && Array.isArray(data.data)) {
          banks.push(...data.data);
          next = data.meta?.next;
        } else {
          break;
        }
      } while (next);
      return banks;
    };
    const results = await Promise.all(countries.map((c) => fetchOneCountry(c.name)));
    return results.flat();
  },

  async resolveAccount(accountNumber: string, bankCode: string): Promise<PaystackResolveAccount> {
    const client = getClient();
    const { data } = await client.get<{ status: boolean; data: PaystackResolveAccount }>('/bank/resolve', {
      params: { account_number: accountNumber, bank_code: bankCode },
    });
    if (!data.status || !data.data) {
      throw new Error(data && (data as any).message ? (data as any).message : 'Failed to resolve account');
    }
    return data.data;
  },

  async createTransferRecipient(body: CreateTransferRecipientBody): Promise<PaystackTransferRecipient> {
    const client = getClient();
    const { data } = await client.post<{ status: boolean; data: PaystackTransferRecipient }>(
      '/transferrecipient',
      body
    );
    if (!data.status || !data.data) {
      throw new Error(data && (data as any).message ? (data as any).message : 'Failed to create recipient');
    }
    return data.data;
  },

  async listTransferRecipients(params?: {
    perPage?: number;
    page?: number;
  }): Promise<{ data: PaystackTransferRecipient[]; meta?: { total: number; page: number; pageCount: number } }> {
    const client = getClient();
    const { data } = await client.get<{
      status: boolean;
      data: PaystackTransferRecipient[];
      meta?: { total: number; page: number; pageCount: number };
    }>('/transferrecipient', { params });
    if (!data.status || !Array.isArray(data.data)) return { data: [] };
    return { data: data.data, meta: data.meta };
  },

  async getTransferRecipient(idOrCode: string): Promise<PaystackTransferRecipient | null> {
    const client = getClient();
    try {
      const { data } = await client.get<{ status: boolean; data: PaystackTransferRecipient }>(
        `/transferrecipient/${encodeURIComponent(idOrCode)}`
      );
      return data.status && data.data ? data.data : null;
    } catch (e: any) {
      if (e?.response?.status === 404) return null;
      throw e;
    }
  },

  async deleteTransferRecipient(idOrCode: string): Promise<void> {
    const client = getClient();
    await client.delete(`/transferrecipient/${encodeURIComponent(idOrCode)}`);
  },

  async initiateTransfer(body: {
    source: string;
    amount: number;
    recipient: string;
    reason: string;
    currency?: string;
    reference?: string;
  }): Promise<PaystackTransfer> {
    const client = getClient();
    const { data } = await client.post<{ status: boolean; data: PaystackTransfer }>('/transfer', body);
    if (!data.status || !data.data) {
      throw new Error(data && (data as any).message ? (data as any).message : 'Transfer failed');
    }
    return data.data;
  },

  async finalizeTransfer(transferCode: string, otp: string): Promise<PaystackTransfer> {
    const client = getClient();
    const { data } = await client.post<{ status: boolean; data: PaystackTransfer }>(
      '/transfer/finalize_transfer',
      { transfer_code: transferCode, otp }
    );
    if (!data.status || !data.data) {
      throw new Error(data && (data as any).message ? (data as any).message : 'Finalize transfer failed');
    }
    return data.data;
  },
};
