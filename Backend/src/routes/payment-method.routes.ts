import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { paymentMethodController } from '../controllers/payment-method.controller';

const router = Router();

router.get('/countries', authenticate, (req, res) => paymentMethodController.getCountries(req, res));
router.get('/banks', authenticate, (req, res) => paymentMethodController.getBanks(req, res));
router.get('/banks/all', authenticate, (req, res) => paymentMethodController.getBanksAll(req, res));
router.post('/resolve-account', authenticate, (req, res) => paymentMethodController.resolveAccount(req, res));

export default router;
