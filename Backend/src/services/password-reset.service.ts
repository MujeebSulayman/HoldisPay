import { supabase } from '../config/supabase';
import { AuthUtils } from '../utils/auth';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { emailService } from './email.service';

class PasswordResetService {
  async requestPasswordReset(email: string, ipAddress?: string): Promise<boolean> {
    try {
      
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, first_name')
        .eq('email', email.toLowerCase())
        .single();

      
      if (userError || !user) {
        logger.warn('Password reset requested for non-existent email', { email });
        return true;
      }

      
      const token = AuthUtils.generatePasswordResetToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); 

      
      const { error: insertError } = await supabase
        .from('password_reset_tokens')
        .insert({
          user_id: user.id,
          token,
          expires_at: expiresAt.toISOString(),
          ip_address: ipAddress,
          is_used: false,
        });

      if (insertError) throw insertError;

      
      const baseUrl = env.FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;
      
      await emailService.sendPasswordResetEmail(user.email, {
        firstName: user.first_name,
        resetUrl,
        expiresInMinutes: 60,
      });

      
      await this.logSecurityEvent({
        userId: user.id,
        eventType: 'password_reset_requested',
        ipAddress,
        success: true,
      });

      return true;
    } catch (error) {
      logger.error('Failed to request password reset', { error });
      return false;
    }
  }

  async resetPassword(token: string, newPassword: string, ipAddress?: string): Promise<{ success: boolean; message: string }> {
    try {
      
      const { data: resetToken, error: tokenError } = await supabase
        .from('password_reset_tokens')
        .select('id, user_id, expires_at, is_used')
        .eq('token', token)
        .single();

      if (tokenError || !resetToken) {
        return {
          success: false,
          message: 'Invalid or expired reset token',
        };
      }

      
      if (resetToken.is_used) {
        logger.warn('Attempted to use already used reset token', { tokenId: resetToken.id });
        return {
          success: false,
          message: 'This reset link has already been used',
        };
      }

      
      if (new Date(resetToken.expires_at) < new Date()) {
        return {
          success: false,
          message: 'Reset link has expired. Please request a new one',
        };
      }

      
      const passwordHash = await AuthUtils.hashPassword(newPassword);

      
      const { error: updateError } = await supabase
        .from('users')
        .update({
          password: passwordHash,
          last_password_change_at: new Date().toISOString(),
          failed_login_attempts: 0,
          account_locked_until: null,
        })
        .eq('id', resetToken.user_id);

      if (updateError) throw updateError;

      
      await supabase
        .from('password_reset_tokens')
        .update({
          is_used: true,
          used_at: new Date().toISOString(),
        })
        .eq('id', resetToken.id);

      
      await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', resetToken.user_id);

      await supabase
        .from('refresh_tokens')
        .update({
          is_revoked: true,
          revoked_at: new Date().toISOString(),
        })
        .eq('user_id', resetToken.user_id);

      
      await this.logSecurityEvent({
        userId: resetToken.user_id,
        eventType: 'password_reset_completed',
        ipAddress,
        success: true,
      });

      logger.info('Password reset successful', {
        userId: resetToken.user_id,
      });

      return {
        success: true,
        message: 'Password reset successful. Please login with your new password',
      };
    } catch (error) {
      logger.error('Failed to reset password', { error });
      return {
        success: false,
        message: 'Failed to reset password. Please try again',
      };
    }
  }

  async validateResetToken(token: string): Promise<boolean> {
    try {
      const { data: resetToken, error } = await supabase
        .from('password_reset_tokens')
        .select('expires_at, is_used')
        .eq('token', token)
        .single();

      if (error || !resetToken) return false;
      if (resetToken.is_used) return false;
      if (new Date(resetToken.expires_at) < new Date()) return false;

      return true;
    } catch (error) {
      return false;
    }
  }

  private async logSecurityEvent(event: {
    userId?: string;
    eventType: string;
    ipAddress?: string;
    success: boolean;
    eventData?: any;
  }): Promise<void> {
    try {
      await supabase.from('security_audit_log').insert({
        user_id: event.userId,
        event_type: event.eventType,
        ip_address: event.ipAddress,
        success: event.success,
        event_data: event.eventData,
      });
    } catch (error) {
      logger.error('Failed to log security event', { error });
    }
  }
}

export const passwordResetService = new PasswordResetService();
