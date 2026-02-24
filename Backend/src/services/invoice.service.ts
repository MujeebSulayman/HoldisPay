import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { Invoice, InvoiceStatus } from '../types/contract';
import { emailService } from './email.service';
import { cacheService, cacheKeys } from './cache.service';

export interface CreateInvoiceParams {
  invoiceId: bigint;
  issuerId: string;
  payerAddress: string;
  receiverAddress: string;
  amount: string;
  tokenAddress: string;
  requiresDelivery: boolean;
  description: string;
  attachmentHash: string;
  txHash?: string;
}

export interface UpdateInvoiceStatusParams {
  invoiceId: bigint;
  status: 'pending' | 'funded' | 'delivered' | 'completed' | 'cancelled' | 'paid' | 'expired';
  fundedAt?: Date;
  deliveredAt?: Date;
  completedAt?: Date;
  paidAt?: Date;
  txHash?: string;
}

export class InvoiceService {
  
  async createInvoice(params: CreateInvoiceParams): Promise<void> {
    try {
      logger.info('Creating invoice in database', { invoiceId: params.invoiceId.toString() });

      const { error } = await supabase
        .from('invoices')
        .insert({
          invoice_id: params.invoiceId.toString(),
          issuer_id: params.issuerId,
          payer_address: params.payerAddress.toLowerCase(),
          receiver_address: params.receiverAddress.toLowerCase(),
          amount: params.amount,
          token_address: params.tokenAddress.toLowerCase(),
          requires_delivery: params.requiresDelivery,
          description: params.description,
          attachment_hash: params.attachmentHash,
          status: 'pending',
          tx_hash: params.txHash,
        });

      if (error) {
        logger.error('Failed to create invoice in database', { error, invoiceId: params.invoiceId.toString() });
        throw new Error(`Failed to create invoice: ${error.message}`);
      }

      // Notify admin of new invoice
      const { data: issuer } = await supabase
        .from('users')
        .select('email, first_name, last_name')
        .eq('id', params.issuerId)
        .single();

      if (issuer) {
        await emailService.notifyAdminNewInvoice({
          invoiceId: params.invoiceId.toString(),
          amount: params.amount,
          issuer: `${issuer.first_name} ${issuer.last_name} (${issuer.email})`,
        });
      }

      logger.info('Invoice created in database', { invoiceId: params.invoiceId.toString() });
      cacheService.invalidatePrefix('inv:');
    } catch (error) {
      logger.error('Failed to create invoice', { error, params });
      throw error;
    }
  }

  async updateInvoiceStatus(params: UpdateInvoiceStatusParams): Promise<void> {
    try {
      logger.info('Updating invoice status', { 
        invoiceId: params.invoiceId.toString(), 
        status: params.status 
      });

      const updateData: any = {
        status: params.status,
      };

      if (params.fundedAt) updateData.funded_at = params.fundedAt.toISOString();
      if (params.deliveredAt) updateData.delivered_at = params.deliveredAt.toISOString();
      if (params.completedAt) updateData.completed_at = params.completedAt.toISOString();
      if (params.paidAt) updateData.paid_at = params.paidAt.toISOString();
      if (params.txHash) updateData.tx_hash = params.txHash;

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('invoice_id', params.invoiceId.toString());

      if (!error) {
        cacheService.del(cacheKeys.invoice(params.invoiceId.toString()));
        cacheService.invalidatePrefix('inv:user:');
      }
      if (error) {
        logger.error('Failed to update invoice status', { error, invoiceId: params.invoiceId.toString() });
        throw new Error(`Failed to update invoice: ${error.message}`);
      }

      logger.info('Invoice status updated', { invoiceId: params.invoiceId.toString(), status: params.status });
    } catch (error) {
      logger.error('Failed to update invoice status', { error, params });
      throw error;
    }
  }

  async getInvoiceByOnChainId(invoiceId: bigint): Promise<any | null> {
    const key = cacheKeys.invoice(invoiceId.toString());
    const cached = cacheService.get<any>(key);
    if (cached !== undefined) return cached;
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('invoice_id', invoiceId.toString())
        .single();

      if (error || !data) {
        return null;
      }
      cacheService.set(key, data, 60_000);
      return data;
    } catch (error) {
      logger.error('Failed to get invoice', { error, invoiceId: invoiceId.toString() });
      return null;
    }
  }

  /** Get invoice by Blockradar payment link id (for deposit webhook). */
  async getInvoiceByPaymentLinkId(paymentLinkId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('payment_link_id', paymentLinkId)
        .single();

      if (error || !data) {
        return null;
      }
      return data;
    } catch (error) {
      logger.error('Failed to get invoice by payment link id', { error, paymentLinkId });
      return null;
    }
  }

  async getUserInvoices(userId: string, role: 'issuer' | 'payer' | 'receiver'): Promise<any[]> {
    const key = cacheKeys.userInvoices(userId, role);
    const cached = cacheService.get<any[]>(key);
    if (cached !== undefined) return cached;
    try {
      let query = supabase.from('invoices').select('*');

      if (role === 'issuer') {
        query = query.eq('issuer_id', userId);
      } else if (role === 'payer') {
        // Need to get user's wallet address first
        const { data: user } = await supabase
          .from('users')
          .select('wallet_address')
          .eq('id', userId)
          .single();
        
        if (user) {
          query = query.eq('payer_address', user.wallet_address.toLowerCase());
        }
      } else if (role === 'receiver') {
        const { data: user } = await supabase
          .from('users')
          .select('wallet_address')
          .eq('id', userId)
          .single();
        
        if (user) {
          query = query.eq('receiver_address', user.wallet_address.toLowerCase());
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to get user invoices', { error, userId, role });
        return [];
      }
      const result = data || [];
      cacheService.set(key, result, 60_000);
      return result;
    } catch (error) {
      logger.error('Failed to get user invoices', { error, userId, role });
      return [];
    }
  }

  async updatePaymentLink(invoiceId: bigint, paymentLinkId: string, paymentLinkUrl: string, slug: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          payment_link_id: paymentLinkId,
          payment_link_url: paymentLinkUrl,
          payment_link_slug: slug,
        })
        .eq('invoice_id', invoiceId.toString());

      if (error) {
        logger.error('Failed to update payment link', { error, invoiceId: invoiceId.toString() });
        throw new Error(`Failed to update payment link: ${error.message}`);
      }

      logger.info('Payment link updated', { invoiceId: invoiceId.toString() });
      cacheService.del(cacheKeys.invoice(invoiceId.toString()));
      cacheService.invalidatePrefix('inv:user:');
    } catch (error) {
      logger.error('Failed to update payment link', { error, invoiceId });
      throw error;
    }
  }

  async getAllInvoices(limit: number = 50, offset: number = 0): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Failed to get all invoices', { error });
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to get all invoices', { error });
      return [];
    }
  }

  async getInvoicesByStatus(status: 'pending' | 'funded' | 'delivered' | 'completed' | 'cancelled'): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to get invoices by status', { error, status });
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to get invoices by status', { error, status });
      return [];
    }
  }
}

export const invoiceService = new InvoiceService();
