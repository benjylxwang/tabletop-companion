import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery } from './validate.js';
import { ValidationError } from '../lib/httpErrors.js';

function makeNext() {
  return vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
}

function makeReq(overrides: Partial<Request>): Request {
  return { body: {}, query: {}, ...overrides } as unknown as Request;
}

const res = {} as Response;

describe('validateBody', () => {
  const schema = z.object({ name: z.string(), count: z.coerce.number() });

  it('calls next() with no argument when schema passes', () => {
    const req = makeReq({ body: { name: 'hello', count: 3 } });
    const next = makeNext();
    validateBody(schema)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(ValidationError) when schema fails', () => {
    const req = makeReq({ body: { count: 1 } }); // missing name
    const next = makeNext();
    validateBody(schema)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    const arg = next.mock.calls[0]?.[0];
    expect(arg).toBeInstanceOf(ValidationError);
    expect((arg as ValidationError).message).toBe('invalid body');
    expect((arg as ValidationError).details).toBeDefined();
  });

  it('replaces req.body with the parsed (coerced) data', () => {
    const req = makeReq({ body: { name: 'test', count: '42' } }); // count as string — coerced
    const next = makeNext();
    validateBody(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith(); // success
    expect(req.body).toEqual({ name: 'test', count: 42 }); // coerced to number
  });

  it('strips extra fields not in schema', () => {
    const req = makeReq({ body: { name: 'test', count: 1, extra: 'ignored' } });
    const next = makeNext();
    validateBody(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).not.toHaveProperty('extra');
  });
});

describe('validateQuery', () => {
  const schema = z.object({ view: z.enum(['dm', 'player']).optional() });

  it('calls next() with no argument when schema passes', () => {
    const req = makeReq({ query: { view: 'player' } });
    const next = makeNext();
    validateQuery(schema)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(ValidationError) when schema fails', () => {
    const req = makeReq({ query: { view: 'invalid' } });
    const next = makeNext();
    validateQuery(schema)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    const arg = next.mock.calls[0]?.[0];
    expect(arg).toBeInstanceOf(ValidationError);
    expect((arg as ValidationError).message).toBe('invalid query');
    expect((arg as ValidationError).details).toBeDefined();
  });

  it('replaces req.query with the parsed data', () => {
    const req = makeReq({ query: { view: 'dm' } });
    const next = makeNext();
    validateQuery(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ view: 'dm' });
  });

  it('passes when optional fields are absent', () => {
    const req = makeReq({ query: {} });
    const next = makeNext();
    validateQuery(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });
});
