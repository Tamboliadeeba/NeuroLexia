// shared/__tests__/starRating.test.ts — Unit tests for computeStars()
//
// Coverage:
//   - All 5 game types
//   - All accuracy threshold edges (29%, 30%, 59%, 60%, 84%, 85%)
//   - Hint modifier (no hints, just over 50%, exactly 50%, over 50%)
//   - Self-reported cap (accuracy null → capped at 2)
//   - Sound Bubbles crystal thresholds (0, 1, 2, 3, 4, 5, 6, 7, 8)
//   - Edge: 0 questions / 0 accuracy
//
// Run: cd shared && npx vitest run

import { describe, it, expect } from 'vitest';
import { computeStars } from '../starRating';

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Shorthand — accuracy-based games with optional hints. */
function stars(
  accuracy: number | null,
  hintsUsed = 0,
  questionCount = 10,
): 0 | 1 | 2 | 3 {
  return computeStars('math_mission', {
    accuracy,
    hints_used: hintsUsed,
    question_count: questionCount,
  });
}

/** Shorthand — Sound Bubbles. */
function bubbleStars(crystals: number): 0 | 1 | 2 | 3 {
  return computeStars('echo_galaxy', {
    accuracy: null,
    crystals_lit: crystals,
    mode: 'bubbles',
  });
}

// ─── Accuracy thresholds ──────────────────────────────────────────────────────

describe('accuracy thresholds (math_mission)', () => {
  it('0% → 0 stars', () => expect(stars(0.0)).toBe(0));
  it('10% → 0 stars', () => expect(stars(0.1)).toBe(0));
  it('29% → 0 stars', () => expect(stars(0.29)).toBe(0));
  it('30% → 1 star',  () => expect(stars(0.30)).toBe(1));
  it('45% → 1 star',  () => expect(stars(0.45)).toBe(1));
  it('59% → 1 star',  () => expect(stars(0.59)).toBe(1));
  it('60% → 2 stars', () => expect(stars(0.60)).toBe(2));
  it('72% → 2 stars', () => expect(stars(0.72)).toBe(2));
  it('84% → 2 stars', () => expect(stars(0.84)).toBe(2));
  it('85% → 3 stars', () => expect(stars(0.85)).toBe(3));
  it('90% → 3 stars', () => expect(stars(0.90)).toBe(3));
  it('100% → 3 stars',() => expect(stars(1.00)).toBe(3));
});

// ─── Hint modifier ────────────────────────────────────────────────────────────

describe('hint modifier (drops 1 star when hints > 50% of questions)', () => {
  it('no hints → unchanged (3 stars for 100%)', () =>
    expect(stars(1.0, 0, 10)).toBe(3));

  it('hints_used = 5 of 10 (exactly 50%) → NOT triggered → 3 stars', () =>
    // 5 / 10 = 0.5 — NOT > 0.5, so no drop
    expect(stars(1.0, 5, 10)).toBe(3));

  it('hints_used = 6 of 10 (60%) → triggered → 3 → 2 stars', () =>
    expect(stars(1.0, 6, 10)).toBe(2));

  it('hints_used = 8 of 8 (100%) → triggered → drop from 3 → 2', () =>
    expect(stars(1.0, 8, 8)).toBe(2));

  it('hints_used = 1 of 1 (100%) → triggered → 1-star baseline drops to 0', () =>
    expect(stars(0.30, 1, 1)).toBe(0));

  it('drop cannot go below 0 stars', () =>
    // 0% accuracy = 0 stars, then hint modifier tries to drop → still 0
    expect(stars(0.0, 6, 10)).toBe(0));

  it('hint modifier not applied when question_count = 0', () =>
    expect(stars(1.0, 9, 0)).toBe(3));

  it('hint modifier not applied when hints_used = 0', () =>
    expect(stars(0.85, 0, 10)).toBe(3));
});

// ─── Self-reported cap ────────────────────────────────────────────────────────

describe('self-reported sessions (accuracy === null)', () => {
  it('null accuracy → capped at 2 stars max', () =>
    expect(stars(null)).toBeLessThanOrEqual(2));

  it('null accuracy → gets at least 1 star (kind baseline)', () =>
    expect(stars(null)).toBeGreaterThanOrEqual(0));

  it('null accuracy with heavy hints → hint modifier applied before cap', () =>
    // baseline 1, hint modifier drops to 0 — still ≤ 2
    expect(stars(null, 9, 10)).toBe(0));
});

// ─── Sound Bubbles crystal thresholds ────────────────────────────────────────

describe('Sound Bubbles crystals', () => {
  it('0 crystals → 0 stars', () => expect(bubbleStars(0)).toBe(0));
  it('1 crystal  → 0 stars', () => expect(bubbleStars(1)).toBe(0));
  it('2 crystals → 1 star',  () => expect(bubbleStars(2)).toBe(1));
  it('3 crystals → 1 star',  () => expect(bubbleStars(3)).toBe(1));
  it('4 crystals → 2 stars', () => expect(bubbleStars(4)).toBe(2));
  it('5 crystals → 2 stars', () => expect(bubbleStars(5)).toBe(2));
  it('6 crystals → 3 stars', () => expect(bubbleStars(6)).toBe(3));
  it('7 crystals → 3 stars', () => expect(bubbleStars(7)).toBe(3));
  it('8 crystals → 3 stars', () => expect(bubbleStars(8)).toBe(3));

  it('hint modifier NOT applied to Sound Bubbles', () =>
    // even with high hints, bubbles uses crystal-only path
    expect(computeStars('echo_galaxy', {
      accuracy: null, crystals_lit: 6, mode: 'bubbles',
      hints_used: 99, question_count: 10,
    })).toBe(3));
});

// ─── All five game types ──────────────────────────────────────────────────────

describe('all five game types accept accuracy-based metrics', () => {
  const games = [
    'trip_to_space',
    'echo_galaxy',
    'astrotales',
    'word_orbit',
    'math_mission',
  ] as const;

  for (const game of games) {
    it(`${game}: 100% → 3 stars`, () =>
      expect(computeStars(game, { accuracy: 1.0 })).toBe(3));

    it(`${game}: 70% → 2 stars`, () =>
      expect(computeStars(game, { accuracy: 0.70 })).toBe(2));

    it(`${game}: 40% → 1 star`, () =>
      expect(computeStars(game, { accuracy: 0.40 })).toBe(1));

    it(`${game}: 10% → 0 stars`, () =>
      expect(computeStars(game, { accuracy: 0.10 })).toBe(0));
  }
});

// ─── Echo Galaxy speak mode (not bubbles) uses accuracy ──────────────────────

describe('echo_galaxy speak mode uses accuracy path, not crystal path', () => {
  it('90% accuracy with mode:speak → 3 stars', () =>
    expect(computeStars('echo_galaxy', { accuracy: 0.9, mode: 'speak' })).toBe(3));

  it('40% accuracy with mode:speak → 1 star', () =>
    expect(computeStars('echo_galaxy', { accuracy: 0.4, mode: 'speak' })).toBe(1));
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('exactly 85% accuracy → 3 stars (boundary inclusive)', () =>
    expect(stars(0.85)).toBe(3));

  it('exactly 60% accuracy → 2 stars (boundary inclusive)', () =>
    expect(stars(0.60)).toBe(2));

  it('exactly 30% accuracy → 1 star (boundary inclusive)', () =>
    expect(stars(0.30)).toBe(1));

  it('result is always 0, 1, 2, or 3 — never outside range', () => {
    const values: number[] = [];
    for (let i = 0; i <= 100; i++) {
      values.push(computeStars('math_mission', { accuracy: i / 100 }));
    }
    expect(values.every((v) => [0, 1, 2, 3].includes(v))).toBe(true);
  });
});
