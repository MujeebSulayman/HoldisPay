import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export class DiditService {
  private readonly baseUrl = 'https://apx.didit.me/v3';

  /**
   * Creates a new KYC session for a user and returns the hosted URL
   */
  async createSession(userId: string): Promise<{ sessionId: string; url: string }> {
    if (!env.DIDIT_APP_ID || !env.DIDIT_API_KEY) {
      throw new Error('Didit API credentials not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/session/`,
        {
          vendor_data: userId,
          client_id: env.DIDIT_APP_ID, // Use the AppID here
          // features: 'ocr,face,aml', // v3 uses workflows, but some apps might still accept features
          callback_url: `${env.FRONTEND_URL || 'https://holdispay.xyz'}/dashboard/kyc`,
        },
        {
          headers: {
            'x-api-key': env.DIDIT_API_KEY, // The API key acts as the secret/key
          },
        }
      );

      return {
        sessionId: response.data.session_id || response.data.id,
        url: response.data.url,
      };
    } catch (error) {
      logger.error('Failed to create Didit session', { 
        error: error instanceof Error ? error.message : error, 
        userId 
      });
      throw new Error('Could not create Didit verification session');
    }
  }
}

export const diditService = new DiditService();
