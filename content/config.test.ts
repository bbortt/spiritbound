import { describe, it, expect } from 'vitest';
import { validateConfig, parseConfig } from './validateConfig';
import { loadConfig } from './configLoader';
import { XP_CONFIG } from '../client/src/xpReward';
import {
  verifies,
  ArchTraceables,
  ConTraceables,
  SwTraceables,
} from '../src/clew/traceables/clew';

const config = loadConfig();

/** The shipped config as plain data, ready to mutate into a violation. */
function mutable(): any {
  return JSON.parse(JSON.stringify(config));
}

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;

function sumWeights(weights: Record<string, number>): number {
  return RARITIES.reduce((total, rarity) => total + weights[rarity], 0);
}

describe('server config — the shipped file', () => {
  it('passes schema validation', () => {
    expect(validateConfig(config)).toEqual({ valid: true, errors: [] });
  });

  it('has rarity weights summing to 1.0 for both categories', () => {
    expect(sumWeights(config.dropRates.cards.rarityWeights)).toBeCloseTo(1, 10);
    expect(sumWeights(config.dropRates.gear.rarityWeights)).toBeCloseTo(1, 10);
  });

  it('keeps the shipped XP band ordered', () => {
    expect(config.xp.levelDiffPenalty.fullXpWithinLevels).toBeLessThan(
      config.xp.levelDiffPenalty.zeroXpBeyondLevels,
    );
  });
});

/**
 * Trash mobs never drop legendaries — those are reserved for bosses and the
 * dungeon tiers (BALANCE.md). Moving the weights into an operator-editable file
 * put out of the schema's reach, so this test is what holds the
 * invariant for the values this repository actually ships.
 */
verifies(ConTraceables.CON_004_LEGENDARY_DROP_WEIGHT_IS_ZERO, () => {
  describe('CON-004 — legendary weight in the shipped config', () => {
    it('is zero for both drop categories', () => {
      expect(config.dropRates.cards.rarityWeights.legendary).toBe(0);
      expect(config.dropRates.gear.rarityWeights.legendary).toBe(0);
    });
  });
});

/**
 * The schema allows up to 3.0; the shipped value stays at 1.5 so fighting up is
 * worthwhile without making a suicidal over-pull the fastest progression in a
 * permadeath game.
 */
verifies(
  ConTraceables.CON_018_THE_ABOVE_LEVEL_XP_BONUS_IS_CAPPED_SO_OVER_PULLING_NEVER_PAYS,
  () => {
    describe('CON-018 — the shipped above-level bonus cap', () => {
      it('is at most 1.5 and never below 1.0', () => {
        expect(
          config.xp.levelDiffPenalty.higherLevelBonusCap,
        ).toBeLessThanOrEqual(1.5);
        expect(
          config.xp.levelDiffPenalty.higherLevelBonusCap,
        ).toBeGreaterThanOrEqual(1);
      });
    });
  },
);

verifies(
  SwTraceables.SW_031_RARITY_WEIGHTS_MUST_SUM_TO_ONE_AND_THE_ERROR_NAMES_THE_ACTUAL_SUM,
  () => {
    describe('SW-031 — rarity weight sum', () => {
      it('rejects a table summing to 0.9 and names the actual sum', () => {
        const broken = mutable();
        broken.dropRates.cards.rarityWeights = {
          common: 0.6,
          uncommon: 0.25,
          rare: 0.02,
          epic: 0.03,
          legendary: 0,
        };

        const { valid, errors } = validateConfig(broken);
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(/must sum to 1\.0 \(got 0\.9\d*\)/);
      });

      it('rejects a table summing to more than one', () => {
        const broken = mutable();
        broken.dropRates.gear.rarityWeights.epic = 0.3;
        const { valid, errors } = validateConfig(broken);
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(/must sum to 1\.0 \(got 1\.2\d*\)/);
      });

      it('rejects an individual weight outside 0.0–1.0', () => {
        const tooBig = mutable();
        tooBig.dropRates.gear.rarityWeights.common = 1.5;
        expect(validateConfig(tooBig).valid).toBe(false);

        const negative = mutable();
        negative.dropRates.cards.baseChance = -0.1;
        expect(validateConfig(negative).valid).toBe(false);
      });
    });
  },
);

verifies(
  SwTraceables.SW_032_THE_XP_LEVEL_BAND_MUST_BE_ORDERED_AND_THE_BONUS_CAP_BOUNDED,
  () => {
    describe('SW-032 — XP band and bonus cap bounds', () => {
      it('rejects a band whose edges are equal or inverted', () => {
        const equal = mutable();
        equal.xp.levelDiffPenalty.fullXpWithinLevels = 8;
        equal.xp.levelDiffPenalty.zeroXpBeyondLevels = 8;
        const { valid, errors } = validateConfig(equal);
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(
          /must be less than zeroXpBeyondLevels/,
        );

        const inverted = mutable();
        inverted.xp.levelDiffPenalty.fullXpWithinLevels = 9;
        expect(validateConfig(inverted).valid).toBe(false);
      });

      it('rejects a bonus cap outside 1.0–3.0', () => {
        const tooGenerous = mutable();
        tooGenerous.xp.levelDiffPenalty.higherLevelBonusCap = 3.5;
        expect(validateConfig(tooGenerous).valid).toBe(false);

        const belowOne = mutable();
        belowOne.xp.levelDiffPenalty.higherLevelBonusCap = 0.9;
        expect(validateConfig(belowOne).valid).toBe(false);
      });

      const NON_POSITIVE: Array<[string, (c: any) => void]> = [
        ['drops.despawnSeconds', (c) => (c.drops.despawnSeconds = 0)],
        ['drops.pickupRangePx', (c) => (c.drops.pickupRangePx = 0)],
        ['enemies.respawnSeconds', (c) => (c.enemies.respawnSeconds = -1)],
        ['enemies.aggroRangePx', (c) => (c.enemies.aggroRangePx = 0)],
        ['enemies.attackRangePx', (c) => (c.enemies.attackRangePx = -5)],
        ['enemies.deaggroRangePx', (c) => (c.enemies.deaggroRangePx = 0)],
        [
          'enemies.chaseSpeedPxPerSec',
          (c) => (c.enemies.chaseSpeedPxPerSec = 0),
        ],
        [
          'enemies.resetSpeedPxPerSec',
          (c) => (c.enemies.resetSpeedPxPerSec = -80),
        ],
        ['xp.baseMonsterXp', (c) => (c.xp.baseMonsterXp = 0)],
      ];

      for (const [label, breakIt] of NON_POSITIVE) {
        it(`rejects a non-positive ${label}`, () => {
          const broken = mutable();
          breakIt(broken);
          expect(validateConfig(broken).valid).toBe(false);
        });
      }
    });
  },
);

verifies(
  ConTraceables.CON_016_AN_INVALID_CONFIG_REFUSES_TO_START_THE_MODULE,
  () => {
    describe('CON-016 — fail-loud parsing', () => {
      it('throws rather than falling back to defaults', () => {
        const broken = mutable();
        broken.dropRates.cards.rarityWeights.epic = 0.5;
        expect(() => parseConfig(broken)).toThrow(/Server config invalid/);
      });

      it('throws on a document missing whole sections', () => {
        expect(() => parseConfig({})).toThrow(/Server config invalid/);
      });
    });
  },
);

/**
 * The other half of 's duplication: the client copies the `xp` block of
 * this file into client/src/xpReward.ts. A retuned config nobody mirrored there
 * would silently make the floating "+N XP" disagree with the XP actually
 * granted. The assertion lives here rather than beside the client copy because
 * the client's tsconfig cannot see the node:fs loader.
 */
verifies(
  ArchTraceables.ARCH_011_THE_CLIENT_DUPLICATES_COMPUTE_XP_REWARD_TO_RENDER_THE_FLOATING_NUMBER,
  () => {
    describe('ARCH-011 — the client XP config duplicate', () => {
      it('matches the shipped content/config.json xp block', () => {
        expect(XP_CONFIG.baseMonsterXp).toBe(config.xp.baseMonsterXp);
        expect(XP_CONFIG.levelDiff).toEqual(config.xp.levelDiffPenalty);
      });
    });
  },
);
