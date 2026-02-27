import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export class WaitlistController {
  async join(req: Request, res: Response): Promise<void> {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : null;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ success: false, error: 'Valid email is required' });
        return;
      }

      const { error } = await supabase.from('waitlist').insert({ email, name });

      if (error) {
        if (error.code === '23505') {
          res.status(200).json({ success: true, message: 'You\'re already on the list.' });
          return;
        }
        logger.error('Waitlist insert failed', { error: error.message, email });
        res.status(500).json({ success: false, error: 'Could not join waitlist. Try again later.' });
        return;
      }

      logger.info('Waitlist signup', { email });
      res.status(200).json({ success: true, message: "You're on the list. We'll be in touch." });
    } catch (e) {
      logger.error('Waitlist join error', { error: (e as Error).message });
      res.status(500).json({ success: false, error: 'Something went wrong. Try again later.' });
    }
  }
}

export const waitlistController = new WaitlistController();
