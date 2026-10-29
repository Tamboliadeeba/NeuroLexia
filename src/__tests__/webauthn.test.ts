/**
 * server/src/__tests__/webauthn.test.ts
 *
 * Integration tests for WebAuthn registration/authentication endpoints.
 *
 * Rules verified:
 *  1. A non-demo child cannot use the demo endpoint.
 *  2. A pending token cannot call /api/child/me (requireChild rejects it).
 *  3. A parent cannot register a credential for another parent's child (ownership check).
 *  4. An expired / missing challenge is rejected with 400.
 *  5. A counter that does not increase is rejected (replay attack detection).
 *  6. Authentication with unknown credential returns 404.
 *  7. Authenticated (verify) endpoint returns pending token when password_hash is set.
 *  8. Authenticated (verify) endpoint returns full JWT when no password_hash.
 *
 * WebAuthn @simplewebauthn/server verification functions are mocked because
 * real signatures cannot be generated without a real authenticator.
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

// ── Mock @simplewebauthn/server ───────────────────────────────────────────────

const mockGenerateRegistrationOptions   = vi.fn();
const mockVerifyRegistrationResponse    = vi.fn();
const mockGenerateAuthenticationOptions = vi.fn();
const mockVerifyAuthenticationResponse  = vi.fn();

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions:   (...args: unknown[]) => mockGenerateRegistrationOptions(...args),
  verifyRegistrationResponse:    (...args: unknown[]) => mockVerifyRegistrationResponse(...args),
  generateAuthenticationOptions: (...args: unknown[]) => mockGenerateAuthenticationOptions(...args),
  verifyAuthenticationResponse:  (...args: unknown[]) => mockVerifyAuthenticationResponse(...args),
}));

// ── Mock challenge helpers ────────────────────────────────────────────────────

const mockInsertChallenge = vi.fn();
const mockLookupChallenge = vi.fn();
const mockDeleteChallenge = vi.fn();

vi.mock('../lib/webauthnChallenges', () => ({
  insertChallenge: (...args: unknown[]) => mockInsertChallenge(...args),
  lookupChallenge: (...args: unknown[]) => mockLookupChallenge(...args),
  deleteChallenge: (...args: unknown[]) => mockDeleteChallenge(...args),
}));

// ── Mock Prisma ───────────────────────────────────────────────────────────────

const mockChildFn      = vi.fn();
const mockCredentialFn = vi.fn();
const mockUserFn       = vi.fn();

vi.mock('../lib/prisma', () => ({
  default: {
    user: {
      findUnique: (o: unknown) => mockUserFn('findUnique', o),
      create:     (o: unknown) => mockUserFn('create', o),
    },
    child: {
      findUnique: (o: unknown) => mockChildFn('findUnique', o),
      findFirst:  (o: unknown) => mockChildFn('findFirst', o),
      findMany:   (o: unknown) => mockChildFn('findMany', o),
    },
    childCredential: {
      findMany:   (o: unknown) => mockCredentialFn('findMany', o),
      findFirst:  (o: unknown) => mockCredentialFn('findFirst', o),
      upsert:     (o: unknown) => mockCredentialFn('upsert', o),
      update:     (o: unknown) => mockCredentialFn('update', o),
      count:      (o: unknown) => mockCredentialFn('count', o),
      deleteMany: (o: unknown) => mockCredentialFn('deleteMany', o),
    },
    webAuthnChallenge: {
      deleteMany: (_o: unknown) => Promise.resolve({ count: 0 }),
      create:     (_o: unknown) => Promise.resolve({}),
      findFirst:  (_o: unknown) => Promise.resolve(null),
    },
  },
}));

// ── Mock express-rate-limit to disable rate limiting in tests ─────────────────
// Without this, back-to-back requests hit 429 from the webauthnLimiter.

vi.mock('express-rate-limit', () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// ── Import routes AFTER mocks ─────────────────────────────────────────────────

import authRouter     from '../routes/auth';
import childRouter    from '../routes/child';
import childrenRouter from '../routes/children';

const app = express();
app.use(express.json());
app.use('/api/auth',     authRouter);
app.use('/api/child',    childRouter);
app.use('/api/children', childrenRouter);

// ── Constants ─────────────────────────────────────────────────────────────────

const JWT_SECRET    = 'test-secret-for-unit-tests-only';
const PARENT_ID     = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PARENT_B_ID   = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CHILD_ID      = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const CHILD_ID2     = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

function makeParentToken(parentId = PARENT_ID) {
  return jwt.sign({ role: 'parent', parentId }, JWT_SECRET, { expiresIn: '1h' });
}
function makeChildToken(childId = CHILD_ID) {
  return jwt.sign({ role: 'child', childId }, JWT_SECRET, { expiresIn: '2h' });
}
function makePendingToken(childId = CHILD_ID) {
  return jwt.sign({ role: 'pending_child', childId }, JWT_SECRET, { expiresIn: '5m' });
}

const PARENT_TOKEN   = makeParentToken(PARENT_ID);
const PARENT_B_TOKEN = makeParentToken(PARENT_B_ID);

// Minimal valid WebAuthn response shape that passes Zod (z.record)
const FAKE_RESPONSE = {
  id: 'ZmFrZWNyZWRpZA',
  rawId: 'ZmFrZWNyZWRpZA',
  type: 'public-key',
  response: {
    authenticatorData: 'AAAA',
    clientDataJSON:    'BBBB',
    signature:         'CCCC',
  },
};

// ── 1. requireChild rejects pending_child tokens ──────────────────────────────

describe('requireChild — rejects pending_child tokens', () => {
  beforeEach(() => vi.resetAllMocks());

  it('403 — pending token cannot call GET /api/child/me', async () => {
    const token = makePendingToken();
    const res = await request(app)
      .get('/api/child/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('200 — full child token is accepted on GET /api/child/me', async () => {
    const token = makeChildToken();
    mockChildFn.mockResolvedValueOnce({
      id: CHILD_ID, name: 'Test', preferred_language: 'en',
      preferred_font: 'opendyslexic', character_id: null,
      total_points: 0, points_balance: 0, active_theme: 'default',
      character: null, unlocks: [], game_progress: [],
    });
    const res = await request(app)
      .get('/api/child/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

// ── 2. Non-demo child cannot use demo endpoint ────────────────────────────────

describe('demo endpoint — is_demo enforcement', () => {
  beforeEach(() => vi.resetAllMocks());

  it('403 — non-demo child is rejected', async () => {
    // findUnique returns a non-demo child
    mockChildFn.mockResolvedValueOnce({ id: CHILD_ID, is_demo: false });
    const res = await request(app)
      .post('/api/auth/child/demo-login')
      .send({ childId: CHILD_ID });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_DEMO');
  });
});

// ── 3. Parent cannot register credential for another parent's child ───────────

describe('WebAuthn register — ownership enforcement', () => {
  beforeEach(() => vi.resetAllMocks());

  it('404 — parent-B cannot GET register options for parent-A child', async () => {
    // assertOwnership: findFirst returns null (child not owned by parent-B)
    mockChildFn.mockResolvedValueOnce(null);
    const res = await request(app)
      .get(`/api/auth/webauthn/register/options?childId=${CHILD_ID}`)
      .set('Authorization', `Bearer ${PARENT_B_TOKEN}`);
    expect(res.status).toBe(404);
  });

  it('404 — parent-B cannot POST register/verify for parent-A child', async () => {
    // assertOwnership: findFirst returns null
    mockChildFn.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/api/auth/webauthn/register/verify')
      .set('Authorization', `Bearer ${PARENT_B_TOKEN}`)
      .send({ childId: CHILD_ID, response: FAKE_RESPONSE });
    expect(res.status).toBe(404);
  });
});

// ── 4. Expired / missing challenge ────────────────────────────────────────────

describe('WebAuthn — expired challenge handling', () => {
  beforeEach(() => vi.resetAllMocks());

  it('400 CHALLENGE_EXPIRED — registration verify with no stored challenge', async () => {
    // ownership passes
    mockChildFn.mockResolvedValueOnce({ id: CHILD_ID, parent_id: PARENT_ID });
    // challenge is missing/expired
    mockLookupChallenge.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/auth/webauthn/register/verify')
      .set('Authorization', `Bearer ${PARENT_TOKEN}`)
      .send({ childId: CHILD_ID, response: FAKE_RESPONSE });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CHALLENGE_EXPIRED');
  });

  it('400 CHALLENGE_EXPIRED — authentication verify with no stored challenge', async () => {
    mockLookupChallenge.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/auth/webauthn/authenticate/verify')
      .send({ childId: CHILD_ID, response: FAKE_RESPONSE });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CHALLENGE_EXPIRED');
  });
});

// ── 5. Counter not advanced — replay attack ───────────────────────────────────

describe('WebAuthn authentication — counter replay check', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 COUNTER_NOT_ADVANCED — counter same as stored', async () => {
    mockLookupChallenge.mockResolvedValueOnce('test-challenge-base64url');

    const fakeCredBuf = Buffer.from(FAKE_RESPONSE.rawId, 'base64url');
    mockCredentialFn.mockResolvedValueOnce({
      id: 'db-row-id',
      credential_id: fakeCredBuf,
      public_key: Buffer.from([1, 2, 3]),
      counter: BigInt(5),   // stored = 5
      transports: [],
    });

    mockVerifyAuthenticationResponse.mockResolvedValueOnce({
      verified: true,
      authenticationInfo: { newCounter: 5 }, // same → replay
    });

    const res = await request(app)
      .post('/api/auth/webauthn/authenticate/verify')
      .send({ childId: CHILD_ID, response: FAKE_RESPONSE });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('COUNTER_NOT_ADVANCED');
  });
});

// ── 6. Unknown credential returns 404 ────────────────────────────────────────

describe('WebAuthn authentication — unknown credential', () => {
  beforeEach(() => vi.resetAllMocks());

  it('404 CREDENTIAL_NOT_FOUND — credential not in DB', async () => {
    mockLookupChallenge.mockResolvedValueOnce('test-challenge');
    mockCredentialFn.mockResolvedValueOnce(null); // findFirst → not found

    const res = await request(app)
      .post('/api/auth/webauthn/authenticate/verify')
      .send({ childId: CHILD_ID, response: FAKE_RESPONSE });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CREDENTIAL_NOT_FOUND');
  });
});

// ── 7. Successful auth — with password_hash ───────────────────────────────────

describe('WebAuthn authentication — success flow', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns pending_child token when child.password_hash is set', async () => {
    mockLookupChallenge.mockResolvedValueOnce('test-challenge-base64url');

    const fakeCredBuf = Buffer.from(FAKE_RESPONSE.rawId, 'base64url');
    mockCredentialFn.mockResolvedValueOnce({
      id: 'db-1', credential_id: fakeCredBuf,
      public_key: Buffer.from([4, 5, 6]), counter: BigInt(1), transports: ['internal'],
    });

    mockVerifyAuthenticationResponse.mockResolvedValueOnce({
      verified: true, authenticationInfo: { newCounter: 2 },
    });

    mockCredentialFn.mockResolvedValueOnce({});   // update counter
    mockDeleteChallenge.mockResolvedValueOnce(undefined);

    // Child has password_hash
    mockChildFn.mockResolvedValueOnce({ id: CHILD_ID, password_hash: '$2b$12$somehash' });

    const res = await request(app)
      .post('/api/auth/webauthn/authenticate/verify')
      .send({ childId: CHILD_ID, response: FAKE_RESPONSE });

    expect(res.status).toBe(200);
    expect(res.body.requiresPassword).toBe(true);
    expect(res.body.pendingToken).toBeTruthy();

    const payload = jwt.verify(res.body.pendingToken, JWT_SECRET) as { role: string };
    expect(payload.role).toBe('pending_child');
  });

  it('returns full child JWT when child has no password_hash', async () => {
    mockLookupChallenge.mockResolvedValueOnce('test-challenge-base64url');

    const fakeCredBuf = Buffer.from(FAKE_RESPONSE.rawId, 'base64url');
    mockCredentialFn.mockResolvedValueOnce({
      id: 'db-2', credential_id: fakeCredBuf,
      public_key: Buffer.from([7, 8, 9]), counter: BigInt(3), transports: ['internal'],
    });

    mockVerifyAuthenticationResponse.mockResolvedValueOnce({
      verified: true, authenticationInfo: { newCounter: 4 },
    });

    mockCredentialFn.mockResolvedValueOnce({});
    mockDeleteChallenge.mockResolvedValueOnce(undefined);

    // No password_hash
    mockChildFn.mockResolvedValueOnce({ id: CHILD_ID2, password_hash: null });

    const res = await request(app)
      .post('/api/auth/webauthn/authenticate/verify')
      .send({ childId: CHILD_ID2, response: FAKE_RESPONSE });

    expect(res.status).toBe(200);
    expect(res.body.requiresPassword).toBe(false);
    expect(res.body.token).toBeTruthy();

    const payload = jwt.verify(res.body.token, JWT_SECRET) as { role: string; childId: string };
    expect(payload.role).toBe('child');
    expect(payload.childId).toBe(CHILD_ID2);
  });

  it('full child JWT from biometric has exactly 2h expiry', async () => {
    mockLookupChallenge.mockResolvedValueOnce('test-challenge-base64url');
    const fakeCredBuf = Buffer.from(FAKE_RESPONSE.rawId, 'base64url');
    mockCredentialFn.mockResolvedValueOnce({
      id: 'db-3', credential_id: fakeCredBuf,
      public_key: Buffer.from([10, 11, 12]), counter: BigInt(0), transports: [],
    });
    mockVerifyAuthenticationResponse.mockResolvedValueOnce({
      verified: true, authenticationInfo: { newCounter: 1 },
    });
    mockCredentialFn.mockResolvedValueOnce({});
    mockDeleteChallenge.mockResolvedValueOnce(undefined);
    mockChildFn.mockResolvedValueOnce({ id: CHILD_ID, password_hash: null });

    const res = await request(app)
      .post('/api/auth/webauthn/authenticate/verify')
      .send({ childId: CHILD_ID, response: FAKE_RESPONSE });

    expect(res.status).toBe(200);
    const payload = jwt.verify(res.body.token, JWT_SECRET) as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBe(7200);
  });
});

// ── 8. DELETE /api/children/:id/credentials ───────────────────────────────────

describe('DELETE /api/children/:id/credentials', () => {
  beforeEach(() => vi.resetAllMocks());

  it('404 — parent-B cannot remove parent-A child credentials', async () => {
    mockChildFn.mockResolvedValueOnce(null); // ownership fails
    const res = await request(app)
      .delete(`/api/children/${CHILD_ID}/credentials`)
      .set('Authorization', `Bearer ${PARENT_B_TOKEN}`);
    expect(res.status).toBe(404);
  });

  it('200 — parent can remove their own child credentials', async () => {
    mockChildFn.mockResolvedValueOnce({ id: CHILD_ID }); // ownership passes
    mockCredentialFn.mockResolvedValueOnce({ count: 2 }); // deleteMany
    const res = await request(app)
      .delete(`/api/children/${CHILD_ID}/credentials`)
      .set('Authorization', `Bearer ${PARENT_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/removed/i);
  });
});

// ── 9. Registration options returns correct structure ─────────────────────────

describe('GET /api/auth/webauthn/register/options', () => {
  beforeEach(() => vi.resetAllMocks());

  it('400 — missing childId query param', async () => {
    const res = await request(app)
      .get('/api/auth/webauthn/register/options')
      .set('Authorization', `Bearer ${PARENT_TOKEN}`);
    expect(res.status).toBe(400);
  });

  it('200 — returns registration options for owned child', async () => {
    // ownership check (findFirst returns the child)
    mockChildFn.mockResolvedValueOnce({ id: CHILD_ID, parent_id: PARENT_ID });
    // child with credentials (findUnique)
    mockChildFn.mockResolvedValueOnce({ id: CHILD_ID, name: 'Test Child', credentials: [] });

    const fakeOptions = {
      challenge: 'base64challengestring',
      rp: { name: 'NeuroLexia', id: 'localhost' },
      user: { id: 'userid', name: 'Test Child', displayName: 'Test Child' },
      pubKeyCredParams: [],
      timeout: 60000,
      attestation: 'none',
    };
    mockGenerateRegistrationOptions.mockResolvedValueOnce(fakeOptions);
    mockInsertChallenge.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .get(`/api/auth/webauthn/register/options?childId=${CHILD_ID}`)
      .set('Authorization', `Bearer ${PARENT_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.challenge).toBe('base64challengestring');
  });
});
