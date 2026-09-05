import { z } from 'zod';
import {
  realizes,
  concerns,
  ConTraceables,
  SwTraceables,
  SysTraceables,
} from '../src/clew/traceables/clew';

export { loadConfig } from './configLoader';

/**
 * validateConfig.ts — schema for content/config.json, the SERVER-OPERATOR
 * tunable balance file (as opposed to cards.json/equipment.json, which are
 * authored content). See docs/ARCHITECTURE.md.
 *
 * Pure: no node:fs here, so the SpacetimeDB bundle can tree-shake the loader
 * away and import only parseConfig.
 */

const RARITY = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;

/** Floating-point slack for the "weights sum to 1.0" check. */
const SUM_EPSILON = 1e-9;

const chance = z.number().min(0).max(1);
const positive = z.number().positive();

const RarityWeightsSchema = z.object({
  common: chance,
  uncommon: chance,
  rare: chance,
  epic: chance,
  legendary: chance,
});

/**
 * A weight table that does not sum to 1.0 silently biases the rarity roll:
 * pickWeightedRarity walks a cumulative range, so a short table over-returns
 * the fallback tier and a long one makes the top tiers unreachable. The
 * message carries the actual sum because the reader is a server operator
 * staring at five numbers, not the author of this schema.
 */
const DropCategorySchema = realizes(
  SwTraceables.SW_031_RARITY_WEIGHTS_MUST_SUM_TO_ONE_AND_THE_ERROR_NAMES_THE_ACTUAL_SUM,
  z
    .object({
      baseChance: chance,
      rarityWeights: RarityWeightsSchema,
    })
    .superRefine((category, ctx) => {
      const sum = RARITY.reduce(
        (total, rarity) => total + category.rarityWeights[rarity],
        0,
      );
      if (Math.abs(sum - 1) > SUM_EPSILON) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rarityWeights'],
          message: `rarity weights must sum to 1.0 (got ${sum})`,
        });
      }
    }),
);

/**
 * The band edges must be ordered — the falloff divides by the distance
 * between them — and the bonus cap is bounded so no config can make suicidal
 * over-pulling the fastest way to level.
 */
const LevelDiffPenaltySchema = concerns(
  ConTraceables.CON_018_THE_ABOVE_LEVEL_XP_BONUS_IS_CAPPED_SO_OVER_PULLING_NEVER_PAYS,
  realizes(
    SwTraceables.SW_032_THE_XP_LEVEL_BAND_MUST_BE_ORDERED_AND_THE_BONUS_CAP_BOUNDED,
    z
      .object({
        fullXpWithinLevels: z.number().int().min(0),
        zeroXpBeyondLevels: z.number().int().min(1),
        higherLevelBonusCap: z.number().min(1).max(3),
      })
      .superRefine((penalty, ctx) => {
        if (penalty.fullXpWithinLevels >= penalty.zeroXpBeyondLevels) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fullXpWithinLevels'],
            message:
              `fullXpWithinLevels (${penalty.fullXpWithinLevels}) must be less ` +
              `than zeroXpBeyondLevels (${penalty.zeroXpBeyondLevels})`,
          });
        }
      }),
  ),
);

export const ConfigSchema = concerns(
  SysTraceables.SYS_009_SERVER_OPERATORS_TUNE_BALANCE_THROUGH_A_VALIDATED_CONFIG_FILE,
  z.object({
    dropRates: z.object({
      cards: DropCategorySchema,
      gear: DropCategorySchema,
    }),
    xp: z.object({
      baseMonsterXp: positive,
      levelDiffPenalty: LevelDiffPenaltySchema,
    }),
    drops: z.object({
      despawnSeconds: positive,
      pickupRangePx: positive,
    }),
    enemies: z.object({
      respawnSeconds: positive,
      aggroRangePx: positive,
      attackRangePx: positive,
      deaggroRangePx: positive,
      chaseSpeedPxPerSec: positive,
      resetSpeedPxPerSec: positive,
    }),
  }),
);

export type ServerConfig = z.infer<typeof ConfigSchema>;
export type RarityWeights = ServerConfig['dropRates']['cards']['rarityWeights'];
export type LevelDiffPenalty = ServerConfig['xp']['levelDiffPenalty'];

export function validateConfig(raw: unknown): {
  valid: boolean;
  errors: string[];
} {
  const result = ConfigSchema.safeParse(raw);
  if (result.success) return { valid: true, errors: [] };
  return {
    valid: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`,
    ),
  };
}

/**
 * Throw-on-invalid, like parseCards/parseEquipment. There is deliberately no
 * fallback to defaults: a server that boots on an invalid balance file runs an
 * economy on numbers nobody chose.
 */
export const parseConfig = realizes(
  ConTraceables.CON_016_AN_INVALID_CONFIG_REFUSES_TO_START_THE_MODULE,
  function parseConfig(raw: unknown): ServerConfig {
    const { valid, errors } = validateConfig(raw);
    if (!valid) throw new Error(`Server config invalid:\n${errors.join('\n')}`);
    return ConfigSchema.parse(raw);
  },
);
