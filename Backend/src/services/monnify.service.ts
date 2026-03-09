import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface MonnifyBank {
  name: string;
  code: string;
  ussdTemplate: string | null;
  baseUssdCode: string | null;
  transferUssdTemplate: string | null;
  bankId?: string;
  nipBankCode?: string;
}

export interface MonnifyAccountValidationResult {
  accountNumber: string;
  accountName: string;
  bankCode: string;
}

export interface MonnifyDisbursementRequest {
  amount: number;
  reference: string;
  narration: string;
  destinationBankCode: string;
  destinationAccountNumber: string;
  currency: string;
  sourceAccountNumber: string;
  async?: boolean;
}

export interface MonnifyDisbursementResponse {
  amount: number;
  reference: string;
  status: string;
  dateCreated: string;
  totalFee: number;
  destinationAccountName: string;
  destinationBankName: string;
  destinationAccountNumber: string;
  destinationBankCode: string;
}

export class MonnifyService {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  private get baseUrl(): string {
    return env.MONNIFY_BASE_URL || 'https://sandbox.monnify.com';
  }

  private getAuthClient(): AxiosInstance {
    return axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  private async getBearerToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const apiKey = env.MONNIFY_API_KEY;
    const secretKey = env.MONNIFY_SECRET_KEY;

    if (!apiKey || !secretKey) {
      throw new Error('Monnify credentials are not fully configured in environment variables');
    }

    const authString = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');
    const client = this.getAuthClient();

    try {
      const response = await client.post('/api/v1/auth/login', null, {
        headers: {
          Authorization: `Basic ${authString}`,
        },
      });

      if (response.data?.requestSuccessful && response.data?.responseBody?.accessToken) {
        this.accessToken = response.data.responseBody.accessToken;
        // Typically token expires in 1 hour; buffering by 5 minutes just in case
        const expiresIn = response.data.responseBody.expiresIn || 3600;
        this.tokenExpiresAt = Date.now() + (expiresIn * 1000) - 300000;
        return this.accessToken!;
      }

      throw new Error('Failed to retrieve Monnify access token');
    } catch (error: any) {
      logger.error('Monnify Authentication Error', { error: error.message, data: error.response?.data });
      throw new Error('Failed to authenticate with Monnify');
    }
  }

  private async getApiClient(timeoutMs = 15000): Promise<AxiosInstance> {
    const token = await this.getBearerToken();
    return axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: timeoutMs,
    });
  }

  async getBanks(): Promise<MonnifyBank[]> {
    try {
      const client = await this.getApiClient();
      const response = await client.get('/api/v1/banks');

      if (response.data?.requestSuccessful && Array.isArray(response.data?.responseBody)) {
        return response.data.responseBody;
      }

      logger.warn('Monnify get banks returned unsuccessful response', { data: response.data });
      return [];
    } catch (error: any) {
      logger.error('Monnify getBanks error', { error: error.message, data: error.response?.data });
      throw new Error(error.response?.data?.responseMessage || 'Failed to fetch banks from Monnify');
    }
  }

  async validateAccount(accountNumber: string, bankCode: string): Promise<MonnifyAccountValidationResult> {
    try {
      const client = await this.getApiClient();
      const response = await client.get('/api/v1/disbursements/account/validate', {
        params: { accountNumber, bankCode },
      });

      if (response.data?.requestSuccessful && response.data?.responseBody) {
        return {
          accountNumber: response.data.responseBody.accountNumber,
          accountName: response.data.responseBody.accountName,
          bankCode: bankCode,
        };
      }

      throw new Error(response.data?.responseMessage || 'Account validation failed');
    } catch (error: any) {
        logger.error('Monnify validateAccount error', { error: error.message, data: error.response?.data });
        throw new Error(error.response?.data?.responseMessage || 'Failed to validate account with Monnify');
    }
  }

  async initiateTransfer(data: MonnifyDisbursementRequest): Promise<MonnifyDisbursementResponse> {
    try {
      const client = await this.getApiClient();
      const response = await client.post('/api/v2/disbursements/single', {
        amount: data.amount,
        reference: data.reference,
        narration: data.narration,
        destinationBankCode: data.destinationBankCode,
        destinationAccountNumber: data.destinationAccountNumber,
        currency: data.currency,
        sourceAccountNumber: data.sourceAccountNumber,
        async: data.async ?? false,
      });

      if (response.data?.requestSuccessful && response.data?.responseBody) {
         return response.data.responseBody;
      }

      throw new Error(response.data?.responseMessage || 'Transfer initiation failed');
    } catch (error: any) {
      logger.error('Monnify initiateTransfer error', { error: error.message, data: error.response?.data });
      throw new Error(error.response?.data?.responseMessage || 'Failed to initiate transfer with Monnify');
    }
  }
}

export const monnifyService = new MonnifyService();
