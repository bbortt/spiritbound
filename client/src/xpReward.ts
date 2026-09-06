// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { realizes, ArchTraceables } from '../../src/clew/traceables/clew';

/**
 * xpReward.ts — client duplicate of the server's XP reward curve.
 *
 * Duplicated byte-for-byte from spacetimedb/src/rules/leveling.ts, together
 * with the `xp` block of content/config.json, because the floating "+N XP"
 * text needs the value that was actually granted and the enemy row no longer
 * carries it (the reward now depends on the killer's level, so it is not row
 * state). Same hand-synced-duplicate decision as levelCurve.ts and
 * handSlots.ts. Keep both copies in sync by hand.
 */

export interface LevelDiffTuning {
  fullXpWithinLevels: number;
  zeroXpBeyondLevels: number;
  higherLevelBonusCap: number;
}

/** Mirrors content/config.json → xp. Re-copy when an operator retunes it. */
export const XP_CONFIG: { baseMonsterXp: number; levelDiff: LevelDiffTuning } =
  {
    baseMonsterXp: 25,
    levelDiff: {
      fullXpWithinLevels: 2,
      zeroXpBeyondLevels: 8,
      higherLevelBonusCap: 1.5,
    },
  };

export const computeXpReward = realizes(
  ArchTraceables.ARCH_011_THE_CLIENT_DUPLICATES_COMPUTE_XP_REWARD_TO_RENDER_THE_FLOATING_NUMBER,
  function computeXpReward(
    baseXp: number,
    monsterLevel: number,
    playerLevel: number,
    cfg: LevelDiffTuning,
  ): number {
    const diff = playerLevel - monsterLevel;

    if (diff <= 0) {
      const bonus =
        1 + Math.min(cfg.higherLevelBonusCap - 1, Math.abs(diff) * 0.1);
      return Math.round(baseXp * bonus);
    }

    if (diff <= cfg.fullXpWithinLevels) return baseXp;
    if (diff >= cfg.zeroXpBeyondLevels) return 0;

    const range = cfg.zeroXpBeyondLevels - cfg.fullXpWithinLevels;
    const into = diff - cfg.fullXpWithinLevels;
    return Math.round(baseXp * (1 - into / range));
  },
);

/** The reward a kill on this enemy would grant the local character. */
export function rewardForKill(
  monsterLevel: number,
  playerLevel: number,
): number {
  return computeXpReward(
    XP_CONFIG.baseMonsterXp,
    monsterLevel,
    playerLevel,
    XP_CONFIG.levelDiff,
  );
}
