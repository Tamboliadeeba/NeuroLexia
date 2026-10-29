/**
 * seedDemoChild.ts
 *
 * Shared function used by:
 *   - POST /api/children/demo  (HTTP endpoint, runtime)
 *   - npm run seed:demo        (CLI seed script)
 *
 * Creates a demo child under `parentId` with ~4 weeks of realistic game
 * session data across 4 games. Idempotent: if a demo child already exists
 * under this parent, returns it without re-seeding.
 *
 * Data model:
 *   - Trip to Space, Echo Galaxy, Word Orbit, Math Mission
 *   - ~4 weeks (28 days back from today), 1-3 sessions/day, some days off
 *   - Accuracy improves over time (week 1: 0.50-0.65, week 4: 0.75-0.92)
 *   - Error categories: c_k_swap, i_e_swap, b_d_reversal, vowel_length, sight_word
 *   - Some sessions with self_reported_count > 0
 *   - metadata: hints_used (stored as part of metadata), tutorial_replays
 *   - Unlocks: mercury + venus owned; enough balance for mars
 *   - At least 3 verified (non-self-reported) sessions per game
 */

import { PrismaClient, type Prisma } from '@prisma/client';

const GAME_TYPES = ['trip_to_space', 'echo_galaxy', 'word_orbit', 'math_mission'] as const;
type GameType = typeof GAME_TYPES[number];

const ERROR_CATEGORIES = ['c_k_swap', 'i_e_swap', 'b_d_reversal', 'vowel_length', 'sight_word'];

/** Deterministic pseudo-random from a seed (LCG) */
function seeded(s: number) {
  let state = s;
  return () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    return Math.abs(state) / 2147483647;
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Build a date offset by `daysBack` days from today, at a given hour */
function daysAgo(days: number, hour = 14, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

interface SessionSpec {
  game_type: GameType;
  daysBack: number;
  level: number;
  totalMoves: number;
  wrongMoves: number;
  selfReported: number;
  tutorialReplays: number;
  hintsUsed: number;
  errors: Record<string, number>;
}

function buildSessions(rng: () => number): SessionSpec[] {
  const specs: SessionSpec[] = [];

  // 28 days, 4 games. Each game gets a session on ~60% of days (some days off).
  // Accuracy improves linearly from week 1 to week 4.
  const DAYS = 28;

  for (const game of GAME_TYPES) {
    let level = 1;
    let sessionCount = 0;

    for (let dayBack = DAYS; dayBack >= 0; dayBack--) {
      // ~40% chance of a day off per game
      if (rng() < 0.4) continue;

      // 1-2 sessions per active day
      const sessionsToday = rng() < 0.3 ? 2 : 1;
      for (let s = 0; s < sessionsToday; s++) {
        // Week index (0=oldest, 3=newest)
        const weekIdx = Math.floor((DAYS - dayBack) / 7);
        const baseAcc = 0.48 + weekIdx * 0.12; // 0.48 → 0.84
        const acc = clamp(baseAcc + (rng() - 0.5) * 0.14, 0.38, 0.95);

        const totalMoves = Math.round(12 + rng() * 20);
        const wrongMoves = Math.round(totalMoves * (1 - acc));
        const selfReported = rng() < 0.18 ? Math.round(rng() * 3) + 1 : 0;
        const tutorialReplays = sessionCount === 0 ? Math.round(rng() * 2) : 0;
        const hintsUsed = Math.round(rng() * 3);

        // Error distribution — more errors early on
        const errBudget = wrongMoves + Math.round(rng() * 4);
        const errors: Record<string, number> = {};
        let remaining = errBudget;
        for (const cat of ERROR_CATEGORIES) {
          if (remaining <= 0) break;
          if (rng() < 0.6) {
            const n = Math.min(remaining, Math.round(rng() * 3) + 1);
            errors[cat] = n;
            remaining -= n;
          }
        }

        specs.push({
          game_type: game,
          daysBack: dayBack,
          level,
          totalMoves,
          wrongMoves: Math.min(wrongMoves, totalMoves),
          selfReported,
          tutorialReplays,
          hintsUsed,
          errors,
        });

        // Occasionally level up
        sessionCount++;
        if (sessionCount % 3 === 0) level = Math.min(level + 1, 8);
      }
    }
  }

  return specs;
}

function computePoints(level: number, totalMoves: number, wrongMoves: number): number {
  const acc = totalMoves > 0 ? (totalMoves - wrongMoves) / totalMoves : 1;
  return Math.max(5, level * 10 + Math.floor(acc * 20));
}

export interface SeedDemoChildResult {
  childId: string;
  alreadyExisted: boolean;
}

export async function seedDemoChild(
  prisma: PrismaClient,
  parentId: string,
  preferredLanguage: 'en' | 'hi' = 'en',
): Promise<SeedDemoChildResult> {
  // Idempotency: if a demo child already exists under this parent, return it.
  const existing = await prisma.child.findFirst({
    where: { parent_id: parentId, is_demo: true },
    select: { id: true },
  });
  if (existing) {
    return { childId: existing.id, alreadyExisted: true };
  }

  // Find the "astro" character
  const astroChar = await prisma.character.findUnique({
    where: { key: 'astro' },
    select: { id: true },
  });

  // Build session specs with a deterministic seed so the data is always the same shape
  const rng = seeded(0xdeadbeef);
  const specs = buildSessions(rng);

  // Compute points totals
  let totalPoints = 0;
  for (const s of specs) {
    totalPoints += computePoints(s.level, s.totalMoves, s.wrongMoves);
  }
  const pointsBalance = Math.max(0, totalPoints - 150); // simulate spending some

  // Build the child + sessions in a single transaction
  const child = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Create child
    const newChild = await tx.child.create({
      data: {
        parent_id: parentId,
        name: 'Demo Child',
        age: 7,
        preferred_language: preferredLanguage,
        preferred_font: 'opendyslexic',
        is_demo: true,
        character_id: astroChar?.id ?? null,
        total_points: totalPoints,
        points_balance: pointsBalance,
      },
      select: { id: true },
    });

    const childId = newChild.id;

    // 2. Create game sessions (with unique client_session_id per record)
    let idx = 0;
    for (const spec of specs) {
      const started = daysAgo(spec.daysBack, 14 + (idx % 4), (idx * 7) % 60);
      const ended = new Date(started.getTime() + (spec.totalMoves * 4 + 30) * 1000);
      const acc = spec.totalMoves > 0
        ? (spec.totalMoves - spec.wrongMoves) / spec.totalMoves
        : 1.0;
      const pts = computePoints(spec.level, spec.totalMoves, spec.wrongMoves);

      await tx.gameSession.create({
        data: {
          child_id: childId,
          game_type: spec.game_type,
          client_session_id: `demo-seed-${childId}-${idx}`,
          started_at: started,
          ended_at: ended,
          level: spec.level,
          score: Math.round(acc * 100),
          points_earned: pts,
          accuracy: spec.selfReported > 0 ? null : acc,
          attempts: spec.totalMoves,
          errors: spec.errors as Prisma.InputJsonValue,
          self_reported_count: spec.selfReported,
          metadata: {
            total_moves: spec.totalMoves,
            wrong_moves: spec.wrongMoves,
            completion_time_ms: (spec.totalMoves * 4 + 30) * 1000,
            tutorial_replays: spec.tutorialReplays,
            hints_used: spec.hintsUsed,
          } as Prisma.InputJsonValue,
        },
      });
      idx++;
    }

    // 3. Upsert game progress (use the highest level reached per game)
    for (const game of GAME_TYPES) {
      const gameSessions = specs.filter((s) => s.game_type === game);
      const maxLevel = gameSessions.reduce((m, s) => Math.max(m, s.level), 1);
      await tx.childGameProgress.upsert({
        where: { child_id_game_type: { child_id: childId, game_type: game } },
        create: { child_id: childId, game_type: game, current_level: maxLevel + 1, phase: 1 },
        update: { current_level: maxLevel + 1 },
      });
    }

    // 4. Unlocks — mercury + venus
    const unlockKeys = ['mercury', 'venus'];
    for (const key of unlockKeys) {
      await tx.unlock.create({
        data: {
          child_id: childId,
          unlock_type: 'planet',
          unlock_key: key,
          unlocked_at: daysAgo(20),
        },
      });
    }

    return newChild;
  });

  return { childId: child.id, alreadyExisted: false };
}
