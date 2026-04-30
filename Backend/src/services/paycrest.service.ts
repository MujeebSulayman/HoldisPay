import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface PaycrestOrderRequest {
  amount: string;
  currency: string; // e.g., 'NGN', 'GHS', 'KES'
  asset: string;    // e.g., 'USDC'
  sourceType: 'fiat' | 'crypto';
  destinationType: 'fiat' | 'crypto';
  destinationAddress?: string; // For on-ramp: Your Master Wallet
  bankDetails?: {
    accountNumber: string;
    bankCode: string;
    accountName: string;
  };
  metadata?: Record<string, any>;
}

export class PaycrestService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.paycrest.io/v2',
      headers: {
        'Content-Type': 'application/json',
        'API-Key': env.PAYCREST_API_KEY,
      },
    });
  }

  async createOrder(request: PaycrestOrderRequest) {
    try {
      const payload = {
        amount: request.amount,
        currency: request.currency,
        asset: request.asset,
        source: { type: request.sourceType },
        destination: { 
          type: request.destinationType,
          address: request.destinationAddress,
          bank_details: request.bankDetails
        },
        metadata: request.metadata
      };

      const response = await this.client.post('/sender/orders', payload);
      return response.data.data;
    } catch (error: any) {
      logger.error('Paycrest Order Creation Failed', { 
        error: error.response?.data || error.message,
        request 
      });
      throw error;
    }
  }

  async getOrderStatus(orderId: string) {
    try {
      const response = await this.client.get(`/sender/orders/${orderId}`);
      return response.data.data;
    } catch (error: any) {
      logger.error('Paycrest Status Check Failed', { orderId, error: error.message });
      throw error;
    }
  }

  async getBanks(currency: string = 'NGN') {
    try {
      const response = await this.client.get(`/institutions/${currency}`);
      return response.data.data;
    } catch (error: any) {
      logger.error('Paycrest Get Banks Failed', { currency, error: error.message });
      throw error;
    }
  }

  async validateAccount(accountNumber: string, bankCode: string) {
    try {
      const response = await this.client.post('/verify-account', {
        institution: bankCode,
        accountIdentifier: accountNumber
      });
      return response.data.data;
    } catch (error: any) {
      logger.error('Paycrest Account Validation Failed', { accountNumber, bankCode, error: error.message });
      throw error;
    }
  }
}

export const paycrestService = new PaycrestService();
