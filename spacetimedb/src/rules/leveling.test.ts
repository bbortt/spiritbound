// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { describe, it, expect } from 'vitest';
import {
  computeXpReward,
  computeKillXpReward,
  type LevelDiffTuning,
} from './leveling';
import {
  verifies,
  ConTraceables,
  SwTraceables,
} from '../../../src/clew/traceables/clew';

/** The shipped content/config.json values, restated so the test is hermetic. */
const CFG: LevelDiffTuning = {
  fullXpWithinLevels: 2,
  zeroXpBeyondLevels: 8,
  higherLevelBonusCap: 1.5,
};

const BASE = 25;

verifies(
  SwTraceables.SW_036_XP_FALLS_OFF_LINEARLY_BETWEEN_THE_FULL_XP_BAND_AND_THE_ZERO_CUTOFF,
  () => {
    describe('computeXpReward', () => {
      it('awards base XP at equal levels', () => {
        expect(computeXpReward(BASE, 5, 5, CFG)).toBe(BASE);
      });

      it('awards a bonus for a monster three levels above the player', () => {
        // diff = -3 → 1 + min(0.5, 0.3) = 1.3
        expect(computeXpReward(BASE, 8, 5, CFG)).toBe(Math.round(BASE * 1.3));
      });

      it('awards full XP while the player is inside the full-XP band', () => {
        expect(computeXpReward(BASE, 4, 5, CFG)).toBe(BASE); // diff 1
        expect(computeXpReward(BASE, 3, 5, CFG)).toBe(BASE); // diff 2, band edge
      });

      it('awards nothing once the player is at or past the cutoff', () => {
        expect(computeXpReward(BASE, 2, 10, CFG)).toBe(0); // diff 8, exactly the cutoff
        expect(computeXpReward(BASE, 2, 20, CFG)).toBe(0); // diff 18, far past
      });

      it('awards a partial reward strictly between zero and base mid-band', () => {
        // diff 5 → 3 levels into a 6-level band → 50 % of base
        const reward = computeXpReward(BASE, 5, 10, CFG);
        expect(reward).toBeGreaterThan(0);
        expect(reward).toBeLessThan(BASE);
        expect(reward).toBe(Math.round(BASE * 0.5));
      });

      it('falls off monotonically across the band', () => {
        const rewards = [3, 4, 5, 6, 7].map((diff) =>
          computeXpReward(BASE, 10, 10 + diff, CFG),
        );
        for (let i = 1; i < rewards.length; i++) {
          expect(rewards[i]).toBeLessThan(rewards[i - 1]);
        }
      });

      it('never returns a negative reward, at any level difference', () => {
        for (let playerLevel = 1; playerLevel <= 50; playerLevel++) {
          for (let monsterLevel = 1; monsterLevel <= 50; monsterLevel++) {
            expect(
              computeXpReward(BASE, monsterLevel, playerLevel, CFG),
            ).toBeGreaterThanOrEqual(0);
          }
        }
      });
    });
  },
);

verifies(
  ConTraceables.CON_018_THE_ABOVE_LEVEL_XP_BONUS_IS_CAPPED_SO_OVER_PULLING_NEVER_PAYS,
  () => {
    describe('CON-018 — the above-level bonus cap', () => {
      it('never exceeds the configured cap, however far above the monster is', () => {
        const capped = Math.round(BASE * CFG.higherLevelBonusCap);
        expect(computeXpReward(BASE, 20, 1, CFG)).toBe(capped);
        expect(computeXpReward(BASE, 50, 1, CFG)).toBe(capped);
      });

      it('reaches the cap exactly at the level difference the rate implies', () => {
        // 0.1 per level → the 1.5 cap is reached at 5 levels above.
        expect(computeXpReward(BASE, 6, 1, CFG)).toBe(
          Math.round(BASE * CFG.higherLevelBonusCap),
        );
        expect(computeXpReward(BASE, 5, 1, CFG)).toBe(Math.round(BASE * 1.4));
      });

      it('honours a stricter cap when the operator configures one', () => {
        const strict: LevelDiffTuning = { ...CFG, higherLevelBonusCap: 1.1 };
        expect(computeXpReward(BASE, 30, 1, strict)).toBe(
          Math.round(BASE * 1.1),
        );
      });
    });
  },
);

/** Hollow Vale's ceiling, as content/zones.json authors it. */
const ZONE_MAX = 10;

verifies(
  SwTraceables.SW_050_XP_GRANT_RETURNS_ZERO_AT_OR_ABOVE_THE_ZONES_MAX_LEVEL,
  () => {
    describe('computeKillXpReward', () => {
      it('grants nothing at the zone ceiling, or above it', () => {
        // Both kills would pay full base XP on the level-gap curve alone —
        // the zero here can only be the ceiling.
        expect(computeXpReward(BASE, ZONE_MAX, ZONE_MAX, CFG)).toBe(BASE);
        expect(
          computeKillXpReward(BASE, ZONE_MAX, ZONE_MAX, ZONE_MAX, CFG),
        ).toBe(0);
        expect(
          computeKillXpReward(BASE, ZONE_MAX, ZONE_MAX + 5, ZONE_MAX, CFG),
        ).toBe(0);
      });

      it('leaves the reward untouched one level below the ceiling', () => {
        const playerLevel = ZONE_MAX - 1;
        for (const monsterLevel of [1, 5, 9, 12]) {
          expect(
            computeKillXpReward(BASE, monsterLevel, playerLevel, ZONE_MAX, CFG),
          ).toBe(computeXpReward(BASE, monsterLevel, playerLevel, CFG));
        }
      });

      it('applies no ceiling at all when the zone is unknown', () => {
        expect(
          computeKillXpReward(BASE, ZONE_MAX, ZONE_MAX + 5, undefined, CFG),
        ).toBe(computeXpReward(BASE, ZONE_MAX, ZONE_MAX + 5, CFG));
      });

      it('keeps the two zeros separable — a below-cap zero is still the level gap', () => {
        // Nine levels above a level-1 mob, but under a maxLevel-20 ceiling:
        // zero because of the gap, with the ceiling never reached.
        expect(computeKillXpReward(BASE, 1, 9, 20, CFG)).toBe(0);
        expect(computeXpReward(BASE, 1, 9, CFG)).toBe(0);
      });
    });
  },
);
