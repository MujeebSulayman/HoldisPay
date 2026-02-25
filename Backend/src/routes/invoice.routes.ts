import { Router } from 'express';
import { invoiceController } from '../controllers/invoice.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();


router.post('/create', authenticate, (req, res) => invoiceController.createInvoice(req, res));


router.get('/:invoiceId', (req, res) => invoiceController.getInvoice(req, res));


router.post('/:invoiceId/fund', authenticate, (req, res) => invoiceController.fundInvoice(req, res));


router.post('/:invoiceId/deliver', authenticate, (req, res) => invoiceController.submitDelivery(req, res));


router.post('/:invoiceId/confirm', authenticate, (req, res) => invoiceController.confirmDelivery(req, res));


router.get('/user/:userId', authenticate, (req, res) => invoiceController.getUserInvoices(req, res));


router.post('/:invoiceId/payment-link', (req, res) => invoiceController.createPaymentLink(req, res));


router.get('/:invoiceId/payment-link', (req, res) => invoiceController.getPaymentLink(req, res));

export default router;
