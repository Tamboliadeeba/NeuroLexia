/**
 * server/src/__tests__/progress.test.ts
 *
 * Tests for:
 *  - POST /api/children/demo  (create demo child, idempotent, production-blocked)
 *  - GET  /api/children/:id/sessions?period=week|month
 *      - ownership check (403/404 for wrong parent)
 *      - empty result (no sessions)
 *      - self-reported exclusion from accuracy
 *      - ETag / 304 behaviour
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import express from 'express';

// ── Env before imports ────────────────────────────────────────────────────────
process.env.JWT_SECRET      = 'test-secret-for-unit-tests-only';
process.env.WEBAUTHN_RP_ID  = 'localhost';
process.env.WEBAUTHN_ORIGIN = 'http://localhost:5173';
process.env.APP_ENV         = 'test';

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockChild          = vi.fn();
const mockUser           = vi.fn();
const mockGameSession    = vi.fn();
const mockChildProgress  = vi.fn();
const mockUnlock         = vi.fn();
const mockCharacter      = vi.fn();
const mockTransaction    = vi.fn();

vi.mock('../lib/prisma', () => ({
  default: {
    child: {
      findFirst:  (o: unknown) => mockChild('findFirst', o),
      findMany:   (o: unknown) => mockChild('findMany', o),
      findUnique: (o: unknown) => mockChild('findUnique', o),
      create:     (o: unknown) => mockChild('create', o),
      update:     (o: unknown) => mockChild('update', o),
      delete:     (o: unknown) => mockChild('delete', o),
    },
    user: {
      findUnique: (o: unknown) => mockUser('findUnique', o),
    },
    gameSession: {
      findMany:   (o: unknown) => mockGameSession('findMany', o),
    },
    childGameProgress: {
      findMany:   (o: unknown) => mockChildProgress('findMany', o),
    },
    unlock:     { create: (o: unknown) => mockUnlock('create', o) },
    character:  { findUnique: (o: unknown) => mockCharacter('findUnique', o) },
    $transaction: (fn: unknown) => {
      // For seedDemoChild the transaction receives a callback (async fn)
      if (typeof fn === 'function') {
        const txClient = {
          child:             { create: (o: unknown) => mockChild('create', o) },
          gameSession:       { create: (o: unknown) => mockGameSession('create', o) },
          childGameProgress: {
            upsert:  (o: unknown) => mockChildProgress('upsert', o),
            findMany:(o: unknown) => mockChildProgress('findMany', o),
          },
          unlock: { create: (o: unknown) => mockUnlock('create', o) },
        };
        return mockTransaction('$transaction-fn', fn(txClient));
      }
      // Array-of-operations form (legacy)
      return mockTransaction('$transaction-arr', fn);
    },
  },
}));

import childrenRouter from '../routes/children';

const app = express();
app.use(express.json());
app.use('/api/children', childrenRouter);

function makeParentToken(parentId: string) {
  return jwt.sign(
    { role: 'parent', parentId },
    process.env.JWT_SECRET!,
    { expiresIn: '2h' },
  );
}

// ── POST /api/children/demo ───────────────────────────────────────────────────

describe('POST /api/children/demo', () => {
  const PARENT_ID = 'parent-001';
  const CHILD_ID  = 'child-demo-001';
  const token     = makeParentToken(PARENT_ID);

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing demo child
    mockChild.mockImplementation((op: string) => {
      if (op === 'findFirst') return null;
      if (op === 'create')    return { id: CHILD_ID };
      if (op === 'findUnique') return {
        id: CHILD_ID, name: 'Demo Child', age: 7,
        preferred_language: 'en', preferred_font: 'opendyslexic',
        username: null, total_points: 400, points_balance: 250,
        is_demo: true, created_at: new Date().toISOString(),
      };
      return null;
    });
    mockUser.mockImplementation((op: string) => {
      if (op === 'findUnique') return { preferred_language: 'en' };
      return null;
    });
    mockCharacter.mockImplementation((op: string) => {
      if (op === 'findUnique') return { id: 'char-astro' };
      return null;
    });
    mockGameSession.mockResolvedValue({ id: 'gs-1' });
    mockChildProgress.mockResolvedValue({});
    mockUnlock.mockResolvedValue({});
    mockTransaction.mockImplementation((_op: string, promise: unknown) => promise);
  });

  it('201 — creates a new demo child and returns child record', async () => {
    const res = await request(app)
      .post('/api/children/demo')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: CHILD_ID, is_demo: true });
  });

  it('200 — returns existing demo child (idempotent)', async () => {
    // Simulate existing demo child found
    mockChild.mockImplementation((op: string) => {
      if (op === 'findFirst') return { id: CHILD_ID };
      if (op === 'findUnique') return {
        id: CHILD_ID, name: 'Demo Child', age: 7,
        preferred_language: 'en', preferred_font: 'opendyslexic',
        username: null, total_points: 400, points_balance: 250,
        is_demo: true, created_at: new Date().toISOString(),
      };
      return null;
    });

    const res = await request(app)
      .post('/api/children/demo')
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: CHILD_ID });
  });

  it('403 — blocked in production', async () => {
    const saved = process.env.APP_ENV;
    process.env.APP_ENV = 'production';
    const res = await request(app)
      .post('/api/children/demo')
      .set('Authorization', `Bearer ${token}`)
      .send();
    process.env.APP_ENV = saved;

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('DEMO_DISABLED');
  });

  it('401 — requires auth token', async () => {
    const res = await request(app).post('/api/children/demo').send();
    expect(res.status).toBe(401);
  });
});

// ── GET /api/children/:id/sessions ───────────────────────────────────────────

describe('GET /api/children/:id/sessions', () => {
  const PARENT_A = 'parent-a';
  const PARENT_B = 'parent-b';
  const CHILD_ID = 'child-xyz';
  const tokenA   = makeParentToken(PARENT_A);
  const tokenB   = makeParentToken(PARENT_B);

  const FIXED_DATE = new Date('2024-06-15T12:00:00Z');

  function makeSessions(overrides: Partial<{
    accuracy: number | null;
    self_reported_count: number;
  }>[] = []) {
    return overrides.map((o, i) => ({
      id: `gs-${i}`,
      game_type: 'trip_to_space',
      ended_at: new Date(FIXED_DATE.getTime() + i * 3600_000),
      level: 2,
      score: 80,
      points_earned: 25,
      accuracy: o.accuracy ?? 0.85,
      attempts: 20,
      errors: { c_k_swap: 2 },
      self_reported_count: o.self_reported_count ?? 0,
      metadata: { total_moves: 20, wrong_moves: 3, completion_time_ms: 90000, tutorial_replays: 0, hints_used: 1 },
    }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: PARENT_A owns CHILD_ID
    mockChild.mockImplementation((op: string, args: { where?: { id?: string; parent_id?: string } }) => {
      if (op === 'findFirst') {
        const w = args.where;
        if (w?.id === CHILD_ID && w?.parent_id === PARENT_A) return { id: CHILD_ID };
        return null;
      }
      return null;
    });
    mockChildProgress.mockImplementation(() => [
      { game_type: 'trip_to_space', current_level: 4 },
    ]);
  });

  it('200 — returns aggregates for week period', async () => {
    mockGameSession.mockImplementation(() => makeSessions([
      { accuracy: 0.9, self_reported_count: 0 },
      { accuracy: 0.8, self_reported_count: 0 },
      { accuracy: 0.7, self_reported_count: 0 },
    ]));

    const res = await request(app)
      .get(`/api/children/${CHILD_ID}/sessions?period=week`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.total_sessions).toBe(3);
    // avg_accuracy of [0.9, 0.8, 0.7] = 0.8
    expect(res.body.summary.avg_accuracy).toBeCloseTo(0.8, 5);
    expect(res.body.period).toBe('week');
    expect(res.body.current_levels).toMatchObject({ trip_to_space: 4 });
  });

  it('self-reported sessions excluded from avg_accuracy', async () => {
    mockGameSession.mockImplementation(() => makeSessions([
      { accuracy: 0.9,  self_reported_count: 0 },   // verified
      { accuracy: null, self_reported_count: 3 },    // self-reported — must be excluded
      { accuracy: 0.7,  self_reported_count: 0 },    // verified
    ]));

    const res = await request(app)
      .get(`/api/children/${CHILD_ID}/sessions`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    // Only 0.9 + 0.7 counted → avg = 0.8
    expect(res.body.summary.avg_accuracy).toBeCloseTo(0.8, 5);
    // by_game avg_accuracy also excludes self-reported
    expect(res.body.by_game.trip_to_space.avg_accuracy).toBeCloseTo(0.8, 5);
    // self_reported_count in by_game = 3
    expect(res.body.by_game.trip_to_space.self_reported_count).toBe(3);
  });

  it('returns null avg_accuracy when all sessions are self-reported', async () => {
    mockGameSession.mockImplementation(() => makeSessions([
      { accuracy: null, self_reported_count: 2 },
      { accuracy: null, self_reported_count: 1 },
    ]));

    const res = await request(app)
      .get(`/api/children/${CHILD_ID}/sessions`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.avg_accuracy).toBeNull();
    expect(res.body.by_game.trip_to_space.avg_accuracy).toBeNull();
  });

  it('returns empty state without errors when child has no sessions', async () => {
    mockGameSession.mockImplementation(() => []);

    const res = await request(app)
      .get(`/api/children/${CHILD_ID}/sessions`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.total_sessions).toBe(0);
    expect(res.body.summary.avg_accuracy).toBeNull();
    expect(res.body.lastUpdated).toBeNull();
  });

  it('304 — returns Not Modified when ETag matches', async () => {
    const sessions = makeSessions([{ accuracy: 0.85, self_reported_count: 0 }]);
    mockGameSession.mockImplementation(() => sessions);

    // First request — get ETag
    const first = await request(app)
      .get(`/api/children/${CHILD_ID}/sessions`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(first.status).toBe(200);
    const etag = first.headers.etag as string;
    expect(etag).toBeTruthy();

    // Second request with same ETag
    const second = await request(app)
      .get(`/api/children/${CHILD_ID}/sessions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('If-None-Match', etag);
    expect(second.status).toBe(304);
  });

  it('404 — parent B cannot access parent A\'s child', async () => {
    const res = await request(app)
      .get(`/api/children/${CHILD_ID}/sessions`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it('401 — no token', async () => {
    const res = await request(app)
      .get(`/api/children/${CHILD_ID}/sessions`);
    expect(res.status).toBe(401);
  });

  it('supports month period', async () => {
    mockGameSession.mockImplementation(() => makeSessions([
      { accuracy: 0.75, self_reported_count: 0 },
    ]));

    const res = await request(app)
      .get(`/api/children/${CHILD_ID}/sessions?period=month`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.period).toBe('month');
  });
});
