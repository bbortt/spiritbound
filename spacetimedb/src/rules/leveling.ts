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

/**
 * The reward a kill actually grants, zone ceiling included.
 *
 * A zone's level range is a design boundary: once the killer is at or above
 * the zone's max level they have out-levelled the place entirely and earn
 * nothing there, however juicy the individual mob. That decision is taken
 * here, ahead of computeXpReward and independent of its level-gap falloff, so
 * "the zone is finished with you" and "this mob is beneath you" stay two
 * separate zeros rather than one indistinguishable one — the client renders
 * different text for each.
 *
 * `zoneMaxLevel` is optional because the caller reads it off a zone row that
 * may not resolve; an unknown zone applies no ceiling and the reward falls
 * through to the plain level-gap curve.
 */
export const computeKillXpReward = concerns(
  SysTraceables.SYS_011_XP_AND_DROP_ELIGIBILITY_SCALE_WITH_THE_ENEMYS_OWN_LEVEL,
  realizes(
    SwTraceables.SW_050_XP_GRANT_RETURNS_ZERO_AT_OR_ABOVE_THE_ZONES_MAX_LEVEL,
    function computeKillXpReward(
      baseXp: number,
      monsterLevel: number,
      playerLevel: number,
      zoneMaxLevel: number | undefined,
      cfg: LevelDiffTuning,
    ): number {
      if (zoneMaxLevel !== undefined && playerLevel >= zoneMaxLevel) return 0;
      return computeXpReward(baseXp, monsterLevel, playerLevel, cfg);
    },
  ),
);
