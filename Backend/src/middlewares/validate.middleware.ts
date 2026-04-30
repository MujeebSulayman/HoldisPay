import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { logger } from '../utils/logger';

export const validate = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Request validation failed', { 
          path: req.path, 
          errors: error.errors 
        });
        return res.status(400).json({
          error: 'Validation failed',
          message: error.errors[0].message,
          details: error.errors,
        });
      }
      return res.status(500).json({ error: 'Internal server error during validation' });
    }
  };
};
