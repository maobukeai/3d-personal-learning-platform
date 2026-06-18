import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/error';

export interface RequestValidationSchema {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
}

export const validateRequest = (schema: RequestValidationSchema) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = (await schema.query.parseAsync(req.query)) as any;
      }
      if (schema.params) {
        req.params = (await schema.params.parseAsync(req.params)) as any;
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.issues.map((err: z.ZodIssue) => ({
          path: err.path.join('.') || 'root',
          message: err.message,
          code: err.code,
        }));
        const errorMessages = details.map((err) => `${err.path}: ${err.message}`).join('; ');
        return next(new AppError(errorMessages, 400, 'VALIDATION_ERROR', details));
      }
      next(error);
    }
  };
};
