import { Router } from 'express';
import { waitlistController } from '../controllers/waitlist.controller';

const router = Router();

router.post('/', (req, res) => waitlistController.join(req, res));

export default router;
