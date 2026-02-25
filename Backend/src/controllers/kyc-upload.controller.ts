import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { logger } from '../utils/logger';
import { supabase } from '../config/supabase';
import { env } from '../config/env';

export class KYCUploadController {
  async uploadDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;
      
      if (!req.user || req.user.userId !== userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }


      const { frontImage, backImage, selfie } = req.body;

      
      const timestamp = Date.now();
      const frontImageUrl = frontImage ? `kyc-docs/${userId}/front-${timestamp}` : '';
      const backImageUrl = backImage ? `kyc-docs/${userId}/back-${timestamp}` : '';
      const selfieUrl = selfie ? `kyc-docs/${userId}/selfie-${timestamp}` : '';

      
      logger.info('KYC documents uploaded', {
        userId,
        frontImageUrl,
        backImageUrl,
        selfieUrl,
      });

      res.json({
        success: true,
        data: {
          frontImageUrl,
          backImageUrl,
          selfieUrl,
        },
      });
    } catch (error) {
      logger.error('KYC upload failed', { error });
      res.status(500).json({
        error: 'Failed to upload documents',
        message: error instanceof Error ? error.message : 'Upload failed',
      });
    }
  }
}

export const kycUploadController = new KYCUploadController();
