import type { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny } from 'zod';
import { ValidationError } from '../lib/httpErrors.js';

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ValidationError('invalid body', result.error.flatten()));
      return;
    }
    req.body = result.data; // use coerced/parsed value
    next();
  };
}

export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new ValidationError('invalid query', result.error.flatten()));
      return;
    }
    // req.query is a getter in Express 4 — mutate in place instead of reassigning
    Object.assign(req.query, result.data);
    next();
  };
}
