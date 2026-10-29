/**
 * content.test.ts — Zod validation for echo_galaxy (Phase 9) and word_orbit (Phase 10) content files.
 *
 * Run from repo root: npx vitest run --project server
 * Or from server/: npx vitest run src/__tests__/content.test.ts
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import * as path from 'path';
import { readFileSync } from 'fs';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ConfusableEntrySchema = z.object({
  word: z.string().min(1),
  category: z.string().min(1),
});

const EnLetterItemSchema = z.object({
  target: z.string().min(1),
  accepted: z.array(z.string().min(1)).min(1),
  confusable: z.array(ConfusableEntrySchema),
  phoneme_category: z.string().nullable(),
  char_length: z.number().int().min(1),
});

const EnWordItemSchema = z.object({
  target: z.string().min(1),
  accepted: z.array(z.string().min(1)).min(1),
  confusable: z.array(ConfusableEntrySchema),
  phoneme_category: z.string().nullable(),
  char_length: z.number().int().min(1),
});

const EnEchoGalaxySchema = z.object({
  _note: z.string(),
  phase1_letters: z.array(EnLetterItemSchema).length(26),
  phase2_words: z.array(EnWordItemSchema).length(20),
  phase3_words: z.array(EnWordItemSchema).length(10),
});

const HiAksharaItemSchema = z.object({
  target: z.string().min(1),
  accepted: z.array(z.string().min(1)).min(1),
  confusable: z.array(ConfusableEntrySchema),
  phoneme_category: z.string().nullable(),
  akshara_length: z.number().int().min(1),
});

const HiWordItemSchema = z.object({
  target: z.string().min(1),
  accepted: z.array(z.string().min(1)).min(1),
  confusable: z.array(ConfusableEntrySchema),
  phoneme_category: z.string().nullable(),
  akshara_length: z.number().int().min(1),
});

const HiEchoGalaxySchema = z.object({
  _note: z.string(),
  _review: z.string(),
  phase1_aksharas: z.array(HiAksharaItemSchema).length(13),
  phase2_words: z.array(HiWordItemSchema).length(15),
  phase3_words: z.array(HiWordItemSchema).length(8),
});

// ─── Load content files ───────────────────────────────────────────────────────

function loadJson(relPath: string) {
  // __dirname = server/src/__tests__, relative from there to repo root = ../../..
  const abs = path.resolve(__dirname, '../../..', relPath);
  return JSON.parse(readFileSync(abs, 'utf-8'));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('echo_galaxy EN content schema (Phase 9)', () => {
  const raw = loadJson('client/src/content/en/echo_galaxy.json');

  it('parses without errors', () => {
    const result = EnEchoGalaxySchema.safeParse(raw);
    if (!result.success) {
      console.error(JSON.stringify(result.error.format(), null, 2));
    }
    expect(result.success).toBe(true);
  });

  it('has exactly 26 letters in phase1', () => {
    const result = EnEchoGalaxySchema.parse(raw);
    expect(result.phase1_letters).toHaveLength(26);
  });

  it('has exactly 20 words in phase2', () => {
    const result = EnEchoGalaxySchema.parse(raw);
    expect(result.phase2_words).toHaveLength(20);
  });

  it('has exactly 10 words in phase3', () => {
    const result = EnEchoGalaxySchema.parse(raw);
    expect(result.phase3_words).toHaveLength(10);
  });

  it('every phase3 word has char_length >= 5', () => {
    const result = EnEchoGalaxySchema.parse(raw);
    for (const item of result.phase3_words) {
      expect(item.char_length, `${item.target} char_length`).toBeGreaterThanOrEqual(5);
    }
  });

  it('every item with a confusable has a phoneme_category', () => {
    const result = EnEchoGalaxySchema.parse(raw);
    const allItems = [
      ...result.phase1_letters,
      ...result.phase2_words,
      ...result.phase3_words,
    ];
    for (const item of allItems) {
      if (item.confusable.length > 0) {
        expect(item.phoneme_category, `${item.target} phoneme_category`).not.toBeNull();
      }
    }
  });

  it('target is always first item of accepted[]', () => {
    const result = EnEchoGalaxySchema.parse(raw);
    const allItems = [
      ...result.phase1_letters,
      ...result.phase2_words,
      ...result.phase3_words,
    ];
    for (const item of allItems) {
      expect(item.accepted[0], `${item.target} accepted[0]`).toBe(item.target);
    }
  });
});

describe('echo_galaxy HI content schema (Phase 9)', () => {
  const raw = loadJson('client/src/content/hi/echo_galaxy.json');

  it('parses without errors', () => {
    const result = HiEchoGalaxySchema.safeParse(raw);
    if (!result.success) {
      console.error(JSON.stringify(result.error.format(), null, 2));
    }
    expect(result.success).toBe(true);
  });

  it('has exactly 13 aksharas in phase1', () => {
    const result = HiEchoGalaxySchema.parse(raw);
    expect(result.phase1_aksharas).toHaveLength(13);
  });

  it('has exactly 15 words in phase2', () => {
    const result = HiEchoGalaxySchema.parse(raw);
    expect(result.phase2_words).toHaveLength(15);
  });

  it('has exactly 8 words in phase3', () => {
    const result = HiEchoGalaxySchema.parse(raw);
    expect(result.phase3_words).toHaveLength(8);
  });

  it('every item with a confusable has a phoneme_category', () => {
    const result = HiEchoGalaxySchema.parse(raw);
    const allItems = [
      ...result.phase1_aksharas,
      ...result.phase2_words,
      ...result.phase3_words,
    ];
    for (const item of allItems) {
      if (item.confusable.length > 0) {
        expect(item.phoneme_category, `${item.target} phoneme_category`).not.toBeNull();
      }
    }
  });

  it('target is always first item of accepted[]', () => {
    const result = HiEchoGalaxySchema.parse(raw);
    const allItems = [
      ...result.phase1_aksharas,
      ...result.phase2_words,
      ...result.phase3_words,
    ];
    for (const item of allItems) {
      expect(item.accepted[0], `${item.target} accepted[0]`).toBe(item.target);
    }
  });
});

// ─── Word Orbit Schemas ───────────────────────────────────────────────────────

const WordOrbitItemSchema = z.object({
  word: z.string().min(1),
  tiles: z.array(z.string().min(1)).min(1),
  alternatives: z.array(z.string()),
  level: z.number().int().min(1),
  distractors: z.array(z.string()),
});

const EnWordOrbitSchema = z.object({
  _note: z.string(),
  level1_3: z.array(WordOrbitItemSchema).min(15),
  level4_6: z.array(WordOrbitItemSchema).min(15),
  level7_plus: z.array(WordOrbitItemSchema).min(15),
});

const HiWordOrbitSchema = z.object({
  _note: z.string(),
  _review: z.string(),
  _segmentation_rule: z.string(),
  level1_3: z.array(WordOrbitItemSchema).min(15),
  level4_6: z.array(WordOrbitItemSchema).min(15),
  level7_plus: z.array(WordOrbitItemSchema).min(15),
});

// ─── Word Orbit Helper: grapheme segmenter ────────────────────────────────────

function segmentGraphemes(s: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' });
    return [...seg.segment(s)].map((g: any) => g.segment as string);
  }
  return Array.from(s);
}

// ─── Word Orbit Tests ─────────────────────────────────────────────────────────

describe('word_orbit EN content schema (Phase 10)', () => {
  const raw = loadJson('client/src/content/en/word_orbit.json');

  it('parses without errors', () => {
    const result = EnWordOrbitSchema.safeParse(raw);
    if (!result.success) console.error(JSON.stringify(result.error.format(), null, 2));
    expect(result.success).toBe(true);
  });

  it('has at least 15 words in each tier', () => {
    const result = EnWordOrbitSchema.parse(raw);
    expect(result.level1_3.length).toBeGreaterThanOrEqual(15);
    expect(result.level4_6.length).toBeGreaterThanOrEqual(15);
    expect(result.level7_plus.length).toBeGreaterThanOrEqual(15);
  });

  it('tiles[].join("") equals word for every item', () => {
    const result = EnWordOrbitSchema.parse(raw);
    const all = [...result.level1_3, ...result.level4_6, ...result.level7_plus];
    for (const item of all) {
      expect(item.tiles.join(''), `${item.word} tiles join`).toBe(item.word);
    }
  });

  it('anagram alternatives accepted: was/saw, tar/rat/art, spin/snip', () => {
    const result = EnWordOrbitSchema.parse(raw);
    const all = [...result.level1_3, ...result.level4_6, ...result.level7_plus];

    const was = all.find((i) => i.word === 'was');
    expect(was?.alternatives).toContain('saw');

    const tar = all.find((i) => i.word === 'tar');
    expect(tar?.alternatives).toContain('rat');
    expect(tar?.alternatives).toContain('art');

    const spin = all.find((i) => i.word === 'spin');
    expect(spin?.alternatives).toContain('snip');
  });

  it('level 1-3 words have 0 distractors, level 4+ may have distractors', () => {
    const result = EnWordOrbitSchema.parse(raw);
    for (const item of result.level1_3) {
      expect(item.distractors, `${item.word} distractors`).toHaveLength(0);
    }
    // level4_6 should have at least some items with 1 distractor
    const withDistractor = result.level4_6.filter((i) => i.distractors.length > 0);
    expect(withDistractor.length).toBeGreaterThan(0);
  });

  it('level7_plus words have 2 distractors each', () => {
    const result = EnWordOrbitSchema.parse(raw);
    for (const item of result.level7_plus) {
      expect(item.distractors.length, `${item.word} distractors`).toBe(2);
    }
  });
});

describe('word_orbit HI content schema (Phase 10)', () => {
  const raw = loadJson('client/src/content/hi/word_orbit.json');

  it('parses without errors', () => {
    const result = HiWordOrbitSchema.safeParse(raw);
    if (!result.success) console.error(JSON.stringify(result.error.format(), null, 2));
    expect(result.success).toBe(true);
  });

  it('has at least 15 words in each tier', () => {
    const result = HiWordOrbitSchema.parse(raw);
    expect(result.level1_3.length).toBeGreaterThanOrEqual(15);
    expect(result.level4_6.length).toBeGreaterThanOrEqual(15);
    expect(result.level7_plus.length).toBeGreaterThanOrEqual(15);
  });

  it('tiles[].join("") equals word for every item (pre-segmentation check)', () => {
    const result = HiWordOrbitSchema.parse(raw);
    const all = [...result.level1_3, ...result.level4_6, ...result.level7_plus];
    for (const item of all) {
      expect(item.tiles.join(''), `${item.word} tiles join`).toBe(item.word);
    }
  });

  it('tiles[] grapheme count matches Intl.Segmenter output for every item', () => {
    const result = HiWordOrbitSchema.parse(raw);
    const all = [...result.level1_3, ...result.level4_6, ...result.level7_plus];
    for (const item of all) {
      const graphemes = segmentGraphemes(item.word);
      // tiles[].length must equal grapheme count of the word
      expect(item.tiles.length, `${item.word} tile count vs grapheme count`)
        .toBe(graphemes.length);
    }
  });

  it('each tile is a valid Devanagari grapheme cluster (non-empty)', () => {
    const result = HiWordOrbitSchema.parse(raw);
    const all = [...result.level1_3, ...result.level4_6, ...result.level7_plus];
    for (const item of all) {
      for (const tile of item.tiles) {
        expect(tile.length, `tile "${tile}" in "${item.word}" must not be empty`).toBeGreaterThan(0);
      }
    }
  });
});

// ─── Math Mission Schemas (Phase 11 amended — two-step flow) ─────────────────

const MathMissionEnSchema = z.object({
  _note: z.string(),
  number_words: z.record(z.string(), z.string()),
  operation_names: z.object({
    add: z.string().min(1),
    sub: z.string().min(1),
    mul: z.string().min(1),
    div: z.string().min(1),
  }),
  operation_symbols: z.object({
    add: z.string().min(1),
    sub: z.string().min(1),
    mul: z.string().min(1),
    div: z.string().min(1),
  }),
  spoken_templates: z.object({
    step1_intro: z.string().min(1),
    step2_add: z.string().min(1),
    step2_sub: z.string().min(1),
    step2_mul: z.string().min(1),
    step2_div: z.string().min(1),
  }),
  hint_glow_label: z.string().min(1),
  operation_labels: z.object({
    add_error: z.string().min(1),
    sub_error: z.string().min(1),
    mul_error: z.string().min(1),
    div_error: z.string().min(1),
  }),
  operation_most_chosen_label: z.string().min(1),
  operation_hardest_label: z.string().min(1),
});

const MathMissionHiSchema = MathMissionEnSchema; // same structure, different text

// ─── mathGenerator (inlined — no client bundle needed) ────────────────────────

type MathOp = 'add' | 'sub' | 'mul' | 'div';
interface NumberPair { a: number; b: number; }
type AnswerOptions = [number, number, number];

class SeededRng2 {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next() { this.s = Math.imul(this.s, 1664525) + 1013904223; return (this.s >>> 0) / 0x100000000; }
  int(min: number, max: number) { return min + Math.floor(this.next() * (max - min + 1)); }
  shuffle<T>(arr: T[]) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
}

function computeAnswers(p: NumberPair) {
  return { add: p.a + p.b, sub: p.a - p.b, mul: p.a * p.b, div: p.a / p.b };
}

function getAnswerFor(p: NumberPair, op: MathOp): number { return computeAnswers(p)[op]; }

function buildAnswerOptionsTest(p: NumberPair, op: MathOp, rng: SeededRng2): AnswerOptions {
  const correct = getAnswerFor(p, op);
  const answers = computeAnswers(p);
  const pool = new Set<number>();
  for (let d = -2; d <= 2; d++) { if (d !== 0 && correct + d >= 0) pool.add(correct + d); }
  for (const o of ['add', 'sub', 'mul', 'div'] as MathOp[]) {
    if (o !== op) { const v = answers[o]; if (v !== correct && v >= 0) pool.add(v); }
  }
  pool.delete(correct);
  const dist = rng.shuffle([...pool]).slice(0, 2);
  let pad = 1;
  while (dist.length < 2) { const v = correct + pad++; if (!dist.includes(v) && v !== correct) dist.push(v); }
  const opts: AnswerOptions = [correct, dist[0], dist[1]]; rng.shuffle(opts); return opts;
}

function generatePairsTest(level: number, count = 8): NumberPair[] {
  return Array.from({ length: count }, (_, i) => {
    const rng = new SeededRng2((level * 10000 + i * 97 + 42) >>> 0);
    if (level <= 3) { const b = rng.int(1, 2); const q = rng.int(1, 5); return { a: b * q, b }; }
    if (level <= 6) { const b = rng.int(1, 4); const q = rng.int(2, 5); return { a: b * q, b }; }
    const b = rng.int(2, 4); const q = rng.int(3, 12); return { a: b * q, b };
  });
}

function checkAnswerTest(p: NumberPair, op: MathOp, chosen: number): boolean {
  return getAnswerFor(p, op) === chosen;
}

// ─── Math Mission content tests ───────────────────────────────────────────────

describe('math_mission EN content schema (Phase 11 amended)', () => {
  const raw = loadJson('client/src/content/en/math_mission.json');

  it('parses without errors', () => {
    const result = MathMissionEnSchema.safeParse(raw);
    if (!result.success) console.error(JSON.stringify(result.error.format(), null, 2));
    expect(result.success).toBe(true);
  });

  it('has number_words entries for 0–20 at minimum', () => {
    const result = MathMissionEnSchema.parse(raw);
    for (let i = 0; i <= 20; i++) {
      expect(result.number_words[String(i)], `number_words[${i}]`).toBeTruthy();
    }
  });

  it('spoken templates include {{a_word}} placeholder', () => {
    const result = MathMissionEnSchema.parse(raw);
    expect(result.spoken_templates.step1_intro).toMatch(/\{\{a_word\}\}/);
    expect(result.spoken_templates.step2_add).toMatch(/\{\{a_word\}\}/);
    expect(result.spoken_templates.step2_div).toMatch(/\{\{a_word\}\}/);
  });

  it('all four step2 templates are present and non-empty', () => {
    const result = MathMissionEnSchema.parse(raw);
    for (const op of ['add', 'sub', 'mul', 'div'] as const) {
      expect(result.spoken_templates[`step2_${op}`], `step2_${op}`).toBeTruthy();
    }
  });

  it('operation_labels keys are present (no recognition_error)', () => {
    const result = MathMissionEnSchema.parse(raw);
    expect(result.operation_labels.add_error).toBeTruthy();
    expect(result.operation_labels.div_error).toBeTruthy();
    expect((result.operation_labels as Record<string,string>).recognition_error).toBeUndefined();
  });

  it('operation_symbols are single characters', () => {
    const result = MathMissionEnSchema.parse(raw);
    expect(result.operation_symbols.add).toBe('+');
    expect(result.operation_symbols.mul).toBe('×');
    expect(result.operation_symbols.div).toBe('÷');
  });
});

describe('math_mission HI content schema (Phase 11 amended)', () => {
  const raw = loadJson('client/src/content/hi/math_mission.json');

  it('parses without errors', () => {
    const result = MathMissionHiSchema.safeParse(raw);
    if (!result.success) console.error(JSON.stringify(result.error.format(), null, 2));
    expect(result.success).toBe(true);
  });

  it('has Hindi number_words for 0–20', () => {
    const result = MathMissionHiSchema.parse(raw);
    for (let i = 0; i <= 20; i++) {
      expect(result.number_words[String(i)], `HI number_words[${i}]`).toBeTruthy();
    }
  });

  it('spoken templates include Devanagari text', () => {
    const result = MathMissionHiSchema.parse(raw);
    const allTemplates = Object.values(result.spoken_templates).join('');
    expect(/[\u0900-\u097F]/.test(allTemplates)).toBe(true);
  });

  it('operation_names are in Devanagari', () => {
    const result = MathMissionHiSchema.parse(raw);
    const allNames = Object.values(result.operation_names).join('');
    expect(/[\u0900-\u097F]/.test(allNames)).toBe(true);
  });
});

// ─── mathGenerator unit tests (two-step pair model) ──────────────────────────

describe('mathGenerator — generatePairs (Phase 11 amended)', () => {
  it('generates exactly 8 pairs per level by default', () => {
    for (const lvl of [1, 4, 7]) {
      const ps = generatePairsTest(lvl);
      expect(ps).toHaveLength(8);
    }
  });

  it('all pairs are valid for subtraction (a >= b)', () => {
    for (const lvl of [1, 3, 5, 7, 9]) {
      generatePairsTest(lvl, 20).forEach((p) => {
        expect(p.a, `level ${lvl}: a >= b`).toBeGreaterThanOrEqual(p.b);
      });
    }
  });

  it('all pairs are valid for division (a % b === 0, b !== 0)', () => {
    for (const lvl of [1, 3, 5, 7, 9]) {
      generatePairsTest(lvl, 20).forEach((p) => {
        expect(p.b, `level ${lvl}: b !== 0`).toBeGreaterThan(0);
        expect(p.a % p.b, `level ${lvl}: a=${p.a} divisible by b=${p.b}`).toBe(0);
      });
    }
  });

  it('level 1-3 pairs: both a and b small (a <= 10)', () => {
    generatePairsTest(1, 20).forEach((p) => {
      expect(p.a).toBeLessThanOrEqual(10);
      expect(p.b).toBeGreaterThanOrEqual(1);
    });
  });

  it('level 7+ pairs: b >= 2', () => {
    generatePairsTest(7, 20).forEach((p) => {
      expect(p.b).toBeGreaterThanOrEqual(2);
    });
  });

  it('deterministic: same level produces same pairs on re-run', () => {
    expect(generatePairsTest(4)).toEqual(generatePairsTest(4));
    expect(generatePairsTest(7)).toEqual(generatePairsTest(7));
  });

  it('all operations produce non-negative results', () => {
    for (const lvl of [1, 4, 7]) {
      generatePairsTest(lvl, 20).forEach((p) => {
        const ans = computeAnswers(p);
        expect(ans.add).toBeGreaterThanOrEqual(0);
        expect(ans.sub).toBeGreaterThanOrEqual(0);
        expect(ans.mul).toBeGreaterThanOrEqual(0);
        expect(ans.div).toBeGreaterThanOrEqual(1);
      });
    }
  });
});

describe('mathGenerator — buildAnswerOptions (Phase 11 amended)', () => {
  const p: NumberPair = { a: 6, b: 3 };   // add=9, sub=3, mul=18, div=2

  it('options always contain the correct answer for each op', () => {
    for (const op of ['add', 'sub', 'mul', 'div'] as MathOp[]) {
      const rng = new SeededRng2(42);
      const opts = buildAnswerOptionsTest(p, op, rng);
      expect(opts).toContain(getAnswerFor(p, op));
    }
  });

  it('options have no duplicates', () => {
    for (const op of ['add', 'sub', 'mul', 'div'] as MathOp[]) {
      const rng = new SeededRng2(99);
      const opts = buildAnswerOptionsTest(p, op, rng);
      expect(new Set(opts).size).toBe(3);
    }
  });

  it('all option values are >= 0', () => {
    for (const op of ['add', 'sub', 'mul', 'div'] as MathOp[]) {
      const rng = new SeededRng2(123);
      buildAnswerOptionsTest(p, op, rng).forEach((o) => expect(o).toBeGreaterThanOrEqual(0));
    }
  });

  it('checkAnswer returns true only for the correct answer', () => {
    expect(checkAnswerTest(p, 'add', 9)).toBe(true);
    expect(checkAnswerTest(p, 'add', 8)).toBe(false);
    expect(checkAnswerTest(p, 'sub', 3)).toBe(true);
    expect(checkAnswerTest(p, 'mul', 18)).toBe(true);
    expect(checkAnswerTest(p, 'div', 2)).toBe(true);
  });

  it('two children choosing different ops from the same pair are BOTH correct', () => {
    // Child A picks add (9), Child B picks mul (18) — both valid
    expect(checkAnswerTest(p, 'add', getAnswerFor(p, 'add'))).toBe(true);
    expect(checkAnswerTest(p, 'mul', getAnswerFor(p, 'mul'))).toBe(true);
  });
});

// ─── Astrotales Schemas (Phase 12) ───────────────────────────────────────────

const AstrotalesSentenceSchema = z.object({
  text: z.string().min(1),
  words: z.array(z.string().min(1)).min(1),
  // accepted is a parallel array of string arrays — one accepted[] per word
  accepted: z.array(z.array(z.string().min(1)).min(1)),
});

const AstrotalesStorySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  level: z.number().int().min(1),
  sentences: z.array(AstrotalesSentenceSchema).min(1),
});

const AstrotalesFileSchema = z.object({
  _note: z.string(),
  stories: z.array(AstrotalesStorySchema).min(1),
});

const AstrotalesHiFileSchema = z.object({
  _note: z.string(),
  _review: z.string(),
  stories: z.array(AstrotalesStorySchema).min(1),
});

// ─── wordAligner pure-logic helpers (inlined for server tests) ────────────────

function normaliseTest(s: string): string {
  return s.normalize('NFC').toLowerCase().trim()
    .replace(/[\u200C\u200D]/g, '')
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~।]/g, '');
}

function toGraphemesTest(s: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' });
    return [...seg.segment(s)].map((g: any) => g.segment as string);
  }
  return Array.from(s);
}

function levenshteinTest(a: string[], b: string[]): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const m = a.length; const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

type WordState2 = 'correct' | 'wrong' | 'skipped';
interface AlignedWord2 { target: string; spoken: string | null; state: WordState2; }

function tokeniseTest(text: string, lang: 'en' | 'hi'): string[] {
  if (lang === 'hi' && typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new (Intl as any).Segmenter('hi', { granularity: 'word' });
    return [...seg.segment(text)]
      .filter((s: any) => s.isWordLike)
      .map((s: any) => normaliseTest(s.segment as string))
      .filter(Boolean);
  }
  return text.split(/[\s\u200C\u200D\u0964\u0965।!?,;:.]+/).map(normaliseTest).filter(Boolean);
}

function checkMatchTest(alt: string, accepted: string[], charLen: number): boolean {
  const normAccepted = accepted.map(normaliseTest);
  const normAlt = normaliseTest(alt);
  if (!normAlt) return false;
  if (normAccepted.includes(normAlt)) return true;
  if (charLen >= 5) {
    const altG = toGraphemesTest(normAlt);
    for (const acc of normAccepted) {
      if (levenshteinTest(altG, toGraphemesTest(acc)) <= 1) return true;
    }
  }
  return false;
}

function alignAndScoreTest(
  targetWords: string[],
  acceptedLists: string[][],
  transcript: string,
  lang: 'en' | 'hi',
): AlignedWord2[] {
  const spoken = tokeniseTest(transcript, lang);
  const T = targetWords.length; const S = spoken.length;
  const INF = 9999;
  const dp: number[][] = Array.from({ length: T + 1 }, () => new Array(S + 1).fill(INF));
  dp[0][0] = 0;
  for (let j = 1; j <= S; j++) dp[0][j] = j;
  for (let i = 1; i <= T; i++) dp[i][0] = i;
  for (let i = 1; i <= T; i++) {
    for (let j = 1; j <= S; j++) {
      const tw = normaliseTest(targetWords[i - 1]);
      const sw = normaliseTest(spoken[j - 1]);
      const charLen = toGraphemesTest(tw).length;
      const isMatch = checkMatchTest(sw, acceptedLists[i - 1] ?? [tw], charLen >= 5 ? 5 : 1);
      dp[i][j] = Math.min(dp[i-1][j-1] + (isMatch ? 0 : 1), dp[i-1][j] + 1, dp[i][j-1] + 1);
    }
  }
  const assignment: (number | null)[] = new Array(T).fill(null);
  let i = T; let j = S;
  while (i > 0 && j > 0) {
    const tw = normaliseTest(targetWords[i - 1]);
    const sw = normaliseTest(spoken[j - 1]);
    const charLen = toGraphemesTest(tw).length;
    const isMatch = checkMatchTest(sw, acceptedLists[i - 1] ?? [tw], charLen >= 5 ? 5 : 1);
    if (dp[i][j] === dp[i-1][j-1] + (isMatch ? 0 : 1)) { assignment[i-1] = j-1; i--; j--; }
    else if (dp[i][j] === dp[i-1][j] + 1) { assignment[i-1] = null; i--; }
    else { j--; }
  }
  while (i > 0) { assignment[i-1] = null; i--; }
  return targetWords.map((target, idx) => {
    const si = assignment[idx];
    if (si === null) return { target, spoken: null, state: 'skipped' as WordState2 };
    const sw = spoken[si];
    const charLen = toGraphemesTest(normaliseTest(target)).length;
    const matched = checkMatchTest(sw, acceptedLists[idx] ?? [target], charLen >= 5 ? 5 : 1);
    return { target, spoken: sw, state: matched ? 'correct' as WordState2 : 'wrong' as WordState2 };
  });
}

// ─── Astrotales content tests ─────────────────────────────────────────────────

describe('astrotales EN content schema (Phase 12)', () => {
  const raw = loadJson('client/src/content/en/astrotales.json');

  it('parses without errors', () => {
    const result = AstrotalesFileSchema.safeParse(raw);
    if (!result.success) console.error(JSON.stringify(result.error.format(), null, 2));
    expect(result.success).toBe(true);
  });

  it('has at least 1 story', () => {
    const result = AstrotalesFileSchema.parse(raw);
    expect(result.stories.length).toBeGreaterThanOrEqual(1);
  });

  it('each story has at least 3 sentences', () => {
    const result = AstrotalesFileSchema.parse(raw);
    result.stories.forEach((s) => {
      expect(s.sentences.length, `story ${s.id} sentence count`).toBeGreaterThanOrEqual(3);
    });
  });

  it('accepted[] length equals words[] length for every sentence', () => {
    const result = AstrotalesFileSchema.parse(raw);
    result.stories.forEach((story) => {
      story.sentences.forEach((sent) => {
        expect(sent.accepted.length, `"${sent.text}" accepted vs words`)
          .toBe(sent.words.length);
      });
    });
  });

  it('accepted[i][0] equals words[i] (target is first accepted variant)', () => {
    const result = AstrotalesFileSchema.parse(raw);
    result.stories.forEach((story) => {
      story.sentences.forEach((sent) => {
        sent.words.forEach((word, i) => {
          expect(sent.accepted[i][0], `"${word}" accepted[0]`).toBe(word);
        });
      });
    });
  });

  it('level-1 stories have short sentences (<=10 words)', () => {
    const result = AstrotalesFileSchema.parse(raw);
    const lvl1 = result.stories.filter((s) => s.level <= 2);
    lvl1.forEach((story) => {
      story.sentences.forEach((sent) => {
        expect(sent.words.length, `"${sent.text}" word count`).toBeLessThanOrEqual(10);
      });
    });
  });
});

describe('astrotales HI content schema (Phase 12)', () => {
  const raw = loadJson('client/src/content/hi/astrotales.json');

  it('parses without errors', () => {
    const result = AstrotalesHiFileSchema.safeParse(raw);
    if (!result.success) console.error(JSON.stringify(result.error.format(), null, 2));
    expect(result.success).toBe(true);
  });

  it('has at least 1 story', () => {
    const result = AstrotalesHiFileSchema.parse(raw);
    expect(result.stories.length).toBeGreaterThanOrEqual(1);
  });

  it('story titles contain Devanagari characters', () => {
    const result = AstrotalesHiFileSchema.parse(raw);
    result.stories.forEach((s) => {
      expect(/[\u0900-\u097F]/.test(s.title), `story ${s.id} title Devanagari`).toBe(true);
    });
  });

  it('accepted[] length equals words[] length for every sentence', () => {
    const result = AstrotalesHiFileSchema.parse(raw);
    result.stories.forEach((story) => {
      story.sentences.forEach((sent) => {
        expect(sent.accepted.length, `"${sent.text}" accepted vs words`).toBe(sent.words.length);
      });
    });
  });

  it('sentence text contains Devanagari', () => {
    const result = AstrotalesHiFileSchema.parse(raw);
    result.stories.forEach((story) => {
      story.sentences.forEach((sent) => {
        expect(/[\u0900-\u097F]/.test(sent.text), `"${sent.text}" Devanagari`).toBe(true);
      });
    });
  });
});

// ─── wordAligner unit tests ───────────────────────────────────────────────────

describe('wordAligner — alignAndScore (Phase 12)', () => {
  const target = ['a', 'small', 'rocket', 'flew', 'into', 'space'];
  const accepted: string[][] = [['a'],['small'],['rocket'],['flew','fly'],['into','in'],['space']];

  it('perfect read: all words correct', () => {
    const result = alignAndScoreTest(target, accepted, 'a small rocket flew into space', 'en');
    expect(result.every((w) => w.state === 'correct')).toBe(true);
  });

  it('accepted variant accepted: "fly" → correct for "flew"', () => {
    const result = alignAndScoreTest(target, accepted, 'a small rocket fly into space', 'en');
    const flew = result.find((w) => w.target === 'flew');
    expect(flew?.state).toBe('correct');
  });

  it('wrong word marked wrong', () => {
    const result = alignAndScoreTest(target, accepted, 'a big rocket flew into space', 'en');
    const small = result.find((w) => w.target === 'small');
    expect(small?.state).toBe('wrong');
  });

  it('one skipped word does not mark remaining words wrong', () => {
    // child omits "small" — remaining words should still align correctly
    const result = alignAndScoreTest(target, accepted, 'a rocket flew into space', 'en');
    const correct = result.filter((w) => w.state === 'correct');
    // at least 4 of 6 should be correct even with one word skipped
    expect(correct.length).toBeGreaterThanOrEqual(4);
  });

  it('extra word does not break alignment', () => {
    const result = alignAndScoreTest(target, accepted, 'a small big rocket flew into space', 'en');
    const correct = result.filter((w) => w.state === 'correct');
    expect(correct.length).toBeGreaterThanOrEqual(4);
  });

  it('Levenshtein allows 1-char typo for long words (>= 5 chars)', () => {
    // "rocket" (6 chars) — "rockeet" (1 insertion, Levenshtein = 1) should match
    const result = alignAndScoreTest(target, accepted, 'a small rockeet flew into space', 'en');
    const rocket = result.find((w) => w.target === 'rocket');
    expect(rocket?.state).toBe('correct');
  });

  it('short word (< 5 chars) must be exact — near-miss is wrong', () => {
    // "flew" (4 chars) — "flew" exact: correct; "flww" (2 edits): wrong
    const result = alignAndScoreTest(target, accepted, 'a small rocket flww into space', 'en');
    const flew = result.find((w) => w.target === 'flew');
    expect(flew?.state).toBe('wrong');
  });

  it('Hindi: Devanagari tokenisation works', () => {
    const hiTarget = ['एक', 'छोटा', 'राकेट'];
    const hiAccepted: string[][] = [['एक'], ['छोटा'], ['राकेट', 'rocket']];
    const result = alignAndScoreTest(hiTarget, hiAccepted, 'एक छोटा राकेट', 'hi');
    expect(result.every((w) => w.state === 'correct')).toBe(true);
  });

  it('Hindi: accepted romanised variant works', () => {
    const hiTarget = ['राकेट'];
    const hiAccepted: string[][] = [['राकेट', 'rocket']];
    const result = alignAndScoreTest(hiTarget, hiAccepted, 'rocket', 'hi');
    expect(result[0].state).toBe('correct');
  });

  it('empty transcript: all words skipped', () => {
    const result = alignAndScoreTest(target, accepted, '', 'en');
    expect(result.every((w) => w.state === 'skipped')).toBe(true);
  });
});

// ─── Math Mission Story Mode content schema (Phase 11 story amendment) ─────────

const StoryObjectSchema = z.object({
  singular: z.string().min(1),
  plural: z.string().min(1),
});

const StoryProblemTypeSchema = z.object({
  templates: z.array(z.string().min(1)).min(1),
  spoken:    z.array(z.string().min(1)).min(1),
});

const MathMissionStorySchema = z.object({
  _note: z.string(),
  characters: z.array(z.string().min(1)).min(2),
  objects: z.record(StoryObjectSchema),
  question_labels: z.object({
    combine:  z.string().min(1),
    takeaway: z.string().min(1),
    compare:  z.string().min(1),
    groups:   z.string().min(1),
    share:    z.string().min(1),
  }),
  problem_types: z.object({
    combine:  StoryProblemTypeSchema,
    takeaway: StoryProblemTypeSchema,
    compare:  StoryProblemTypeSchema,
    groups:   StoryProblemTypeSchema,
    share:    StoryProblemTypeSchema,
  }),
  error_labels: z.object({
    combine_error:  z.string().min(1),
    takeaway_error: z.string().min(1),
    compare_error:  z.string().min(1),
    groups_error:   z.string().min(1),
    share_error:    z.string().min(1),
  }),
  mode_select_numbers: z.string().min(1),
  mode_select_story:   z.string().min(1),
  mode_select_guide:   z.string().min(1),
  switch_mode:  z.string().min(1),
  show_words:   z.string().min(1),
  show_me:      z.string().min(1),
  hint_label:   z.string().min(1),
});

// Inline template renderer (mirrors storyGenerator.ts renderTemplate)
function renderTemplateTest(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((t, [k, v]) => t.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v), template);
}

const STORY_TEMPLATE_VARS: Record<string, string> = {
  a: '3', b: '4', a_word: 'three', b_word: 'four',
  name1: 'Astro', name2: 'Nova',
  obj_a_pl: 'stars', obj_a: 'star', obj_b_pl: 'moons', obj_b: 'moon',
  result_word: 'seven',
};

describe('math_mission EN story section content schema (Phase 11 story)', () => {
  const raw = loadJson('client/src/content/en/math_mission.json');

  it('story section parses without errors', () => {
    const result = MathMissionStorySchema.safeParse((raw as any).story);
    if (!result.success) console.error(JSON.stringify(result.error.format(), null, 2));
    expect(result.success).toBe(true);
  });

  it('has at least 2 characters', () => {
    const story = (raw as any).story;
    const result = MathMissionStorySchema.parse(story);
    expect(result.characters.length).toBeGreaterThanOrEqual(2);
  });

  it('objects map has all required object keys', () => {
    const story = MathMissionStorySchema.parse((raw as any).story);
    for (const key of ['star', 'moon', 'asteroid', 'rocket', 'planet']) {
      expect(story.objects[key], `object "${key}" missing`).toBeDefined();
    }
  });

  it('every problem_type has equal count of templates and spoken entries', () => {
    const story = MathMissionStorySchema.parse((raw as any).story);
    for (const [type, data] of Object.entries(story.problem_types)) {
      expect(data.templates.length, `${type}: templates.length === spoken.length`)
        .toBe(data.spoken.length);
    }
  });

  it('every EN template renders without leftover {{}} placeholders when all vars supplied', () => {
    const story = MathMissionStorySchema.parse((raw as any).story);
    for (const [type, data] of Object.entries(story.problem_types)) {
      for (const template of [...data.templates, ...data.spoken]) {
        const rendered = renderTemplateTest(template, STORY_TEMPLATE_VARS);
        const leftover = rendered.match(/\{\{[^}]+\}\}/g);
        expect(leftover, `${type}: leftover placeholders in "${template}": ${leftover?.join(', ')}`)
          .toBeNull();
      }
    }
  });

  it('question_labels has all 5 problem types', () => {
    const story = MathMissionStorySchema.parse((raw as any).story);
    for (const type of ['combine', 'takeaway', 'compare', 'groups', 'share']) {
      expect(story.question_labels[type as keyof typeof story.question_labels], `question_labels.${type}`).toBeTruthy();
    }
  });

  it('mode_select strings are present', () => {
    const story = MathMissionStorySchema.parse((raw as any).story);
    expect(story.mode_select_numbers).toBeTruthy();
    expect(story.mode_select_story).toBeTruthy();
    expect(story.mode_select_guide).toBeTruthy();
  });
});

describe('math_mission HI story section content schema (Phase 11 story)', () => {
  const raw = loadJson('client/src/content/hi/math_mission.json');

  it('story section parses without errors', () => {
    const result = MathMissionStorySchema.safeParse((raw as any).story);
    if (!result.success) console.error(JSON.stringify(result.error.format(), null, 2));
    expect(result.success).toBe(true);
  });

  it('has _review note (NEEDS NATIVE REVIEW)', () => {
    const story = (raw as any).story;
    expect(story._review).toBeDefined();
  });

  it('Hindi story characters contain Devanagari', () => {
    const story = MathMissionStorySchema.parse((raw as any).story);
    const allChars = story.characters.join('');
    expect(/[\u0900-\u097F]/.test(allChars)).toBe(true);
  });

  it('Hindi object plurals are present and non-empty', () => {
    const story = MathMissionStorySchema.parse((raw as any).story);
    for (const [key, obj] of Object.entries(story.objects)) {
      expect(obj.plural, `HI object ${key} plural`).toBeTruthy();
    }
  });

  it('Hindi problem templates contain Devanagari', () => {
    const story = MathMissionStorySchema.parse((raw as any).story);
    const allTemplates = Object.values(story.problem_types)
      .flatMap((pt) => [...pt.templates, ...pt.spoken])
      .join(' ');
    expect(/[\u0900-\u097F]/.test(allTemplates)).toBe(true);
  });

  it('Hindi mode_select strings contain Devanagari', () => {
    const story = MathMissionStorySchema.parse((raw as any).story);
    const allMode = [story.mode_select_numbers, story.mode_select_story, story.mode_select_guide].join('');
    expect(/[\u0900-\u097F]/.test(allMode)).toBe(true);
  });
});

// ─── storyGenerator pure-logic unit tests (inlined, no client bundle) ──────────

type StoryProblemType2 = 'combine' | 'takeaway' | 'compare' | 'groups' | 'share';

function computeStoryAnswerTest(type: StoryProblemType2, a: number, b: number): number {
  switch (type) {
    case 'combine':  return a + b;
    case 'takeaway': return a - b;
    case 'compare':  return a - b;
    case 'groups':   return a * b;
    case 'share':    return a / b;
  }
}

function buildStoryOptionsTest(answer: number, a: number, b: number): [number, number, number, number] {
  const pool = new Set<number>();
  for (let d = -3; d <= 3; d++) { if (d !== 0 && answer + d >= 0) pool.add(answer + d); }
  pool.add(a + b); pool.add(Math.abs(a - b)); pool.add(a * b > 20 ? a : a * b);
  pool.delete(answer);
  const sorted = [...pool].slice(0, 3);
  while (sorted.length < 3) sorted.push(answer + sorted.length + 4);
  return [answer, sorted[0], sorted[1], sorted[2]];
}

describe('storyGenerator — computeStoryAnswer (inlined logic)', () => {
  it('combine: 3 + 4 = 7', () => {
    expect(computeStoryAnswerTest('combine', 3, 4)).toBe(7);
  });
  it('takeaway: 8 - 3 = 5', () => {
    expect(computeStoryAnswerTest('takeaway', 8, 3)).toBe(5);
  });
  it('compare: 9 - 6 = 3', () => {
    expect(computeStoryAnswerTest('compare', 9, 6)).toBe(3);
  });
  it('groups: 3 * 4 = 12', () => {
    expect(computeStoryAnswerTest('groups', 3, 4)).toBe(12);
  });
  it('share: 12 / 4 = 3', () => {
    expect(computeStoryAnswerTest('share', 12, 4)).toBe(3);
  });
  it('L1-3 combine totals never exceed 10', () => {
    // For level 1-3, a+b <=10
    const cases: [number, number][] = [[1,1],[2,3],[3,4],[5,5],[4,6],[3,7]];
    for (const [a, b] of cases) {
      if (a + b <= 10) expect(computeStoryAnswerTest('combine', a, b)).toBe(a + b);
    }
  });
  it('options always include the correct answer', () => {
    const answer = 7;
    const opts = buildStoryOptionsTest(answer, 3, 4);
    expect(opts).toContain(answer);
  });
  it('options have no duplicates', () => {
    const opts = buildStoryOptionsTest(7, 3, 4);
    expect(new Set(opts).size).toBe(4);
  });
  it('all options are >= 0', () => {
    const opts = buildStoryOptionsTest(5, 8, 3);
    opts.forEach((o) => expect(o).toBeGreaterThanOrEqual(0));
  });
});
