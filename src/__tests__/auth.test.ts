/**
 * server/src/__tests__/auth.test.ts
 *
 * Tests for register, login, ownership middleware, and the plaintext-to-hash rule.
 * Uses vitest + in-process supertest.  Does NOT need a real database.
 *
 * Run from the server/ directory:
 *   npx vitest run src/__tests__/auth.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import express from 'express';

// ── Environment vars must be set before importing routes ──────────────────────
process.env.JWT_SECRET      = 'test-secret-for-unit-tests-only';
process.env.WEBAUTHN_RP_ID  = 'localhost';
process.env.WEBAUTHN_ORIGIN = 'http://localhost:5173';
process.env.APP_ENV         = 'test';

// ── Prisma mock ───────────────────────────────────────────────────────────────

type MockCall = (method: string, ...args: unknown[]) => unknown;

const mockUserFn = vi.fn<MockCall>();
const mockChildFn = vi.fn<MockCall>();

vi.mock('../lib/prisma', () => ({
  default: {
    user: {
      findUnique: (opts: unknown) => mockUserFn('findUnique', opts),
      create:     (opts: unknown) => mockUserFn('create',     opts),
    },
    child: {
      findMany:  (opts: unknown) => mockChildFn('findMany',  opts),
      findFirst: (opts: unknown) => mockChildFn('findFirst', opts),
    },
  },
}));

// ── Import routes after mocks ─────────────────────────────────────────────────

import authRouter     from '../routes/auth';
import childrenRouter from '../routes/children';

const app = express();
app.use(express.json());
app.use('/api/auth',     authRouter);
app.use('/api/children', childrenRouter);

// ── Helper ────────────────────────────────────────────────────────────────────

function makeToken(parentId: string) {
  return jwt.sign(
    { role: 'parent', parentId },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' },
  );
}

// ── Register tests ────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('422 — missing required fields', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(422);
  });

  it('422 — consent:false is rejected', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test', email: 'a@b.com', password: 'password123', consent: false,
    });
    expect(res.status).toBe(422);
    // error is now a structured object { code, message, fieldErrors }
    expect(res.body.error.message).toMatch(/accept/i);
  });

  it('422 — password shorter than 8 chars', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test', email: 'a@b.com', password: 'short', consent: true,
    });
    expect(res.status).toBe(422);
  });

  it('409 — duplicate email', async () => {
    mockUserFn.mockResolvedValueOnce({ id: 'existing-id' }); // findUnique hit
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test', email: 'taken@example.com', password: 'password123', consent: true,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
    expect(res.body.error.message).toMatch(/already registered/i);
  });

  it('201 — creates user and returns valid parent JWT', async () => {
    mockUserFn.mockResolvedValueOnce(null);  // findUnique → not found
    mockUserFn.mockResolvedValueOnce({ id: 'new-id', name: 'Alice', email: 'alice@example.com' });
    const res = await request(app).post('/api/auth/register').send({
      name: 'Alice', email: 'alice@example.com', password: 'password123', consent: true,
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET!) as { role: string };
    expect(payload.role).toBe('parent');
  });

  it('HASH RULE — stored password is a bcrypt hash, never plaintext', async () => {
    mockUserFn.mockResolvedValueOnce(null); // findUnique
    let storedHash = '';
    mockUserFn.mockImplementationOnce(async (_method: string, opts: unknown) => {
      const data = (opts as { data: { password_hash: string } }).data;
      storedHash = data.password_hash;
      return { id: 'id', name: 'Bob', email: 'bob@example.com' };
    });
    await request(app).post('/api/auth/register').send({
      name: 'Bob', email: 'bob@example.com', password: 'plaintext123', consent: true,
    });
    expect(storedHash).toBeTruthy();
    expect(storedHash).not.toBe('plaintext123');
    const verified = await bcrypt.compare('plaintext123', storedHash);
    expect(verified).toBe(true);
  });
});

// ── Login tests ───────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 — unknown email, generic message (no email-existence leak)', async () => {
    mockUserFn.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com', password: 'anything',
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('WRONG_CREDENTIALS');
    expect(res.body.error.message).toMatch(/wrong email or password/i);
    // Must NOT say "email not found" or "user does not exist"
    expect(res.body.error.message).not.toMatch(/not found/i);
    expect(res.body.error.message).not.toMatch(/does not exist/i);
  });

  it('401 — wrong password, same generic message', async () => {
    const hash = await bcrypt.hash('correctpassword', 4);
    mockUserFn.mockResolvedValueOnce({ id: 'u1', name: 'Alice', password_hash: hash });
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com', password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('WRONG_CREDENTIALS');
    expect(res.body.error.message).toMatch(/wrong email or password/i);
  });

  it('200 — correct credentials return valid JWT', async () => {
    const hash = await bcrypt.hash('goodpassword', 4);
    mockUserFn.mockResolvedValueOnce({ id: 'u1', name: 'Alice', password_hash: hash });
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com', password: 'goodpassword',
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET!) as { role: string; parentId: string };
    expect(payload.role).toBe('parent');
    expect(payload.parentId).toBe('u1');
  });

  it('HASH RULE — response body never contains password_hash', async () => {
    const hash = await bcrypt.hash('secret', 4);
    mockUserFn.mockResolvedValueOnce({ id: 'u1', name: 'Alice', password_hash: hash });
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com', password: 'secret',
    });
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(hash);
    expect(body).not.toContain('password_hash');
  });
});

// ── Ownership tests ───────────────────────────────────────────────────────────

describe('GET /api/children — auth & ownership', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 — no token', async () => {
    const res = await request(app).get('/api/children');
    expect(res.status).toBe(401);
  });

  it('401 — invalid/tampered token', async () => {
    const res = await request(app)
      .get('/api/children')
      .set('Authorization', 'Bearer totally.not.valid');
    expect(res.status).toBe(401);
  });

  it('200 — returns children for authenticated parent', async () => {
    const tok = makeToken('parent-A');
    mockChildFn.mockResolvedValueOnce([
      { id: 'child-1', name: 'Child A', parent_id: 'parent-A' },
    ]);
    const res = await request(app)
      .get('/api/children')
      .set('Authorization', `Bearer ${tok}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('DELETE /api/children/:id — ownership enforcement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404 — parent-A cannot delete parent-B\'s child (ownership check)', async () => {
    const tok = makeToken('parent-A');
    // assertOwnership → findFirst returns null (child not owned by parent-A)
    mockChildFn.mockResolvedValueOnce(null);
    const res = await request(app)
      .delete('/api/children/child-owned-by-parent-B')
      .set('Authorization', `Bearer ${tok}`);
    // We use 404, not 403, to avoid leaking existence
    expect(res.status).toBe(404);
  });
});
