/**
 * starRating.ts — Shared star-rating computation for NeuroLexia.
 *
 * computeStars(gameType, mode, metrics) → 0 | 1 | 2 | 3
 *
 * Rules (all thresholds in STAR_THRESHOLDS):
 *  1. Sound Bubbles (echo_galaxy mode:'bubbles'): based on crystals_lit / 8.
 *  2. All other games: based on accuracy (correct / total, or provided value).
 *  3. Hint modifier: if hints_used > floor(question_count / 2) → drop 1 star (min 0).
 *  4. Self-reported sessions (accuracy === null): cap at 2 stars maximum.
 *
 * IMPORTANT: This module must be imported on the SERVER for the authoritative
 * star calculation.  The client may import it too for optimistic display, but
 * the value stored in the database always comes from the server computation.
 *
 * Game accuracy formulas:
 *   trip_to_space  : valid_moves / total_moves   (total - wrong) / total
 *   echo_galaxy    : verified_correct / verified_attempts
 *   astrotales     : correct_words / verified_words
 *   word_orbit     : first_try_solves / words_total
 *   math_mission   : correct_first_try / questions_answered  (both modes)
 *   echo_galaxy/bubbles: crystals_lit out of MAX_CRYSTALS (8)
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum crystals in a Sound Bubbles round. */
export const BUBBLES_MAX_CRYSTALS = 8;

/**
 * Accuracy thresholds for general star rating.
 * `min` is inclusive, `max` is exclusive (except for 3-star which is `>=`).
 *
 * Stars | Accuracy range
 * ------|--------------------
 *   3   | >= 0.85  (85%+)
 *   2   | 0.60 – 0.849...  (60–84%)
 *   1   | 0.30 – 0.599...  (30–59%)
 *   0   | < 0.30            (below 30%)
 */
export const ACCURACY_THRESHOLDS: ReadonlyArray<{ stars: 0 | 1 | 2 | 3; minAccuracy: number }> = [
  { stars: 3, minAccuracy: 0.85 },
  { stars: 2, minAccuracy: 0.60 },
  { stars: 1, minAccuracy: 0.30 },
  { stars: 0, minAccuracy: 0.00 },
] as const;

/**
 * Crystal thresholds for Sound Bubbles mode.
 *
 * Crystals lit | Stars
 * -------------|------
 *   6–8        |  3
 *   4–5        |  2
 *   2–3        |  1
 *   0–1        |  0
 */
export const BUBBLES_THRESHOLDS: ReadonlyArray<{ stars: 0 | 1 | 2 | 3; minCrystals: number }> = [
  { stars: 3, minCrystals: 6 },
  { stars: 2, minCrystals: 4 },
  { stars: 1, minCrystals: 2 },
  { stars: 0, minCrystals: 0 },
] as const;

/** Maximum stars a self-reported (accuracy === null) session can earn. */
export const SELF_REPORTED_STAR_CAP = 2;

/**
 * Hint modifier rule: if `hints_used > floor(question_count / 2)`
 * then drop 1 star (minimum 0).
 * The question_count is the number of items the hints could apply to.
 */
export const HINT_MODIFIER_FRACTION = 0.5; // > 50% of questions had hints

// ─── Types ────────────────────────────────────────────────────────────────────

export type GameType =
  | 'trip_to_space'
  | 'echo_galaxy'
  | 'astrotales'
  | 'word_orbit'
  | 'math_mission';

export interface StarMetrics {
  /**
   * Pre-computed accuracy (0.0–1.0) OR null for self-reported sessions.
   * When null the session is treated as self-reported and capped at 2 stars.
   *
   * For Sound Bubbles pass null for accuracy and supply crystals_lit instead.
   */
  accuracy: number | null;

  /**
   * Number of hints used.  Used for the hint modifier.
   * Omit or pass 0 when hints are not applicable.
   */
  hints_used?: number;

  /**
   * Total number of questions / items (used for the hint modifier denominator).
   * Omit or pass 0 when hints are not applicable.
   */
  question_count?: number;

  /**
   * For Sound Bubbles only: number of crystals lit (0–8).
   * Overrides accuracy-based calculation when mode is 'bubbles'.
   */
  crystals_lit?: number;

  /**
   * Game mode string (e.g. 'bubbles', 'numbers', 'story').
   * Used to route Sound Bubbles to the crystal-based path.
   */
  mode?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function starsFromAccuracy(accuracy: number): 0 | 1 | 2 | 3 {
  for (const threshold of ACCURACY_THRESHOLDS) {
    if (accuracy >= threshold.minAccuracy) return threshold.stars;
  }
  return 0;
}

function starsFromCrystals(crystals: number): 0 | 1 | 2 | 3 {
  for (const threshold of BUBBLES_THRESHOLDS) {
    if (crystals >= threshold.minCrystals) return threshold.stars;
  }
  return 0;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Compute the star rating (0–3) for a completed game session.
 *
 * @param gameType   - One of the five game types.
 * @param metrics    - Accuracy, hints, crystals, etc.  See StarMetrics.
 * @returns          - Integer 0, 1, 2, or 3.
 */
export function computeStars(
  gameType: GameType,
  metrics: StarMetrics,
): 0 | 1 | 2 | 3 {
  const isSoundBubbles =
    gameType === 'echo_galaxy' && metrics.mode === 'bubbles';
  const isSelfReported = metrics.accuracy === null && !isSoundBubbles;

  // ── Step 1: base star count ────────────────────────────────────────────────

  let stars: 0 | 1 | 2 | 3;

  if (isSoundBubbles) {
    const crystals = metrics.crystals_lit ?? 0;
    stars = starsFromCrystals(crystals);
  } else if (isSelfReported) {
    // Self-reported: default to 1 star (partial credit) before the cap
    stars = 1;
  } else {
    const accuracy = metrics.accuracy ?? 0;
    stars = starsFromAccuracy(accuracy);
  }

  // ── Step 2: hint modifier ──────────────────────────────────────────────────

  if (!isSoundBubbles) {
    const hintsUsed = metrics.hints_used ?? 0;
    const questionCount = metrics.question_count ?? 0;

    if (hintsUsed > 0 && questionCount > 0) {
      const hintsUsedFraction = hintsUsed / questionCount;
      if (hintsUsedFraction > HINT_MODIFIER_FRACTION) {
        stars = Math.max(0, stars - 1) as 0 | 1 | 2 | 3;
      }
    }
  }

  // ── Step 3: self-reported cap ─────────────────────────────────────────────

  if (isSelfReported) {
    stars = Math.min(stars, SELF_REPORTED_STAR_CAP) as 0 | 1 | 2 | 3;
  }

  return stars;
}
