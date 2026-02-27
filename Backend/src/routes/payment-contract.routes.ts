import { Router } from 'express';
import { paymentContractController } from '../controllers/payment-contract.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { contractAttachmentUpload } from '../middlewares/contract-attachment-upload.middleware';

const router = Router();

router.post(
  '/create',
  authenticate,
  paymentContractController.createContract.bind(paymentContractController)
);

router.post(
  '/fund',
  authenticate,
  paymentContractController.fundContract.bind(paymentContractController)
);

router.post(
  '/:contractId/fund-link',
  authenticate,
  paymentContractController.createContractFundingLink.bind(paymentContractController)
);

router.get(
  '/my-contracts',
  authenticate,
  paymentContractController.getUserContracts.bind(paymentContractController)
);

router.get(
  '/validate-contractor',
  authenticate,
  paymentContractController.validateContractorTag.bind(paymentContractController)
);

router.get(
  '/:contractId',
  authenticate,
  paymentContractController.getContract.bind(paymentContractController)
);

router.post(
  '/:contractId/attachments',
  authenticate,
  (req, res, next) => {
    contractAttachmentUpload(req, res, (err: any) => {
      if (err) return res.status(400).json({ error: err.message || 'Invalid file' });
      next();
    });
  },
  paymentContractController.uploadAttachment.bind(paymentContractController)
);

router.get(
  '/:contractId/attachments',
  authenticate,
  paymentContractController.listAttachments.bind(paymentContractController)
);

router.get(
  '/:contractId/attachments/:attachmentId/download-url',
  authenticate,
  paymentContractController.getAttachmentDownloadUrl.bind(paymentContractController)
);

router.patch(
  '/:contractId',
  authenticate,
  paymentContractController.updateContract.bind(paymentContractController)
);

router.delete(
  '/:contractId',
  authenticate,
  paymentContractController.deleteContract.bind(paymentContractController)
);

router.post(
  '/:contractId/submit-work',
  authenticate,
  paymentContractController.submitWork.bind(paymentContractController)
);

router.post(
  '/:contractId/approve-work',
  authenticate,
  paymentContractController.approveWork.bind(paymentContractController)
);

router.post(
  '/:contractId/release-payment',
  authenticate,
  paymentContractController.releasePayment.bind(paymentContractController)
);

router.post(
  '/:contractId/claim',
  authenticate,
  paymentContractController.claimPayment.bind(paymentContractController)
);

router.get(
  '/:contractId/team',
  authenticate,
  paymentContractController.getTeamMembers.bind(paymentContractController)
);

router.get(
  '/:contractId/disputes',
  authenticate,
  paymentContractController.getDisputes.bind(paymentContractController)
);

router.get(
  '/tokens/supported',
  authenticate,
  paymentContractController.getSupportedTokens.bind(paymentContractController)
);

router.get(
  '/stats/overview',
  authenticate,
  paymentContractController.getContractStats.bind(paymentContractController)
);

export default router;
