/**
 * server/src/__tests__/children.test.ts
 *
 * Integration tests for POST /api/children (add child).
 *
 * Covers (per spec):
 *  1. Adding two children with blank usernames both succeed (no unique-constraint clash).
 *  2. Duplicate non-empty username returns 409.
 *  3. A parent cannot add a child to another parent (ownership isn't relevant here,
 *     but the JWT's parentId is used — a forged/different parent token gets their own
 *     child, not parent-A's family).
 *  4. Age coercion: string "8" is accepted.
 *  5. Empty-string username/password treated as null.
 *  6. Short password (< 4 chars) returns 422.
 *  7. Missing name returns 422.
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

const mockChild = vi.fn();
const mockUser  = vi.fn();

vi.mock('../lib/prisma', () => ({
  default: {
    child: {
      findUnique: (o: unknown) => mockChild('findUnique', o),
      findFirst:  (o: unknown) => mockChild('findFirst', o),
      findMany:   (o: unknown) => mockChild('findMany', o),
      create:     (o: unknown) => mockChild('create', o),
      update:     (o: unknown) => mockChild('update', o),
      delete:     (o: unknown) => mockChild('delete', o),
    },
    childGameProgress:  { deleteMany: () => Promise.resolve({ count: 0 }) },
    gameSession:        { deleteMany: () => Promise.resolve({ count: 0 }) },
    aiReport:           { deleteMany: () => Promise.resolve({ count: 0 }) },
    unlock:             { deleteMany: () => Promise.resolve({ count: 0 }) },
    childCredential:    { deleteMany: () => Promise.resolve({ count: 0 }), count: () => Promise.resolve(0) },
    user:               { findUnique: (o: unknown) => mockUser('findUnique', o) },
    $transaction:       (ops: unknown[]) => Promise.all(ops),
  },
}));

// seedDemoChild is not needed for these tests
vi.mock('../lib/seedDemoChild', () => ({
  seedDemoChild: vi.fn().mockResolvedValue({ childId: 'demo-id', alreadyExisted: false }),
}));

import childrenRouter from '../routes/children';

const app = express();
app.use(express.json());
app.use('/api/children', childrenRouter);

// ── Helpers ───────────────────────────────────────────────────────────────────

const JWT_SECRET = 'test-secret-for-unit-tests-only';
const PARENT_A   = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PARENT_B   = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CHILD_ID_1 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const CHILD_ID_2 = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

function makeParentToken(parentId = PARENT_A) {
  return jwt.sign({ role: 'parent', parentId }, JWT_SECRET, { expiresIn: '1h' });
}

const TOKEN_A = makeParentToken(PARENT_A);
const TOKEN_B = makeParentToken(PARENT_B);

/** Minimal valid payload the form sends when all optional fields are blank */
function minimalPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Alice',
    age: 7,
    preferred_language: 'en',
    username: null,
    password: null,
    preferred_font: 'opendyslexic',
    ...overrides,
  };
}

/** A created-child response shape */
function createdChild(childId: string, parentId: string, name = 'Alice') {
  return {
    id: childId, name, age: 7, preferred_language: 'en',
    preferred_font: 'opendyslexic', username: null,
    total_points: 0, points_balance: 0, is_demo: false,
    created_at: new Date().toISOString(), parent_id: parentId,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/children — add child', () => {
  beforeEach(() => vi.resetAllMocks());

  // ── 1. Two children with blank usernames both succeed ─────────────────────

  it('blank username: first child created (201)', async () => {
    // username uniqueness check: findUnique → not found (null username skips the check)
    mockChild.mockResolvedValueOnce(createdChild(CHILD_ID_1, PARENT_A));

    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${TOKEN_A}`)
      .send(minimalPayload({ username: null }));

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(CHILD_ID_1);
  });

  it('blank username: second child with same parent also succeeds (201)', async () => {
    // No uniqueness check for null username — goes straight to create
    mockChild.mockResolvedValueOnce(createdChild(CHILD_ID_2, PARENT_A, 'Bob'));

    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${TOKEN_A}`)
      .send(minimalPayload({ name: 'Bob', username: null }));

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Bob');
    // Confirm create was called exactly once (no spurious findUnique for null username)
    const createCalls = mockChild.mock.calls.filter(([op]) => op === 'create');
    expect(createCalls).toHaveLength(1);
  });

  it('empty-string username is treated as null — succeeds (201)', async () => {
    mockChild.mockResolvedValueOnce(createdChild(CHILD_ID_1, PARENT_A));

    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${TOKEN_A}`)
      .send(minimalPayload({ username: '' }));

    expect(res.status).toBe(201);
    // No findUnique call (null username skips check)
    const findCalls = mockChild.mock.calls.filter(([op]) => op === 'findUnique');
    expect(findCalls).toHaveLength(0);
  });

  // ── 2. Duplicate non-empty username returns 409 ───────────────────────────

  it('duplicate username returns 409', async () => {
    // findUnique for username → found (already exists)
    mockChild.mockResolvedValueOnce({ id: 'existing-child-id' });

    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${TOKEN_A}`)
      .send(minimalPayload({ username: 'alice' }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USERNAME_TAKEN');
  });

  it('unique username succeeds (201)', async () => {
    // findUnique → not found
    mockChild.mockResolvedValueOnce(null);
    // create → child
    mockChild.mockResolvedValueOnce(createdChild(CHILD_ID_1, PARENT_A));

    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${TOKEN_A}`)
      .send(minimalPayload({ username: 'unique_alice' }));

    expect(res.status).toBe(201);
  });

  // ── 3. A different parent's token creates a child for that parent ─────────

  it("parent-B's token creates a child under parent-B (not parent-A)", async () => {
    mockChild.mockResolvedValueOnce(createdChild(CHILD_ID_2, PARENT_B, 'Charlie'));

    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${TOKEN_B}`)
      .send(minimalPayload({ name: 'Charlie' }));

    expect(res.status).toBe(201);
    // The create call should carry parent_B's parentId
    const createCall = mockChild.mock.calls.find(([op]) => op === 'create');
    expect(createCall).toBeTruthy();
    const createData = (createCall![1] as { data?: { parent_id?: string } }).data;
    expect(createData?.parent_id).toBe(PARENT_B);
  });

  it('no token returns 401', async () => {
    const res = await request(app)
      .post('/api/children')
      .send(minimalPayload());
    expect(res.status).toBe(401);
  });

  // ── 4. Age coercion — string "8" accepted ────────────────────────────────

  it('age as string "8" is coerced and accepted (201)', async () => {
    mockChild.mockResolvedValueOnce(createdChild(CHILD_ID_1, PARENT_A));

    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${TOKEN_A}`)
      .send(minimalPayload({ age: '8' }));

    expect(res.status).toBe(201);
  });

  it('age 0 returns 422', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${TOKEN_A}`)
      .send(minimalPayload({ age: 0 }));
    expect(res.status).toBe(422);
    expect(res.body.error.fieldErrors?.age).toBeTruthy();
  });

  it('age 19 returns 422', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${TOKEN_A}`)
      .send(minimalPayload({ age: 19 }));
    expect(res.status).toBe(422);
    expect(res.body.error.fieldErrors?.age).toBeTruthy();
  });

  // ── 5. Empty-string password treated as null (no hash) ───────────────────

  it('empty string password is treated as null — no password_hash set', async () => {
    let capturedData: Record<string, unknown> | null = null;
    mockChild.mockImplementationOnce((_op: string, args: { data?: Record<string, unknown> }) => {
      capturedData = args.data ?? null;
      return Promise.resolve(createdChild(CHILD_ID_1, PARENT_A));
    });

    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${TOKEN_A}`)
      .send(minimalPayload({ password: '' }));

    expect(res.status).toBe(201);
    expect(capturedData?.password_hash).toBeUndefined();
  });

  // ── 6. Short password returns 422 ────────────────────────────────────────

  it('password shorter than 4 chars returns 422', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${TOKEN_A}`)
      .send(minimalPayload({ password: 'ab' }));
    expect(res.status).toBe(422);
    expect(res.body.error.fieldErrors?.password).toBeTruthy();
  });

  // ── 7. Missing name returns 422 ───────────────────────────────────────────

  it('missing name returns 422', async () => {
    const res = await request(app)
      .post('/api/children')
      .set('Authorization', `Bearer ${TOKEN_A}`)
      .send(minimalPayload({ name: '' }));
    expect(res.status).toBe(422);
    expect(res.body.error.fieldErrors?.name).toBeTruthy();
  });
});
