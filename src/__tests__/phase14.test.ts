/**
 * server/src/__tests__/phase14.test.ts
 *
 * Phase 14 — Integration tests: bypass login full flow.
 *
 * Per plan step 9 — covers (with mocked Prisma):
 *  (a) GET /api/auth/demo-children → returns is_demo children when bypass active
 *      POST /api/auth/child/demo-login → child JWT
 *  (b) POST /api/child/sessions — Trip to Space level created; total_points +
 *      points_balance both incremented; no unlocks row created
 *  (c) POST /api/child/unlocks { unlock_key: "mercury" } → balance deducted,
 *      unlocks row inserted
 *  (d) second purchase of same key → 409
 *  (e) purchase with insufficient balance → 402
 *  (f) Echo Galaxy "I said it!" → self_reported_count > 0, session accepted
 *  (g) (child_id, client_session_id) idempotency: submit same session twice →
 *      second returns 200 with cached result, no duplicate row
 *  (+) total_points invariant — never decremented by purchase
 *
 * ENV: DEV_BIOMETRIC_BYPASS=true, APP_ENV=test (which permits bypass),
 *      is_demo=true child.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import express from 'express';

// ── Env before any imports ─────────────────────────────────────────────────

process.env.JWT_SECRET           = 'test-phase14-secret-at-least-32-chars!!';
process.env.WEBAUTHN_RP_ID       = 'localhost';
process.env.WEBAUTHN_ORIGIN      = 'http://localhost:5173';
process.env.APP_ENV              = 'test';
process.env.DEV_BIOMETRIC_BYPASS = 'true';

// ── Prisma mock ────────────────────────────────────────────────────────────
// Each model method calls the vi.fn() so tests can mockImplementation on it.
// $transaction handles BOTH the callback form (unlocks) AND the array form (sessions).

const mockChild         = vi.fn();
const mockUser          = vi.fn();
const mockGameSession   = vi.fn();
const mockChildProgress = vi.fn();
const mockUnlock        = vi.fn();
const mockTransaction   = vi.fn();
const mockCharacter     = vi.fn();
const mockCredential    = vi.fn();

vi.mock('../lib/prisma', () => ({
  default: {
    child: {
      findUnique: (o: unknown) => mockChild('findUnique', o),
      findFirst:  (o: unknown) => mockChild('findFirst',  o),
      findMany:   (o: unknown) => mockChild('findMany',   o),
      create:     (o: unknown) => mockChild('create',     o),
      update:     (o: unknown) => mockChild('update',     o),
      delete:     (o: unknown) => mockChild('delete',     o),
    },
    user: {
      findUnique: (o: unknown) => mockUser('findUnique', o),
      findFirst:  (o: unknown) => mockUser('findFirst',  o),
      create:     (o: unknown) => mockUser('create',     o),
    },
    gameSession: {
      findUnique: (o: unknown) => mockGameSession('findUnique', o),
      create:     (o: unknown) => mockGameSession('create',     o),
    },
    childGameProgress: {
      findUnique: (o: unknown) => mockChildProgress('findUnique', o),
      upsert:     (o: unknown) => mockChildProgress('upsert',     o),
    },
    unlock: {
      findUnique: (o: unknown) => mockUnlock('findUnique', o),
      create:     (o: unknown) => mockUnlock('create',     o),
    },
    character: {
      findUnique: (o: unknown) => mockCharacter('findUnique', o),
      findFirst:  (o: unknown) => mockCharacter('findFirst',  o),
    },
    childCredential: {
      findMany: (o: unknown) => mockCredential('findMany', o),
    },
    // $transaction dispatches to mockTransaction(_type, payload)
    // Callback form (unlocks): prisma.$transaction(async tx => ...) → mockTransaction('cb', fn)
    // Array form   (sessions): prisma.$transaction([p1,p2,p3])       → mockTransaction('arr', arr)
    $transaction: (fnOrArr: unknown) => {
      if (typeof fnOrArr === 'function') {
        return mockTransaction('cb', fnOrArr);
      }
      return mockTransaction('arr', fnOrArr);
    },
  },
}));

// ── Build Express app with all routers ─────────────────────────────────────

import authRouter     from '../routes/auth';
import childRouter    from '../routes/child';

const app = express();
app.use(express.json());
app.use('/api/auth',  authRouter);
app.use('/api/child', childRouter);

// ── Shared test data ───────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET!;
const CHILD_ID   = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const SESS_ID_1  = '11111111-1111-1111-1111-111111111111';

function makeChildToken() {
  return jwt.sign({ role: 'child', childId: CHILD_ID }, JWT_SECRET, { expiresIn: '2h' });
}

const CHILD_TOKEN  = makeChildToken();

const NOW   = new Date().toISOString();
const LATER = new Date(Date.now() + 60_000).toISOString();

const DEMO_CHILD = {
  id: CHILD_ID,
  name: 'Aarav',
  age: 7,
  preferred_language: 'en',
  preferred_font: 'opendyslexic',
  is_demo: true,
  username: null,
  total_points: 0,
  points_balance: 0,
  character_id: null,
  active_theme: 'default',
  parent_id: 'p-parent-id',
  created_at: NOW,
  character: null,
  unlocks: [],
  game_progress: [],
};

// ── Helper: set up $transaction mock for the UNLOCK (callback) form ────────
// Mirrors the pattern in unlocks.test.ts: mockTransaction receives ('cb', fn)
// and calls fn(tx) where tx has the given child/unlock mock behaviour.

function setupUnlockTransaction(opts: {
  balance: number;
  totalPoints: number;
  alreadyOwned?: boolean;
  insufficientBalance?: boolean;
}) {
  const { balance, totalPoints, alreadyOwned = false } = opts;

  mockTransaction.mockImplementation((type: string, fn: unknown) => {
    if (type === 'cb' && typeof fn === 'function') {
      const tx = {
        child: {
          findUnique: vi.fn().mockResolvedValue({ points_balance: balance, total_points: totalPoints }),
          update: vi.fn().mockResolvedValue({ points_balance: balance - 10, total_points: totalPoints }),
        },
        unlock: {
          findUnique: vi.fn().mockResolvedValue(alreadyOwned ? { id: 'existing-row' } : null),
          create: vi.fn().mockResolvedValue({
            id: 'ul-1', unlock_type: 'planet', unlock_key: 'mercury', unlocked_at: NOW,
          }),
        },
      };
      return (fn as (tx: unknown) => unknown)(tx);
    }
    return Promise.resolve([]);
  });
}

// ── Helper: set up $transaction mock for the SESSION (array) form ──────────
// sessions route calls prisma.$transaction([op1, op2, op3]) — array form.
// mockTransaction receives ('arr', [Promise, Promise, Promise]).
// We resolve the array as [sessionResult, progressResult, childResult].

function setupSessionTransaction(opts: {
  pointsEarned?: number;
  totalPoints?: number;
  balance?: number;
} = {}) {
  const { pointsEarned = 30, totalPoints = 30, balance = 30 } = opts;

  // First make gameSession.findUnique return null (not a duplicate)
  mockGameSession.mockImplementation((op: string) => {
    if (op === 'findUnique') return null;
    if (op === 'create')     return { id: 'gs-new', points_earned: pointsEarned };
    return null;
  });
  mockChildProgress.mockImplementation((op: string) => {
    if (op === 'upsert') return { current_level: 2 };
    return null;
  });
  mockChild.mockImplementation((op: string) => {
    if (op === 'update') return { total_points: totalPoints, points_balance: balance };
    return DEMO_CHILD;
  });

  // The array form: mockTransaction('arr', [p1, p2, p3])
  // Just resolve all with Promise.all
  mockTransaction.mockImplementation((type: string, arr: unknown) => {
    if (type === 'arr') return Promise.all(arr as Promise<unknown>[]);
    return Promise.resolve(null);
  });
}

// ── (a) Demo login flow ─────────────────────────────────────────────────────

describe('(a) bypass login — demo child login flow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /api/auth/demo-children — returns is_demo children when bypass active', async () => {
    mockChild.mockImplementation((op: string) => {
      if (op === 'findMany') return [
        { id: CHILD_ID, name: 'Aarav', is_demo: true, character: { model_key: 'astro' } },
      ];
      return null;
    });

    const res = await request(app).get('/api/auth/demo-children');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].id).toBe(CHILD_ID);
  });

  it('POST /api/auth/child/demo-login — returns child JWT for is_demo child', async () => {
    mockChild.mockImplementation((op: string) => {
      if (op === 'findUnique') return DEMO_CHILD;
      return null;
    });

    const res = await request(app)
      .post('/api/auth/child/demo-login')
      .send({ childId: CHILD_ID });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    // Decode and verify role
    const decoded = jwt.verify(res.body.token, JWT_SECRET) as { role: string; childId: string };
    expect(decoded.role).toBe('child');
    expect(decoded.childId).toBe(CHILD_ID);
  });

  it('POST /api/auth/child/demo-login — 403 for non-demo child', async () => {
    mockChild.mockImplementation((op: string) => {
      if (op === 'findUnique') return { ...DEMO_CHILD, is_demo: false };
      return null;
    });

    const res = await request(app)
      .post('/api/auth/child/demo-login')
      .send({ childId: CHILD_ID });

    expect(res.status).toBe(403);
  });
});

// ── (b) Trip to Space session → points incremented, no unlocks ─────────────

describe('(b) POST /api/child/sessions — Trip to Space level', () => {
  beforeEach(() => vi.clearAllMocks());

  it('201 — creates session, returns incremented total_points and points_balance', async () => {
    setupSessionTransaction({ pointsEarned: 30, totalPoints: 30, balance: 30 });

    const res = await request(app)
      .post('/api/child/sessions')
      .set('Authorization', `Bearer ${CHILD_TOKEN}`)
      .send({
        client_session_id: SESS_ID_1,
        game_type: 'trip_to_space',
        started_at: NOW,
        ended_at: LATER,
        level: 1,
        score: 100,
        attempts: 10,
        errors: {},
        self_reported_count: 0,
        metadata: { total_moves: 10, wrong_moves: 0, completion_time_ms: 30000, tutorial_replays: 0 },
      });

    expect(res.status).toBe(201);
    expect(res.body.total_points).toBeGreaterThan(0);
    expect(res.body.points_balance).toBeGreaterThan(0);
    expect(res.body.points_earned).toBeGreaterThan(0);
  });

  it('session submission never calls unlock.create', async () => {
    setupSessionTransaction();

    await request(app)
      .post('/api/child/sessions')
      .set('Authorization', `Bearer ${CHILD_TOKEN}`)
      .send({
        client_session_id: SESS_ID_1,
        game_type: 'trip_to_space',
        started_at: NOW,
        ended_at: LATER,
        level: 1,
        score: 100,
        attempts: 10,
        errors: {},
        self_reported_count: 0,
        metadata: { total_moves: 10, wrong_moves: 0, completion_time_ms: 30000, tutorial_replays: 0 },
      });

    // unlock.create must NEVER have been called from a session submit
    const unlockCreateCalls = mockUnlock.mock.calls.filter(
      ([op]: [string]) => op === 'create',
    );
    expect(unlockCreateCalls).toHaveLength(0);
  });
});

// ── (c) POST /api/child/unlocks — mercury purchase ────────────────────────

describe('(c) POST /api/child/unlocks — mercury', () => {
  beforeEach(() => vi.clearAllMocks());

  it('201 — deducts 10 from points_balance, inserts unlock row, total_points unchanged', async () => {
    setupUnlockTransaction({ balance: 50, totalPoints: 50 });

    const res = await request(app)
      .post('/api/child/unlocks')
      .set('Authorization', `Bearer ${CHILD_TOKEN}`)
      .send({ unlock_key: 'mercury' });

    expect(res.status).toBe(201);
    expect(res.body.points_balance).toBe(40);          // 50 - 10
    expect(res.body.total_points).toBe(50);            // unchanged
    expect(res.body.unlock.unlock_key).toBe('mercury');
    expect(res.body.unlock.unlock_type).toBe('planet');
  });
});

// ── (d) 409 on second purchase ─────────────────────────────────────────────

describe('(d) POST /api/child/unlocks — duplicate → 409', () => {
  beforeEach(() => vi.clearAllMocks());

  it('409 if already owned', async () => {
    setupUnlockTransaction({ balance: 200, totalPoints: 200, alreadyOwned: true });

    const res = await request(app)
      .post('/api/child/unlocks')
      .set('Authorization', `Bearer ${CHILD_TOKEN}`)
      .send({ unlock_key: 'mercury' });

    expect(res.status).toBe(409);
  });
});

// ── (e) 402 with insufficient balance ─────────────────────────────────────

describe('(e) POST /api/child/unlocks — insufficient balance → 402', () => {
  beforeEach(() => vi.clearAllMocks());

  it('402 when balance < cost', async () => {
    // Mercury costs 10; balance = 5
    mockTransaction.mockImplementation((type: string, fn: unknown) => {
      if (type === 'cb' && typeof fn === 'function') {
        const tx = {
          child: {
            findUnique: vi.fn().mockResolvedValue({ points_balance: 5, total_points: 100 }),
            update: vi.fn(),
          },
          unlock: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
          },
        };
        return (fn as (tx: unknown) => unknown)(tx);
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .post('/api/child/unlocks')
      .set('Authorization', `Bearer ${CHILD_TOKEN}`)
      .send({ unlock_key: 'mercury' });

    expect(res.status).toBe(402);
  });
});

// ── (f) Echo Galaxy self-reported → self_reported_count > 0, session accepted

describe('(f) POST /api/child/sessions — Echo Galaxy "I said it!" logged', () => {
  beforeEach(() => vi.clearAllMocks());

  it('201 — session with self_reported_count > 0 accepted without error', async () => {
    setupSessionTransaction({ pointsEarned: 20, totalPoints: 20, balance: 20 });

    const res = await request(app)
      .post('/api/child/sessions')
      .set('Authorization', `Bearer ${CHILD_TOKEN}`)
      .send({
        client_session_id: '22222222-2222-2222-2222-222222222222',
        game_type: 'echo_galaxy',
        started_at: NOW,
        ended_at: LATER,
        level: 1,
        score: 3,
        attempts: 5,
        errors: { b_d_swap: 2 },
        self_reported_count: 3, // 3 "I said it!" taps
        metadata: { total_moves: 0, wrong_moves: 0, completion_time_ms: 45000, tutorial_replays: 0 },
      });

    expect(res.status).toBe(201);
    expect(res.body.points_earned).toBeGreaterThan(0);
  });

  it('Zod accepts self_reported_count = 5 (all self-reported) without error', async () => {
    setupSessionTransaction({ pointsEarned: 10, totalPoints: 10, balance: 10 });

    const res = await request(app)
      .post('/api/child/sessions')
      .set('Authorization', `Bearer ${CHILD_TOKEN}`)
      .send({
        client_session_id: '33333333-3333-3333-3333-333333333333',
        game_type: 'echo_galaxy',
        started_at: NOW,
        ended_at: LATER,
        level: 1,
        score: 0,
        attempts: 5,
        errors: {},
        self_reported_count: 5, // all self-reported
        metadata: { total_moves: 0, wrong_moves: 0, completion_time_ms: 60000, tutorial_replays: 0 },
      });

    expect(res.status).toBe(201);
  });
});

// ── (g) Idempotency: same client_session_id ────────────────────────────────

describe('(g) POST /api/child/sessions — idempotency via client_session_id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('second submission returns 200 with cached result, no re-insert', async () => {
    let findUniqueCalls = 0;

    mockGameSession.mockImplementation((op: string) => {
      if (op === 'findUnique') {
        findUniqueCalls++;
        if (findUniqueCalls === 1) return null; // first call: not found → will create
        // subsequent calls: return cached session
        return {
          id: 'gs-existing',
          points_earned: 30,
          child: { total_points: 30, points_balance: 30 },
        };
      }
      if (op === 'create') return { id: 'gs-new', points_earned: 30 };
      return null;
    });
    mockChildProgress.mockImplementation((op: string) => {
      if (op === 'upsert') return { current_level: 2 };
      if (op === 'findUnique') return { current_level: 2 };
      return { current_level: 2 };
    });
    mockChild.mockImplementation((op: string) => {
      if (op === 'update') return { total_points: 30, points_balance: 30 };
      return DEMO_CHILD;
    });
    mockTransaction.mockImplementation((type: string, arr: unknown) => {
      if (type === 'arr') return Promise.all(arr as Promise<unknown>[]);
      return Promise.resolve(null);
    });

    const body = {
      client_session_id: SESS_ID_1,
      game_type: 'trip_to_space',
      started_at: NOW,
      ended_at: LATER,
      level: 1,
      score: 100,
      attempts: 10,
      errors: {},
      self_reported_count: 0,
      metadata: { total_moves: 10, wrong_moves: 0, completion_time_ms: 30000, tutorial_replays: 0 },
    };

    // First submission
    const first = await request(app)
      .post('/api/child/sessions')
      .set('Authorization', `Bearer ${CHILD_TOKEN}`)
      .send(body);
    expect(first.status).toBe(201);

    // Second submission — same client_session_id
    const second = await request(app)
      .post('/api/child/sessions')
      .set('Authorization', `Bearer ${CHILD_TOKEN}`)
      .send(body);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(second.body.points_earned).toBe(30);
  });
});

// ── total_points invariant — never decremented by purchase ─────────────────

describe('total_points invariant — never decremented by unlock purchase', () => {
  beforeEach(() => vi.clearAllMocks());

  it('total_points returned after mercury purchase equals pre-purchase total', async () => {
    const TOTAL_BEFORE   = 500;
    const BALANCE_BEFORE = 100;

    mockTransaction.mockImplementation((type: string, fn: unknown) => {
      if (type === 'cb' && typeof fn === 'function') {
        const tx = {
          child: {
            findUnique: vi.fn().mockResolvedValue({
              points_balance: BALANCE_BEFORE,
              total_points: TOTAL_BEFORE,
            }),
            update: vi.fn().mockResolvedValue({
              points_balance: BALANCE_BEFORE - 10,
              total_points: TOTAL_BEFORE, // unchanged
            }),
          },
          unlock: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'ul-2', unlock_type: 'planet', unlock_key: 'mercury', unlocked_at: NOW,
            }),
          },
        };
        return (fn as (tx: unknown) => unknown)(tx);
      }
      return Promise.resolve([]);
    });

    const res = await request(app)
      .post('/api/child/unlocks')
      .set('Authorization', `Bearer ${CHILD_TOKEN}`)
      .send({ unlock_key: 'mercury' });

    expect(res.status).toBe(201);
    expect(res.body.total_points).toBe(TOTAL_BEFORE);            // unchanged
    expect(res.body.points_balance).toBe(BALANCE_BEFORE - 10);  // deducted
  });
});
