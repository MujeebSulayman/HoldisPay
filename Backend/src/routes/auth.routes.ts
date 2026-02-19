import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Login
router.post('/login', (req, res) => authController.login(req, res));

// Token Refresh
router.post('/refresh', (req, res) => authController.refreshToken(req, res));

// Logout
router.post('/logout', authenticate, (req, res) => authController.logout(req, res));

// Logout from all sessions
router.post('/logout-all', authenticate, (req, res) => authController.logoutAllSessions(req, res));

// Get all active sessions
router.get('/sessions', authenticate, (req, res) => authController.getSessions(req, res));

// Revoke specific session
router.delete('/sessions/:sessionId', authenticate, (req, res) => authController.revokeSession(req, res));

// Password Reset Flow
router.post('/password-reset/request', (req, res) => authController.requestPasswordReset(req, res));
router.post('/password-reset/reset', (req, res) => authController.resetPassword(req, res));
router.get('/password-reset/validate', (req, res) => authController.validateResetToken(req, res));

export default router;
