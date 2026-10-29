import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { requireParent } from '../middleware/authMiddleware';
import { assertOwnership } from '../lib/ownership';
import { seedDemoChild } from '../lib/seedDemoChild';

const router = Router();

// All routes require a valid parent JWT
router.use(requireParent);

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateChildSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  // Coerce age so a string "7" (browser quirk) is accepted alongside number 7.
  age: z.coerce.number().int().min(1, 'Age must be between 1 and 18').max(18, 'Age must be between 1 and 18'),
  preferred_language: z.enum(['en', 'hi']).default('en'),
  // Treat empty string the same as omitted/null — convert "" → null before min check.
  username: z.string().max(50).nullish().transform((v) => (v === '' || v == null) ? null : v),
  // Treat empty string as no password.
  password: z.string().nullish().transform((v) => (v === '' || v == null) ? null : v)
    .pipe(z.string().min(4, 'Password must be at least 4 characters').nullable().optional()),
  // character_id / override_pin excluded — child-portal only.
  preferred_font: z.enum(['opendyslexic', 'atkinson', 'default']).default('opendyslexic'),
  is_demo: z.boolean().default(false),
});

const UpdateChildSchema = CreateChildSchema.partial().extend({
  name: z.string().min(1).max(100).optional(),
});

// ── GET /api/children ─────────────────────────────────────────────────────────

router.get('/', async (req, res): Promise<void> => {
  const parentId = req.parentId!;
  const children = await prisma.child.findMany({
    where: { parent_id: parentId },
    select: {
      id: true,
      name: true,
      age: true,
      preferred_language: true,
      preferred_font: true,
      username: true,
      // character_id is child-only — not exposed to parent API
      total_points: true,
      points_balance: true,
      active_theme: true,
      is_demo: true,
      created_at: true,
      unlocks: {
        select: { id: true, unlock_type: true, unlock_key: true, unlocked_at: true },
        orderBy: { unlocked_at: 'asc' },
      },
    },
    orderBy: { created_at: 'asc' },
  });
  res.json(children);
});

// ── POST /api/children ────────────────────────────────────────────────────────

router.post('/', async (req, res): Promise<void> => {
  const parentId = req.parentId!;
  const parse = CreateChildSchema.safeParse(req.body);
  if (!parse.success) {
    const fieldErrors: Record<string, string> = {};
    parse.error.errors.forEach((e) => { const k = e.path[0] as string | undefined; if (k) fieldErrors[k] = e.message; });
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: parse.error.errors[0]?.message ?? 'Validation error', fieldErrors } });
    return;
  }
  const { password, ...rest } = parse.data;

  const data: Record<string, unknown> = {
    ...rest,
    parent_id: parentId,
  };

  if (password) data.password_hash = await bcrypt.hash(password, 12);

  if (rest.username) {
    const exists = await prisma.child.findUnique({
      where: { username: rest.username },
      select: { id: true },
    });
    if (exists) {
      res.status(409).json({ error: { code: 'USERNAME_TAKEN', message: 'This username is already taken', fieldErrors: { username: 'This username is already taken' } } });
      return;
    }
  }

  const child = await prisma.child.create({
    data: data as Parameters<typeof prisma.child.create>[0]['data'],
    select: {
      id: true, name: true, age: true, preferred_language: true,
      preferred_font: true, username: true,
      total_points: true, points_balance: true, is_demo: true, created_at: true,
    },
  });
  res.status(201).json(child);
});

// ── PUT /api/children/:id ─────────────────────────────────────────────────────

router.put('/:id', async (req, res): Promise<void> => {
  const parentId = req.parentId!;
  const childId  = req.params.id;

  if (!await assertOwnership(parentId, childId, res)) return;

  const parse = UpdateChildSchema.safeParse(req.body);
  if (!parse.success) {
    const fieldErrors: Record<string, string> = {};
    parse.error.errors.forEach((e) => { const k = e.path[0] as string | undefined; if (k) fieldErrors[k] = e.message; });
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: parse.error.errors[0]?.message ?? 'Validation error', fieldErrors } });
    return;
  }
  const { password, ...rest } = parse.data;
  const data: Record<string, unknown> = { ...rest };

  if (password !== undefined) {
    data.password_hash = password ? await bcrypt.hash(password, 12) : null;
  }

  if (rest.username) {
    const conflict = await prisma.child.findFirst({
      where: { username: rest.username, NOT: { id: childId } },
      select: { id: true },
    });
    if (conflict) {
      res.status(409).json({ error: { code: 'USERNAME_TAKEN', message: 'This username is already taken', fieldErrors: { username: 'This username is already taken' } } });
      return;
    }
  }

  const child = await prisma.child.update({
    where: { id: childId },
    data: data as Parameters<typeof prisma.child.update>[0]['data'],
    select: {
      id: true, name: true, age: true, preferred_language: true,
      preferred_font: true, username: true,
      total_points: true, points_balance: true, is_demo: true, created_at: true,
    },
  });
  res.json(child);
});

// ── DELETE /api/children/:id/data — reset game data, keep profile ─────────────

router.delete('/:id/data', async (req, res): Promise<void> => {
  const parentId = req.parentId!;
  const childId  = req.params.id;

  if (!await assertOwnership(parentId, childId, res)) return;

  await prisma.$transaction([
    prisma.gameSession.deleteMany({ where: { child_id: childId } }),
    prisma.childGameProgress.deleteMany({ where: { child_id: childId } }),
    prisma.aiReport.deleteMany({ where: { child_id: childId } }),
    prisma.unlock.deleteMany({ where: { child_id: childId } }),
    prisma.child.update({
      where: { id: childId },
      data: { total_points: 0, points_balance: 0 },
    }),
  ]);

  res.json({ message: 'Game data reset successfully' });
});

// ── DELETE /api/children/:id — full removal ───────────────────────────────────

router.delete('/:id', async (req, res): Promise<void> => {
  const parentId = req.parentId!;
  const childId  = req.params.id;

  if (!await assertOwnership(parentId, childId, res)) return;

  // Prisma cascades delete credentials, sessions, progress, unlocks, reports
  await prisma.child.delete({ where: { id: childId } });
  res.json({ message: 'Child deleted successfully' });
});

// ── GET /api/children/:id/credentials/count — credential count for parent UI ─

router.get('/:id/credentials/count', async (req, res): Promise<void> => {
  const parentId = req.parentId!;
  const childId  = req.params.id;

  if (!await assertOwnership(parentId, childId, res)) return;

  const count = await prisma.childCredential.count({ where: { child_id: childId } });
  res.json({ count });
});

// ── DELETE /api/children/:id/credentials ─────────────────────────────────────
// Remove all registered biometric credentials for a child device.
// Requires parent auth + ownership.

router.delete('/:id/credentials', async (req, res): Promise<void> => {
  const parentId = req.parentId!;
  const childId  = req.params.id;

  if (!await assertOwnership(parentId, childId, res)) return;

  await prisma.childCredential.deleteMany({ where: { child_id: childId } });

  res.json({ message: 'All credentials removed' });
});

// ── POST /api/children/demo — create + seed a demo child (idempotent) ─────────
// Hidden in production (APP_ENV=production → 403).

router.post('/demo', async (req, res): Promise<void> => {
  if (process.env.APP_ENV === 'production') {
    res.status(403).json({ error: { code: 'DEMO_DISABLED', message: 'Demo mode is disabled in production' } });
    return;
  }

  const parentId = req.parentId!;

  // Use the parent's preferred_language for the demo child
  const parent = await prisma.user.findUnique({
    where: { id: parentId },
    select: { preferred_language: true },
  });
  const lang = parent?.preferred_language ?? 'en';

  const result = await seedDemoChild(prisma, parentId, lang);

  // Return the child record (same shape as GET /api/children)
  const child = await prisma.child.findUnique({
    where: { id: result.childId },
    select: {
      id: true, name: true, age: true, preferred_language: true,
      preferred_font: true, username: true,
      total_points: true, points_balance: true, is_demo: true, created_at: true,
    },
  });

  res.status(result.alreadyExisted ? 200 : 201).json(child);
});

// ── GET /api/children/:id/sessions — progress aggregates ──────────────────────
// Query param: period=week (default) | month
// Returns ETag based on latest session timestamp; 304 if nothing changed.

router.get('/:id/sessions', async (req, res): Promise<void> => {
  const parentId = req.parentId!;
  const childId  = req.params.id;
  const period   = req.query.period === 'month' ? 'month' : 'week';

  if (!await assertOwnership(parentId, childId, res)) return;

  const now = new Date();
  const since = new Date(now);
  if (period === 'week') {
    since.setDate(since.getDate() - 7);
  } else {
    since.setDate(since.getDate() - 30);
  }

  const sessions = await prisma.gameSession.findMany({
    where: { child_id: childId, ended_at: { gte: since } },
    orderBy: { ended_at: 'asc' },
    select: {
      id: true,
      game_type: true,
      ended_at: true,
      level: true,
      score: true,
      points_earned: true,
      accuracy: true,
      attempts: true,
      errors: true,
      self_reported_count: true,
      metadata: true,
    },
  });

  // Latest ended_at used for ETag and lastUpdated
  const latestAt = sessions.length > 0
    ? sessions[sessions.length - 1].ended_at.toISOString()
    : null;

  // ETag: hash of "childId|period|latestAt"
  const etagBase = `${childId}|${period}|${latestAt ?? 'empty'}`;
  const etag = `"${Buffer.from(etagBase).toString('base64').slice(0, 24)}"`;

  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }

  // Aggregates per game type
  const gameTypes = ['trip_to_space', 'echo_galaxy', 'astrotales', 'word_orbit', 'math_mission'] as const;

  // Bubbles-mode aggregates for echo_galaxy
  const bubblesAgg = {
    sessionCount: 0,
    totalCrystals: 0,
    correctFirstTap: 0,
    totalTaps: 0,
    confusedPairs: {} as Record<string, number>,
  };

  // Astrotales reading-detail aggregates
  const astroAgg = {
    sentencesPerfect: 0,
    missedWords: {} as Record<string, number>,
  };

  const byGame: Record<string, {
    sessions: typeof sessions;
    verifiedCount: number;
    avgAccuracy: number | null;
    totalPoints: number;
    totalHints: number;
    totalReplays: number;
    selfReportedCount: number;
    errorTotals: Record<string, number>;
    dailyAccuracy: Record<string, { sum: number; count: number }>;
    storySessionCount: number;
    storyAccuracy: number | null;
    hardestStoryType: string | null;
  }> = {};

  for (const gt of gameTypes) {
    const gs = sessions.filter((s) => s.game_type === gt);
    const verified = gs.filter((s) => s.self_reported_count === 0 && s.accuracy !== null);
    const avgAcc = verified.length > 0
      ? verified.reduce((sum, s) => sum + (s.accuracy ?? 0), 0) / verified.length
      : null;
    const totalPoints = gs.reduce((sum, s) => sum + s.points_earned, 0);

    let totalHints = 0;
    let totalReplays = 0;
    const errorTotals: Record<string, number> = {};
    const dailyAccuracy: Record<string, { sum: number; count: number }> = {};

    // Story mode aggregates (math_mission only)
    let storySessionCount = 0;
    let storyTotalMoves = 0;
    let storyWrongMoves = 0;
    const storyErrorCounts: Record<string, number> = {};

    for (const s of gs) {
      const meta = s.metadata as Record<string, unknown> | null;
      if (meta) {
        totalHints   += Number(meta.hints_used   ?? 0);
        totalReplays += Number(meta.tutorial_replays ?? 0);

        if (gt === 'math_mission' && meta.mode === 'story') {
          storySessionCount += 1;
          storyTotalMoves   += Number(meta.total_moves ?? 0);
          storyWrongMoves   += Number(meta.wrong_moves ?? 0);
        }
        if (gt === 'echo_galaxy' && meta.mode === 'bubbles') {
          bubblesAgg.sessionCount += 1;
          bubblesAgg.totalCrystals += Number(meta.crystals_lit ?? 0);
        }
      }
      const errs = s.errors as Record<string, number> | null;
      if (errs) {
        for (const [cat, count] of Object.entries(errs)) {
          errorTotals[cat] = (errorTotals[cat] ?? 0) + count;
          if (gt === 'math_mission' &&
              ['combine_error','takeaway_error','compare_error','groups_error','share_error'].includes(cat)) {
            storyErrorCounts[cat] = (storyErrorCounts[cat] ?? 0) + count;
          }
        }
      }
      // Accumulate bubbles confused pairs from phoneme_categories errors
      if (gt === 'echo_galaxy') {
        const meta = s.metadata as Record<string, unknown> | null;
        const errs2 = s.errors as Record<string, unknown> | null;
        if (meta?.mode === 'bubbles' && errs2) {
          const phonemeCats = errs2.phoneme_categories as Record<string, number> | null;
          if (phonemeCats) {
            for (const [cat, count] of Object.entries(phonemeCats)) {
              bubblesAgg.confusedPairs[cat] = (bubblesAgg.confusedPairs[cat] ?? 0) + Number(count);
            }
          }
          bubblesAgg.totalTaps     += Number(s.attempts ?? 0);
          bubblesAgg.correctFirstTap += Number((meta.total_moves ?? 0)) - Number((meta.wrong_moves ?? 0));
        }
      }
      // Accumulate Astrotales reading-detail aggregates
      if (gt === 'astrotales') {
        const meta = s.metadata as Record<string, unknown> | null;
        if (meta) {
          astroAgg.sentencesPerfect += Number(meta.sentences_perfect ?? 0);
          // Extract mispronounced_words from errors JSONB
          const errs3 = s.errors as Record<string, unknown> | null;
          if (errs3) {
            const misprWords = errs3.mispronounced_words as Record<string, number> | null;
            if (misprWords) {
              for (const [word, count] of Object.entries(misprWords)) {
                astroAgg.missedWords[word] = (astroAgg.missedWords[word] ?? 0) + Number(count);
              }
            }
          }
        }
      }
      if (s.accuracy !== null && s.self_reported_count === 0) {
        const day = s.ended_at.toISOString().slice(0, 10);
        if (!dailyAccuracy[day]) dailyAccuracy[day] = { sum: 0, count: 0 };
        dailyAccuracy[day].sum   += s.accuracy;
        dailyAccuracy[day].count += 1;
      }
    }

    const storyAccuracy = storyTotalMoves > 0
      ? Math.round(((storyTotalMoves - storyWrongMoves) / storyTotalMoves) * 100)
      : null;
    const hardestStoryType = Object.entries(storyErrorCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

    byGame[gt] = {
      sessions: gs,
      verifiedCount: verified.length,
      avgAccuracy: avgAcc,
      totalPoints,
      totalHints,
      totalReplays,
      selfReportedCount: gs.reduce((sum, s) => sum + s.self_reported_count, 0),
      errorTotals,
      dailyAccuracy,
      storySessionCount,
      storyAccuracy,
      hardestStoryType,
    };
  }

  // Current levels
  const progress = await prisma.childGameProgress.findMany({
    where: { child_id: childId },
    select: { game_type: true, current_level: true },
  });
  const currentLevels: Record<string, number> = {};
  for (const p of progress) {
    currentLevels[p.game_type] = p.current_level;
  }

  // Summary cards
  const totalSessions  = sessions.length;
  const totalPts       = sessions.reduce((s, r) => s + r.points_earned, 0);
  const allVerified    = sessions.filter((s) => s.self_reported_count === 0 && s.accuracy !== null);
  const overallAvgAcc  = allVerified.length > 0
    ? allVerified.reduce((s, r) => s + (r.accuracy ?? 0), 0) / allVerified.length
    : null;

  // Per-session self-reported list for the panel
  const selfReportedSessions = sessions
    .filter((s) => s.self_reported_count > 0)
    .map((s) => ({
      id: s.id,
      game_type: s.game_type,
      ended_at: s.ended_at.toISOString(),
      self_reported_count: s.self_reported_count,
    }));

  // Accuracy trend (daily, all games combined with verified only)
  const accuracyTrend: Record<string, { sum: number; count: number }> = {};
  for (const s of allVerified) {
    const day = s.ended_at.toISOString().slice(0, 10);
    if (!accuracyTrend[day]) accuracyTrend[day] = { sum: 0, count: 0 };
    accuracyTrend[day].sum   += s.accuracy ?? 0;
    accuracyTrend[day].count += 1;
  }

  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    period,
    lastUpdated: latestAt,
    summary: {
      total_sessions: totalSessions,
      avg_accuracy: overallAvgAcc,
      total_points: totalPts,
    },
    current_levels: currentLevels,
    by_game: Object.fromEntries(
      gameTypes.map((gt) => {
        const g = byGame[gt];
        return [gt, {
          verified_sessions: g.verifiedCount,
          avg_accuracy: g.avgAccuracy,
          total_points: g.totalPoints,
          hints_used: g.totalHints,
          replay_count: g.totalReplays,
          self_reported_count: g.selfReportedCount,
          error_totals: g.errorTotals,
          daily_accuracy: Object.entries(g.dailyAccuracy).map(([day, v]) => ({
            day,
            accuracy: v.sum / v.count,
          })),
          story_session_count: g.storySessionCount,
          story_accuracy: g.storyAccuracy,
          hardest_story_type: g.hardestStoryType,
        }];
      }),
    ),
    self_reported_sessions: selfReportedSessions,
    accuracy_trend: Object.entries(accuracyTrend).map(([day, v]) => ({
      day,
      accuracy: v.sum / v.count,
    })),
    bubbles_data: {
      session_count: bubblesAgg.sessionCount,
      avg_crystals_lit: bubblesAgg.sessionCount > 0
        ? Math.round(bubblesAgg.totalCrystals / bubblesAgg.sessionCount)
        : null,
      accuracy: bubblesAgg.totalTaps > 0
        ? Math.round((bubblesAgg.correctFirstTap / bubblesAgg.totalTaps) * 100) / 100
        : null,
      confused_pairs: Object.entries(bubblesAgg.confusedPairs)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([cat, count]) => ({ cat, count })),
    },
    astro_data: {
      sentences_perfect: astroAgg.sentencesPerfect,
      missed_words: Object.entries(astroAgg.missedWords)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([word, count]) => ({ word, count })),
    },
  });
});

export default router;
