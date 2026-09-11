// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

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

/**
 * The per-rarity `{hp, damage}` pair an enemy's base stats are multiplied by.
 * Deliberately NOT `RarityWeightsSchema`: that one is five 0..1 chances summing
 * to 1.0, this one is five unbounded-above multipliers with no sum at all.
 */
const RarityMultiplierPairSchema = z.object({
  hp: z.number().min(1),
  damage: z.number().min(1),
});

/**
 * A multiplier below 1.0 would make a higher-rarity enemy weaker than a common
 * one, and a non-increasing step would make two rarities indistinguishable in a
 * fight — both defeat the point of the rarity axis. The message names the two
 * tiers and both values because the reader is a server operator retuning a
 * table, not the author of this schema.
 */
const RarityMultipliersSchema = realizes(
  ConTraceables.CON_026_RARITY_MULTIPLIERS_COVER_EVERY_RARITY_AT_OR_ABOVE_ONE_INCREASING_BY_TIER,
  z
    .object({
      common: RarityMultiplierPairSchema,
      uncommon: RarityMultiplierPairSchema,
      rare: RarityMultiplierPairSchema,
      epic: RarityMultiplierPairSchema,
      legendary: RarityMultiplierPairSchema,
    })
    .superRefine((multipliers, ctx) => {
      for (const axis of ['hp', 'damage'] as const) {
        for (let i = 1; i < RARITY.length; i++) {
          const lower = RARITY[i - 1];
          const higher = RARITY[i];
          if (multipliers[higher][axis] <= multipliers[lower][axis]) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [higher, axis],
              message:
                `${higher}.${axis} (${multipliers[higher][axis]}) must be ` +
                `greater than ${lower}.${axis} (${multipliers[lower][axis]})`,
            });
          }
        }
      }
    }),
);

/**
 * A cast that lands for less than an ordinary swing inverts the telegraph: the
 * red circle on the ground is only worth dodging because standing in it costs
 * more than trading hits. The bound sits on the ratio rather than on a second
 * damage number so it survives any retune of `baseDamage`, and the message
 * names the value because the reader is a server operator, not this schema's
 * author.
 */
const CastDamageRatioSchema = realizes(
  ConTraceables.CON_034_A_TELEGRAPHED_CAST_NEVER_HITS_SOFTER_THAN_A_MELEE_SWING,
  z.number().min(1, {
    message:
      'castDamageRatio must be at least 1.0 — a cast that hits softer than ' +
      'a melee swing makes the telegraph pointless',
  }),
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
      // The zone-1 archetype's base stats, level-1 and common-rarity, before
      // rules/enemyScaling.ts applies level and rarity to them. They are dials
      // here rather than authored content only until a real enemy-definition
      // pipeline exists (content/enemies.json); at that point per-archetype
      // values move there and these two become the fallback.
      baseHp: positive,
      baseDamage: positive,
      castDamageRatio: CastDamageRatioSchema,
      rarityMultipliers: RarityMultipliersSchema,
    }),
  }),
);

export type ServerConfig = z.infer<typeof ConfigSchema>;
export type RarityWeights = ServerConfig['dropRates']['cards']['rarityWeights'];
export type LevelDiffPenalty = ServerConfig['xp']['levelDiffPenalty'];
export type RarityMultipliers = ServerConfig['enemies']['rarityMultipliers'];
export type EnemyConfig = ServerConfig['enemies'];

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
