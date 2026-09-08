// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { describe, it, expect } from 'vitest';
import { validateZones, parseZones } from './validateZones';
import { loadZones } from './zonesLoader';
import { verifies, ConTraceables } from '../src/clew/traceables/clew';

const zones = loadZones();

/** The shipped zones as plain data, ready to mutate into a violation. */
function mutable(): any[] {
  return JSON.parse(JSON.stringify(zones));
}

/** The shipped `hollow-vale` entry, mutated by `breakIt` and re-validated. */
function rejected(breakIt: (zone: any) => void): {
  valid: boolean;
  errors: string[];
} {
  const [zone] = mutable();
  breakIt(zone);
  return validateZones([zone]);
}

describe('zone definitions — the shipped file', () => {
  it('passes schema validation', () => {
    const { valid, errors } = validateZones(zones);
    expect(valid, `Validation errors:\n${errors.join('\n')}`).toBe(true);
  });

  it('ships hollow-vale as zone 1', () => {
    expect(zones.map((zone) => zone.slug)).toEqual(['hollow-vale']);
    expect(zones[0].zoneId).toBe(1);
  });

  it('no duplicate slugs or zoneIds', () => {
    const slugs = zones.map((zone) => zone.slug);
    const zoneIds = zones.map((zone) => zone.zoneId);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(zoneIds).size).toBe(zoneIds.length);
  });

  it('places every boss arena inside the 2880×2880 zone map', () => {
    for (const zone of zones) {
      expect(
        zone.boss.arenaX,
        `${zone.slug}: arenaX out of bounds`,
      ).toBeGreaterThan(0);
      expect(
        zone.boss.arenaX,
        `${zone.slug}: arenaX out of bounds`,
      ).toBeLessThan(2880);
      expect(
        zone.boss.arenaY,
        `${zone.slug}: arenaY out of bounds`,
      ).toBeGreaterThan(0);
      expect(
        zone.boss.arenaY,
        `${zone.slug}: arenaY out of bounds`,
      ).toBeLessThan(2880);
    }
  });

  it('throws rather than returning a partial list on invalid data', () => {
    expect(() => parseZones([{}])).toThrow(/Zone data invalid/);
  });
});

// Rejection-path coverage: the shipped-file tests above only prove the shipped
// content complies; these prove the validator actually REJECTS a synthetic
// violation of each rule, not just that no violation happens to exist yet.

verifies(
  ConTraceables.CON_019_ZONE_LEVEL_BANDS_PARTITION_THE_ZONES_LEVEL_RANGE_WITH_NO_GAP_OR_OVERLAP,
  () => {
    describe('CON-019 rejection path', () => {
      it('rejects bands that leave a gap', () => {
        const { valid, errors } = rejected((zone) => {
          zone.levelBands = [
            { min: 1, max: 2 },
            { min: 4, max: 10 },
          ];
        });
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(
          /level bands must be contiguous — band \[4, 10\] must start at 3 \(got 4\)/,
        );
      });

      it('rejects bands that overlap', () => {
        const { valid, errors } = rejected((zone) => {
          zone.levelBands = [
            { min: 1, max: 3 },
            { min: 3, max: 10 },
          ];
        });
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(/level bands must be contiguous/);
      });

      it('rejects a first band that does not start at minLevel', () => {
        const { valid, errors } = rejected((zone) => {
          zone.levelBands[0] = { min: 2, max: 2 };
        });
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(
          /first level band must start at minLevel 1 \(got 2\)/,
        );
      });

      it('rejects a last band that does not end at maxLevel', () => {
        const { valid, errors } = rejected((zone) => {
          zone.levelBands[zone.levelBands.length - 1] = { min: 9, max: 9 };
        });
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(
          /last level band must end at maxLevel 10 \(got 9\)/,
        );
      });
    });
  },
);

verifies(
  ConTraceables.CON_020_A_ZONES_POPULATION_FLOOR_ACROSS_OCCUPIED_BANDS_CAN_NEVER_EXCEED_ITS_MAX,
  () => {
    describe('CON-020 rejection path', () => {
      it('rejects a population min above its max', () => {
        const { valid, errors } = rejected((zone) => {
          zone.population.min = 200;
        });
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(
          /population min must be <= max \(got 200 > 120\)/,
        );
      });

      it('rejects a band floor total above max, naming both numbers', () => {
        const { valid, errors } = rejected((zone) => {
          zone.population.floorPerOccupiedBand = 30;
        });
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(/floor total 150, max 120/);
      });

      it('accepts a band floor total exactly at max', () => {
        const [zone] = mutable();
        zone.population.floorPerOccupiedBand = 24;
        expect(validateZones([zone]).valid).toBe(true);
      });
    });
  },
);

verifies(
  ConTraceables.CON_021_A_ZONES_MINIMUM_SPAWN_DISTANCE_MUST_BE_STRICTLY_LESS_THAN_ITS_DESPAWN_SAFE_DISTANCE,
  () => {
    describe('CON-021 rejection path', () => {
      it('rejects a spawn distance equal to the despawn-safe distance', () => {
        const { valid, errors } = rejected((zone) => {
          zone.director.minSpawnDistFromPlayerPx = 900;
        });
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(
          /minSpawnDistFromPlayerPx must be < despawnSafeDistPx \(got 900 >= 900\)/,
        );
      });

      it('rejects a spawn distance above the despawn-safe distance', () => {
        const { valid } = rejected((zone) => {
          zone.director.minSpawnDistFromPlayerPx = 1000;
        });
        expect(valid).toBe(false);
      });
    });
  },
);

verifies(
  ConTraceables.CON_022_ZONE_DIRECTOR_DEADBAND_AND_MAX_BAND_SHARE_ARE_BOUNDED,
  () => {
    describe('CON-022 rejection path', () => {
      it('rejects a deadband of zero', () => {
        const { valid } = rejected((zone) => {
          zone.director.deadband = 0;
        });
        expect(valid).toBe(false);
      });

      it('rejects a maxBandSharePct below 0.2', () => {
        const { valid } = rejected((zone) => {
          zone.population.maxBandSharePct = 0.1;
        });
        expect(valid).toBe(false);
      });

      it('rejects a maxBandSharePct above 1.0', () => {
        const { valid } = rejected((zone) => {
          zone.population.maxBandSharePct = 1.5;
        });
        expect(valid).toBe(false);
      });

      it('accepts the inclusive bounds 0.2 and 1.0', () => {
        for (const share of [0.2, 1.0]) {
          const [zone] = mutable();
          zone.population.maxBandSharePct = share;
          expect(validateZones([zone]).valid).toBe(true);
        }
      });
    });
  },
);

verifies(
  ConTraceables.CON_023_A_ZONES_SPAWN_RARITIES_MUST_BE_NON_EMPTY_AND_ALL_VALID,
  () => {
    describe('CON-023 rejection path', () => {
      it('rejects an empty spawnRarities array', () => {
        const { valid, errors } = rejected((zone) => {
          zone.spawnRarities = [];
        });
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(/must list at least one rarity/);
      });

      it('rejects a rarity outside the five valid values', () => {
        const { valid } = rejected((zone) => {
          zone.spawnRarities = ['common', 'mythic'];
        });
        expect(valid).toBe(false);
      });
    });
  },
);

verifies(
  ConTraceables.CON_024_A_ZONE_BOSS_WINDOW_MUST_BE_SHORTER_THAN_ITS_CYCLE,
  () => {
    describe('CON-024 rejection path', () => {
      it('rejects a boss window equal to its cycle', () => {
        const { valid, errors } = rejected((zone) => {
          zone.boss.windowMinutes = 10;
        });
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(
          /boss windowMinutes must be < cycleMinutes \(got 10 >= 10\)/,
        );
      });

      it('rejects a boss window longer than its cycle', () => {
        const { valid } = rejected((zone) => {
          zone.boss.windowMinutes = 15;
        });
        expect(valid).toBe(false);
      });
    });
  },
);

verifies(ConTraceables.CON_025_A_TUTORIAL_ZONES_MIN_LEVEL_MUST_BE_ONE, () => {
  describe('CON-025 rejection path', () => {
    it('rejects a tutorial zone whose minLevel is not 1', () => {
      const { valid, errors } = rejected((zone) => {
        zone.minLevel = 2;
        zone.recommendedLevel = 2;
        zone.levelBands[0] = { min: 2, max: 2 };
      });
      expect(valid).toBe(false);
      expect(errors.join('\n')).toMatch(
        /tutorial zone must have minLevel === 1 \(got 2\)/,
      );
    });

    it('accepts a non-tutorial zone whose minLevel is not 1', () => {
      const [zone] = mutable();
      zone.tutorialZone = false;
      zone.minLevel = 2;
      zone.recommendedLevel = 2;
      zone.levelBands[0] = { min: 2, max: 2 };
      expect(validateZones([zone]).valid).toBe(true);
    });
  });
});
