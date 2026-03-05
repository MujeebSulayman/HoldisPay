import { logger } from '../utils/logger';
import { AuthUtils } from '../utils/auth';
import { userWalletService } from './user-wallet.service';
import { multiChainWalletService } from './multi-chain-wallet.service';
import { supabase } from '../config/supabase';
import { SUPPORTED_CHAINS } from '../config/chains';
import { env } from '../config/env';
import { emailService } from './email.service';
import { refreshTokenService } from './refresh-token.service';
import { sessionService } from './session.service';
import {
  CreateUserRequest,
  UserRegistrationResponse,
  UserProfileResponse,
  User,
  SubmitKYCRequest,
  UpdateKYCStatusRequest,
  KYCStatus,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_PATTERN,
} from '../types/user';

/** Normalize username to tag format: lowercase, only a-z0-9_- */
export function normalizeUsername(username: string): string {
  return username
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');
}

export function validateUsername(username: string): { valid: boolean; message?: string } {
  const raw = username.trim();
  if (raw.length < USERNAME_MIN_LENGTH) {
    return { valid: false, message: `Username must be at least ${USERNAME_MIN_LENGTH} characters` };
  }
  if (raw.length > USERNAME_MAX_LENGTH) {
    return { valid: false, message: `Username must be at most ${USERNAME_MAX_LENGTH} characters` };
  }
  if (!USERNAME_PATTERN.test(raw)) {
    return { valid: false, message: 'Username can only contain letters, numbers, underscore and hyphen' };
  }
  const normalized = normalizeUsername(raw);
  if (normalized.length < USERNAME_MIN_LENGTH) {
    return { valid: false, message: `Username must be at least ${USERNAME_MIN_LENGTH} characters after formatting` };
  }
  const reserved = ['admin', 'support', 'holdis', 'holdispay', 'api', 'www'];
  if (reserved.includes(normalized) || reserved.some((r) => normalized.startsWith(`${r}-`))) {
    return { valid: false, message: 'This username is reserved' };
  }
  return { valid: true };
}

async function ensureTagUnique(tag: string): Promise<string> {
  const { data } = await supabase.from('users').select('id').eq('tag', tag).maybeSingle();
  if (!data) return tag;
  let n = 1;
  for (;;) {
    const candidate = `${tag}-${n}`;
    const { data: existing } = await supabase.from('users').select('id').eq('tag', candidate).maybeSingle();
    if (!existing) return candidate;
    n += 1;
  }
}

export class UserService {
  async registerUser(request: CreateUserRequest): Promise<UserRegistrationResponse> {
    try {
      logger.info('Starting user registration', {
        email: request.email,
        accountType: request.accountType,
      });

      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', request.email.toLowerCase())
        .single();

      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      const usernameValidation = validateUsername(request.username);
      if (!usernameValidation.valid) {
        throw new Error(usernameValidation.message);
      }
      let tag = normalizeUsername(request.username);
      tag = await ensureTagUnique(tag);

      const passwordHash = await AuthUtils.hashPassword(request.password);

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          email: request.email.toLowerCase(),
          password: passwordHash,
          account_type: request.accountType,
          first_name: request.firstName,
          last_name: request.lastName,
          tag,
          phone_number: request.phoneNumber,
          date_of_birth: request.dateOfBirth,
          address: request.address,
          business_info: request.businessInfo,
          wallet_address_id: null,
          wallet_address: null,
          kyc_status: 'pending',
          email_verified: false,
          phone_verified: true,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) {
        logger.error('Failed to insert user', { error: insertError });
        throw new Error(`Failed to create user: ${insertError.message}`);
      }

      
      const wallets = await multiChainWalletService.createWalletsOnAllChains(
        newUser.id,
        `${request.firstName} ${request.lastName}`
      );

      
      const primaryWallet = wallets['base'] || Object.values(wallets)[0];

      if (primaryWallet) {
        
        await supabase
          .from('users')
          .update({
            wallet_address_id: primaryWallet.addressId,
            wallet_address: primaryWallet.address,
          })
          .eq('id', newUser.id);

        newUser.wallet_address_id = primaryWallet.addressId;
        newUser.wallet_address = primaryWallet.address;
      }

      logger.info('User registered successfully with multi-chain wallet', {
        userId: newUser.id,
        email: newUser.email,
        accountType: newUser.account_type,
        tag: newUser.tag ?? tag,
        walletAddress: primaryWallet?.address,
        chainCount: Object.keys(wallets).length,
      });

      const { env } = await import('../config/env');
      const frontendUrl = env.FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const verificationToken = AuthUtils.generateEmailVerificationToken(newUser.id, newUser.email);
      const verifyUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`;
      try {
        await emailService.sendEmailVerificationEmail(newUser.email, {
          firstName: newUser.first_name,
          verifyUrl,
          expiresInHours: 24,
        });
      } catch (emailErr) {
        const errMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
        logger.error('Verification email could not be sent (user still created)', {
          userId: newUser.id,
          email: newUser.email,
          error: errMsg,
        });
        if (process.env.NODE_ENV === 'development') {
          logger.warn('DEV: Verification link (use this if email failed): ' + verifyUrl);
        }
      }

      try {
        await emailService.notifyAdminNewUser({
          email: newUser.email,
          name: `${newUser.first_name} ${newUser.last_name}`,
          accountType: newUser.account_type,
        });
      } catch (adminEmailErr) {
        logger.warn('Admin new-user email could not be sent', {
          error: adminEmailErr instanceof Error ? adminEmailErr.message : String(adminEmailErr),
        });
      }

      return {
        requiresEmailVerification: true as const,
        email: newUser.email,
      };
    } catch (error) {
      logger.error('User registration failed', { error, request });
      throw error;
    }
  }

  async login(email: string, password: string, sessionInfo?: {
    ipAddress?: string;
    userAgent?: string;
    deviceName?: string;
    browser?: string;
    os?: string;
  }): Promise<{
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      accountType: string;
      firstName: string;
      lastName: string;
      tag?: string;
      phoneNumber: string | null;
      walletAddress: string;
      kycStatus: string;
      emailVerified: boolean;
      phoneVerified: boolean;
    };
  }> {
    try {
      logger.info('User login attempt', { email });

      const { data: user, error } = await supabase
        .from('users')
        .select('id, email, password, wallet_address, is_active, account_type, first_name, last_name, phone_number, tag, kyc_status, email_verified, phone_verified')
        .eq('email', email.toLowerCase())
        .single();

      if (error) {
        logger.warn('Login lookup failed', { email: email.toLowerCase(), error: error.message });
        throw new Error('Invalid email or password');
      }
      if (!user) {
        throw new Error('Invalid email or password');
      }

      const userWithLock = user as typeof user & { account_locked_until?: string | null; failed_login_attempts?: number };
      if (userWithLock.account_locked_until && new Date(userWithLock.account_locked_until) > new Date()) {
        throw new Error('Account is temporarily locked due to multiple failed login attempts');
      }

      if (!user.is_active) {
        throw new Error('Account is deactivated. Please contact support.');
      }

      if (!user.email_verified) {
        throw new Error('Please verify your email before signing in. Check your inbox for the verification link.');
      }

      if (!user.password) {
        throw new Error('Invalid email or password');
      }

      const isValidPassword = await AuthUtils.comparePassword(password, user.password);

      if (!isValidPassword) {
        try {
          const failedAttempts = (userWithLock.failed_login_attempts ?? 0) + 1;
          const updates: Record<string, unknown> = { failed_login_attempts: failedAttempts };
          if (failedAttempts >= 5) {
            const lockUntil = new Date();
            lockUntil.setMinutes(lockUntil.getMinutes() + 30);
            updates.account_locked_until = lockUntil.toISOString();
          }
          await supabase.from('users').update(updates).eq('id', user.id);
        } catch (_) {
          
        }
        throw new Error('Invalid email or password');
      }

      
      try {
        await supabase
          .from('users')
          .update({
            failed_login_attempts: 0,
            account_locked_until: null,
            last_login_at: new Date().toISOString(),
          } as Record<string, unknown>)
          .eq('id', user.id);
      } catch (_) {
        
      }

      const tokenPayload = {
        userId: user.id,
        email: user.email,
        walletAddress: user.wallet_address,
        accountType: user.account_type,
      };

      const accessToken = AuthUtils.generateAccessToken(tokenPayload);

      
      const refreshTokenData = await refreshTokenService.createRefreshToken({
        userId: user.id,
        ipAddress: sessionInfo?.ipAddress,
        userAgent: sessionInfo?.userAgent,
      });

      
      await sessionService.createSession({
        userId: user.id,
        accessToken,
        refreshTokenId: refreshTokenData.id,
        sessionInfo: {
          ipAddress: sessionInfo?.ipAddress,
          userAgent: sessionInfo?.userAgent,
          deviceName: sessionInfo?.deviceName,
          browser: sessionInfo?.browser,
          os: sessionInfo?.os,
        },
        expiresInMinutes: 15,
      });

      logger.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        tag: user.tag ?? null,
      });

      return {
        accessToken,
        refreshToken: refreshTokenData.token,
        user: {
          id: user.id,
          email: user.email,
          accountType: user.account_type,
          firstName: user.first_name,
          lastName: user.last_name,
          tag: user.tag ?? undefined,
          phoneNumber: user.phone_number,
          walletAddress: user.wallet_address,
          kycStatus: user.kyc_status,
          emailVerified: user.email_verified,
          phoneVerified: user.phone_verified,
        },
      };
    } catch (error) {
      logger.error('Login failed', { error, email });
      throw error;
    }
  }

  async getUserProfile(userId: string): Promise<UserProfileResponse> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const wallet = await userWalletService.getUserWallet(userId);
      if (!wallet) {
        throw new Error('User wallet not found');
      }

      const balance = await userWalletService.getChildAddressBalance(wallet.id);

      logger.info('getUserProfile', { userId: user.id, tag: user.tag ?? null });

      return {
        id: user.id,
        email: user.email,
        accountType: user.accountType,
        profile: user.profile,
        tag: user.tag,
        walletAddress: user.walletAddress,
        walletBalance: {
          native: balance.nativeBalance,
          nativeInUSD: '0',
          tokens: balance.tokens.map(t => ({
            symbol: t.symbol,
            balance: t.balance,
            balanceInUSD: '0',
          })),
        },
        invoiceStats: {
          totalIssued: 0,
          totalPaid: 0,
          totalReceived: 0,
          pendingAmount: '0',
        },
        kycStatus: user.kycStatus,
        kycInfo: user.kycInfo,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      logger.error('Failed to get user profile', { error, userId });
      throw error;
    }
  }

  async tagExists(tag: string): Promise<boolean> {
    const normalized = normalizeUsername(tag);
    if (normalized.length < USERNAME_MIN_LENGTH) return false;
    const { data } = await supabase.from('users').select('id').eq('tag', normalized).maybeSingle();
    return !!data;
  }

  async userExists(email: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      return !!data && !error;
    } catch (error) {
      logger.error('Failed to check user existence', { error, email });
      return false;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapDbUserToUser(data);
    } catch (error) {
      logger.error('Failed to get user by email', { error, email });
      return null;
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    const { cacheService, cacheKeys } = await import('./cache.service');
    const key = cacheKeys.userProfile(userId);
    const cached = cacheService.get<User>(key);
    if (cached !== undefined) return cached;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      const user = this.mapDbUserToUser(data);
      cacheService.set(key, user, 60_000);
      return user;
    } catch (error) {
      logger.error('Failed to get user by ID', { error, userId });
      return null;
    }
  }

  async getAllUsers(limit: number = 50, offset: number = 0): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to fetch users: ${error.message}`);
      }

      return (data || []).map(user => this.mapDbUserToUser(user));
    } catch (error) {
      logger.error('Failed to get all users', { error, limit, offset });
      throw error;
    }
  }

  /** Count users created on or after the given date (e.g. start of current month). */
  async getCountCreatedAfter(since: Date): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .gte('created_at', since.toISOString());

      if (error) {
        throw new Error(`Failed to count users: ${error.message}`);
      }
      return count ?? 0;
    } catch (error) {
      logger.error('Failed to get new users count', { error, since: since.toISOString() });
      throw error;
    }
  }

  /** Count users created within [start, end). Used for growth report by period. */
  async getCountCreatedInPeriod(start: Date, end: Date): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString());

      if (error) {
        throw new Error(`Failed to count users in period: ${error.message}`);
      }
      return count ?? 0;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get users count in period', { error: msg, start: start.toISOString(), end: end.toISOString() });
      throw error;
    }
  }

  /** Returns signups per period for the last N months (period key e.g. "2024-03"). */
  async getUsersGrowthReport(periodsCount: number = 12): Promise<Array<{ period: string; count: number }>> {
    const reports: Array<{ period: string; count: number }> = [];
    const now = new Date();
    for (let i = periodsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const periodKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      try {
        const count = await this.getCountCreatedInPeriod(start, end);
        reports.push({ period: periodKey, count });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn('Users growth report: period failed, using 0', { period: periodKey, error: msg });
        reports.push({ period: periodKey, count: 0 });
      }
    }
    return reports;
  }

  async submitKYC(userId: string, kycData: SubmitKYCRequest): Promise<void> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      logger.info('KYC submission started', {
        userId,
        verificationLevel: kycData.verificationLevel,
        documentsCount: kycData.documents.length,
      });

      const kycInfo = {
        submittedAt: new Date().toISOString(),
        documents: kycData.documents.map((doc, index) => ({
          id: `doc_${Date.now()}_${index}`,
          type: doc.type,
          documentNumber: doc.documentNumber,
          issueDate: doc.issueDate,
          expiryDate: doc.expiryDate,
          issuingCountry: doc.issuingCountry,
          frontImageUrl: doc.frontImageUrl,
          backImageUrl: doc.backImageUrl,
          selfieUrl: doc.selfieUrl,
          uploadedAt: new Date().toISOString(),
          verified: false,
        })),
        verificationLevel: kycData.verificationLevel,
      };

      
      const { error: updateError } = await supabase
        .from('users')
        .update({
          kyc_status: 'submitted',
          kyc_info: kycInfo,
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error(`Failed to update KYC status: ${updateError.message}`);
      }

      
      for (const doc of kycData.documents) {
        const { error: docError } = await supabase
          .from('kyc_documents')
          .insert({
            user_id: userId,
            document_type: doc.type,
            document_number: doc.documentNumber,
            issue_date: doc.issueDate,
            expiry_date: doc.expiryDate,
            issuing_country: doc.issuingCountry,
            front_image_url: doc.frontImageUrl,
            back_image_url: doc.backImageUrl,
            selfie_url: doc.selfieUrl,
            verified: false,
          });

        if (docError) {
          logger.warn('Failed to insert KYC document', { error: docError, userId });
        }
      }

      
      logger.info('KYC submitted successfully', { userId });
    } catch (error) {
      logger.error('Failed to submit KYC', { error, userId });
      throw error;
    }
  }

  async updateKYCStatus(userId: string, updateData: UpdateKYCStatusRequest): Promise<void> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      logger.info('Updating KYC status', {
        userId,
        status: updateData.status,
        reviewedBy: updateData.reviewedBy,
      });

      
      const { data: userData } = await supabase
        .from('users')
        .select('kyc_info')
        .eq('id', userId)
        .single();

      const kycInfo = (userData?.kyc_info as any) || {};
      kycInfo.reviewedAt = new Date().toISOString();
      kycInfo.reviewedBy = updateData.reviewedBy;
      kycInfo.notes = updateData.notes;

      if (updateData.status === 'rejected' && updateData.rejectionReason) {
        kycInfo.rejectionReason = updateData.rejectionReason;
      }

      if (updateData.status === 'verified' && kycInfo.documents) {
        kycInfo.documents = kycInfo.documents.map((doc: any) => ({
          ...doc,
          verified: true,
        }));
      }

      
      const { error } = await supabase
        .from('users')
        .update({
          kyc_status: updateData.status,
          kyc_info: kycInfo,
        })
        .eq('id', userId);

      if (error) {
        throw new Error(`Failed to update KYC status: ${error.message}`);
      }

      
      if (updateData.status === 'verified') {
        await supabase
          .from('kyc_documents')
          .update({ verified: true })
          .eq('user_id', userId);
      }

      logger.info('KYC status updated', { userId, status: updateData.status });
    } catch (error) {
      logger.error('Failed to update KYC status', { error, userId });
      throw error;
    }
  }

  async updateProfile(userId: string, updates: Partial<User['profile']>): Promise<void> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const updateData: any = {};
      if (updates.firstName) updateData.first_name = updates.firstName;
      if (updates.lastName) updateData.last_name = updates.lastName;
      if (updates.dateOfBirth) updateData.date_of_birth = updates.dateOfBirth;
      if (updates.phoneNumber) updateData.phone_number = updates.phoneNumber;
      if (updates.address) updateData.address = updates.address;
      if (updates.businessInfo) updateData.business_info = updates.businessInfo;

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        throw new Error(`Failed to update profile: ${error.message}`);
      }

      logger.info('User profile updated', { userId });
    } catch (error) {
      logger.error('Failed to update profile', { error, userId });
      throw error;
    }
  }

  async verifyEmail(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('users')
        .update({ email_verified: true })
        .eq('id', userId);

      if (error) {
        throw new Error(`Failed to verify email: ${error.message}`);
      }

      logger.info('Email verified', { userId });
    } catch (error) {
      logger.error('Failed to verify email', { error, userId });
      throw error;
    }
  }

  async verifyPhone(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('users')
        .update({ phone_verified: true })
        .eq('id', userId);

      if (error) {
        throw new Error(`Failed to verify phone: ${error.message}`);
      }

      logger.info('Phone verified', { userId });
    } catch (error) {
      logger.error('Failed to verify phone', { error, userId });
      throw error;
    }
  }

  async getUserWalletAddressId(userId: string): Promise<string> {
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('wallet_address_id')
        .eq('id', userId)
        .maybeSingle();
      if (userRow?.wallet_address_id) {
        return userRow.wallet_address_id;
      }
      const wallet = await userWalletService.getUserWallet(userId);
      if (!wallet) {
        throw new Error('User wallet not found');
      }
      return wallet.id;
    } catch (error) {
      logger.error('Failed to get user wallet address ID', { error, userId });
      throw error;
    }
  }

  async getUserByWalletAddress(walletAddress: string): Promise<User | null> {
    try {
      const normalized = walletAddress?.toLowerCase();
      if (!normalized) return null;

      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', normalized)
        .single();

      if (!userError && userRow) {
        return this.mapDbUserToUser(userRow);
      }

      const { data: walletRows, error: walletError } = await supabase
        .from('user_wallets')
        .select('user_id')
        .eq('wallet_address', normalized)
        .limit(1);

      const userId = walletRows?.[0]?.user_id;
      if (walletError || !userId) {
        return null;
      }

      const { data: userByWallet, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError || !userByWallet) {
        return null;
      }

      return this.mapDbUserToUser(userByWallet);
    } catch (error) {
      logger.error('Failed to get user by wallet address', { error, walletAddress });
      return null;
    }
  }

  
  private mapDbUserToUser(dbUser: any): User {
    return {
      id: dbUser.id,
      email: dbUser.email,
      password: dbUser.password,
      accountType: dbUser.account_type,
      profile: {
        firstName: dbUser.first_name,
        lastName: dbUser.last_name,
        dateOfBirth: dbUser.date_of_birth,
        phoneNumber: dbUser.phone_number,
        address: dbUser.address,
        businessInfo: dbUser.business_info,
      },
      tag: dbUser.tag ?? undefined,
      walletAddressId: dbUser.wallet_address_id,
      walletAddress: dbUser.wallet_address,
      kycStatus: dbUser.kyc_status,
      kycInfo: dbUser.kyc_info,
      isActive: dbUser.is_active,
      emailVerified: dbUser.email_verified,
      phoneVerified: dbUser.phone_verified,
      createdAt: new Date(dbUser.created_at),
      updatedAt: new Date(dbUser.updated_at),
    };
  }
}

export const userService = new UserService();
