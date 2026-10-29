/**
 * server/src/__tests__/demo-login.test.ts
 *
 * Tests for:
 *   GET  /api/auth/demo-children
 *   POST /api/auth/child/demo-login
 *
 * Rules verified:
 *   - Works for is_demo=true children (non-production)
 *   - Rejected for is_demo=false children
 *   - Rejected in production (APP_ENV=production)
 *   - Returns a valid child JWT on success
 *   - JWT lasts 2 hours (exp - iat <= 7200)
 *
 * Run from server/:
 *   npx vitest run src/__tests__/demo-login.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import express from 'express';

// ── Environment vars (must be set before importing routes) ────────────────────
process.env.JWT_SECRET      = 'test-secret-for-unit-tests-only';
process.env.WEBAUTHN_RP_ID  = 'localhost';
process.env.WEBAUTHN_ORIGIN = 'http://localhost:5173';

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockChildFn = vi.fn();

vi.mock('../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    child: {
      findMany:  (opts: unknown) => mockChildFn('findMany',  opts),
      findUnique: (opts: unknown) => mockChildFn('findUnique', opts),
      findFirst:  (opts: unknown) => mockChildFn('findFirst',  opts),
    },
  },
}));

// ── Import route after mocks ──────────────────────────────────────────────────
import authRouter from '../routes/auth';

// ── App builder — lets us change APP_ENV per test group ───────────────────────
function buildApp(appEnv: string) {
  process.env.APP_ENV = appEnv;
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

// ── GET /api/auth/demo-children ───────────────────────────────────────────────

describe('GET /api/auth/demo-children', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => { process.env.APP_ENV = 'test'; });

  it('403 — blocked when APP_ENV=production', async () => {
    const app = buildApp('production');
    const res = await request(app).get('/api/auth/demo-children');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('DEMO_DISABLED');
  });

  it('200 — returns demo children list in development', async () => {
    mockChildFn.mockResolvedValueOnce([
      { id: 'demo-1', name: 'Aarav', preferred_language: 'en', character_id: null, character: null },
    ]);
    const app = buildApp('development');
    const res = await request(app).get('/api/auth/demo-children');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].name).toBe('Aarav');
  });

  it('200 — returns empty array when no demo children exist', async () => {
    mockChildFn.mockResolvedValueOnce([]);
    const app = buildApp('development');
    const res = await request(app).get('/api/auth/demo-children');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('200 — works in test environment (APP_ENV=test)', async () => {
    mockChildFn.mockResolvedValueOnce([{ id: 'demo-1', name: 'Test', preferred_language: 'en', character_id: null, character: null }]);
    const app = buildApp('test');
    const res = await request(app).get('/api/auth/demo-children');
    expect(res.status).toBe(200);
  });
});

// ── POST /api/auth/child/demo-login ──────────────────────────────────────────

describe('POST /api/auth/child/demo-login', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => { process.env.APP_ENV = 'test'; });

  it('403 — blocked when APP_ENV=production', async () => {
    const app = buildApp('production');
    const res = await request(app)
      .post('/api/auth/child/demo-login')
      .send({ childId: '00000000-0000-0000-0000-000000000001' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('DEMO_DISABLED');
  });

  it('422 — invalid childId (not a UUID)', async () => {
    const app = buildApp('development');
    const res = await request(app)
      .post('/api/auth/child/demo-login')
      .send({ childId: 'not-a-uuid' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 — missing childId', async () => {
    const app = buildApp('development');
    const res = await request(app)
      .post('/api/auth/child/demo-login')
      .send({});
    expect(res.status).toBe(422);
  });

  it('404 — child not found', async () => {
    mockChildFn.mockResolvedValueOnce(null);
    const app = buildApp('development');
    const res = await request(app)
      .post('/api/auth/child/demo-login')
      .send({ childId: '00000000-0000-0000-0000-000000000001' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('403 — child exists but is_demo=false (non-demo child cannot use demo endpoint)', async () => {
    mockChildFn.mockResolvedValueOnce({ id: '00000000-0000-0000-0000-000000000001', is_demo: false });
    const app = buildApp('development');
    const res = await request(app)
      .post('/api/auth/child/demo-login')
      .send({ childId: '00000000-0000-0000-0000-000000000001' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_DEMO');
  });

  it('200 — returns valid child JWT for is_demo=true child', async () => {
    const demoId = '00000000-0000-0000-0000-000000000002';
    mockChildFn.mockResolvedValueOnce({ id: demoId, is_demo: true });
    const app = buildApp('development');
    const res = await request(app)
      .post('/api/auth/child/demo-login')
      .send({ childId: demoId });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.childId).toBe(demoId);
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET!) as {
      role: string;
      childId: string;
      iat: number;
      exp: number;
    };
    expect(payload.role).toBe('child');
    expect(payload.childId).toBe(demoId);
  });

  it('JWT — child token lasts exactly 2 hours (exp - iat = 7200)', async () => {
    const demoId = '00000000-0000-0000-0000-000000000003';
    mockChildFn.mockResolvedValueOnce({ id: demoId, is_demo: true });
    const app = buildApp('development');
    const res = await request(app)
      .post('/api/auth/child/demo-login')
      .send({ childId: demoId });
    expect(res.status).toBe(200);
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET!) as {
      iat: number;
      exp: number;
    };
    const duration = payload.exp - payload.iat;
    expect(duration).toBe(7200); // exactly 2 hours
  });

  it('JWT — demo token has role=child (not pending_child)', async () => {
    const demoId = '00000000-0000-0000-0000-000000000004';
    mockChildFn.mockResolvedValueOnce({ id: demoId, is_demo: true });
    const app = buildApp('test');
    const res = await request(app)
      .post('/api/auth/child/demo-login')
      .send({ childId: demoId });
    expect(res.status).toBe(200);
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET!) as { role: string };
    expect(payload.role).toBe('child');
    expect(payload.role).not.toBe('pending_child');
  });

  it('SECURITY — response body never contains password_hash or is_demo=true details', async () => {
    const demoId = '00000000-0000-0000-0000-000000000005';
    mockChildFn.mockResolvedValueOnce({ id: demoId, is_demo: true });
    const app = buildApp('development');
    const res = await request(app)
      .post('/api/auth/child/demo-login')
      .send({ childId: demoId });
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('password_hash');
    expect(body).not.toContain('is_demo');
  });
});
