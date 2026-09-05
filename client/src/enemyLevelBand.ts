import { realizes, SwTraceables } from '../../src/clew/traceables/clew';

/**
 * enemyLevelBand.ts — how an enemy's level reads against the local character's.
 *
 * Extracted from GameScene as plain TypeScript so the decision can be unit
 * tested; the Scene only paints the colour this returns (005-testing-contract
 * §2, "pure calculation with no Phaser dependency").
 */

export type LevelBand = 'trivial' | 'even' | 'tough' | 'dangerous';

/** Colours match the usual MMO reading: grey trivial → red lethal. */
export const LEVEL_BAND_COLOR: Record<LevelBand, string> = {
  trivial: '#888888',
  even: '#ffffff',
  tough: '#ffcc00',
  dangerous: '#ff4444',
};

/**
 * Classify an enemy by how far above the player it is.
 *   3+ below  → trivial (grey; little or no XP)
 *   within 2  → even (white)
 *   1–3 above → tough (yellow)
 *   4+ above  → dangerous (red)
 */
export const classifyEnemyLevel = realizes(
  SwTraceables.SW_038_ENEMY_LEVEL_RENDERS_COLOURED_BY_RELATIVE_DIFFICULTY_AND_ZERO_READS_NO_XP,
  function classifyEnemyLevel(
    enemyLevel: number,
    playerLevel: number,
  ): LevelBand {
    const above = enemyLevel - playerLevel;
    if (above >= 4) return 'dangerous';
    if (above >= 1) return 'tough';
    if (above >= -2) return 'even';
    return 'trivial';
  },
);

export function enemyLevelColor(
  enemyLevel: number,
  playerLevel: number,
): string {
  return LEVEL_BAND_COLOR[classifyEnemyLevel(enemyLevel, playerLevel)];
}
