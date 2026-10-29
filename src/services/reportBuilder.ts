/**
 * reportBuilder.ts
 *
 * Aggregates game_sessions for a child over a period into a structured
 * data blob used to build the watsonx.ai prompt.
 *
 * Data gate: fewer than 3 verified sessions total → returns insufficient_data.
 * Pseudonymisation: only age is included; name/id never enters the prompt.
 */

import prisma from '../lib/prisma';

export const ERROR_LABELS: Record<string, string> = {
  c_k_swap:       'confusing C and K sounds',
  i_e_swap:       'mixing I and E sounds',
  b_d_reversal:   'confusing B and D letters',
  b_d_swap:       'confusing B and D letters',
  b_p_swap:       'confusing B and P letters',
  m_n_swap:       'confusing M and N sounds',
  w_v_swap:       'mixing W and V sounds',
  p_q_swap:       'confusing P and Q letters',
  vowel_length:   'vowel length errors',
  sight_word:     'difficulty with sight words',
};

export const ERROR_LABELS_HI: Record<string, string> = {
  c_k_swap:       'क/स की ध्वनि में भ्रम',
  i_e_swap:       'इ/ए की ध्वनि में भ्रम',
  b_d_reversal:   'ब/ड अक्षर में भ्रम',
  b_d_swap:       'ब/ड अक्षर में भ्रम',
  b_p_swap:       'ब/प अक्षर में भ्रम',
  m_n_swap:       'म/न की ध्वनि में भ्रम',
  w_v_swap:       'व/ब की ध्वनि में भ्रम',
  p_q_swap:       'प/क्यू अक्षर में भ्रम',
  vowel_length:   'स्वर की लंबाई में त्रुटि',
  sight_word:     'दृश्य शब्दों में कठिनाई',
};

function humanLabel(key: string, lang: 'en' | 'hi'): string {
  const map = lang === 'hi' ? ERROR_LABELS_HI : ERROR_LABELS;
  return map[key] ?? (lang === 'hi' ? key : key.replace(/_/g, ' '));
}

export interface ReportInput {
  age: number;
  periodStart: Date;
  periodEnd: Date;
  lang: 'en' | 'hi';
  games: {
    key: string;
    label: string;
    verifiedSessions: number;
    avgAccuracy: number | null;
    levelsReached: number;
    hintsUsed: number;
    replays: number;
    selfReported: number;
    topErrors: { label: string; count: number }[];
    storySessionCount?: number;
    storyAccuracy?: number | null;
    hardestStoryType?: string | null;
  }[];
  topWeakAreas: string[];
  totalVerifiedSessions: number;
}

export type BuildResult =
  | { insufficient_data: true }
  | { insufficient_data: false; input: ReportInput; prompt: { system: string; user: string } };

const GAME_LABELS: Record<string, string> = {
  trip_to_space: 'Trip to Space',
  echo_galaxy:   'Echo Galaxy',
  word_orbit:    'Word Orbit',
  math_mission:  'Math Mission',
  astrotales:    'Astrotales',
};
const GAME_LABELS_HI: Record<string, string> = {
  trip_to_space: 'अंतरिक्ष यात्रा',
  echo_galaxy:   'इको गैलेक्सी',
  word_orbit:    'वर्ड ऑर्बिट',
  math_mission:  'मैथ मिशन',
  astrotales:    'एस्ट्रोटेल्स',
};

export async function buildReportInput(
  childId: string,
  childAge: number,
  periodStart: Date,
  periodEnd: Date,
  lang: 'en' | 'hi',
): Promise<BuildResult> {
  const sessions = await prisma.gameSession.findMany({
    where: {
      child_id: childId,
      ended_at: { gte: periodStart, lte: periodEnd },
    },
    select: {
      game_type: true,
      accuracy: true,
      level: true,
      self_reported_count: true,
      errors: true,
      metadata: true,
    },
  });

  const verified = sessions.filter(
    (s) => s.self_reported_count === 0 && s.accuracy !== null,
  );

  if (verified.length < 3) {
    return { insufficient_data: true };
  }

  const gameKeys = ['trip_to_space', 'echo_galaxy', 'word_orbit', 'math_mission', 'astrotales'] as const;
  const gLabels = lang === 'hi' ? GAME_LABELS_HI : GAME_LABELS;

  const gameData = gameKeys
    .map((key) => {
      const gs = sessions.filter((s) => s.game_type === key);
      if (gs.length === 0) return null;

      const verifiedGs = gs.filter(
        (s) => s.self_reported_count === 0 && s.accuracy !== null,
      );
      const avgAcc =
        verifiedGs.length > 0
          ? verifiedGs.reduce((s, r) => s + (r.accuracy ?? 0), 0) / verifiedGs.length
          : null;
      const maxLevel = gs.reduce((m, s) => Math.max(m, s.level), 1);

      let hintsUsed = 0;
      let replays = 0;
      const errorCounts: Record<string, number> = {};

      // Story mode stats (math_mission only)
      let storySessionCount = 0;
      let storyCorrectFirstTry = 0;
      let storyTotalQ = 0;
      const storyErrorCounts: Record<string, number> = {};

      for (const s of gs) {
        const meta = s.metadata as Record<string, unknown> | null;
        if (meta) {
          hintsUsed += Number(meta.hints_used ?? 0);
          replays   += Number(meta.tutorial_replays ?? 0);

          // Extract story mode data
          if (key === 'math_mission' && meta.mode === 'story') {
            storySessionCount += 1;
            storyTotalQ += Number(meta.total_moves ?? 0);
            const correct = Number(meta.total_moves ?? 0) - Number(meta.wrong_moves ?? 0);
            storyCorrectFirstTry += correct;
          }
        }
        const errs = s.errors as Record<string, number> | null;
        if (errs) {
          for (const [cat, cnt] of Object.entries(errs)) {
            errorCounts[cat] = (errorCounts[cat] ?? 0) + cnt;
            if (key === 'math_mission') {
              // story error keys end in _error (combine_error, takeaway_error, etc.)
              if (['combine_error','takeaway_error','compare_error','groups_error','share_error'].includes(cat)) {
                storyErrorCounts[cat] = (storyErrorCounts[cat] ?? 0) + Number(cnt);
              }
            }
          }
        }
      }

      const topErrors = Object.entries(errorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([cat, count]) => ({ label: humanLabel(cat, lang), count }));

      // Hardest story problem type
      const hardestStoryType = Object.entries(storyErrorCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

      return {
        key,
        label: gLabels[key] ?? key,
        verifiedSessions: verifiedGs.length,
        avgAccuracy: avgAcc,
        levelsReached: maxLevel,
        hintsUsed,
        replays,
        selfReported: gs.reduce((s, r) => s + r.self_reported_count, 0),
        topErrors,
        // story extras (only populated for math_mission)
        storySessionCount,
        storyAccuracy: storyTotalQ > 0 ? Math.round((storyCorrectFirstTry / storyTotalQ) * 100) : null,
        hardestStoryType,
      };
    })
    .filter(Boolean) as ReportInput['games'];

  // Top weak areas across all games
  const allErrors: Record<string, number> = {};
  for (const s of sessions) {
    const errs = s.errors as Record<string, number> | null;
    if (errs) {
      for (const [cat, cnt] of Object.entries(errs)) {
        allErrors[cat] = (allErrors[cat] ?? 0) + cnt;
      }
    }
  }
  const topWeakAreas = Object.entries(allErrors)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat]) => humanLabel(cat, lang));

  const input: ReportInput = {
    age: childAge,
    periodStart,
    periodEnd,
    lang,
    games: gameData,
    topWeakAreas,
    totalVerifiedSessions: verified.length,
  };

  const prompt = buildPrompt(input);
  return { insufficient_data: false, input, prompt };
}

function buildPrompt(input: ReportInput): { system: string; user: string } {
  const { age, periodStart, periodEnd, lang, games, topWeakAreas } = input;
  const isHindi = lang === 'hi';

  const system = [
    'You are a supportive child education specialist writing a compassionate progress note for a parent of a child aged ' + age + ' working on literacy and numeracy.',
    `Write in ${isHindi ? 'Hindi' : 'English'}.`,
    isHindi ? 'Write entirely in Devanagari Hindi script.' : '',
    'Use simple, non-clinical language.',
    'Structure your response with exactly these section headers on their own lines: SUMMARY, WEAK_AREAS, ACTIVITIES.',
    isHindi ? 'Target approximately 200 words (about 1000 tokens).' : 'Maximum 300 words total.',
    'ACTIVITIES must contain exactly 3 practical offline items.',
    'IMPORTANT: Do NOT provide a medical diagnosis. If you observe persistent difficulties, recommend consulting a qualified specialist.',
  ].filter(Boolean).join('\n');

  const gameLines = games.map((g) => {
    const acc = g.avgAccuracy != null ? `${Math.round(g.avgAccuracy * 100)}% accuracy` : 'no verified data';
    const errors = g.topErrors.length
      ? `errors: ${g.topErrors.map((e) => e.label).join(', ')}`
      : '';
    const extras = [
      `hints used: ${g.hintsUsed}`,
      g.selfReported > 0 ? `self-reported: ${g.selfReported}` : '',
    ].filter(Boolean).join(', ');
    let storyLine = '';
    if (g.key === 'math_mission' && g.storySessionCount && g.storySessionCount > 0) {
      storyLine = `story problems: ${g.storySessionCount} sessions, accuracy ${g.storyAccuracy != null ? g.storyAccuracy + '%' : 'n/a'}`;
      if (g.hardestStoryType) storyLine += `, hardest type: ${g.hardestStoryType.replace('_error', '')}`;
    }
    return `- ${g.label}: ${acc}, levels reached: ${g.levelsReached}${errors ? ', ' + errors : ''}${extras ? ', ' + extras : ''}${storyLine ? ', ' + storyLine : ''}`;
  }).join('\n');

  const user = [
    `Child age: ${age}.`,
    `Period: ${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}.`,
    'Game performance summary:',
    gameLines,
    topWeakAreas.length ? `Top weak areas: ${topWeakAreas.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  return { system, user };
}
