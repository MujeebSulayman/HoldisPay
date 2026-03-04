import { Router } from 'express';
import { webhookController } from '../controllers/webhook.controller';
import { blockradarWebhookController } from '../controllers/blockradar-webhook.controller';
import { verifyBlockradarSignature } from '../middlewares/blockradar-webhook-verify.middleware';

const router = Router();

router.post('/blockradar', (req, res) => webhookController.handleBlockradarWebhook(req, res));

router.post('/blockradar/transfer', verifyBlockradarSignature, (req, res) =>
  blockradarWebhookController.handleTransferWebhook(req, res)
);

router.post('/blockradar/contract', verifyBlockradarSignature, (req, res) =>
  blockradarWebhookController.handleContractWebhook(req, res)
);

router.post('/blockradar/payment-link', verifyBlockradarSignature, (req, res) =>
  blockradarWebhookController.handlePaymentLinkWebhook(req, res)
);

if (process.env.NODE_ENV !== 'production') {


  router.get('/test', (req, res) => webhookController.testWebhook(req, res));
}

export default router;
