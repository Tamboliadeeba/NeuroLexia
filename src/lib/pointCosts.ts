/**
 * pointCosts.ts — canonical unlock costs (server-side only).
 *
 * The client NEVER provides costs; the server always reads from here.
 * unlock_type is derived from the key prefix group.
 */

export type UnlockKey =
  | 'mercury' | 'venus' | 'earth' | 'mars'
  | 'jupiter' | 'saturn' | 'uranus' | 'neptune'
  | 'aurora' | 'void';

export const POINT_COSTS: Record<UnlockKey, number> = {
  // Planets (in solar-system order)
  mercury: 10,
  venus:   30,
  earth:   40,
  mars:    60,
  jupiter: 80,
  saturn:  100,
  uranus:  120,
  neptune: 140,
  // Bonus themes
  aurora:  80,
  void:    150,
} as const;

export const PLANET_KEYS: ReadonlySet<string> = new Set([
  'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune',
]);
export const THEME_KEYS:  ReadonlySet<string> = new Set(['aurora', 'void']);

export const ALL_UNLOCK_KEYS = Object.keys(POINT_COSTS) as UnlockKey[];

/** Returns 'planet' | 'theme' for valid keys, null otherwise. */
export function unlockTypeFromKey(key: string): 'planet' | 'theme' | null {
  if (PLANET_KEYS.has(key)) return 'planet';
  if (THEME_KEYS.has(key))  return 'theme';
  return null;
}
