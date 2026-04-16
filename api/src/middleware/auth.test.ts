import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { User } from '@supabase/supabase-js';

const getUser = vi.fn();

vi.mock('../lib/supabase.js', () => ({
  supabase: { auth: { getUser: (...args: unknown[]) => getUser(...args) } },
}));

const { authMiddleware } = await import('./auth.js');

type AuthResult = Awaited<ReturnType<typeof import('@supabase/supabase-js').SupabaseClient.prototype.auth.getUser>>;

function makeReq(headers: Record<string, string> = {}): Request {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return {
    header(name: string) {
      return lower[name.toLowerCase()];
    },
  } as unknown as Request;
}

function makeRes() {
  const json = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json, _status: status, _json: json } as unknown as Response & {
    _status: typeof status;
    _json: typeof json;
  };
}

const fakeUser: User = { id: 'u1', email: 'a@b.c' } as unknown as User;

describe('authMiddleware', () => {
  beforeEach(() => {
    getUser.mockReset();
  });

  it('401s when Authorization header is missing', async () => {
    const req = makeReq();
    const res = makeRes() as Response & {
      _status: ReturnType<typeof vi.fn>;
      _json: ReturnType<typeof vi.fn>;
    };
    const next = vi.fn() as NextFunction;
    await authMiddleware(req, res, next);
    expect(res._status).toHaveBeenCalledWith(401);
    expect(res._json).toHaveBeenCalledWith({ error: 'unauthenticated' });
    expect(next).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('401s when Authorization is malformed (no token)', async () => {
    const req = makeReq({ Authorization: 'Bearer ' });
    const res = makeRes() as Response & { _status: ReturnType<typeof vi.fn> };
    const next = vi.fn() as NextFunction;
    await authMiddleware(req, res, next);
    expect(res._status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401s when Supabase returns an error', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'bad' } } satisfies Partial<AuthResult>);
    const req = makeReq({ Authorization: 'Bearer token' });
    const res = makeRes() as Response & { _status: ReturnType<typeof vi.fn> };
    const next = vi.fn() as NextFunction;
    await authMiddleware(req, res, next);
    expect(res._status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401s when Supabase returns no user', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const req = makeReq({ Authorization: 'Bearer token' });
    const res = makeRes() as Response & { _status: ReturnType<typeof vi.fn> };
    const next = vi.fn() as NextFunction;
    await authMiddleware(req, res, next);
    expect(res._status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches req.user and calls next() on valid token', async () => {
    getUser.mockResolvedValueOnce({ data: { user: fakeUser }, error: null });
    const req = makeReq({ Authorization: 'Bearer token' });
    const res = makeRes() as Response;
    const next = vi.fn() as NextFunction;
    await authMiddleware(req, res, next);
    expect(req.user).toBe(fakeUser);
    expect(next).toHaveBeenCalledOnce();
    expect(getUser).toHaveBeenCalledWith('token');
  });
});
