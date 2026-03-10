import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { adminService } from '../services/admin.service';
import { userService } from '../services/user.service';
import { userWalletService } from '../services/user-wallet.service';
import { multiChainWalletService } from '../services/multi-chain-wallet.service';
import { transactionService } from '../services/transaction.service';
import { balanceService } from '../services/balance.service';
import { diditService } from '../services/didit.service';
import { logger } from '../utils/logger';

export class UserController {
  async checkUsername(req: Request, res: Response): Promise<void> {
    try {
      const raw = (req.query.username as string)?.trim() ?? '';
      const { validateUsername, normalizeUsername } = await import('../services/user.service');
      const validation = validateUsername(raw);
      if (!validation.valid) {
        res.status(200).json({
          success: true,
          data: { available: false, message: validation.message },
        });
        return;
      }
      const tag = normalizeUsername(raw);
      const exists = await userService.tagExists(tag);
      res.status(200).json({
        success: true,
        data: {
          available: !exists,
          tag: exists ? undefined : tag,
          message: exists ? 'This name already exists' : undefined,
        },
      });
    } catch (error) {
      logger.error('Check username API error', { error });
      res.status(500).json({
        error: 'Check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

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

      const result = await userService.login(email, password);

      logger.info('User logged in via API', {
        userId: result.user.id,
        email: result.user.email,
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Invalid credentials';
      logger.error('Login API error', { message: msg, email: req.body?.email });
      res.status(401).json({
        error: 'Login failed',
        message: msg,
      });
    }
  }

  async register(req: Request, res: Response): Promise<void> {
    try {
      const {
        email,
        password,
        accountType,
        firstName,
        lastName,
        username,
        phoneNumber,
        dateOfBirth,
        address,
      } = req.body;

      if (!email || !password || !accountType || !firstName || !lastName || !username || !phoneNumber) {
        res.status(400).json({
          error: 'Missing required fields',
          message: 'Email, password, accountType, firstName, lastName, username, and phoneNumber are required',
        });
        return;
      }

      if (accountType !== 'individual') {
        res.status(400).json({
          error: 'Invalid account type',
          message: 'Only individual accounts can be created via signup',
        });
        return;
      }

      const exists = await userService.userExists(email);
      if (exists) {
        res.status(409).json({
          error: 'User already exists',
          message: 'An account with this email already exists',
        });
        return;
      }

      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';

      const result = await userService.registerUser({
        email,
        password,
        accountType,
        firstName,
        lastName,
        username: String(username).trim(),
        phoneNumber,
        dateOfBirth,
        address,
        sessionInfo: { ipAddress, userAgent },
      });

      if ('requiresEmailVerification' in result) {
        logger.info('User registered via API (email verification required)', {
          email: result.email,
        });
        res.status(201).json({
          success: true,
          message: 'Check your email to verify your account',
          data: result,
        });
      } else {
        logger.info('User registered via API', {
          userId: result.user.id,
          email: result.user.email,
          accountType: result.user.accountType,
        });
        res.status(201).json({
          success: true,
          message: 'User registered successfully',
          data: result,
        });
      }
    } catch (error) {
      logger.error('Registration API error', { error });
      res.status(500).json({
        error: 'Registration failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const profile = await userService.getUserProfile(userId);

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      logger.error('Get profile API error', { error });
      res.status(500).json({
        error: 'Failed to get profile',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getWallet(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const wallet = await userWalletService.getUserWallet(userId);
      if (!wallet) {
        res.status(404).json({
          error: 'Wallet not found',
          message: 'User does not have a wallet',
        });
        return;
      }

      const balance = await userWalletService.getChildAddressBalance(wallet.id);

      res.status(200).json({
        success: true,
        data: {
          addressId: wallet.id,
          address: wallet.address,
          balance,
          label: wallet.label,
          createdAt: wallet.createdAt,
        },
      });
    } catch (error) {
      logger.error('Get wallet API error', { error });
      res.status(500).json({
        error: 'Failed to get wallet',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async initiateDiditKyc(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      
      const authUserId = (req as AuthenticatedRequest).user?.userId;
      if (!authUserId || authUserId !== userId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You can only initiate KYC for your own account',
        });
        return;
      }

      // Generate a new verification session via the Didit service
      const { sessionId, url } = await diditService.createSession(userId);

      // Save the session ID to the user's profile so the webhook can match it later
      await userService.updateProfile(userId, { diditSessionId: sessionId });

      logger.info('Didit KYC session initiated', {
        userId,
        sessionId,
      });

      res.status(200).json({
        success: true,
        data: {
          sessionId,
          url,
        },
      });
    } catch (error) {
      logger.error('Initiate Didit KYC API error', { error });
      res.status(500).json({
        error: 'Failed to initiate KYC',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateKYC(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { status, rejectionReason, notes, reviewedBy } = req.body;

      if (!status || !['pending', 'submitted', 'under_review', 'verified', 'rejected'].includes(status)) {
        res.status(400).json({
          error: 'Invalid status',
          message: 'Status must be pending, submitted, under_review, verified, or rejected',
        });
        return;
      }

      if (!reviewedBy) {
        res.status(400).json({
          error: 'Missing reviewer',
          message: 'reviewedBy is required',
        });
        return;
      }

      await userService.updateKYCStatus(userId, {
        status,
        rejectionReason,
        notes,
        reviewedBy,
      });

      logger.info('KYC status updated via API', {
        userId,
        status,
        reviewedBy,
      });

      res.status(200).json({
        success: true,
        message: 'KYC status updated',
      });
    } catch (error) {
      logger.error('Update KYC API error', { error });
      res.status(500).json({
        error: 'Failed to update KYC',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const updates = req.body;

      await userService.updateProfile(userId, updates);

      logger.info('Profile updated via API', { userId });

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
      });
    } catch (error) {
      logger.error('Update profile API error', { error });
      res.status(500).json({
        error: 'Failed to update profile',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async fundWallet(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { amount, token } = req.body;

      if (!amount) {
        res.status(400).json({
          error: 'Missing amount',
          message: 'Amount is required',
        });
        return;
      }

      const addressId = await userService.getUserWalletAddressId(userId);
      const result = await userWalletService.fundUserWallet(addressId, amount, token);

      const adminId = (req as AuthenticatedRequest).user?.userId;
      if (adminId) {
        adminService.logAdminAction({
          adminUserId: adminId,
          action: 'wallet_fund',
          targetType: 'user',
          targetId: userId,
          details: { amount, token, txHash: result.hash },
        }).catch(() => {});
      }

      res.status(200).json({
        success: true,
        message: 'Wallet funded successfully',
        data: {
          txHash: result.hash,
          status: result.status,
        },
      });
    } catch (error) {
      logger.error('Fund wallet API error', { error });
      res.status(500).json({
        error: 'Failed to fund wallet',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const { limit = '50', offset = '0', includeWallet = 'true' } = req.query;

      const users = await userService.getAllUsers(
        parseInt(limit as string), 
        parseInt(offset as string)
      );

      if (includeWallet === 'true') {
        const usersWithWallets = await Promise.all(
          users.map(async (user) => {
            try {
              const wallet = await userWalletService.getUserWallet(user.id);
              let balance = null;

              if (wallet) {
                try {
                  balance = await userWalletService.getChildAddressBalance(wallet.id);
                } catch (error) {
                  logger.warn('Failed to get balance for user wallet', { 
                    userId: user.id, 
                    walletId: wallet.id 
                  });
                }
              }

              return {
                ...user,
                wallet: wallet ? {
                  addressId: wallet.id,
                  address: wallet.address,
                  balance,
                  label: wallet.label,
                  createdAt: wallet.createdAt,
                } : null,
              };
            } catch (error) {
              logger.warn('Failed to get wallet for user', { userId: user.id });
              return { ...user, wallet: null };
            }
          })
        );

        res.status(200).json({
          success: true,
          data: {
            users: usersWithWallets,
            total: users.length,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
          },
        });
      } else {
        res.status(200).json({
          success: true,
          data: {
            users,
            total: users.length,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
          },
        });
      }
    } catch (error) {
      logger.error('Get all users API error', { error });
      res.status(500).json({
        error: 'Failed to get users',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getAllWallets(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const wallets = await multiChainWalletService.getAllUserWalletsFromDb(userId);

      res.status(200).json({
        success: true,
        data: wallets,
      });
    } catch (error) {
      logger.error('Get all wallets API error', { error });
      res.status(500).json({
        error: 'Failed to get wallets',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getConsolidatedBalance(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const data = await balanceService.getConsolidatedBalance(userId);
      res.status(200).json({
        success: true,
        data: {
          wallet: data.wallet,
          inContracts: data.inContracts,
          withdrawableUsd: data.withdrawableUsd,
        },
      });
    } catch (error) {
      logger.error('Get consolidated balance API error', { error });
      res.status(500).json({
        error: 'Failed to get consolidated balance',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getWalletOverview(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const authUserId = (req as AuthenticatedRequest).user?.userId;
      if (!authUserId || authUserId !== userId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You can only access your own wallet overview',
        });
        return;
      }

      const [wallets, flow] = await Promise.all([
        multiChainWalletService.getAllUserWalletsFromDb(userId),
        transactionService.getWalletOverviewFlow(userId, { periodsWeeks: 12, recentLimit: 30 }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          wallets,
          flow,
        },
      });
    } catch (error) {
      logger.error('Get wallet overview API error', { error });
      res.status(500).json({
        error: 'Failed to get wallet overview',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getChainWallet(req: Request, res: Response): Promise<void> {
    try {
      const { userId, chainId } = req.params;

      const wallet = await multiChainWalletService.getUserWalletForChain(userId, chainId);

      if (!wallet) {
        res.status(404).json({
          error: 'Wallet not found',
          message: `No wallet found for chain ${chainId}`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: wallet,
      });
    } catch (error) {
      logger.error('Get chain wallet API error', { error });
      res.status(500).json({
        error: 'Failed to get chain wallet',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getUserTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const authUserId = (req as AuthenticatedRequest).user?.userId;
      if (!authUserId || authUserId !== userId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You can only access your own transactions',
        });
        return;
      }

      const { 
        limit = '50', 
        offset = '0',
        status,
        txType,
        chainId,
        startDate,
        endDate
      } = req.query;

      const transactions = await transactionService.getUserTransactions(userId, {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        status: status as string,
        txType: txType as string,
        chainId: chainId as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      res.status(200).json({
        success: true,
        data: transactions,
      });
    } catch (error) {
      logger.error('Get user transactions API error', { error });
      res.status(500).json({
        error: 'Failed to get transactions',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const userController = new UserController();
