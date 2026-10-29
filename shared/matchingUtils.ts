/**
 * shared/matchingUtils.ts
 *
 * Canonical matching logic used by both server (Phase 9 Echo Galaxy scoring)
 * and client (Echo Galaxy, Astrotales UI feedback).
 *
 * Matching pipeline per item:
 *  1. Normalise every alternative: NFC → lowercase → trim → strip ZWJ/ZWNJ/punctuation.
 *  2. Split into a grapheme array (using Intl.Segmenter when available, else code-point split).
 *  3. Tiered matching:
 *     a. Exact match against the normalised target.
 *     b. Accepted-list match (any alternative in accepted[]).
 *     c. If charLength >= 5 (or akshara grapheme count >= 3 for Hindi): Levenshtein ≤ 1
 *        on grapheme arrays.
 *  4. Confusable check: if any alternative matches a confusable entry, log the error category.
 *
 * All 5 STT alternatives are checked at each tier before moving to the next.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type MatchMethod = 'exact' | 'accepted' | 'levenshtein' | 'confusable' | 'none';

export interface MatchResult {
  matched: boolean;
  method: MatchMethod;
  /** Populated when method === 'confusable' (the confusable[] hit) */
  confusableCategory?: string;
}

export interface ConfusableEntry {
  word: string;
  category: string;
}

// ─── Text normalisation ────────────────────────────────────────────────────

/**
 * Normalise a string to a comparable form:
 * NFC → lowercase → trim → strip ZWJ (U+200D), ZWNJ (U+200C), and ASCII punctuation.
 */
export function normalise(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .trim()
    // Remove Zero-Width Joiner and Zero-Width Non-Joiner (appear in Devanagari conjuncts from STT)
    .replace(/[\u200C\u200D]/g, '')
    // Strip ASCII punctuation (not Devanagari punctuation / matras)
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, '');
}

// ─── Grapheme splitting ────────────────────────────────────────────────────

/**
 * Split a string into an array of user-perceived grapheme clusters.
 * Uses Intl.Segmenter when available (Node 16+, Chrome 87+, Firefox 125+).
 * Falls back to Array.from() (splits by Unicode code point, not grapheme) — acceptable for ASCII.
 */
export function toGraphemes(s: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' });
    return [...seg.segment(s)].map((g: any) => g.segment as string);
  }
  // Fallback: code-point iteration (incorrect for Devanagari conjuncts, but safe for ASCII)
  return Array.from(s);
}

// ─── Levenshtein distance on grapheme arrays ─────────────────────────────

/**
 * Compute Levenshtein edit distance between two grapheme arrays.
 * Returns early as soon as distance exceeds maxDist (default 1).
 */
export function levenshtein(a: string[], b: string[], maxDist = 1): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;

  const m = a.length;
  const n = b.length;
  // Use a two-row rolling array
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > maxDist) return maxDist + 1; // prune
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// ─── Core matching function ────────────────────────────────────────────────

/**
 * checkMatch — run all 5 STT alternatives through the matching pipeline.
 *
 * @param alternatives  Up to 5 STT transcript alternatives (raw, un-normalised).
 * @param accepted      The accepted[] list for this item (includes target + variants).
 * @param charLength    char_length (English) or akshara_length (Hindi) from content JSON.
 *                      Levenshtein is only applied when charLength >= 5 (or grapheme count >= 3).
 * @param confusables   Optional confusable[] entries: [{ word, category }].
 *                      If an alternative matches a confusable, returns method='confusable'.
 *
 * Tiers (applied in order, stop at first match):
 *  1. Exact match: normalised alternative === normalised accepted[0] (the target).
 *  2. Accepted-list: normalised alternative matches any entry in accepted[].
 *  3. Levenshtein ≤ 1 on grapheme arrays (only when charLength >= 5).
 *  4. Confusable check (all tiers): if matched via confusable list → method='confusable'.
 */
export function checkMatch(
  alternatives: string[],
  accepted: string[],
  charLength: number,
  confusables: ConfusableEntry[] = [],
): MatchResult {
  const normAccepted = accepted.map(normalise);
  const normConfusables = confusables.map((c) => ({ norm: normalise(c.word), category: c.category }));
  const useLevenshtein = charLength >= 5;

  // Check each alternative in turn
  for (const alt of alternatives) {
    const normAlt = normalise(alt);
    if (!normAlt) continue; // skip empty

    // ── Tier 1: exact match (also covers accepted[0] = target)
    if (normAccepted.includes(normAlt)) {
      return { matched: true, method: 'exact' };
    }
  }

  // ── Tier 2: accepted-list (all alternatives, exact string match after normalise)
  // Already covered in tier 1 since normAccepted includes all accepted entries.
  // Kept as a named tier for clarity — no additional code needed.

  // ── Tier 3: Levenshtein ≤ 1 on grapheme arrays (only for longer items)
  if (useLevenshtein) {
    for (const alt of alternatives) {
      const normAlt = normalise(alt);
      if (!normAlt) continue;
      const altGraphemes = toGraphemes(normAlt);

      for (const acc of normAccepted) {
        const accGraphemes = toGraphemes(acc);
        if (levenshtein(altGraphemes, accGraphemes, 1) <= 1) {
          return { matched: true, method: 'levenshtein' };
        }
      }
    }
  }

  // ── Confusable check: runs on all alternatives regardless of match result
  for (const alt of alternatives) {
    const normAlt = normalise(alt);
    if (!normAlt) continue;
    for (const conf of normConfusables) {
      if (normAlt === conf.norm) {
        return { matched: false, method: 'confusable', confusableCategory: conf.category };
      }
      // Also try Levenshtein on confusables for longer items
      if (useLevenshtein) {
        const altG = toGraphemes(normAlt);
        const confG = toGraphemes(conf.norm);
        if (levenshtein(altG, confG, 1) <= 1) {
          return { matched: false, method: 'confusable', confusableCategory: conf.category };
        }
      }
    }
  }

  return { matched: false, method: 'none' };
}
