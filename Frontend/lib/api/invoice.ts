import { apiClient } from './client';

export interface CreateInvoiceRequest {
  amount: string;
  currency: string;
  customerEmail: string;
  customerName?: string;
  description: string;
  dueDate?: string;
}

export interface Invoice {
  id: string;
  invoice_id: string;
  issuer_id: string;
  payer_id: string | null;
  receiver_id: string;
  amount: string;
  currency: string;
  status: string;
  payment_link_id: string | null;
  created_at: string;
  updated_at: string;
  customer_email?: string;
  customer_name?: string;
  description?: string;
  due_date?: string;
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
