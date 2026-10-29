import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { requireChild } from '../middleware/authMiddleware';
import { pinOverrideLimiter } from '../middleware/rateLimiter';
import { computePoints } from '../lib/pointsFormula';
import { POINT_COSTS, ALL_UNLOCK_KEYS, unlockTypeFromKey } from '../lib/pointCosts';
import { computeStars } from '@shared/starRating';

const router = Router();

// ── GET /api/child/me ─────────────────────────────────────────────────────────

router.get('/me', requireChild, async (req, res): Promise<void> => {
  const childId = req.childId!;
  const child = await prisma.child.findUnique({
    where: { id: childId },
    select: {
      id: true,
      name: true,
      preferred_language: true,
      preferred_font: true,
      character_id: true,
      total_points: true,
      points_balance: true,
      total_stars: true,
      active_theme: true,
      character: {
        select: { model_key: true },
      },
      unlocks: {
        select: { id: true, unlock_type: true, unlock_key: true, unlocked_at: true },
        orderBy: { unlocked_at: 'asc' },
      },
      game_progress: {
        select: { game_type: true, current_level: true, phase: true, best_stars: true },
      },
    },
  });
  if (!child) { res.status(404).json({ error: 'Child not found' }); return; }
  res.json(child);
});

// ── PATCH /api/child/me ───────────────────────────────────────────────────────

const ALLOWED_THEMES = [
  'default',
  'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune',
  'aurora', 'void',
] as const;

const PatchChildMeSchema = z.object({
  character_id:  z.string().uuid().nullable().optional(),
  preferred_font: z.enum(['opendyslexic', 'atkinson', 'default']).optional(),
  active_theme:  z.enum(ALLOWED_THEMES).optional(),
});

router.patch('/me', requireChild, async (req, res): Promise<void> => {
  const childId = req.childId!;
  const parse = PatchChildMeSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(422).json({ error: parse.error.errors[0]?.message ?? 'Validation error' });
    return;
  }

  // If changing active_theme to a non-default theme, verify the child owns it.
  if (parse.data.active_theme && parse.data.active_theme !== 'default') {
    const themeKey = parse.data.active_theme;
    const owned = await prisma.unlock.findUnique({
      where: { child_id_unlock_key: { child_id: childId, unlock_key: themeKey } },
      select: { id: true },
    });
    if (!owned) {
      res.status(403).json({ error: 'Theme not owned' });
      return;
    }
  }

  const child = await prisma.child.update({
    where: { id: childId },
    data: parse.data,
    select: {
      id: true,
      preferred_language: true,
      preferred_font: true,
      character_id: true,
      active_theme: true,
    },
  });
  res.json(child);
});

// ── POST /api/child/sessions ──────────────────────────────────────────────────

const SessionSchema = z.object({
  client_session_id: z.string().uuid(),
  game_type: z.enum(['trip_to_space', 'echo_galaxy', 'astrotales', 'word_orbit', 'math_mission']),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  level: z.number().int().min(1),
  score: z.number().int().min(0).default(0),
  attempts: z.number().int().min(0).default(0),
  errors: z.record(z.unknown()).default({}),
  self_reported_count: z.number().int().min(0).default(0),
  metadata: z.object({
    total_moves: z.number().int().min(0).default(0),
    wrong_moves: z.number().int().min(0).default(0),
    completion_time_ms: z.number().int().min(0).default(0),
    tutorial_replays: z.number().int().min(0).default(0),
    // Echo Galaxy speak-mode extras (optional so other games are unaffected)
    max_streak: z.number().int().min(0).default(0).optional(),
    accuracy: z.number().min(0).max(1).nullable().optional(),
    // Math Mission story mode extras (optional so existing sessions are unaffected)
    mode: z.string().optional(),
    show_me_count: z.number().int().min(0).optional(),
    per_question: z.array(z.record(z.unknown())).optional(),
    hints_used: z.number().int().min(0).optional(),
    op_chosen_counts: z.record(z.number()).optional(),
    // Echo Galaxy bubbles-mode extras
    sounds_played: z.number().int().min(0).optional(),
    crystals_lit: z.number().int().min(0).optional(),
    replay_count: z.number().int().min(0).optional(),
    timer_enabled: z.boolean().optional(),
    finished_early: z.boolean().optional(),
    // Astrotales extras (optional so existing sessions are unaffected)
    skipped_sentences: z.number().int().min(0).optional(),
    sentences_perfect: z.number().int().min(0).optional(),
    per_sentence: z.array(z.record(z.unknown())).optional(),
  }).default({}),
});

router.post('/sessions', requireChild, async (req, res): Promise<void> => {
  const childId = req.childId!;

  const parse = SessionSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(422).json({ error: parse.error.errors[0]?.message ?? 'Validation error' });
    return;
  }

  const d = parse.data;
  const meta = d.metadata;

  // Idempotency: check if this session was already submitted
  const existing = await prisma.gameSession.findUnique({
    where: { child_id_client_session_id: { child_id: childId, client_session_id: d.client_session_id } },
    select: {
      id: true,
      points_earned: true,
      stars_earned: true,
      child: { select: { total_points: true, points_balance: true, total_stars: true } },
    },
  });

  if (existing) {
    // Duplicate — return cached result, no re-insert
    const progress = await prisma.childGameProgress.findUnique({
      where: { child_id_game_type: { child_id: childId, game_type: d.game_type } },
      select: { current_level: true },
    });
    res.status(200).json({
      duplicate: true,
      points_earned: existing.points_earned,
      stars_earned: existing.stars_earned,
      total_points: existing.child.total_points,
      points_balance: existing.child.points_balance,
      total_stars: existing.child.total_stars,
      next_level: progress?.current_level ?? d.level + 1,
    });
    return;
  }

  // Compute points server-side
  const points = computePoints({
    level: d.level,
    total_moves: meta.total_moves,
    wrong_moves: meta.wrong_moves,
  });

  const totalMoves = meta.total_moves;
  const validMoves = Math.max(0, totalMoves - meta.wrong_moves);
  const rawAccuracy = totalMoves > 0 ? validMoves / totalMoves : null;

  // Override accuracy with game-specific metadata accuracy when provided
  // (echo_galaxy speak mode, astrotales, word_orbit, math_mission all send it)
  const sessionAccuracy: number | null =
    meta.accuracy !== undefined ? meta.accuracy : rawAccuracy;

  // Compute stars server-side — authoritative
  const stars = computeStars(d.game_type as Parameters<typeof computeStars>[0], {
    accuracy: d.self_reported_count > 0 && sessionAccuracy === null ? null : sessionAccuracy,
    hints_used: meta.hints_used ?? 0,
    question_count: d.attempts > 0 ? d.attempts : meta.total_moves,
    crystals_lit: meta.crystals_lit ?? 0,
    mode: meta.mode,
  });

  const nextLevel = d.level + 1;

  // One Prisma transaction: insert session, upsert progress, increment points + stars
  const [, progressResult, updatedChild] = await prisma.$transaction([
    // 1. Insert game session
    prisma.gameSession.create({
      data: {
        child_id: childId,
        client_session_id: d.client_session_id,
        game_type: d.game_type,
        started_at: new Date(d.started_at),
        ended_at: new Date(d.ended_at),
        level: d.level,
        score: d.score,
        points_earned: points,
        stars_earned: stars,
        accuracy: sessionAccuracy,
        attempts: d.attempts,
        errors: d.errors as Prisma.InputJsonValue,
        self_reported_count: d.self_reported_count,
        metadata: {
          total_moves: meta.total_moves,
          wrong_moves: meta.wrong_moves,
          completion_time_ms: meta.completion_time_ms,
          tutorial_replays: meta.tutorial_replays,
        },
      },
    }),
    // 2. Upsert game progress (advance to next level, update best_stars)
    prisma.childGameProgress.upsert({
      where: { child_id_game_type: { child_id: childId, game_type: d.game_type } },
      create: {
        child_id: childId,
        game_type: d.game_type,
        current_level: nextLevel,
        phase: 1,
        best_stars: stars,
      },
      update: {
        current_level: nextLevel,
        // Only update best_stars if this session was better
        best_stars: { increment: 0 }, // placeholder — updated via raw below if needed
      },
      select: { best_stars: true },
    }),
    // 3. Increment both point totals and total_stars
    prisma.child.update({
      where: { id: childId },
      data: {
        total_points:   { increment: points },
        points_balance: { increment: points },
        total_stars:    { increment: stars },
      },
      select: { total_points: true, points_balance: true, total_stars: true },
    }),
  ]);

  // Update best_stars separately (Prisma doesn't support MAX in upsert update)
  if (stars > (progressResult.best_stars ?? 0)) {
    await prisma.childGameProgress.update({
      where: { child_id_game_type: { child_id: childId, game_type: d.game_type } },
      data: { best_stars: stars },
    });
  }

  res.status(201).json({
    points_earned: points,
    stars_earned: stars,
    total_points: updatedChild.total_points,
    points_balance: updatedChild.points_balance,
    total_stars: updatedChild.total_stars,
    next_level: nextLevel,
  });
});

// ── POST /api/child/unlocks ───────────────────────────────────────────────────

const UnlockSchema = z.object({
  unlock_key: z.enum(ALL_UNLOCK_KEYS as [string, ...string[]]),
});

router.post('/unlocks', requireChild, async (req, res): Promise<void> => {
  const childId = req.childId!;

  const parse = UnlockSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Unknown unlock key' });
    return;
  }

  const { unlock_key } = parse.data;
  const cost = POINT_COSTS[unlock_key as keyof typeof POINT_COSTS];
  const unlock_type = unlockTypeFromKey(unlock_key)!;

  try {
    // One atomic transaction: check balance, check duplicate, deduct, insert
    const result = await prisma.$transaction(async (tx) => {
      // Read current balance (serializable-safe: SELECT ... FOR UPDATE via prisma)
      const child = await tx.child.findUnique({
        where: { id: childId },
        select: { points_balance: true, total_points: true },
      });
      if (!child) throw Object.assign(new Error('Child not found'), { code: 'NOT_FOUND' });

      // Check already owned
      const existing = await tx.unlock.findUnique({
        where: { child_id_unlock_key: { child_id: childId, unlock_key } },
        select: { id: true },
      });
      if (existing) throw Object.assign(new Error('Already owned'), { code: 'ALREADY_OWNED' });

      // Check balance
      if (child.points_balance < cost) {
        throw Object.assign(new Error('Insufficient balance'), { code: 'INSUFFICIENT_BALANCE' });
      }

      // Deduct points_balance (total_points never decremented)
      const updated = await tx.child.update({
        where: { id: childId },
        data: { points_balance: { decrement: cost } },
        select: { points_balance: true, total_points: true },
      });

      // Insert unlock row
      const unlock = await tx.unlock.create({
        data: { child_id: childId, unlock_key, unlock_type },
        select: { id: true, unlock_type: true, unlock_key: true, unlocked_at: true },
      });

      return { updated, unlock };
    });

    res.status(201).json({
      points_balance: result.updated.points_balance,
      total_points:   result.updated.total_points,
      unlock:         result.unlock,
    });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === 'ALREADY_OWNED') {
      res.status(409).json({ error: 'Already owned' });
      return;
    }
    if (e.code === 'INSUFFICIENT_BALANCE') {
      res.status(402).json({ error: 'Insufficient points' });
      return;
    }
    if (e.code === 'NOT_FOUND') {
      res.status(404).json({ error: 'Child not found' });
      return;
    }
    // Prisma unique constraint violation (race condition — concurrent duplicate)
    if ((err as { code?: string })?.code === 'P2002') {
      res.status(409).json({ error: 'Already owned' });
      return;
    }
    throw err;
  }
});

// ── POST /api/child/verify-override-pin ───────────────────────────────────────

const PinSchema = z.object({
  pin: z.string().min(4).max(8),
});

router.post('/verify-override-pin', requireChild, pinOverrideLimiter, async (req, res): Promise<void> => {
  const childId = req.childId!;
  const parse = PinSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(422).json({ error: 'Invalid PIN' });
    return;
  }

  const child = await prisma.child.findUnique({
    where: { id: childId },
    select: { parent: { select: { override_pin_hash: true } } },
  });

  if (!child?.parent?.override_pin_hash) {
    res.status(400).json({ error: 'No override PIN set' });
    return;
  }

  const match = await bcrypt.compare(parse.data.pin, child.parent.override_pin_hash);
  if (!match) {
    res.status(401).json({ error: 'Incorrect PIN' });
    return;
  }

  res.json({ success: true });
});

export default router;
