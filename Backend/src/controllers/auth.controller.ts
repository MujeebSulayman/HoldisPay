import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { refreshTokenService } from '../services/refresh-token.service';
import { sessionService } from '../services/session.service';
import { passwordResetService } from '../services/password-reset.service';
import { emailService } from '../services/email.service';
import { AuthUtils } from '../utils/auth';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { env } from '../config/env';
import { supabase } from '../config/supabase';

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          error: 'Missing required fields',
          message: 'Email and password are required',
        });
        return;
      }

      
      const userAgent = req.headers['user-agent'] || '';
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';

      const result = await userService.login(email, password, {
        ipAddress,
        userAgent,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Login controller error', { error });
      res.status(401).json({
        error: 'Authentication failed',
        message: error instanceof Error ? error.message : 'Login failed',
      });
    }
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          error: 'Missing refresh token',
        });
        return;
      }

      
      const tokenData = await refreshTokenService.verifyRefreshToken(refreshToken);

      if (!tokenData) {
        res.status(401).json({
          error: 'Invalid or expired refresh token',
        });
        return;
      }

      
      const { supabase } = await import('../config/supabase');
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, wallet_address, account_type, is_active')
        .eq('id', tokenData.userId)
        .single();

      if (userError || !user || !user.is_active) {
        res.status(401).json({
          error: 'User account not found or inactive',
        });
        return;
      }

      
      await refreshTokenService.revokeRefreshToken(tokenData.tokenId);

      
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        walletAddress: user.wallet_address,
        accountType: user.account_type,
      };

      const newAccessToken = AuthUtils.generateAccessToken(tokenPayload);

      
      const newRefreshTokenData = await refreshTokenService.createRefreshToken({
        userId: user.id,
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      
      await sessionService.createSession({
        userId: user.id,
        accessToken: newAccessToken,
        refreshTokenId: newRefreshTokenData.id,
        sessionInfo: {
          ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        },
        expiresInMinutes: env.SESSION_TIMEOUT_MINUTES,
      });

      logger.info('Token refreshed successfully', { userId: user.id });

      res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshTokenData.token,
        },
      });
    } catch (error) {
      logger.error('Refresh token error', { error });
      res.status(401).json({
        error: 'Failed to refresh token',
        message: error instanceof Error ? error.message : 'Token refresh failed',
      });
    }
  }

  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const authHeader = req.headers.authorization;
      const token = authHeader?.substring(7);

      if (token) {
        const tokenHash = AuthUtils.hashToken(token);

        
        const { supabase } = await import('../config/supabase');
        await supabase
          .from('user_sessions')
          .update({ is_active: false })
          .eq('access_token_hash', tokenHash);
      }

      logger.info('User logged out', { userId: req.user.userId });

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      logger.error('Logout error', { error });
      res.status(500).json({
        error: 'Logout failed',
      });
    }
  }

  async logoutAllSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      
      await sessionService.revokeAllSessions(req.user.userId);

      
      await refreshTokenService.revokeAllUserRefreshTokens(req.user.userId);

      logger.info('All sessions logged out', { userId: req.user.userId });

      res.json({
        success: true,
        message: 'Logged out from all devices',
      });
    } catch (error) {
      logger.error('Logout all sessions error', { error });
      res.status(500).json({
        error: 'Failed to logout from all sessions',
      });
    }
  }

  async getSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const sessions = await sessionService.getUserSessions(req.user.userId);

      res.json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      logger.error('Get sessions error', { error });
      res.status(500).json({
        error: 'Failed to fetch sessions',
      });
    }
  }

  async revokeSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { sessionId } = req.params;

      if (!sessionId) {
        res.status(400).json({
          error: 'Session ID is required',
        });
        return;
      }

      const success = await sessionService.revokeSession(sessionId, req.user.userId);

      if (success) {
        res.json({
          success: true,
          message: 'Session revoked successfully',
        });
      } else {
        res.status(404).json({
          error: 'Session not found',
        });
      }
    } catch (error) {
      logger.error('Revoke session error', { error });
      res.status(500).json({
        error: 'Failed to revoke session',
      });
    }
  }

  async requestPasswordReset(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          error: 'Email is required',
        });
        return;
      }

      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

      await passwordResetService.requestPasswordReset(email, ipAddress);

      
      res.json({
        success: true,
        message: 'If an account exists with that email, we sent a password reset link',
      });
    } catch (error) {
      logger.error('Request password reset error', { error });
      res.json({
        success: true,
        message: 'If an account exists with that email, we sent a password reset link',
      });
    }
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        res.status(400).json({
          error: 'Token and new password are required',
        });
        return;
      }

      if (newPassword.length < 8) {
        res.status(400).json({
          error: 'Password must be at least 8 characters long',
        });
        return;
      }

      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

      const result = await passwordResetService.resetPassword(token, newPassword, ipAddress);

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
        });
      } else {
        res.status(400).json({
          error: result.message,
        });
      }
    } catch (error) {
      logger.error('Reset password error', { error });
      res.status(500).json({
        error: 'Failed to reset password',
      });
    }
  }

  async validateResetToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        res.status(400).json({
          error: 'Token is required',
        });
        return;
      }

      const isValid = await passwordResetService.validateResetToken(token);

      res.json({
        success: true,
        valid: isValid,
      });
    } catch (error) {
      logger.error('Validate reset token error', { error });
      res.status(500).json({
        error: 'Failed to validate token',
      });
    }
  }

  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const token = typeof req.query.token === 'string' ? req.query.token : undefined;
      if (!token) {
        res.status(400).json({ success: false, error: 'Token is required' });
        return;
      }
      const { userId } = AuthUtils.verifyEmailVerificationToken(token);

      const { data: dbUser, error: userError } = await supabase
        .from('users')
        .select('id, email, wallet_address, account_type, is_active, first_name, last_name, phone_number, tag, kyc_status, email_verified, phone_verified')
        .eq('id', userId)
        .single();

      if (userError || !dbUser || !dbUser.is_active) {
        res.status(400).json({ success: false, error: 'User not found or inactive' });
        return;
      }

      if (dbUser.email_verified) {
        res.status(400).json({
          success: false,
          error: 'This verification link has already been used. Please sign in.',
        });
        return;
      }

      await userService.verifyEmail(userId);

      const tokenPayload = {
        userId: dbUser.id,
        email: dbUser.email,
        walletAddress: dbUser.wallet_address,
        accountType: dbUser.account_type,
      };
      const accessToken = AuthUtils.generateAccessToken(tokenPayload);
      const refreshTokenData = await refreshTokenService.createRefreshToken({
        userId: dbUser.id,
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });
      await sessionService.createSession({
        userId: dbUser.id,
        accessToken,
        refreshTokenId: refreshTokenData.id,
        sessionInfo: {
          ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        },
        expiresInMinutes: env.SESSION_TIMEOUT_MINUTES,
      });

      const user = {
        id: dbUser.id,
        email: dbUser.email,
        accountType: dbUser.account_type,
        firstName: dbUser.first_name,
        lastName: dbUser.last_name,
        tag: dbUser.tag ?? undefined,
        phoneNumber: dbUser.phone_number,
        walletAddress: dbUser.wallet_address,
        kycStatus: dbUser.kyc_status,
        emailVerified: dbUser.email_verified,
        phoneVerified: dbUser.phone_verified,
      };

      emailService.notifyUserRegistration(dbUser.email, { firstName: dbUser.first_name }).catch((err) =>
        logger.error('Welcome email failed after verify', { err, userId })
      );

      res.json({
        success: true,
        message: 'Email verified',
        data: {
          user,
          accessToken,
          refreshToken: refreshTokenData.token,
        },
      });
    } catch (error) {
      logger.error('Verify email error', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Invalid or expired link',
      });
    }
  }
}

export const authController = new AuthController();
