import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import prisma from '../lib/prisma';
import { authLimiter, webauthnLimiter } from '../middleware/rateLimiter';
import { requireParent, requirePendingChild, requireChild } from '../middleware/authMiddleware';
import { assertOwnership } from '../lib/ownership';
import { insertChallenge, lookupChallenge, deleteChallenge } from '../lib/webauthnChallenges';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function rpId(): string {
  return process.env.WEBAUTHN_RP_ID!;
}

function expectedOrigin(): string {
  return process.env.WEBAUTHN_ORIGIN!;
}

function signParentJwt(parentId: string, name: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ role: 'parent', parentId, name }, secret, { expiresIn: '24h' });
}

function signChildJwt(childId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ role: 'child', childId }, secret, { expiresIn: '2h' });
}

function signPendingChildJwt(childId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ role: 'pending_child', childId }, secret, { expiresIn: '5m' });
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  consent: z.boolean().refine((v) => v === true, 'You must accept the data usage policy'),
  preferred_language: z.enum(['en', 'hi']).default('en'),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const ChildPasswordSchema = z.object({
  pendingToken: z.string().min(1),
  password: z.string().min(1, 'Password is required'),
});

const WebAuthnRegisterVerifySchema = z.object({
  childId: z.string().uuid(),
  response: z.record(z.unknown()),
});

const WebAuthnAuthVerifySchema = z.object({
  childId: z.string().uuid(),
  response: z.record(z.unknown()),
});

const DemoLoginSchema = z.object({
  childId: z.string().uuid('childId must be a valid UUID'),
});

// ── POST /api/auth/register ───────────────────────────────────────────────────

router.post('/register', authLimiter, async (req, res): Promise<void> => {
  const parse = RegisterSchema.safeParse(req.body);
  if (!parse.success) {
    const fieldErrors: Record<string, string> = {};
    parse.error.errors.forEach((e) => {
      const key = e.path[0] as string | undefined;
      if (key) fieldErrors[key] = e.message;
    });
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: parse.error.errors[0]?.message ?? 'Validation error', fieldErrors } });
    return;
  }
  const { name, email, password, preferred_language } = parse.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    res.status(409).json({ error: { code: 'EMAIL_TAKEN', message: 'This email is already registered', fieldErrors: { email: 'This email is already registered' } } });
    return;
  }

  const password_hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password_hash,
      preferred_language: preferred_language as 'en' | 'hi',
      consent_given_at: new Date(),
    },
    select: { id: true, name: true, email: true },
  });

  const token = signParentJwt(user.id, user.name);
  res.status(201).json({ token, parentId: user.id, name: user.name });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────

router.post('/login', authLimiter, async (req, res): Promise<void> => {
  const parse = LoginSchema.safeParse(req.body);
  if (!parse.success) {
    const fieldErrors: Record<string, string> = {};
    parse.error.errors.forEach((e) => {
      const key = e.path[0] as string | undefined;
      if (key) fieldErrors[key] = e.message;
    });
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: parse.error.errors[0]?.message ?? 'Validation error', fieldErrors } });
    return;
  }
  const { email, password } = parse.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, password_hash: true },
  });

  const WRONG_CREDS = { code: 'WRONG_CREDENTIALS', message: 'Wrong email or password' };

  if (!user) {
    await bcrypt.compare(password, '$2b$12$invalidhashpaddingtoconstanttime');
    res.status(401).json({ error: WRONG_CREDS });
    return;
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    res.status(401).json({ error: WRONG_CREDS });
    return;
  }

  const token = signParentJwt(user.id, user.name);
  res.json({ token, parentId: user.id, name: user.name });
});

// ── POST /api/auth/child/password ─────────────────────────────────────────────

router.post('/child/password', async (req, res): Promise<void> => {
  const parse = ChildPasswordSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(422).json({ error: parse.error.errors[0]?.message ?? 'Validation error' });
    return;
  }
  const { pendingToken, password } = parse.data;

  const secret = process.env.JWT_SECRET;
  if (!secret) { res.status(500).json({ error: 'Server misconfigured' }); return; }

  let childId: string;
  try {
    const payload = jwt.verify(pendingToken, secret) as { role: string; childId: string };
    if (payload.role !== 'pending_child') throw new Error('wrong role');
    childId = payload.childId;
  } catch {
    res.status(401).json({ error: 'Invalid or expired pending token' });
    return;
  }

  const child = await prisma.child.findUnique({
    where: { id: childId },
    select: { id: true, password_hash: true },
  });

  if (!child?.password_hash) {
    res.status(400).json({ error: 'This child does not have a password set' });
    return;
  }

  const match = await bcrypt.compare(password, child.password_hash);
  if (!match) {
    res.status(401).json({ error: 'Wrong password' });
    return;
  }

  const token = signChildJwt(child.id);
  res.json({ token, childId: child.id });
});

// Ensure requirePendingChild is imported even though it's Phase 2 — keeps TS happy
void requirePendingChild;

// ── GET /api/auth/demo-children ───────────────────────────────────────────────

router.get('/demo-children', (_req, res): void => {
  if (process.env.APP_ENV === 'production') {
    res.status(403).json({ error: { code: 'DEMO_DISABLED', message: 'Demo mode is disabled in production' } });
    return;
  }
  (async () => {
    const children = await prisma.child.findMany({
      where: { is_demo: true },
      select: {
        id: true,
        name: true,
        preferred_language: true,
        character_id: true,
        character: {
          select: { key: true, model_key: true, fallback_svg: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(children);
  })().catch((err) => {
    console.error('[demo-children] DB error:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
  });
});

// ── POST /api/auth/child/demo-login ───────────────────────────────────────────

router.post('/child/demo-login', authLimiter, async (req, res): Promise<void> => {
  if (process.env.APP_ENV === 'production') {
    res.status(403).json({ error: { code: 'DEMO_DISABLED', message: 'Demo mode is disabled in production' } });
    return;
  }

  const parse = DemoLoginSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parse.error.errors[0]?.message ?? 'Validation error',
        fieldErrors: { childId: parse.error.errors[0]?.message ?? 'Invalid' },
      },
    });
    return;
  }

  const { childId } = parse.data;
  const child = await prisma.child.findUnique({
    where: { id: childId },
    select: { id: true, is_demo: true },
  });

  if (!child) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Child not found' } });
    return;
  }

  if (!child.is_demo) {
    res.status(403).json({
      error: { code: 'NOT_DEMO', message: 'This child is not a demo account' },
    });
    return;
  }

  const token = signChildJwt(child.id);
  res.json({ token, childId: child.id });
});

// ── WebAuthn Registration ─────────────────────────────────────────────────────
// GET /api/auth/webauthn/register/options?childId=<uuid>
// POST /api/auth/webauthn/register/verify
// Both require a valid parent JWT + ownership of the child.

router.get('/webauthn/register/options', requireParent, webauthnLimiter, async (req, res): Promise<void> => {
  const parentId = req.parentId!;
  const childId  = req.query.childId as string | undefined;

  if (!childId || typeof childId !== 'string') {
    res.status(400).json({ error: 'childId query param is required' });
    return;
  }

  if (!await assertOwnership(parentId, childId, res)) return;

  // Load child + existing credentials (to exclude from options)
  const child = await prisma.child.findUnique({
    where: { id: childId },
    select: {
      id: true,
      name: true,
      credentials: { select: { credential_id: true, transports: true } },
    },
  });
  if (!child) { res.status(404).json({ error: 'Child not found' }); return; }

  const options = await generateRegistrationOptions({
    rpName: 'NeuroLexia',
    rpID: rpId(),
    userID: Buffer.from(child.id),
    userName: child.name,
    userDisplayName: child.name,
    attestationType: 'none',
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'preferred',
    },
    excludeCredentials: child.credentials.map((c) => ({
      id: c.credential_id,
      transports: (c.transports ?? []) as AuthenticatorTransport[],
    })),
  });

  // Store challenge for this child
  await insertChallenge(childId, options.challenge);

  res.json(options);
});

router.post('/webauthn/register/verify', requireParent, webauthnLimiter, async (req, res): Promise<void> => {
  const parentId = req.parentId!;
  const parse = WebAuthnRegisterVerifySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0]?.message ?? 'Invalid request' });
    return;
  }
  const { childId, response } = parse.data;

  if (!await assertOwnership(parentId, childId, res)) return;

  const challenge = await lookupChallenge(childId);
  if (!challenge) {
    res.status(400).json({ error: { code: 'CHALLENGE_EXPIRED', message: 'Challenge expired or not found. Please try again.' } });
    return;
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: response as RegistrationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: expectedOrigin(),
      expectedRPID: rpId(),
      requireUserVerification: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Verification failed';
    res.status(400).json({ error: { code: 'VERIFICATION_FAILED', message: msg } });
    return;
  }

  if (!verification.verified || !verification.registrationInfo) {
    res.status(400).json({ error: { code: 'VERIFICATION_FAILED', message: 'Biometric verification failed' } });
    return;
  }

  // Delete challenge on success (prevents replay)
  await deleteChallenge(childId);

  const { credential } = verification.registrationInfo;

  // Upsert credential (handles re-registration of the same authenticator)
  await prisma.childCredential.upsert({
    where: { credential_id: Buffer.from(credential.id) },
    create: {
      child_id:      childId,
      credential_id: Buffer.from(credential.id),
      public_key:    Buffer.from(credential.publicKey),
      counter:       BigInt(credential.counter),
      transports:    (response as { response?: { transports?: string[] } }).response?.transports ?? [],
    },
    update: {
      public_key:  Buffer.from(credential.publicKey),
      counter:     BigInt(credential.counter),
      transports:  (response as { response?: { transports?: string[] } }).response?.transports ?? [],
    },
  });

  // Return updated credential count
  const count = await prisma.childCredential.count({ where: { child_id: childId } });
  res.status(201).json({ verified: true, credentialCount: count });
});

// ── WebAuthn Authentication ───────────────────────────────────────────────────
// GET /api/auth/webauthn/authenticate/options?childId=<uuid>  — public (no auth needed, child not yet known)
// POST /api/auth/webauthn/authenticate/verify                 — public

router.get('/webauthn/authenticate/options', webauthnLimiter, async (req, res): Promise<void> => {
  const childId = req.query.childId as string | undefined;

  if (!childId || typeof childId !== 'string') {
    res.status(400).json({ error: 'childId query param is required' });
    return;
  }

  // Validate UUID shape (but do not 404 — resist user-enumeration)
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(childId)) {
    res.status(400).json({ error: 'Invalid childId' });
    return;
  }

  const credentials = await prisma.childCredential.findMany({
    where: { child_id: childId },
    select: { credential_id: true, transports: true },
  });

  const options = await generateAuthenticationOptions({
    rpID: rpId(),
    userVerification: 'required',
    allowCredentials: credentials.map((c) => ({
      id: c.credential_id,
      transports: (c.transports ?? []) as AuthenticatorTransport[],
    })),
  });

  await insertChallenge(childId, options.challenge);

  res.json(options);
});

router.post('/webauthn/authenticate/verify', webauthnLimiter, async (req, res): Promise<void> => {
  const parse = WebAuthnAuthVerifySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0]?.message ?? 'Invalid request' });
    return;
  }
  const { childId, response } = parse.data;

  const challenge = await lookupChallenge(childId);
  if (!challenge) {
    res.status(400).json({ error: { code: 'CHALLENGE_EXPIRED', message: 'Challenge expired or not found. Please try again.' } });
    return;
  }

  // Find the credential being used
  const rawId = (response as { rawId?: string }).rawId ?? (response as { id?: string }).id ?? '';
  const credentialBuffer = Buffer.from(rawId, 'base64url');

  const storedCredential = await prisma.childCredential.findFirst({
    where: { child_id: childId, credential_id: credentialBuffer },
    select: { id: true, credential_id: true, public_key: true, counter: true, transports: true },
  });

  if (!storedCredential) {
    // Credential not found — remove from client localStorage signal
    res.status(404).json({ error: { code: 'CREDENTIAL_NOT_FOUND', message: 'Credential not registered on this server' } });
    return;
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: response as AuthenticationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: expectedOrigin(),
      expectedRPID: rpId(),
      requireUserVerification: true,
      credential: {
        id: storedCredential.credential_id,
        publicKey: storedCredential.public_key,
        counter: Number(storedCredential.counter),
        transports: (storedCredential.transports ?? []) as AuthenticatorTransport[],
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Verification failed';
    res.status(400).json({ error: { code: 'VERIFICATION_FAILED', message: msg } });
    return;
  }

  if (!verification.verified) {
    res.status(401).json({ error: { code: 'VERIFICATION_FAILED', message: 'Biometric verification failed' } });
    return;
  }

  // Counter must have advanced (replay attack protection)
  const newCounter = verification.authenticationInfo.newCounter;
  if (newCounter <= Number(storedCredential.counter)) {
    res.status(401).json({ error: { code: 'COUNTER_NOT_ADVANCED', message: 'Possible replay attack detected' } });
    return;
  }

  // Update counter
  await prisma.childCredential.update({
    where: { id: storedCredential.id },
    data: { counter: BigInt(newCounter) },
  });

  // Delete challenge on success
  await deleteChallenge(childId);

  // Load child to check if password step is needed
  const child = await prisma.child.findUnique({
    where: { id: childId },
    select: { id: true, password_hash: true },
  });
  if (!child) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Child not found' } });
    return;
  }

  if (child.password_hash) {
    // Return a short-lived pending JWT; client will then send password
    const pendingToken = signPendingChildJwt(child.id);
    res.json({ verified: true, requiresPassword: true, pendingToken, childId: child.id });
  } else {
    const token = signChildJwt(child.id);
    res.json({ verified: true, requiresPassword: false, token, childId: child.id });
  }
});

// ── POST /api/auth/child/logout ───────────────────────────────────────────────
// Best-effort server-side cleanup. The client clears the token regardless of
// the response, so this endpoint always returns 204.

router.post('/child/logout', requireChild, async (_req, res): Promise<void> => {
  // JWT is stateless — no server-side session table to invalidate.
  // This endpoint exists so clients can fire a fire-and-forget logout call;
  // future token-revocation logic (e.g. a denylist) would go here.
  res.status(204).end();
});

export default router;
