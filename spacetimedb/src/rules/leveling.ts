// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * rules/leveling.ts — XP reward scaling by player-to-enemy level difference.
 * Pure functions: no SpacetimeDB imports, no side effects. The tuning comes in
 * as a parameter (from content/config.json via the reducer module) rather than
 * being read here, so the rules stay independent of the operator's config file
 * and a test can fix the numbers.
 */

import {
  realizes,
  concerns,
  ConTraceables,
  SysTraceables,
  SwTraceables,
} from '../../../src/clew/traceables/clew';

/** The `xp.levelDiffPenalty` block of the server config. */
export interface LevelDiffTuning {
  fullXpWithinLevels: number;
  zeroXpBeyondLevels: number;
  higherLevelBonusCap: number;
}

/**
 * XP scaling by level difference.
 * Killing far-below-level monsters gives almost nothing.
 * Killing above-level monsters gives a modest bonus — deliberately capped,
 * because under permadeath a large bonus would encourage suicidal over-pulling.
 */
export const computeXpReward = concerns(
  SysTraceables.SYS_011_XP_AND_DROP_ELIGIBILITY_SCALE_WITH_THE_ENEMYS_OWN_LEVEL,
  realizes(
    [
      SwTraceables.SW_036_XP_FALLS_OFF_LINEARLY_BETWEEN_THE_FULL_XP_BAND_AND_THE_ZERO_CUTOFF,
      ConTraceables.CON_018_THE_ABOVE_LEVEL_XP_BONUS_IS_CAPPED_SO_OVER_PULLING_NEVER_PAYS,
    ] as const,
    function computeXpReward(
      baseXp: number,
      monsterLevel: number,
      playerLevel: number,
      cfg: LevelDiffTuning,
    ): number {
      const diff = playerLevel - monsterLevel;

      // Monster is at or above player level → bonus, capped
      if (diff <= 0) {
        const bonus =
          1 + Math.min(cfg.higherLevelBonusCap - 1, Math.abs(diff) * 0.1);
        return Math.round(baseXp * bonus);
      }

      // Within the "full XP" band
      if (diff <= cfg.fullXpWithinLevels) return baseXp;

      // Beyond the cutoff → nothing
      if (diff >= cfg.zeroXpBeyondLevels) return 0;

      // Linear falloff between the two thresholds
      const range = cfg.zeroXpBeyondLevels - cfg.fullXpWithinLevels;
      const into = diff - cfg.fullXpWithinLevels;
      return Math.round(baseXp * (1 - into / range));
    },
  ),
);
