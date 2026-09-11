// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { describe, it, expect } from 'vitest';
import {
  computeTargetPopulation,
  allocateBands,
  planAdjustments,
  pickRespawnBand,
  type PopulationConfig,
  type DirectorConfig,
} from './spawnDirector';
import { verifies, SwTraceables } from '../../../src/clew/traceables/clew';

/**
 * The shipped hollow-vale tuning, written out rather than loaded, because
 * these assertions are about the *rules* and not about the numbers a content
 * author happens to have picked today — several cases below deliberately
 * retune a single dial (a `maxBandSharePct` of 1.0 to take the cap out of the
 * way, a lower `min` to reach the clamp) and a shared literal makes the one
 * changed dial the visible part of the test.
 */
const POPULATION: PopulationConfig = {
  base: 20,
  perPlayer: 6,
  min: 20,
  max: 120,
  floorPerOccupiedBand: 6,
  maxBandSharePct: 0.5,
};

const DIRECTOR: DirectorConfig = {
  deadband: 3,
  maxSpawnsPerTick: 4,
  maxDespawnsPerTick: 2,
};

const sum = (counts: readonly number[]): number =>
  counts.reduce((total, count) => total + count, 0);

/**
 * mulberry32 — a 32-bit PRNG small enough to read, deterministic across runs
 * and platforms, and seedable per case.
 *
 * The property tests below are seeded rather than random precisely so a
 * failure is reproducible: every case is derived from an integer seed the
 * loop iterates in order, and the assertion message carries that seed and the
 * generated input, so a red run names the exact case to re-run rather than
 * "it failed once". No property-test dependency is pulled in for this — see
 * `003-developer-guidelines.md` §4; a seeded loop inside a plain `it` is the
 * whole of what these properties need.
 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let drawn = Math.imul(state ^ (state >>> 15), 1 | state);
    drawn = (drawn + Math.imul(drawn ^ (drawn >>> 7), 61 | drawn)) ^ drawn;
    return ((drawn ^ (drawn >>> 14)) >>> 0) / 4294967296;
  };
}

/** An integer in `[low, high]`, inclusive at both ends. */
const between = (next: () => number, low: number, high: number): number =>
  low + Math.floor(next() * (high - low + 1));

/** How many seeds each property sweeps. Fixed, so the run time is fixed. */
const SEEDS = 400;

verifies(
  SwTraceables.SW_041_COMPUTE_TARGET_POPULATION_CLAMPS_BASE_PLUS_PER_PLAYER_SCALING,
  () => {
    describe('computeTargetPopulation', () => {
      it('returns the raw linear value while it sits between the bounds', () => {
        expect(computeTargetPopulation(10, POPULATION)).toBe(80);
      });

      it('raises an empty zone to the floor when base is below min', () => {
        expect(computeTargetPopulation(0, { ...POPULATION, base: 5 })).toBe(20);
      });

      it('clamps a player count that would undercut min', () => {
        const lean = { ...POPULATION, base: 5, perPlayer: 1 };
        expect(computeTargetPopulation(3, lean)).toBe(20);
      });

      it('clamps a crowd that would blow past max', () => {
        expect(computeTargetPopulation(100, POPULATION)).toBe(120);
      });

      it('scales linearly in player count between the bounds', () => {
        const atFive = computeTargetPopulation(5, POPULATION);
        const atTen = computeTargetPopulation(10, POPULATION);
        expect(atTen - atFive).toBe(5 * POPULATION.perPlayer);
      });
    });
  },
);

verifies(
  SwTraceables.SW_042_ALLOCATE_BANDS_GUARANTEES_EACH_OCCUPIED_BANDS_FLOOR_BEFORE_PROPORTIONAL_SPLIT,
  () => {
    describe('allocateBands floor pass', () => {
      // 19 players against 1 is far enough past `maxBandSharePct` that the cap
      // would swallow the proportional split entirely, so this case takes the
      // cap out of the way — 1.0 is the legal maximum content validation
      // allows — to assert the floor-then-proportional shape on its own.
      const uncapped = { ...POPULATION, maxBandSharePct: 1 };
      const outlier = allocateBands(112, [19, 0, 0, 0, 1], 5, uncapped);

      it('pays the lone outlier band its full floor', () => {
        expect(outlier[4]).toBeGreaterThanOrEqual(
          uncapped.floorPerOccupiedBand,
        );
      });

      it('splits what is left after both floors by player share', () => {
        const floor = uncapped.floorPerOccupiedBand;
        expect(outlier[0] - floor).toBe(95);
        expect(outlier[4] - floor).toBe(5);
        expect((outlier[0] - floor) / (outlier[4] - floor)).toBe(19);
      });

      it('leaves the unoccupied bands empty while the cap does not bind', () => {
        expect(outlier).toEqual([101, 0, 0, 0, 11]);
      });

      it('never leaves an occupied band on zero, however thin its share', () => {
        const thin = allocateBands(40, [200, 1, 0, 0, 0], 5, uncapped);
        expect(thin[1]).toBeGreaterThanOrEqual(uncapped.floorPerOccupiedBand);
      });
    });
  },
);

verifies(
  SwTraceables.SW_043_ALLOCATE_BANDS_CAPS_A_BAND_AT_ITS_SHARE_AND_REDISTRIBUTES_THE_OVERFLOW,
  () => {
    describe('allocateBands band-share cap', () => {
      it('stops one occupied band short of the whole budget', () => {
        const lone = allocateBands(100, [10, 0, 0, 0, 0], 5, POPULATION);
        expect(lone[0]).toBe(Math.floor(100 * POPULATION.maxBandSharePct));
        expect(lone[0]).toBeLessThan(100);
        expect(sum(lone)).toBe(100);
      });

      it('lands a dominant band overflow on the minor occupied bands', () => {
        const skewed = allocateBands(100, [16, 2, 2, 0, 0], 5, POPULATION);
        // Both minor bands are far above the 14 the floor-plus-proportional
        // pass alone would have left them on, and the two unoccupied bands
        // took none of it: overflow prefers bands that actually hold players.
        expect(skewed[1]).toBeGreaterThan(14);
        expect(skewed[2]).toBeGreaterThan(14);
        expect(skewed[3]).toBe(0);
        expect(skewed[4]).toBe(0);
        expect(sum(skewed)).toBe(100);
      });

      it('spills into quiet bands when no occupied band has headroom', () => {
        const lone = allocateBands(100, [10, 0, 0, 0, 0], 5, POPULATION);
        expect(sum(lone.slice(1))).toBe(50);
      });

      it('holds every band to its share whenever drift has none to place', () => {
        const cap = Math.floor(100 * POPULATION.maxBandSharePct);
        const spread = allocateBands(100, [5, 5, 1, 1, 0], 5, POPULATION);
        for (const count of spread) {
          expect(count).toBeLessThanOrEqual(cap);
        }
      });
    });
  },
);

verifies(
  SwTraceables.SW_044_ALLOCATE_BANDS_CORRECTS_ROUNDING_DRIFT_ONTO_THE_LARGEST_BAND,
  () => {
    describe('allocateBands rounding drift', () => {
      it('puts the rounding residue on the largest band', () => {
        // Three equal bands over a budget of 100: floors take 18, and 82 does
        // not divide by three, so 1 count of residue has to land somewhere.
        const thirds = allocateBands(100, [1, 1, 1, 0, 0], 5, {
          ...POPULATION,
          maxBandSharePct: 1,
        });
        expect(sum(thirds)).toBe(100);
        expect(thirds[0]).toBe(34);
        expect(thirds[1]).toBe(33);
        expect(thirds[2]).toBe(33);
      });

      it('sums to exactly the budget across seeded random demand', () => {
        for (let seed = 1; seed <= SEEDS; seed++) {
          const next = seededRandom(seed);
          const bandCount = between(next, 1, 8);
          const totalBudget = between(next, 0, 500);
          // One seed in five leaves the zone empty, so the even-rest branch is
          // swept by the same property rather than only by its own unit test.
          const empty = next() < 0.2;
          const demand = Array.from({ length: bandCount }, () =>
            empty ? 0 : between(next, 0, 20),
          );
          const cfg: PopulationConfig = {
            ...POPULATION,
            floorPerOccupiedBand: between(next, 0, 12),
            maxBandSharePct: between(next, 20, 100) / 100,
          };
          const input = JSON.stringify({
            seed,
            totalBudget,
            demand,
            bandCount,
            floorPerOccupiedBand: cfg.floorPerOccupiedBand,
            maxBandSharePct: cfg.maxBandSharePct,
          });

          const alloc = allocateBands(totalBudget, demand, bandCount, cfg);

          expect(alloc.length, input).toBe(bandCount);
          expect(sum(alloc), input).toBe(totalBudget);
          for (const count of alloc) {
            expect(Number.isInteger(count), input).toBe(true);
            expect(count, input).toBeGreaterThanOrEqual(0);
          }
        }
      });
    });
  },
);

verifies(
  SwTraceables.SW_045_ALLOCATE_BANDS_RESTS_EVENLY_ACROSS_BANDS_WHEN_NONE_ARE_OCCUPIED,
  () => {
    describe('allocateBands resting distribution', () => {
      it('spreads an empty zone evenly instead of emptying it', () => {
        expect(allocateBands(20, [0, 0, 0, 0, 0], 5, POPULATION)).toEqual([
          4, 4, 4, 4, 4,
        ]);
      });

      it('keeps every band populated when the budget does not divide', () => {
        const uneven = allocateBands(22, [0, 0, 0, 0, 0], 5, POPULATION);
        expect(uneven).toEqual([5, 5, 4, 4, 4]);
        expect(Math.max(...uneven) - Math.min(...uneven)).toBe(1);
        expect(sum(uneven)).toBe(22);
        for (const count of uneven) {
          expect(count).toBeGreaterThan(0);
        }
      });

      it('ignores the band-share cap while resting', () => {
        // Two bands at a 0.2 share would cap at 4 each and strand 12 counts;
        // the resting branch runs before the cap exists.
        const resting = allocateBands(20, [0, 0], 2, {
          ...POPULATION,
          maxBandSharePct: 0.2,
        });
        expect(resting).toEqual([10, 10]);
      });
    });
  },
);

verifies(
  SwTraceables.SW_046_PLAN_ADJUSTMENTS_IGNORES_IN_DEADBAND_DELTAS_AND_NEVER_GOES_NEGATIVE,
  () => {
    describe('planAdjustments deadband', () => {
      // The per-tick rate caps are a separate gate; lifting them here keeps
      // these assertions about the deadband boundary alone, so a retuned
      // maxSpawnsPerTick can never make one of them pass for the wrong reason.
      const unlimited: DirectorConfig = {
        ...DIRECTOR,
        maxSpawnsPerTick: 999,
        maxDespawnsPerTick: 999,
      };

      it('does nothing at a delta sitting exactly on the deadband', () => {
        expect(planAdjustments([10], [7], unlimited)).toEqual({
          spawns: [],
          despawns: [],
        });
        expect(planAdjustments([7], [10], unlimited)).toEqual({
          spawns: [],
          despawns: [],
        });
      });

      it('spawns the whole gap once it clears the deadband', () => {
        expect(planAdjustments([11], [7], unlimited).spawns).toEqual([
          { band: 0, count: 4 },
        ]);
      });

      it('despawns the whole excess once it clears the deadband', () => {
        expect(planAdjustments([7], [11], unlimited).despawns).toEqual([
          { band: 0, count: 4 },
        ]);
      });

      it('reads a missing actual count as an empty band', () => {
        expect(planAdjustments([10, 10], [10], unlimited).spawns).toEqual([
          { band: 1, count: 10 },
        ]);
      });

      it('never emits a negative or zero count across seeded random gaps', () => {
        for (let seed = 1; seed <= SEEDS; seed++) {
          const next = seededRandom(seed);
          const bandCount = between(next, 1, 8);
          const target = Array.from({ length: bandCount }, () =>
            between(next, 0, 60),
          );
          const actual = Array.from({ length: bandCount }, () =>
            between(next, 0, 60),
          );
          const cfg: DirectorConfig = {
            deadband: between(next, 1, 6),
            maxSpawnsPerTick: between(next, 1, 10),
            maxDespawnsPerTick: between(next, 1, 10),
          };
          const input = JSON.stringify({ seed, target, actual, cfg });

          const plan = planAdjustments(target, actual, cfg);

          for (const entry of [...plan.spawns, ...plan.despawns]) {
            expect(Number.isInteger(entry.count), input).toBe(true);
            expect(entry.count, input).toBeGreaterThan(0);
            expect(
              Math.abs(target[entry.band] - actual[entry.band]),
              input,
            ).toBeGreaterThan(cfg.deadband);
          }
          const touched = [...plan.spawns, ...plan.despawns].map(
            (entry) => entry.band,
          );
          expect(new Set(touched).size, input).toBe(touched.length);
        }
      });
    });
  },
);

verifies(
  SwTraceables.SW_047_PLAN_ADJUSTMENTS_CAPS_TOTAL_SPAWNS_AND_DESPAWNS_AND_FAVOURS_SPAWNING,
  () => {
    describe('planAdjustments rate limits', () => {
      it('caps spawns zone-wide, not per band', () => {
        const plan = planAdjustments([20, 20, 20], [0, 0, 0], DIRECTOR);
        expect(sum(plan.spawns.map((entry) => entry.count))).toBe(
          DIRECTOR.maxSpawnsPerTick,
        );
      });

      it('caps despawns zone-wide, not per band', () => {
        const plan = planAdjustments([0, 0, 0], [20, 20, 20], DIRECTOR);
        expect(sum(plan.despawns.map((entry) => entry.count))).toBe(
          DIRECTOR.maxDespawnsPerTick,
        );
      });

      it('returns spawns in full even with despawns pending the same tick', () => {
        const both = planAdjustments([30, 0], [0, 30], DIRECTOR);
        const onlySpawns = planAdjustments([30, 0], [0, 0], DIRECTOR);
        expect(both.spawns).toEqual(onlySpawns.spawns);
        expect(sum(both.spawns.map((entry) => entry.count))).toBe(
          DIRECTOR.maxSpawnsPerTick,
        );
        expect(sum(both.despawns.map((entry) => entry.count))).toBe(
          DIRECTOR.maxDespawnsPerTick,
        );
      });

      it('spends a tight cap on the band furthest off target first', () => {
        const plan = planAdjustments([5, 40], [0, 0], DIRECTOR);
        expect(plan.spawns).toEqual([
          { band: 1, count: DIRECTOR.maxSpawnsPerTick },
        ]);
      });

      it('leaves both lists empty when every band sits in its deadband', () => {
        expect(planAdjustments([10, 10], [8, 12], DIRECTOR)).toEqual({
          spawns: [],
          despawns: [],
        });
      });

      it('never exceeds either cap across seeded random gaps', () => {
        for (let seed = 1; seed <= SEEDS; seed++) {
          const next = seededRandom(seed);
          const bandCount = between(next, 1, 8);
          const target = Array.from({ length: bandCount }, () =>
            between(next, 0, 60),
          );
          const actual = Array.from({ length: bandCount }, () =>
            between(next, 0, 60),
          );
          const cfg: DirectorConfig = {
            deadband: between(next, 1, 6),
            maxSpawnsPerTick: between(next, 1, 10),
            maxDespawnsPerTick: between(next, 1, 10),
          };
          const input = JSON.stringify({ seed, target, actual, cfg });

          const plan = planAdjustments(target, actual, cfg);

          expect(
            sum(plan.spawns.map((entry) => entry.count)),
            input,
          ).toBeLessThanOrEqual(cfg.maxSpawnsPerTick);
          expect(
            sum(plan.despawns.map((entry) => entry.count)),
            input,
          ).toBeLessThanOrEqual(cfg.maxDespawnsPerTick);
        }
      });
    });
  },
);

verifies(
  SwTraceables.SW_048_PASSIVE_RESPAWN_RETIRES_AN_OVER_TARGET_ENEMY_OR_RE_ROLLS_IT_INTO_THE_NEEDIEST_BAND,
  () => {
    describe('pickRespawnBand', () => {
      it('retires an enemy whose own band is exactly at target', () => {
        expect(pickRespawnBand(2, [10, 10, 10], [0, 0, 10])).toBe('retire');
      });

      it('retires an enemy whose own band is over target', () => {
        expect(pickRespawnBand(2, [10, 10, 10], [0, 0, 14])).toBe('retire');
      });

      it('retires when every band is at or over target', () => {
        expect(pickRespawnBand(1, [10, 10, 10], [10, 12, 11])).toBe('retire');
      });

      it('re-rolls into the neediest band, not the one it died in', () => {
        expect(pickRespawnBand(0, [10, 10, 10], [8, 1, 6])).toEqual({
          band: 1,
        });
      });

      it('keeps an enemy home when no band needs it more', () => {
        expect(pickRespawnBand(2, [10, 10, 10], [7, 7, 3])).toEqual({
          band: 2,
        });
      });

      it('leaves a tie with the band the enemy died in', () => {
        expect(pickRespawnBand(2, [10, 10, 10], [5, 5, 5])).toEqual({
          band: 2,
        });
      });

      it('retires an enemy whose band no longer exists', () => {
        expect(pickRespawnBand(7, [10, 10, 10], [0, 0, 0])).toBe('retire');
      });
    });
  },
);
