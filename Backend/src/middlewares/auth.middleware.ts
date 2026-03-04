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
    const payload = AuthUtils.verifyAccessToken(token);
    const userId = payload.userId != null ? String(payload.userId) : '';

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token',
      });
      return;
    }

    
    const { supabase } = await import('../config/supabase');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, is_active')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      logger.warn('Token valid but user lookup failed', { userId, error: userError.message, code: userError.code });
      res.status(503).json({
        error: 'Service unavailable',
        message: 'Could not verify account. Please try again.',
      });
      return;
    }

    if (!user) {
      logger.warn('Token valid but user not found in database', { userId });
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

    const lockedUntil = (user as { account_locked_until?: string | null }).account_locked_until;
    if (lockedUntil && new Date(lockedUntil) > new Date()) {
      logger.warn('Token valid but user account is locked', { userId: payload.userId });
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User account is temporarily locked',
      });
      return;
    }

    
    try {
      const { sessionService } = await import('../services/session.service');
      await sessionService.updateSessionActivity(token);
    } catch (_) {
      
    }

    req.user = { ...payload, userId };

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
      try {
        const payload = AuthUtils.verifyAccessToken(token);
        req.user = payload;
      } catch {
      }
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

/** Ensures the authenticated user is either the target user (req.params.userId) or an admin. Use on routes with :userId. */
export const requireSelfOrAdmin = (
  paramName: string = 'userId'
) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }
      const targetId = req.params[paramName];
      if (!targetId) {
        next();
        return;
      }
      if (req.user.userId === targetId || req.user.accountType === 'admin') {
        next();
        return;
      }
      res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own resources',
      });
    } catch (error) {
      logger.error('Self or admin check failed', { error });
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied',
      });
    }
  };
};
