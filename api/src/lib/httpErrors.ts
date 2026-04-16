import type { Response } from 'express';
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

type ErrorBody = { error: string; details?: unknown };

export function sendError(res: Response, err: unknown): void {
  if (err instanceof HttpError) {
    const body: ErrorBody = { error: err.message };
    if (err.details !== undefined) body.details = err.details;
    res.status(err.status).json(body);
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'invalid request', details: err.flatten() });
    return;
  }
  console.error('unhandled error in request handler:', err);
  res.status(500).json({ error: 'internal' });
}
