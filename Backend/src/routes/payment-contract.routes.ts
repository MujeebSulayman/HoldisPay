import { Router } from 'express';
import { paymentContractController } from '../controllers/payment-contract.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.post(
  '/create',
  authenticateToken,
  paymentContractController.createContract.bind(paymentContractController)
);

router.post(
  '/fund',
  authenticateToken,
  paymentContractController.fundContract.bind(paymentContractController)
);

router.get(
  '/my-contracts',
  authenticateToken,
  paymentContractController.getUserContracts.bind(paymentContractController)
);

router.get(
  '/:contractId',
  authenticateToken,
  paymentContractController.getContract.bind(paymentContractController)
);

router.post(
  '/:contractId/claim',
  authenticateToken,
  paymentContractController.claimPayment.bind(paymentContractController)
);

router.get(
  '/:contractId/milestones',
  authenticateToken,
  paymentContractController.getMilestones.bind(paymentContractController)
);

router.post(
  '/milestones/submit',
  authenticateToken,
  paymentContractController.submitMilestone.bind(paymentContractController)
);

router.get(
  '/:contractId/team',
  authenticateToken,
  paymentContractController.getTeamMembers.bind(paymentContractController)
);

router.get(
  '/:contractId/disputes',
  authenticateToken,
  paymentContractController.getDisputes.bind(paymentContractController)
);

router.get(
  '/tokens/supported',
  authenticateToken,
  paymentContractController.getSupportedTokens.bind(paymentContractController)
);

router.get(
  '/stats/overview',
  authenticateToken,
  paymentContractController.getContractStats.bind(paymentContractController)
);

export default router;
