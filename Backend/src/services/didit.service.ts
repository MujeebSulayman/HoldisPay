import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export class DiditService {
  private readonly baseUrl = 'https://verification.didit.me/v3';

  /**
   * Creates a new KYC session for a user and returns the hosted URL
   */
  async createSession(userId: string): Promise<{ sessionId: string; url: string }> {
    if (!env.DIDIT_APP_ID || !env.DIDIT_API_KEY || !env.DIDIT_WORKFLOW_ID) {
      throw new Error('Didit API credentials (APP_ID, API_KEY, WORKFLOW_ID) are not fully configured');
    }

    try {
      logger.info('Creating Didit V3 session...', { userId, workflowId: env.DIDIT_WORKFLOW_ID });
      const response = await axios.post(
        `${this.baseUrl}/session/`,
        {
          workflow_id: env.DIDIT_WORKFLOW_ID,
          vendor_data: userId,
          callback: `${env.FRONTEND_URL || 'https://holdispay.xyz'}/dashboard/kyc`,
        },
        {
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-api-key': env.DIDIT_API_KEY, 
          },
        }
      );

      return {
        sessionId: response.data.session_id || response.data.id,
        url: response.data.url || response.data.verification_url,
      };
    } catch (error) {
      logger.error('Failed to create Didit session', { 
        error: error instanceof Error ? error.message : error, 
        userId 
      });
      throw new Error('Could not create Didit verification session. Please check your workflow ID and API keys.');
    }
  }
}

export const diditService = new DiditService();
