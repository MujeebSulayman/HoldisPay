import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { supabase } from '../config/supabase';
import { monnifyService, MonnifyBank } from '../services/monnify.service';
import { cacheService } from '../services/cache.service';
import { logger } from '../utils/logger';

const BANKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const COUNTRIES_CACHE_TTL_MS = 60 * 60 * 1000;

export const paymentMethodController = {
  async getCountries(_req: Request, res: Response): Promise<void> {
    try {
      const cacheKey = 'monnify:countries';
      // Monnify currently focuses on Nigeria, we can hardcode or adapt this as needed
      // Paystack had a generic `listCountries`. For Holdis with Monnify, we return Nigeria
      const cached = await cacheService.get<any[]>(cacheKey);
      if (cached !== undefined) {
        res.status(200).json({ success: true, data: cached });
        return;
      }
      
      const data = [
        { id: 1, name: 'Nigeria', iso_code: 'NG', default_currency_code: 'NGN' }
      ];
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
      const countryRaw = (req.query.country as string)?.trim();
      if (!countryRaw) {
        res.status(400).json({ success: false, error: 'country is required' });
        return;
      }
      const country = countryRaw.toLowerCase();
      const currency = (req.query.currency as string)?.trim();
      const type = (req.query.type as string)?.trim();
      const cacheKey = 'monnify:banks:all';
      
      const cached = await cacheService.get<{ data: any[] }>(cacheKey);
      if (cached !== undefined) {
        res.status(200).json({ success: true, data: cached.data });
        return;
      }

      const banks = await monnifyService.getBanks();
      // Map Monnify bank interface to what the frontend expects (previously Paystack format)
      const mappedBanks = banks.map((b) => ({
        id: b.bankId || b.code,
        name: b.name,
        code: b.code,
        slug: b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        country: 'Nigeria',
        currency: 'NGN',
        type: 'nuban',
        active: true,
      }));

      await cacheService.set(
        cacheKey,
        { data: mappedBanks },
        BANKS_CACHE_TTL_MS
      );
      res.status(200).json({ success: true, data: mappedBanks });
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
      const cacheKey = 'monnify:banks:all:list';
      const cached = await cacheService.get<any[]>(cacheKey);
      if (cached !== undefined) {
        res.status(200).json({ success: true, data: cached });
        return;
      }
      
      const banks = await monnifyService.getBanks();
      const mappedBanks = banks.map((b) => ({
        id: b.bankId || b.code,
        name: b.name,
        code: b.code,
        slug: b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        country: 'Nigeria',
        currency: 'NGN',
        type: 'nuban',
        active: true,
      }));

      await cacheService.set(cacheKey, mappedBanks, BANKS_CACHE_TTL_MS);
      res.status(200).json({ success: true, data: mappedBanks });
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
      const data = await monnifyService.validateAccount(String(account_number).trim(), String(bank_code).trim());
      res.status(200).json({ success: true, data: { account_name: data.accountName, account_number: data.accountNumber, bank_id: data.bankCode } });
    } catch (e: any) {
      const monnifyMsg = e?.response?.data?.responseMessage;
      const isSsl = e?.message?.includes('SSL') || e?.message?.includes('ECONNRESET') || e?.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
      const userMessage = monnifyMsg
        ? monnifyMsg
        : isSsl
          ? 'Network error. Please try again.'
          : e?.message ?? 'Failed to resolve account';
      logger.warn('Payment methods resolveAccount error', {
        error: e?.message ?? e,
        status: e?.response?.status,
        monnifyMessage: monnifyMsg,
      });
      res.status(400).json({
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
        account_number_masked: r.account_number ?? '',
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
      
      // Monnify Validation
      if (recType !== 'mobile_money') {
        const validated = await monnifyService.validateAccount(accNum, bCode);
        if (!validated.accountName) {
           throw new Error('Could not validate account name via Monnify');
        }
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
          account_number_masked: row.account_number ?? '',
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
      const apiMsg = e?.response?.data?.responseMessage || e?.response?.data?.message;
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
      const userMessage = apiMsg
        ? apiMsg
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
      res.status(200).json({ success: true });
    } catch (e: any) {
      logger.error('Payment methods remove error', { error: e?.message ?? e });
      res.status(500).json({ success: false, error: e?.message ?? 'Failed to delete' });
    }
  },
};
