import { Router } from 'express';
import { paymentContractController } from '../controllers/payment-contract.controller';
import { authenticate } from '../middlewares/auth.middleware';

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

router.get(
  '/my-contracts',
  authenticate,
  paymentContractController.getUserContracts.bind(paymentContractController)
);

router.get(
  '/:contractId',
  authenticate,
  paymentContractController.getContract.bind(paymentContractController)
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
  '/:contractId/claim',
  authenticate,
  paymentContractController.claimPayment.bind(paymentContractController)
);

router.get(
  '/:contractId/milestones',
  authenticate,
  paymentContractController.getMilestones.bind(paymentContractController)
);

router.post(
  '/milestones/submit',
  authenticate,
  paymentContractController.submitMilestone.bind(paymentContractController)
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
