import { supabase } from '../config/supabase';
import { AuthUtils } from '../utils/auth';
import { logger } from '../utils/logger';

export interface SessionInfo {
  deviceName?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateSessionRequest {
  userId: string;
  accessToken: string;
  refreshTokenId: string;
  sessionInfo: SessionInfo;
  expiresInMinutes?: number;
}

export interface UserSession {
  id: string;
  user_id: string;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  last_activity_at: string;
  created_at: string;
  is_active: boolean;
}

import { env } from '../config/env';

class SessionService {
  async createSession(request: CreateSessionRequest): Promise<string> {
    try {
      const tokenHash = AuthUtils.hashToken(request.accessToken);
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + (request.expiresInMinutes || env.SESSION_TIMEOUT_MINUTES));

      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: request.userId,
          access_token_hash: tokenHash,
          refresh_token_id: request.refreshTokenId,
          device_name: request.sessionInfo.deviceName,
          browser: request.sessionInfo.browser,
          os: request.sessionInfo.os,
          ip_address: request.sessionInfo.ipAddress,
          expires_at: expiresAt.toISOString(),
          is_active: true,
        })
        .select('id')
        .single();

      if (error) throw error;

      logger.info('Session created', {
        userId: request.userId,
        sessionId: data.id,
      });

      return data.id;
    } catch (error) {
      logger.error('Failed to create session', { error });
      throw error;
    }
  }

  async updateSessionActivity(accessToken: string): Promise<void> {
    try {
      const tokenHash = AuthUtils.hashToken(accessToken);

      await supabase
        .from('user_sessions')
        .update({
          last_activity_at: new Date().toISOString(),
        })
        .eq('access_token_hash', tokenHash)
        .eq('is_active', true);
    } catch (error) {
      logger.error('Failed to update session activity', { error });
    }
  }

  async getUserSessions(userId: string): Promise<UserSession[]> {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('id, user_id, device_name, browser, os, ip_address, last_activity_at, created_at, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_activity_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Failed to get user sessions', { error });
      return [];
    }
  }

  async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', sessionId)
        .eq('user_id', userId);

      if (error) throw error;

      logger.info('Session revoked', { sessionId, userId });
      return true;
    } catch (error) {
      logger.error('Failed to revoke session', { error });
      return false;
    }
  }

  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<boolean> {
    try {
      let query = supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', userId);

      if (exceptSessionId) {
        query = query.neq('id', exceptSessionId);
      }

      const { error } = await query;

      if (error) throw error;

      logger.info('All sessions revoked', { userId, exceptSessionId });
      return true;
    } catch (error) {
      logger.error('Failed to revoke all sessions', { error });
      return false;
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    try {
      await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .lt('expires_at', new Date().toISOString())
        .eq('is_active', true);

      logger.info('Expired sessions cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', { error });
    }
  }
}

export const sessionService = new SessionService();
