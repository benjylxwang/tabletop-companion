import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Response } from 'express';
import { z } from 'zod';
import {
  HttpError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
  sendError,
} from './httpErrors.js';

function makeRes() {
  const json = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json, _status: status, _json: json } as unknown as Response & {
    _status: ReturnType<typeof vi.fn>;
    _json: ReturnType<typeof vi.fn>;
  };
}

describe('sendError', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('maps NotFoundError to 404 with code NOT_FOUND', () => {
    const res = makeRes();
    sendError(res, new NotFoundError());
    expect(res._status).toHaveBeenCalledWith(404);
    expect(res._json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'not found' },
    });
  });

  it('maps NotFoundError with custom message', () => {
    const res = makeRes();
    sendError(res, new NotFoundError('campaign missing'));
    expect(res._status).toHaveBeenCalledWith(404);
    expect(res._json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'campaign missing' },
    });
  });

  it('maps ValidationError with details to 400 including details', () => {
    const res = makeRes();
    const details = { formErrors: [], fieldErrors: { name: ['required'] } };
    sendError(res, new ValidationError('invalid body', details));
    expect(res._status).toHaveBeenCalledWith(400);
    expect(res._json).toHaveBeenCalledWith({
      error: { code: 'VALIDATION_ERROR', message: 'invalid body', details },
    });
  });

  it('omits details when ValidationError has none', () => {
    const res = makeRes();
    sendError(res, new ValidationError());
    expect(res._status).toHaveBeenCalledWith(400);
    expect(res._json).toHaveBeenCalledWith({
      error: { code: 'VALIDATION_ERROR', message: 'invalid request' },
    });
  });

  it('maps ForbiddenError to 403 with code FORBIDDEN', () => {
    const res = makeRes();
    sendError(res, new ForbiddenError());
    expect(res._status).toHaveBeenCalledWith(403);
    expect(res._json).toHaveBeenCalledWith({
      error: { code: 'FORBIDDEN', message: 'forbidden' },
    });
  });

  it('maps ZodError to 400 with flattened details', () => {
    const schema = z.object({ name: z.string() });
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    const res = makeRes();
    if (!result.success) sendError(res, result.error);
    expect(res._status).toHaveBeenCalledWith(400);
    const body = res._json.mock.calls[0]?.[0] as {
      error: { code: string; message: string; details: unknown };
    };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('invalid request');
    expect(body.error.details).toBeDefined();
  });

  it('maps unknown errors to 500 with code INTERNAL_ERROR and logs', () => {
    const res = makeRes();
    sendError(res, new Error('boom'));
    expect(res._status).toHaveBeenCalledWith(500);
    expect(res._json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'internal' },
    });
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('maps a raw HttpError to HTTP_ERROR code', () => {
    const res = makeRes();
    sendError(res, new HttpError(418, 'teapot'));
    expect(res._status).toHaveBeenCalledWith(418);
    expect(res._json).toHaveBeenCalledWith({
      error: { code: 'HTTP_ERROR', message: 'teapot' },
    });
  });

  it('maps a raw 5xx HttpError to INTERNAL_ERROR code', () => {
    const res = makeRes();
    sendError(res, new HttpError(503, 'service unavailable'));
    expect(res._status).toHaveBeenCalledWith(503);
    expect(res._json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'service unavailable' },
    });
  });
});
