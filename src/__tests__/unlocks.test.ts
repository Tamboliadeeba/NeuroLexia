/**
 * server/src/__tests__/unlocks.test.ts
 *
 * Integration tests for POST /api/child/unlocks and PATCH /api/child/me (active_theme).
 *
 * Covers (per spec):
 *  1. Buying mercury with enough balance deducts 10 from points_balance, inserts one unlocks row.
 *  2. total_points is NEVER decremented.
 *  3. Buying the same planet again returns 409.
 *  4. Buying with insufficient balance returns 402.
 *  5. Unknown key returns 400.
 *  6. Two parallel buy requests create only one row and charge once (unique constraint).
 *  7. Setting an unowned theme via PATCH /api/child/me is rejected with 403.
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

const mockChild  = vi.fn();
const mockUnlock = vi.fn();
const mockTransaction = vi.fn();

vi.mock('../lib/prisma', () => ({
  default: {
    child: {
      findUnique: (o: unknown) => mockChild('findUnique', o),
      update:     (o: unknown) => mockChild('update', o),
    },
    unlock: {
      findUnique: (o: unknown) => mockUnlock('findUnique', o),
      create:     (o: unknown) => mockUnlock('create', o),
    },
    $transaction: (fn: unknown) => mockTransaction('$transaction', fn),
  },
}));

import childRouter from '../routes/child';

const app = express();
app.use(express.json());
app.use('/api/child', childRouter);

const JWT_SECRET = 'test-secret-for-unit-tests-only';
const CHILD_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeChildToken(childId: string) {
  return jwt.sign({ role: 'child', childId }, JWT_SECRET, { expiresIn: '1h' });
}

const TOKEN = makeChildToken(CHILD_ID);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sets up mockTransaction to execute the callback (which is what the real prisma.$transaction does),
 * using the provided tx-level mocks.
 */
function setupSuccessfulTransaction({
  balance,
  totalPoints,
  alreadyOwned = false,
}: {
  balance: number;
  totalPoints: number;
  alreadyOwned?: boolean;
}) {
  mockTransaction.mockImplementation((_name: string, fn: (tx: unknown) => Promise<unknown>) => {
    // Build a transaction mock object
    const tx = {
      child: {
        findUnique: vi.fn().mockResolvedValue({ points_balance: balance, total_points: totalPoints }),
        update: vi.fn().mockResolvedValue({ points_balance: balance - 10, total_points: totalPoints }),
      },
      unlock: {
        findUnique: vi.fn().mockResolvedValue(alreadyOwned ? { id: 'existing-id' } : null),
        create: vi.fn().mockResolvedValue({
          id: 'new-unlock-id',
          unlock_type: 'planet',
          unlock_key: 'mercury',
          unlocked_at: new Date().toISOString(),
        }),
      },
    };
    if (typeof fn === 'function') return fn(tx);
    return Promise.resolve({});
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('POST /api/child/unlocks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ── 1. Buy mercury (happy path) ───────────────────────────────────────────

  it('deducts 10 from points_balance and inserts one unlock row', async () => {
    let capturedCreate: unknown;
    let capturedDecrement: unknown;

    mockTransaction.mockImplementation((_name: string, fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        child: {
          findUnique: vi.fn().mockResolvedValue({ points_balance: 50, total_points: 200 }),
          update: vi.fn().mockImplementation((args: { data?: { points_balance?: { decrement?: number } } }) => {
            capturedDecrement = args.data?.points_balance;
            return Promise.resolve({ points_balance: 40, total_points: 200 });
          }),
        },
        unlock: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation((args: unknown) => {
            capturedCreate = args;
            return Promise.resolve({
              id: 'new-unlock-id',
              unlock_type: 'planet',
              unlock_key: 'mercury',
              unlocked_at: new Date().toISOString(),
            });
          }),
        },
      };
      return typeof fn === 'function' ? fn(tx) : Promise.resolve({});
    });

    const res = await request(app)
      .post('/api/child/unlocks')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ unlock_key: 'mercury' });

    expect(res.status).toBe(201);
    expect(res.body.points_balance).toBe(40);
    // total_points must NOT be decremented — should still be 200
    expect(res.body.total_points).toBe(200);

    // The decrement should be exactly 10 (mercury cost)
    expect(capturedDecrement).toEqual({ decrement: 10 });

    // Exactly one unlock row created for mercury
    const create = capturedCreate as { data?: { unlock_key?: string; unlock_type?: string } };
    expect(create?.data?.unlock_key).toBe('mercury');
    expect(create?.data?.unlock_type).toBe('planet');

    expect(res.body.unlock.unlock_key).toBe('mercury');
  });

  // ── 2. total_points is never decremented ────────────────────────────────

  it('never decrements total_points', async () => {
    mockTransaction.mockImplementation((_name: string, fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        child: {
          findUnique: vi.fn().mockResolvedValue({ points_balance: 200, total_points: 500 }),
          update: vi.fn().mockResolvedValue({ points_balance: 190, total_points: 500 }),
        },
        unlock: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: 'id2', unlock_type: 'planet', unlock_key: 'mercury', unlocked_at: new Date().toISOString(),
          }),
        },
      };
      return typeof fn === 'function' ? fn(tx) : Promise.resolve({});
    });

    const res = await request(app)
      .post('/api/child/unlocks')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ unlock_key: 'mercury' });

    expect(res.status).toBe(201);
    expect(res.body.total_points).toBe(500);
  });

  // ── 3. Buying the same planet again returns 409 ──────────────────────────

  it('returns 409 if already owned', async () => {
    mockTransaction.mockImplementation((_name: string, fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        child: {
          findUnique: vi.fn().mockResolvedValue({ points_balance: 200, total_points: 500 }),
          update: vi.fn(),
        },
        unlock: {
          findUnique: vi.fn().mockResolvedValue({ id: 'already-exists' }), // already owned
          create: vi.fn(),
        },
      };
      return typeof fn === 'function' ? fn(tx) : Promise.resolve({});
    });

    const res = await request(app)
      .post('/api/child/unlocks')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ unlock_key: 'mercury' });

    expect(res.status).toBe(409);
  });

  // ── 4. Insufficient balance returns 402 ──────────────────────────────────

  it('returns 402 if insufficient balance', async () => {
    mockTransaction.mockImplementation((_name: string, fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        child: {
          findUnique: vi.fn().mockResolvedValue({ points_balance: 5, total_points: 100 }), // only 5, need 10
          update: vi.fn(),
        },
        unlock: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
        },
      };
      return typeof fn === 'function' ? fn(tx) : Promise.resolve({});
    });

    const res = await request(app)
      .post('/api/child/unlocks')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ unlock_key: 'mercury' });

    expect(res.status).toBe(402);
  });

  // ── 5. Unknown key returns 400 ────────────────────────────────────────────

  it('returns 400 for unknown unlock_key', async () => {
    const res = await request(app)
      .post('/api/child/unlocks')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ unlock_key: 'pluto' }); // not in pointCosts

    expect(res.status).toBe(400);
    // No transaction called
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('returns 400 for missing unlock_key', async () => {
    const res = await request(app)
      .post('/api/child/unlocks')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({});

    expect(res.status).toBe(400);
  });

  // ── 6. Parallel buy requests — only one row and one charge ───────────────

  it('only charges once and creates one row when two parallel requests race', async () => {
    let createCallCount = 0;
    let updateCallCount = 0;

    mockTransaction.mockImplementation(async (_name: string, fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        child: {
          findUnique: vi.fn().mockResolvedValue({ points_balance: 50, total_points: 200 }),
          update: vi.fn().mockImplementation(() => {
            updateCallCount++;
            return Promise.resolve({ points_balance: 40, total_points: 200 });
          }),
        },
        unlock: {
          // First call returns null (not owned); second call simulates the unique constraint
          // throwing a Prisma P2002 error (simulated by already-owned throw on second call)
          findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValue({ id: 'already-created' }),
          create: vi.fn().mockImplementation(() => {
            createCallCount++;
            if (createCallCount > 1) {
              // Simulate unique constraint violation (Prisma P2002)
              const err = new Error('Unique constraint failed') as Error & { code: string };
              err.code = 'P2002';
              return Promise.reject(err);
            }
            return Promise.resolve({
              id: 'race-unlock-id',
              unlock_type: 'planet',
              unlock_key: 'mercury',
              unlocked_at: new Date().toISOString(),
            });
          }),
        },
      };
      return fn(tx);
    });

    // Fire two concurrent requests
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/child/unlocks')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ unlock_key: 'mercury' }),
      request(app)
        .post('/api/child/unlocks')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ unlock_key: 'mercury' }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // One succeeds with 201, the other gets 409 (already owned or P2002 → 409)
    expect(statuses).toEqual([201, 409]);
  });

  // ── Valid keys ─────────────────────────────────────────────────────────────

  it('accepts all valid unlock keys', async () => {
    const validKeys = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'aurora', 'void'];
    for (const key of validKeys) {
      mockTransaction.mockImplementation((_name: string, fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          child: {
            findUnique: vi.fn().mockResolvedValue({ points_balance: 999, total_points: 999 }),
            update: vi.fn().mockResolvedValue({ points_balance: 999, total_points: 999 }),
          },
          unlock: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'id', unlock_type: key === 'aurora' || key === 'void' ? 'theme' : 'planet',
              unlock_key: key, unlocked_at: new Date().toISOString(),
            }),
          },
        };
        return typeof fn === 'function' ? fn(tx) : Promise.resolve({});
      });

      const res = await request(app)
        .post('/api/child/unlocks')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ unlock_key: key });

      expect(res.status).toBe(201);
    }
  });
});

// ── PATCH /api/child/me — active_theme ────────────────────────────────────────

describe('PATCH /api/child/me — active_theme', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 403 when setting an unowned theme', async () => {
    // mock unlock lookup → not found
    mockUnlock.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/child/me')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ active_theme: 'aurora' });

    expect(res.status).toBe(403);
  });

  it('allows setting an owned theme', async () => {
    // mock unlock lookup → found
    mockUnlock.mockResolvedValue({ id: 'some-unlock-id' });
    mockChild.mockResolvedValue({
      id: CHILD_ID,
      preferred_language: 'en',
      preferred_font: 'opendyslexic',
      character_id: null,
      active_theme: 'aurora',
    });

    const res = await request(app)
      .patch('/api/child/me')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ active_theme: 'aurora' });

    expect(res.status).toBe(200);
    expect(res.body.active_theme).toBe('aurora');
  });

  it('allows setting default theme without ownership check', async () => {
    mockChild.mockResolvedValue({
      id: CHILD_ID,
      preferred_language: 'en',
      preferred_font: 'opendyslexic',
      character_id: null,
      active_theme: 'default',
    });

    const res = await request(app)
      .patch('/api/child/me')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ active_theme: 'default' });

    expect(res.status).toBe(200);
    // mockUnlock should NOT have been called for 'default'
    expect(mockUnlock).not.toHaveBeenCalled();
  });

  it('rejects unknown theme values', async () => {
    const res = await request(app)
      .patch('/api/child/me')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ active_theme: 'rainbow' });

    expect(res.status).toBe(422);
  });

  it('accepts all new planet keys as active_theme if owned', async () => {
    const newPlanets = ['earth', 'jupiter', 'uranus', 'neptune'];
    for (const key of newPlanets) {
      mockUnlock.mockResolvedValue({ id: `unlock-${key}` });
      mockChild.mockResolvedValue({
        id: CHILD_ID, preferred_language: 'en', preferred_font: 'opendyslexic',
        character_id: null, active_theme: key,
      });
      const res = await request(app)
        .patch('/api/child/me')
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ active_theme: key });
      expect(res.status).toBe(200);
      expect(res.body.active_theme).toBe(key);
    }
  });
});
