import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.post('/login', (req, res) => authController.login(req, res));

router.post('/refresh', (req, res) => authController.refreshToken(req, res));

router.post('/logout', authenticate, (req, res) => authController.logout(req, res));

router.post('/logout-all', authenticate, (req, res) => authController.logoutAllSessions(req, res));

router.get('/sessions', authenticate, (req, res) => authController.getSessions(req, res));

router.delete('/sessions/:sessionId', authenticate, (req, res) => authController.revokeSession(req, res));

const passwordResetRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many password reset requests. Try again later.',
});
router.post('/password-reset/request', passwordResetRequestLimiter, (req, res) =>
  authController.requestPasswordReset(req, res)
);
router.post('/password-reset/reset', (req, res) => authController.resetPassword(req, res));
router.get('/password-reset/validate', (req, res) => authController.validateResetToken(req, res));

export default router;
