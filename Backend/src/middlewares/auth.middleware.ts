import { Request, Response, NextFunction } from 'express';
import { AuthUtils } from '../utils/auth';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    walletAddress?: string;
    accountType?: string;
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.substring(7);
    const payload = AuthUtils.verifyToken(token);

    // Enhanced security: Check if user still exists and is active
    const { supabase } = await import('../config/supabase');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, is_active, account_locked_until')
      .eq('id', payload.userId)
      .single();

    if (userError || !user) {
      logger.warn('Token valid but user not found', { userId: payload.userId });
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User account not found',
      });
      return;
    }

    if (!user.is_active) {
      logger.warn('Token valid but user is inactive', { userId: payload.userId });
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User account is inactive',
      });
      return;
    }

    if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
      logger.warn('Token valid but user account is locked', { userId: payload.userId });
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User account is temporarily locked',
      });
      return;
    }

    // Update session activity
    const { sessionService } = await import('../services/session.service');
    await sessionService.updateSessionActivity(token);

    req.user = payload;

    next();
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown auth error');
    const message = err.message || 'Invalid token';
    logger.error('Authentication failed', { message, name: err.name });
    res.status(401).json({
      error: 'Unauthorized',
      message,
    });
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = AuthUtils.verifyToken(token);
      req.user = payload;
    }

    next();
  } catch (error) {
    next();
  }
};

export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    if (req.user.accountType !== 'admin') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Admin check failed', { error });
    res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required',
    });
  }
};
