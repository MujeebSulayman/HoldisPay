import { supabase } from '../config/supabase';
import { AuthUtils } from '../utils/auth';
import { logger } from '../utils/logger';

export interface CreateRefreshTokenRequest {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: any;
}

export interface RefreshTokenData {
  id: string;
  token: string;
  expiresAt: Date;
}

class RefreshTokenService {
  async createRefreshToken(request: CreateRefreshTokenRequest): Promise<RefreshTokenData> {
    try {
      
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', request.userId)
        .single();

      const payload = {
        userId: request.userId,
        email: user?.email || '',
      };

      const token = AuthUtils.generateRefreshToken(payload);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); 

      const { data, error } = await supabase
        .from('refresh_tokens')
        .insert({
          user_id: request.userId,
          token,
          expires_at: expiresAt.toISOString(),
          ip_address: request.ipAddress,
          user_agent: request.userAgent,
          device_info: request.deviceInfo,
          is_revoked: false,
        })
        .select('id, token, expires_at')
        .single();

      if (error) throw error;

      logger.info('Refresh token created', {
        userId: request.userId,
        tokenId: data.id,
      });

      return {
        id: data.id,
        token: data.token,
        expiresAt: new Date(data.expires_at),
      };
    } catch (error) {
      logger.error('Failed to create refresh token', { error });
      throw error;
    }
  }

  async verifyRefreshToken(token: string): Promise<{ userId: string; tokenId: string } | null> {
    try {
      const payload = AuthUtils.verifyRefreshToken(token);

      const { data, error } = await supabase
        .from('refresh_tokens')
        .select('id, user_id, expires_at, is_revoked')
        .eq('token', token)
        .single();

      if (error || !data) {
        logger.warn('Refresh token not found in database');
        return null;
      }

      if (data.is_revoked) {
        logger.warn('Refresh token has been revoked', { tokenId: data.id });
        return null;
      }

      if (new Date(data.expires_at) < new Date()) {
        logger.warn('Refresh token has expired', { tokenId: data.id });
        await this.revokeRefreshToken(data.id);
        return null;
      }

      return {
        userId: data.user_id,
        tokenId: data.id,
      };
    } catch (error) {
      logger.error('Failed to verify refresh token', { error });
      return null;
    }
  }

  async revokeRefreshToken(tokenId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('refresh_tokens')
        .update({
          is_revoked: true,
          revoked_at: new Date().toISOString(),
        })
        .eq('id', tokenId);

      if (error) throw error;

      logger.info('Refresh token revoked', { tokenId });
      return true;
    } catch (error) {
      logger.error('Failed to revoke refresh token', { error });
      return false;
    }
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('refresh_tokens')
        .update({
          is_revoked: true,
          revoked_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('is_revoked', false);

      if (error) throw error;

      logger.info('All user refresh tokens revoked', { userId });
      return true;
    } catch (error) {
      logger.error('Failed to revoke all user refresh tokens', { error });
      return false;
    }
  }

  async cleanupExpiredTokens(): Promise<void> {
    try {
      await supabase
        .from('refresh_tokens')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .eq('is_revoked', false);

      logger.info('Expired refresh tokens cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup expired tokens', { error });
    }
  }
}

export const refreshTokenService = new RefreshTokenService();
