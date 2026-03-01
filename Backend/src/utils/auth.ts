import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';

const JWT_ALGORITHM = 'HS256' as const;
const ISSUER = 'holdis-api';

export interface TokenPayload {
  userId: string;
  email: string;
  walletAddress?: string;
  accountType?: string;
}

export class AuthUtils {
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: '2h',
      issuer: ISSUER,
      algorithm: JWT_ALGORITHM,
      audience: 'access',
    });
  }

  static generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: '7d',
      issuer: ISSUER,
      algorithm: JWT_ALGORITHM,
      audience: 'refresh',
    });
  }

  /** Verify access token only (rejects refresh tokens). */
  static verifyAccessToken(token: string): TokenPayload {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET, {
        algorithms: [JWT_ALGORITHM],
        issuer: ISSUER,
        audience: 'access',
      }) as TokenPayload;
      return payload;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Invalid or expired token');
    }
  }

  /** Verify refresh token only (rejects access tokens). */
  static verifyRefreshToken(token: string): TokenPayload {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET, {
        algorithms: [JWT_ALGORITHM],
        issuer: ISSUER,
        audience: 'refresh',
      }) as TokenPayload;
      return payload;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Invalid or expired token');
    }
  }

  /** Verify any token (access or refresh). Use verifyAccessToken/verifyRefreshToken when type is known. */
  static verifyToken(token: string): TokenPayload {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET, {
        algorithms: [JWT_ALGORITHM],
        issuer: ISSUER,
      }) as TokenPayload;
      return payload;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Invalid or expired token');
    }
  }

  static decodeToken(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch (error) {
      return null;
    }
  }

  static generateEmailVerificationToken(userId: string, email: string): string {
    return jwt.sign(
      { userId, email },
      env.JWT_SECRET,
      {
        expiresIn: '24h',
        issuer: ISSUER,
        algorithm: JWT_ALGORITHM,
        audience: 'email_verification',
      }
    );
  }

  static verifyEmailVerificationToken(token: string): { userId: string; email: string } {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
      issuer: ISSUER,
      audience: 'email_verification',
    }) as { userId: string; email: string };
    return payload;
  }

  static generatePasswordResetToken(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  static hashToken(token: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
