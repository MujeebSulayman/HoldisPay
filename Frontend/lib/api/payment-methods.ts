import { apiClient } from './client';

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
  country: string;
  currency: string;
  type: string;
  active: boolean;
}

export type RecipientType = 'nuban' | 'ghipss' | 'mobile_money' | 'basa';

export interface PaymentMethod {
  id: string;
  paystack_recipient_code: string;
  account_number_masked: string;
  bank_code: string;
  bank_name: string;
  account_name: string;
  currency: string;
  country: string;
  recipient_type: RecipientType;
  is_default: boolean;
  created_at: string;
}

export interface ResolveAccountResponse {
  account_name: string;
  account_number: string;
  bank_id: number;
}

export const paymentMethodsApi = {
  async getCountries() {
    return apiClient.get<PaystackCountry[]>('/api/payment-methods/countries');
  },

  async getBanks(country: string, currency?: string, type?: string) {
    const params = new URLSearchParams({ country });
    if (currency) params.set('currency', currency);
    if (type) params.set('type', type);
    return apiClient.get<PaystackBank[]>(`/api/payment-methods/banks?${params.toString()}`);
  },

  async getBanksAll() {
    return apiClient.get<PaystackBank[]>('/api/payment-methods/banks/all');
  },

  async resolveAccount(accountNumber: string, bankCode: string) {
    return apiClient.post<ResolveAccountResponse>('/api/payment-methods/resolve-account', {
      account_number: accountNumber,
      bank_code: bankCode,
    });
  },

  async getPaymentMethods(userId: string) {
    return apiClient.get<PaymentMethod[]>(`/api/users/${userId}/payment-methods`);
  },

  async addPaymentMethod(
    userId: string,
    body: {
      account_number: string;
      bank_code: string;
      bank_name: string;
      account_name: string;
      currency: string;
      country: string;
      recipient_type: RecipientType;
    }
  ) {
    return apiClient.post<PaymentMethod>(`/api/users/${userId}/payment-methods`, body);
  },

  async setDefault(userId: string, id: string) {
    return apiClient.patch<unknown>(`/api/users/${userId}/payment-methods/${id}/default`, {});
  },

  async deletePaymentMethod(userId: string, id: string) {
    return apiClient.delete<unknown>(`/api/users/${userId}/payment-methods/${id}`);
  },
};
