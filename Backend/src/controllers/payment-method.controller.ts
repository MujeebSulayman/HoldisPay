import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { supabase } from '../config/supabase';
import { paystackService, PaystackBank } from '../services/paystack.service';
import { cacheService } from '../services/cache.service';
import { logger } from '../utils/logger';

const BANKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const COUNTRIES_CACHE_TTL_MS = 60 * 60 * 1000;

function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber || accountNumber.length < 4) return '****';
  return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
}

export const paymentMethodController = {
  async getCountries(_req: Request, res: Response): Promise<void> {
    try {
      const cacheKey = 'paystack:countries';
      const cached = await cacheService.get<Awaited<ReturnType<typeof paystackService.listCountries>>>(cacheKey);
      if (cached !== undefined) {
        res.status(200).json({ success: true, data: cached });
        return;
      }
      const data = await paystackService.listCountries();
      await cacheService.set(cacheKey, data, COUNTRIES_CACHE_TTL_MS);
      res.status(200).json({ success: true, data });
    } catch (e: any) {
      logger.error('Payment methods getCountries error', { error: e?.message ?? e });
      res.status(500).json({
        success: false,
        error: e?.message ?? 'Failed to fetch countries',
      });
    }
  },

  async getBanks(req: Request, res: Response): Promise<void> {
    try {
      const country = (req.query.country as string)?.trim();
      if (!country) {
        res.status(400).json({ success: false, error: 'country is required' });
        return;
      }
      const currency = (req.query.currency as string)?.trim();
      const type = (req.query.type as string)?.trim();
      const cacheKey = `paystack:banks:${country}:${currency || 'all'}:${type || 'all'}`;
      const cached = await cacheService.get<{ data: any[] }>(cacheKey);
      if (cached !== undefined) {
        res.status(200).json({ success: true, data: cached.data, next: cached.next, previous: cached.previous });
        return;
      }
      const result = await paystackService.listBanks({
        country,
        currency: currency || undefined,
        type: type || undefined,
        perPage: 100,
      });
      await cacheService.set(
        cacheKey,
        { data: result.data, next: result.next, previous: result.previous },
        BANKS_CACHE_TTL_MS
      );
      res.status(200).json({ success: true, data: result.data, next: result.next, previous: result.previous });
    } catch (e: any) {
      logger.error('Payment methods getBanks error', { error: e?.message ?? e });
      res.status(500).json({
        success: false,
        error: e?.message ?? 'Failed to fetch banks',
      });
    }
  },

  async getBanksAll(req: Request, res: Response): Promise<void> {
    try {
      const cacheKey = 'paystack:banks:all';
      const cached = await cacheService.get<PaystackBank[]>(cacheKey);
      if (cached !== undefined) {
        res.status(200).json({ success: true, data: cached });
        return;
      }
      const data = await paystackService.listAllBanks();
      await cacheService.set(cacheKey, data, BANKS_CACHE_TTL_MS);
      res.status(200).json({ success: true, data });
    } catch (e: any) {
      logger.error('Payment methods getBanksAll error', { error: e?.message ?? e });
      res.status(500).json({
        success: false,
        error: e?.message ?? 'Failed to fetch banks',
      });
    }
  },

  async resolveAccount(req: Request, res: Response): Promise<void> {
    try {
      const { account_number, bank_code } = req.body || {};
      if (!account_number || !bank_code) {
        res.status(400).json({ success: false, error: 'account_number and bank_code are required' });
        return;
      }
      const data = await paystackService.resolveAccount(String(account_number).trim(), String(bank_code).trim());
      res.status(200).json({ success: true, data: { account_name: data.account_name, account_number: data.account_number, bank_id: data.bank_id } });
    } catch (e: any) {
      const paystackMsg = e?.response?.data?.message;
      const is422 = e?.response?.status === 422;
      const isSsl = e?.message?.includes('SSL') || e?.message?.includes('ECONNRESET') || e?.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
      const userMessage = paystackMsg
        ? paystackMsg
        : isSsl
          ? 'Network error. Please try again.'
          : e?.message ?? 'Failed to resolve account';
      logger.warn('Payment methods resolveAccount error', {
        error: e?.message ?? e,
        status: e?.response?.status,
        paystackMessage: paystackMsg,
      });
      res.status(is422 ? 422 : 400).json({
        success: false,
        error: userMessage,
      });
    }
  },

  async list(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user?.userId;
      const paramUserId = req.params?.userId;
      if (!userId || (paramUserId && paramUserId !== userId)) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }
      const targetUserId = paramUserId || userId;
      const { data: rows, error } = await supabase
        .from('user_payment_methods')
        .select('*')
        .eq('user_id', targetUserId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) {
        logger.error('Payment methods list DB error', { error: error.message, userId: targetUserId });
        res.status(500).json({ success: false, error: 'Failed to list payment methods' });
        return;
      }
      const data = (rows || []).map((r: any) => ({
        id: r.id,
        paystack_recipient_code: r.paystack_recipient_code,
        account_number_masked: maskAccountNumber(r.account_number),
        bank_code: r.bank_code,
        bank_name: r.bank_name,
        account_name: r.account_name,
        currency: r.currency,
        country: r.country,
        recipient_type: r.recipient_type ?? 'nuban',
        is_default: r.is_default,
        created_at: r.created_at,
      }));
      res.status(200).json({ success: true, data });
    } catch (e: any) {
      logger.error('Payment methods list error', { error: e?.message ?? e });
      res.status(500).json({ success: false, error: e?.message ?? 'Failed to list payment methods' });
    }
  },

  async add(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user?.userId;
      const paramUserId = req.params?.userId;
      if (!userId || (paramUserId && paramUserId !== userId)) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }
      const targetUserId = paramUserId || userId;
      const { account_number, bank_code, bank_name, account_name, currency, country, recipient_type } = req.body || {};
      const validRecipientTypes = ['nuban', 'ghipss', 'basa', 'mobile_money'];
      if (!recipient_type || !validRecipientTypes.includes(recipient_type)) {
        res.status(400).json({
          success: false,
          error: 'recipient_type is required and must be one of: nuban, ghipss, basa, mobile_money',
        });
        return;
      }
      const recType = recipient_type;
      if (!account_number || !bank_code || !bank_name || !account_name || !currency || !country) {
        res.status(400).json({
          success: false,
          error: 'account_number, bank_code, bank_name, account_name, currency, country are required',
        });
        return;
      }
      const accNum = String(account_number).trim();
      const bCode = String(bank_code).trim();
      let recipient;
      if (recType === 'mobile_money') {
        recipient = await paystackService.createTransferRecipient({
          type: 'mobile_money',
          name: String(account_name).trim(),
          account_number: accNum,
          bank_code: bCode,
          currency: String(currency).trim().toUpperCase(),
        });
      } else {
        await paystackService.resolveAccount(accNum, bCode);
        recipient = await paystackService.createTransferRecipient({
          type: recType,
          name: String(account_name).trim(),
          account_number: accNum,
          bank_code: bCode,
          currency: String(currency).trim().toUpperCase(),
        });
      }
      const { data: existingList } = await supabase
        .from('user_payment_methods')
        .select('id')
        .eq('user_id', targetUserId);
      const isFirst = !existingList || existingList.length === 0;
      const { data: row, error } = await supabase
        .from('user_payment_methods')
        .insert({
          user_id: targetUserId,
          paystack_recipient_code: recipient.recipient_code,
          account_number: accNum,
          bank_code: bCode,
          bank_name: String(bank_name).trim(),
          account_name: String(account_name).trim(),
          currency: String(currency).trim().toUpperCase(),
          country: String(country).trim(),
          recipient_type: recType,
          is_default: isFirst,
        })
        .select()
        .single();
      if (error) {
        logger.error('Payment methods add DB error', { error: error.message, userId: targetUserId });
        const safeMessage = error.message?.includes('duplicate') ? 'This bank account is already added.' : error.message;
        res.status(500).json({ success: false, error: safeMessage || 'Failed to save payment method' });
        return;
      }
      res.status(201).json({
        success: true,
        data: {
          id: row.id,
          paystack_recipient_code: row.paystack_recipient_code,
          account_number_masked: maskAccountNumber(row.account_number),
          bank_code: row.bank_code,
          bank_name: row.bank_name,
          account_name: row.account_name,
          currency: row.currency,
          country: row.country,
          recipient_type: row.recipient_type ?? 'nuban',
          is_default: row.is_default,
          created_at: row.created_at,
        },
      });
    } catch (e: any) {
      logger.error('Payment methods add error', { error: e?.message ?? e, response: e?.response?.data });
      const paystackMsg = e?.response?.data?.message;
      const msg = e?.message ?? '';
      const isSslOrNetwork =
        typeof msg === 'string' &&
        (msg.includes('SSL') ||
          msg.includes('ssl3_read_bytes') ||
          msg.includes('bad record mac') ||
          msg.includes('ECONNRESET') ||
          msg.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE') ||
          msg.includes('ETIMEDOUT') ||
          msg.includes('ECONNREFUSED'));
      const userMessage = paystackMsg
        ? paystackMsg
        : isSslOrNetwork
          ? 'Network error. Please try again.'
          : msg || 'Failed to add payment method';
      const status = e?.response?.status === 400 || e?.response?.status === 422 ? e.response.status : 500;
      res.status(status).json({
        success: false,
        error: userMessage,
      });
    }
  },

  async setDefault(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user?.userId;
      const paramUserId = req.params?.userId;
      const id = req.params?.id;
      if (!userId || (paramUserId && paramUserId !== userId) || !id) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }
      const targetUserId = paramUserId || userId;
      const { error: updateAll } = await supabase
        .from('user_payment_methods')
        .update({ is_default: false })
        .eq('user_id', targetUserId);
      if (updateAll) {
        res.status(500).json({ success: false, error: 'Failed to update' });
        return;
      }
      const { error: updateOne } = await supabase
        .from('user_payment_methods')
        .update({ is_default: true })
        .eq('id', id)
        .eq('user_id', targetUserId);
      if (updateOne) {
        res.status(404).json({ success: false, error: 'Payment method not found' });
        return;
      }
      res.status(200).json({ success: true });
    } catch (e: any) {
      logger.error('Payment methods setDefault error', { error: e?.message ?? e });
      res.status(500).json({ success: false, error: e?.message ?? 'Failed to update' });
    }
  },

  async remove(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user?.userId;
      const paramUserId = req.params?.userId;
      const id = req.params?.id;
      if (!userId || (paramUserId && paramUserId !== userId) || !id) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }
      const targetUserId = paramUserId || userId;
      const { data: row, error: fetchErr } = await supabase
        .from('user_payment_methods')
        .select('paystack_recipient_code')
        .eq('id', id)
        .eq('user_id', targetUserId)
        .single();
      if (fetchErr || !row) {
        res.status(404).json({ success: false, error: 'Payment method not found' });
        return;
      }
      const { error: delErr } = await supabase
        .from('user_payment_methods')
        .delete()
        .eq('id', id)
        .eq('user_id', targetUserId);
      if (delErr) {
        res.status(500).json({ success: false, error: 'Failed to delete' });
        return;
      }
      try {
        await paystackService.deleteTransferRecipient(row.paystack_recipient_code);
      } catch (_) {}
      res.status(200).json({ success: true });
    } catch (e: any) {
      logger.error('Payment methods remove error', { error: e?.message ?? e });
      res.status(500).json({ success: false, error: e?.message ?? 'Failed to delete' });
    }
  },
};
