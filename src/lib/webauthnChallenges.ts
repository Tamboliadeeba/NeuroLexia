/**
 * webauthnChallenges.ts
 *
 * Lightweight helpers for the webauthn_challenges table.
 *
 * Challenges are single-use (deleted on first successful lookup) and expire
 * after 5 minutes.  A background sweep at insert time removes expired rows
 * so the table stays small.
 */

import prisma from './prisma';

const EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/** Insert a challenge for childId and return it. Also sweeps expired rows. */
export async function insertChallenge(childId: string | null, challenge: string): Promise<void> {
  const expires_at = new Date(Date.now() + EXPIRY_MS);
  // Sweep expired rows opportunistically (fire-and-forget, non-blocking)
  prisma.webAuthnChallenge.deleteMany({ where: { expires_at: { lt: new Date() } } }).catch(() => {});
  await prisma.webAuthnChallenge.create({ data: { child_id: childId, challenge, expires_at } });
}

/**
 * Look up a non-expired challenge for the given childId.
 * Returns the challenge string if found, null otherwise.
 */
export async function lookupChallenge(childId: string): Promise<string | null> {
  const row = await prisma.webAuthnChallenge.findFirst({
    where: { child_id: childId, expires_at: { gt: new Date() } },
    orderBy: { created_at: 'desc' },
    select: { id: true, challenge: true },
  });
  return row?.challenge ?? null;
}

/**
 * Delete the latest non-expired challenge for childId.
 * Must be called after a successful verification to prevent replay.
 */
export async function deleteChallenge(childId: string): Promise<void> {
  // Delete all unexpired challenges for this child (there should be at most one)
  await prisma.webAuthnChallenge.deleteMany({
    where: { child_id: childId, expires_at: { gt: new Date() } },
  });
}
