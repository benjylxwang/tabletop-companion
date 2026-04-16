import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { viewModeMiddleware } from './viewMode.js';

function runMiddleware(query: Record<string, unknown>): Request {
  const req = { query } as unknown as Request;
  const res = {} as Response;
  const next = vi.fn() as unknown as NextFunction;
  viewModeMiddleware(req, res, next);
  expect(next).toHaveBeenCalledOnce();
  return req;
}

describe('viewModeMiddleware', () => {
  it('sets requestedView to "player" when ?view=player', () => {
    expect(runMiddleware({ view: 'player' }).requestedView).toBe('player');
  });

  it('sets requestedView to "dm" when ?view=dm', () => {
    expect(runMiddleware({ view: 'dm' }).requestedView).toBe('dm');
  });

  it('defaults to "dm" when no view query is present', () => {
    expect(runMiddleware({}).requestedView).toBe('dm');
  });

  it('defaults to "dm" for unrecognized values', () => {
    expect(runMiddleware({ view: 'garbage' }).requestedView).toBe('dm');
  });

  it('is case-sensitive — "PLAYER" defaults to "dm"', () => {
    expect(runMiddleware({ view: 'PLAYER' }).requestedView).toBe('dm');
  });
});
