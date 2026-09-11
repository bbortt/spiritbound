// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { z } from 'zod';
import {
  realizes,
  concerns,
  ConTraceables,
  SysTraceables,
} from '../src/clew/traceables/clew';

export { loadZones } from './zonesLoader';

/**
 * validateZones.ts — schema for content/zones.json, the authored zone
 * definitions (level range, bands, population sizing, spawn-director tuning
 * and boss cycle) the spawn director and boss cycle read.
 *
 * Pure: no node:fs here, so the SpacetimeDB bundle can tree-shake the loader
 * away and import only parseZones.
 */

const RARITY = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;

const level = z.number().int().min(1).max(50);
const positive = z.number().positive();
const nonNegativeInt = z.number().int().min(0);
const positiveInt = z.number().int().positive();

const LevelBandSchema = z.object({
  min: level,
  max: level,
});

const PopulationSchema = realizes(
  ConTraceables.CON_022_ZONE_DIRECTOR_DEADBAND_AND_MAX_BAND_SHARE_ARE_BOUNDED,
  z.object({
    base: nonNegativeInt,
    perPlayer: nonNegativeInt,
    min: nonNegativeInt,
    max: positiveInt,
    floorPerOccupiedBand: nonNegativeInt,
    maxBandSharePct: z.number().min(0.2).max(1),
  }),
);

const DirectorSchema = realizes(
  ConTraceables.CON_022_ZONE_DIRECTOR_DEADBAND_AND_MAX_BAND_SHARE_ARE_BOUNDED,
  z.object({
    tickSeconds: positive,
    deadband: z.number().int().min(1),
    maxSpawnsPerTick: positiveInt,
    maxDespawnsPerTick: positiveInt,
    minSpawnDistFromPlayerPx: positive,
    despawnSafeDistPx: positive,
    sustainedDeviationTicks: positiveInt,
  }),
);

const BossSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'must be lowercase-hyphenated (a-z, 0-9, -)'),
  rarity: z.enum(RARITY),
  level,
  cycleMinutes: positive,
  windowMinutes: positive,
  arenaX: z.number(),
  arenaY: z.number(),
});

export const ZoneSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'must be lowercase-hyphenated (a-z, 0-9, -)'),
  zoneId: positiveInt,
  name: z.string().min(1),
  minLevel: level,
  maxLevel: level,
  recommendedLevel: level.optional(),
  tutorialZone: z.boolean(),
  spawnRarities: realizes(
    ConTraceables.CON_023_A_ZONES_SPAWN_RARITIES_MUST_BE_NON_EMPTY_AND_ALL_VALID,
    z.array(z.enum(RARITY)).min(1, 'must list at least one rarity'),
  ),
  levelBands: z.array(LevelBandSchema).min(1),
  population: PopulationSchema,
  director: DirectorSchema,
  boss: BossSchema,
  flavor: z.string().min(1),
  masteredMessage: z.string().min(1).optional(),
});

export type ZoneDef = z.infer<typeof ZoneSchema>;

const crossCheck = realizes(
  [
    ConTraceables.CON_019_ZONE_LEVEL_BANDS_PARTITION_THE_ZONES_LEVEL_RANGE_WITH_NO_GAP_OR_OVERLAP,
    ConTraceables.CON_020_A_ZONES_POPULATION_FLOOR_ACROSS_OCCUPIED_BANDS_CAN_NEVER_EXCEED_ITS_MAX,
    ConTraceables.CON_021_A_ZONES_MINIMUM_SPAWN_DISTANCE_MUST_BE_STRICTLY_LESS_THAN_ITS_DESPAWN_SAFE_DISTANCE,
    ConTraceables.CON_024_A_ZONE_BOSS_WINDOW_MUST_BE_SHORTER_THAN_ITS_CYCLE,
    ConTraceables.CON_025_A_TUTORIAL_ZONES_MIN_LEVEL_MUST_BE_ONE,
  ] as const,
  function crossCheck(zones: ZoneDef[]): string[] {
    const errors: string[] = [];

    const slugs = zones.map((zone) => zone.slug);
    const dupeSlugs = slugs.filter((s, i) => slugs.indexOf(s) !== i);
    if (dupeSlugs.length > 0) {
      errors.push(`Duplicate slugs: ${[...new Set(dupeSlugs)].join(', ')}`);
    }

    const zoneIds = zones.map((zone) => zone.zoneId);
    const dupeZoneIds = zoneIds.filter((id, i) => zoneIds.indexOf(id) !== i);
    if (dupeZoneIds.length > 0) {
      errors.push(`Duplicate zoneIds: ${[...new Set(dupeZoneIds)].join(', ')}`);
    }

    for (const zone of zones) {
      if (zone.minLevel > zone.maxLevel) {
        errors.push(
          `${zone.slug}: minLevel must be <= maxLevel (got ${zone.minLevel} > ${zone.maxLevel})`,
        );
      }
      errors.push(...levelBandErrors(zone));
      errors.push(...populationErrors(zone));

      if (
        zone.director.minSpawnDistFromPlayerPx >=
        zone.director.despawnSafeDistPx
      ) {
        errors.push(
          `${zone.slug}: minSpawnDistFromPlayerPx must be < despawnSafeDistPx (got ${zone.director.minSpawnDistFromPlayerPx} >= ${zone.director.despawnSafeDistPx})`,
        );
      }

      if (zone.boss.windowMinutes >= zone.boss.cycleMinutes) {
        errors.push(
          `${zone.slug}: boss windowMinutes must be < cycleMinutes (got ${zone.boss.windowMinutes} >= ${zone.boss.cycleMinutes})`,
        );
      }

      if (zone.tutorialZone && zone.minLevel !== 1) {
        errors.push(
          `${zone.slug}: tutorial zone must have minLevel === 1 (got ${zone.minLevel})`,
        );
      }
    }

    return errors;
  },
);

/** Bands are read in authored order only after sorting, so a shuffled file is still valid. */
function levelBandErrors(zone: ZoneDef): string[] {
  const errors: string[] = [];
  const bands = [...zone.levelBands].sort((a, b) => a.min - b.min);

  for (const band of bands) {
    if (band.min > band.max) {
      errors.push(
        `${zone.slug}: level band [${band.min}, ${band.max}] must have min <= max`,
      );
    }
  }
  if (errors.length > 0) return errors;

  const first = bands[0];
  const last = bands[bands.length - 1];
  if (first.min !== zone.minLevel) {
    errors.push(
      `${zone.slug}: first level band must start at minLevel ${zone.minLevel} (got ${first.min})`,
    );
  }
  if (last.max !== zone.maxLevel) {
    errors.push(
      `${zone.slug}: last level band must end at maxLevel ${zone.maxLevel} (got ${last.max})`,
    );
  }
  for (let i = 1; i < bands.length; i++) {
    const previous = bands[i - 1];
    const current = bands[i];
    if (current.min !== previous.max + 1) {
      errors.push(
        `${zone.slug}: level bands must be contiguous — band [${current.min}, ${current.max}] must start at ${previous.max + 1} (got ${current.min})`,
      );
    }
  }

  return errors;
}

/**
 * The floor-total message carries both numbers because the reader is a content
 * author staring at a band list and a population block in two different places.
 */
function populationErrors(zone: ZoneDef): string[] {
  const errors: string[] = [];
  const { population } = zone;

  if (population.min > population.max) {
    errors.push(
      `${zone.slug}: population min must be <= max (got ${population.min} > ${population.max})`,
    );
  }

  const floorTotal = population.floorPerOccupiedBand * zone.levelBands.length;
  if (floorTotal > population.max) {
    errors.push(
      `${zone.slug}: population floor across all bands must be <= max (floor total ${floorTotal}, max ${population.max})`,
    );
  }

  return errors;
}

export const validateZones = concerns(
  SysTraceables.SYS_008_CONTENT_IS_AUTHORED_AS_JSON_VALIDATED_THEN_IDEMPOTENTLY_SEEDED,
  function validateZones(zones: unknown[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const valid: ZoneDef[] = [];

    for (const item of zones) {
      const result = ZoneSchema.safeParse(item);
      if (!result.success) {
        const slug =
          typeof (item as Record<string, unknown>)?.slug === 'string'
            ? ((item as Record<string, unknown>).slug as string)
            : '(unknown)';
        for (const issue of result.error.issues) {
          const path = issue.path.join('.') || 'root';
          errors.push(`${slug}: ${path}: ${issue.message}`);
        }
      } else {
        valid.push(result.data);
      }
    }

    errors.push(...crossCheck(valid));
    return { valid: errors.length === 0, errors };
  },
);

export function parseZones(raw: unknown[]): ZoneDef[] {
  const { valid, errors } = validateZones(raw);
  if (!valid) throw new Error(`Zone data invalid:\n${errors.join('\n')}`);
  return raw.map((item) => ZoneSchema.parse(item));
}
