import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'not found') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends HttpError {
  constructor(message = 'invalid request', details?: unknown) {
    super(400, message, details);
    this.name = 'ValidationError';
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'forbidden') {
    super(403, message);
    this.name = 'ForbiddenError';
  }
}

type ErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'FORBIDDEN' | 'INTERNAL_ERROR' | 'HTTP_ERROR';

type ErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
};

function resolveCode(err: HttpError): ErrorCode {
  if (err instanceof ValidationError) return 'VALIDATION_ERROR';
  if (err instanceof NotFoundError) return 'NOT_FOUND';
  if (err instanceof ForbiddenError) return 'FORBIDDEN';
  if (err.status >= 500) return 'INTERNAL_ERROR';
  return 'HTTP_ERROR';
}

export function sendError(res: Response, err: unknown): void {
  if (err instanceof HttpError) {
    const body: ErrorBody = {
      error: {
        code: resolveCode(err),
        message: err.message,
      },
    };
    if (err.details !== undefined) body.error.details = err.details;
    res.status(err.status).json(body);
    return;
  }
  if (err instanceof ZodError) {
    const body: ErrorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'invalid request',
        details: err.flatten(),
      },
    };
    res.status(400).json(body);
    return;
  }
  console.error('unhandled error in request handler:', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'internal' } });
}

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  sendError(res, err);
}
