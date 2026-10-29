/**
 * server/src/__tests__/pointsFormula.test.ts
 *
 * Unit tests for server/src/lib/pointsFormula.ts — Phase 14 step 8.
 *
 * Formula:
 *   base      = level * 10
 *   accuracy  = valid_moves / total_moves  (clamped 0–1)
 *   bonus     = Math.floor(accuracy * 20)
 *   points    = max(5, base + bonus)
 *
 * Tests cover (per plan):
 *  - level 1 / 4 / 7 base point tiers
 *  - zero verified attempts (total_moves = 0 → accuracy assumed 1.0)
 *  - all-self-reported case (wrong_moves = total_moves → accuracy = 0)
 *  - cap enforcement (result always ≥ 5)
 *  - Mercury planet costs only 10 pts → level 1 session award < 10+20=30, so
 *    at level 1 with perfect accuracy = 10+20 = 30 > 10 ✓
 */

import { describe, it, expect } from 'vitest';
import { computePoints } from '../lib/pointsFormula';

describe('computePoints — level tiers', () => {
  it('level 1 with perfect accuracy: base=10, bonus=20 → 30', () => {
    expect(computePoints({ level: 1, total_moves: 10, wrong_moves: 0 })).toBe(30);
  });

  it('level 4 with perfect accuracy: base=40, bonus=20 → 60', () => {
    expect(computePoints({ level: 4, total_moves: 10, wrong_moves: 0 })).toBe(60);
  });

  it('level 7 with perfect accuracy: base=70, bonus=20 → 90', () => {
    expect(computePoints({ level: 7, total_moves: 10, wrong_moves: 0 })).toBe(90);
  });

  it('level 1 with 50% accuracy: base=10, bonus=10 → 20', () => {
    expect(computePoints({ level: 1, total_moves: 10, wrong_moves: 5 })).toBe(20);
  });

  it('level 4 with 50% accuracy: base=40, bonus=10 → 50', () => {
    expect(computePoints({ level: 4, total_moves: 10, wrong_moves: 5 })).toBe(50);
  });

  it('level 7 with 50% accuracy: base=70, bonus=10 → 80', () => {
    expect(computePoints({ level: 7, total_moves: 10, wrong_moves: 5 })).toBe(80);
  });
});

describe('computePoints — zero total_moves (no moves recorded)', () => {
  it('total_moves=0 → accuracy assumed 1.0 → level 1 returns 30', () => {
    // total_moves=0 means the child had a trivial session or no moves logged;
    // accuracy defaults to 1.0 to avoid penalising for missing data.
    expect(computePoints({ level: 1, total_moves: 0, wrong_moves: 0 })).toBe(30);
  });

  it('total_moves=0 → accuracy=1.0 → level 4 returns 60', () => {
    expect(computePoints({ level: 4, total_moves: 0, wrong_moves: 0 })).toBe(60);
  });
});

describe('computePoints — all wrong (all-self-reported case)', () => {
  it('all moves wrong → accuracy=0 → level 1: base=10, bonus=0 → 10', () => {
    expect(computePoints({ level: 1, total_moves: 10, wrong_moves: 10 })).toBe(10);
  });

  it('all moves wrong → accuracy=0 → level 4: base=40, bonus=0 → 40', () => {
    expect(computePoints({ level: 4, total_moves: 10, wrong_moves: 10 })).toBe(40);
  });

  it('all moves wrong → accuracy=0 → level 7: base=70, bonus=0 → 70', () => {
    expect(computePoints({ level: 7, total_moves: 10, wrong_moves: 10 })).toBe(70);
  });
});

describe('computePoints — minimum cap (result always >= 5)', () => {
  it('very low result still returns at least 5', () => {
    // Level 0 would give 0 base — but level is always >= 1 in real calls.
    // Test the clamp directly with an edge scenario.
    // With level=1 and worst accuracy, result=10 which already > 5.
    // The cap exists for safety; verify it's active by injecting level=0 (not
    // normally possible from Zod validation but tests the guard).
    const result = computePoints({ level: 0, total_moves: 10, wrong_moves: 10 });
    expect(result).toBeGreaterThanOrEqual(5);
  });

  it('level 1 worst case is 10 — well above minimum 5', () => {
    const result = computePoints({ level: 1, total_moves: 100, wrong_moves: 100 });
    expect(result).toBeGreaterThanOrEqual(5);
    expect(result).toBe(10); // base=10, bonus=0
  });
});

describe('computePoints — Mercury planet threshold check', () => {
  // Mercury costs 10 pts. Even a level 1 session with all wrong moves
  // awards 10 pts. So a child can always afford Mercury after 1 session.
  it('level 1 all-wrong session awards exactly 10 — enough for Mercury (cost 10)', () => {
    const pts = computePoints({ level: 1, total_moves: 10, wrong_moves: 10 });
    expect(pts).toBeGreaterThanOrEqual(10); // 10 >= 10 → can buy Mercury
  });

  it('level 1 perfect session awards 30 — enough for Mercury (cost 10) and Venus (cost 30)', () => {
    const pts = computePoints({ level: 1, total_moves: 10, wrong_moves: 0 });
    expect(pts).toBeGreaterThanOrEqual(30); // combined cost = 40, but single session = 30
  });
});

describe('computePoints — accuracy clamping', () => {
  it('clamps accuracy to 0 when wrong_moves > total_moves', () => {
    // Guards against bad data where wrong_moves was miscounted
    const pts = computePoints({ level: 1, total_moves: 5, wrong_moves: 10 });
    // valid_moves = max(0, 5-10) = 0 → accuracy = 0 → bonus = 0 → 10
    expect(pts).toBe(10);
  });

  it('accuracy is exactly 1.0 when no wrong moves', () => {
    const pts = computePoints({ level: 2, total_moves: 20, wrong_moves: 0 });
    // base=20, bonus=floor(1.0*20)=20 → 40
    expect(pts).toBe(40);
  });
});
