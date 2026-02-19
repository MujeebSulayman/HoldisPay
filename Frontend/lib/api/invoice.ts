import { apiClient } from './client';

export interface CreateInvoiceRequest {
  userId: string;
  payer: string;
  receiver: string;
  amount: string;
  tokenAddress?: string;
  requiresDelivery?: boolean;
  description: string;
  attachmentHash?: string;
}

export interface Invoice {
  id: string;
  invoice_id: string;
  issuer_id: string;
  payer_address: string;
  receiver_address: string;
  amount: string;
  token_address: string;
  requires_delivery: boolean;
  status: string;
  description: string;
  attachment_hash: string;
  payment_link_id: string | null;
  payment_link_url: string | null;
  payment_link_slug: string | null;
  created_at: string;
  updated_at: string;
  funded_at?: string;
  delivered_at?: string;
  completed_at?: string;
  tx_hash?: string;
}

export interface InvoiceResponse {
  success: boolean;
  data: Invoice;
}

export interface InvoicesResponse {
  success: boolean;
  data: Invoice[];
}

export const invoiceApi = {
  async createInvoice(data: CreateInvoiceRequest) {
    const response = await apiClient.post<Invoice>('/api/invoices/create', data);
    return response;
  },

  async getInvoice(invoiceId: string) {
    const response = await apiClient.get<Invoice>(`/api/invoices/${invoiceId}`);
    return response;
  },

  async getUserInvoices(userId: string, role?: 'issuer' | 'payer' | 'receiver') {
    const url = role 
      ? `/api/invoices/user/${userId}?role=${role}`
      : `/api/invoices/user/${userId}`;
    const response = await apiClient.get<Invoice[]>(url);
    return response;
  },

  async createPaymentLink(invoiceId: string) {
    const response = await apiClient.post(`/api/invoices/${invoiceId}/payment-link`, {});
    return response;
  },

  async getPaymentLink(invoiceId: string) {
    const response = await apiClient.get(`/api/invoices/${invoiceId}/payment-link`);
    return response;
  },

  async fundInvoice(invoiceId: string, userId: string) {
    const response = await apiClient.post(`/api/invoices/${invoiceId}/fund`, { userId });
    return response;
  },

  async submitDelivery(invoiceId: string, userId: string, deliveryProof?: string) {
    const response = await apiClient.post(`/api/invoices/${invoiceId}/deliver`, {
      userId,
      deliveryProof,
    });
    return response;
  },

  async confirmDelivery(invoiceId: string, userId: string, confirmationNotes?: string) {
    const response = await apiClient.post(`/api/invoices/${invoiceId}/confirm`, {
      userId,
      confirmationNotes,
    });
    return response;
  },
};
