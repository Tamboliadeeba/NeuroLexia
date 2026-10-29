/**
 * pointsFormula.ts
 *
 * Server-side points computation for all games.
 * Called inside the /api/child/sessions transaction.
 *
 * Formula:
 *   base      = level * 10
 *   accuracy  = valid_moves / total_moves  (clamped 0–1)
 *   bonus     = Math.floor(accuracy * 20)
 *   points    = base + bonus  (min 5)
 */

export interface PointsInput {
  level: number;
  total_moves: number;
  wrong_moves: number;
}

export function computePoints(input: PointsInput): number {
  const { level, total_moves, wrong_moves } = input;
  const valid_moves = Math.max(0, total_moves - wrong_moves);
  const accuracy = total_moves > 0 ? valid_moves / total_moves : 1;
  const base = level * 10;
  const bonus = Math.floor(accuracy * 20);
  return Math.max(5, base + bonus);
}
