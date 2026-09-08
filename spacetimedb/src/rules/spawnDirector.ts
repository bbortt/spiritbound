// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * rules/spawnDirector.ts — how big a zone's enemy population should be, how it
 * splits across level bands, and what to spawn or despawn to close the gap.
 *
 * Pure functions: no SpacetimeDB imports, no clock, no side effects. Every dial
 * arrives as a parameter (the zone's `population`/`director` block from
 * content/zones.json, threaded in by the reducer) rather than being read here,
 * the same way rules/enemyScaling.ts takes its multiplier table — so a test can
 * fix the numbers and the rules stay portable off SpacetimeDB.
 *
 * Counts in and out are plain integers indexed by level band; nothing in here
 * knows what a band *is* — "occupied" only ever means `demand[i] > 0`. Bosses
 * never reach these functions either: they run their own cycle, and the reducer
 * strips them out of both the demand and the actual counts it passes in.
 */

import {
  realizes,
  concerns,
  SwTraceables,
  SysTraceables,
} from '../../../src/clew/traceables/clew';

/**
 * The dials `computeTargetPopulation` and `allocateBands` read — a zone's
 * `population` block satisfies this structurally.
 */
export interface PopulationConfig {
  base: number;
  perPlayer: number;
  min: number;
  max: number;
  floorPerOccupiedBand: number;
  maxBandSharePct: number;
}

/**
 * The dials `planAdjustments` reads — a zone's `director` block satisfies this
 * structurally. The distance and cadence dials on that block belong to the
 * reducer that executes the plan, not to the plan itself.
 */
export interface DirectorConfig {
  deadband: number;
  maxSpawnsPerTick: number;
  maxDespawnsPerTick: number;
}

/** One band's share of a tick's spawn or despawn work. `count` is never <= 0. */
export interface BandAdjustment {
  band: number;
  count: number;
}

/** What a single director tick wants done, before anything executes it. */
export interface AdjustmentPlan {
  spawns: BandAdjustment[];
  despawns: BandAdjustment[];
}

/**
 * What to do with an enemy whose respawn timer just fired: delete it, or bring
 * it back re-rolled into `band`.
 */
export type RespawnDecision = 'retire' | { band: number };

/**
 * The zone's total enemy budget for the player count currently standing in it.
 *
 * Linear in player count, then clamped: `min` keeps the map from reading as
 * dead when nobody is around, `max` keeps a crowd from spawning without limit.
 */
export const computeTargetPopulation = concerns(
  SysTraceables.SYS_013_POPULATION_ALLOCATION_DECIDES_TARGET_AND_ADJUSTMENT_COUNTS_INDEPENDENT_OF_EXECUTION,
  realizes(
    SwTraceables.SW_041_COMPUTE_TARGET_POPULATION_CLAMPS_BASE_PLUS_PER_PLAYER_SCALING,
    function computeTargetPopulation(
      playersInZone: number,
      cfg: PopulationConfig,
    ): number {
      const raw = cfg.base + playersInZone * cfg.perPlayer;
      return Math.min(cfg.max, Math.max(cfg.min, raw));
    },
  ),
);

/**
 * Split `totalBudget` across `bandCount` level bands given `demand` — the
 * number of players standing in each band.
 *
 * Four passes, in the order the specs describe them, plus one short-circuit:
 *
 * 0. No players anywhere: rest evenly across *every* band and return. This
 *    bypasses the rest of the pipeline entirely — an empty zone is not a zone
 *    that should hold no enemies.
 * 1. Floor: every occupied band gets `floorPerOccupiedBand` first, so a lone
 *    outlier keeps a real presence next to a band holding the crowd.
 * 2. Proportional: whatever is left splits across the occupied bands by their
 *    share of total players, floored — the residue is pass 4's problem.
 * 3. Cap: no band keeps more than `floor(totalBudget * maxBandSharePct)`; the
 *    cut is redistributed to the bands that still have headroom.
 * 4. Drift: the difference between the running total and `totalBudget` lands on
 *    the largest band, so the result always sums to exactly the budget.
 */
export const allocateBands = concerns(
  SysTraceables.SYS_013_POPULATION_ALLOCATION_DECIDES_TARGET_AND_ADJUSTMENT_COUNTS_INDEPENDENT_OF_EXECUTION,
  realizes(
    [
      SwTraceables.SW_042_ALLOCATE_BANDS_GUARANTEES_EACH_OCCUPIED_BANDS_FLOOR_BEFORE_PROPORTIONAL_SPLIT,
      SwTraceables.SW_043_ALLOCATE_BANDS_CAPS_A_BAND_AT_ITS_SHARE_AND_REDISTRIBUTES_THE_OVERFLOW,
      SwTraceables.SW_044_ALLOCATE_BANDS_CORRECTS_ROUNDING_DRIFT_ONTO_THE_LARGEST_BAND,
      SwTraceables.SW_045_ALLOCATE_BANDS_RESTS_EVENLY_ACROSS_BANDS_WHEN_NONE_ARE_OCCUPIED,
    ],
    function allocateBands(
      totalBudget: number,
      demand: readonly number[],
      bandCount: number,
      cfg: PopulationConfig,
    ): number[] {
      // A zone with no bands cannot hold an allocation of any shape, and every
      // pass below divides or indexes by the band count. No spec covers it,
      // because a zero-band zone is unauthorable — the guard is here so a bad
      // caller gets an empty array rather than a NaN-filled one.
      if (bandCount <= 0) {
        return [];
      }
      const budget = Math.max(0, Math.trunc(totalBudget));
      const players = (band: number): number =>
        Math.max(0, Math.trunc(demand[band] ?? 0));

      let totalDemand = 0;
      for (let band = 0; band < bandCount; band++) {
        totalDemand += players(band);
      }
      if (totalDemand === 0) {
        return restEvenly(budget, bandCount);
      }

      const alloc: number[] = new Array<number>(bandCount).fill(0);

      // Pass 1 — the floor, paid in band order. Truncating against what is
      // left keeps the floors inside the budget when the two dials disagree:
      // content validation bounds the floor total against `population.max`
      // only, not against the smaller budget a low player count produces.
      let unpaid = budget;
      for (let band = 0; band < bandCount; band++) {
        if (players(band) === 0) {
          continue;
        }
        const paid = Math.min(cfg.floorPerOccupiedBand, unpaid);
        alloc[band] = paid;
        unpaid -= paid;
      }

      // Pass 2 — the remainder, proportional to player share.
      const remainder = unpaid;
      for (let band = 0; band < bandCount; band++) {
        if (players(band) === 0) {
          continue;
        }
        alloc[band] += Math.floor((remainder * players(band)) / totalDemand);
      }

      capAndRedistribute(alloc, budget, players, cfg);
      correctDrift(alloc, budget);
      return alloc;
    },
  ),
);

/**
 * The budget spread as evenly as the band count allows, low bands taking the
 * extra when it does not divide.
 */
function restEvenly(budget: number, bandCount: number): number[] {
  const even = Math.floor(budget / bandCount);
  const extra = budget % bandCount;
  return Array.from(
    { length: bandCount },
    (_unused, band) => even + (band < extra ? 1 : 0),
  );
}

/**
 * Cut every band back to its share of the budget and hand the cut out again.
 *
 * Receivers are the occupied bands that still have headroom; when the crowd is
 * in a single band there are none, so the overflow falls through to the
 * unoccupied bands rather than being dropped. The cap spec wants the capped
 * band to *not* consume the whole budget while the drift spec wants the output
 * to still sum to it, and spreading into quiet bands is the only way both hold
 * at once — a resting band is exactly where an ambient population belongs
 * anyway. If the whole zone is at its cap the leftover is held here and
 * `correctDrift` places it, which is the one case where a band can end up a
 * count or two above its share.
 */
function capAndRedistribute(
  alloc: number[],
  budget: number,
  players: (band: number) => number,
  cfg: PopulationConfig,
): void {
  const cap = Math.floor(budget * cfg.maxBandSharePct);
  let overflow = 0;
  for (let band = 0; band < alloc.length; band++) {
    if (alloc[band] > cap) {
      overflow += alloc[band] - cap;
      alloc[band] = cap;
    }
  }

  while (overflow > 0) {
    const withHeadroom = alloc
      .map((_unused, band) => band)
      .filter((band) => alloc[band] < cap);
    const occupied = withHeadroom.filter((band) => players(band) > 0);
    const receivers = occupied.length > 0 ? occupied : withHeadroom;
    if (receivers.length === 0) {
      return;
    }

    let moved = 0;
    const share = Math.floor(overflow / receivers.length);
    for (const band of receivers) {
      // A share smaller than one per receiver still has to move, or the loop
      // stalls with overflow in hand: fall back to one count each.
      const wanted = share > 0 ? share : overflow - moved > 0 ? 1 : 0;
      const take = Math.min(wanted, cap - alloc[band]);
      alloc[band] += take;
      moved += take;
    }
    if (moved === 0) {
      return;
    }
    overflow -= moved;
  }
}

/**
 * Push the running total onto `budget` exactly, using the largest band each
 * time. A shortfall is one addition; a surplus drains largest-band-first so no
 * band is ever pushed below zero to pay for it.
 */
function correctDrift(alloc: number[], budget: number): void {
  let drift = budget - alloc.reduce((sum, count) => sum + count, 0);
  while (drift !== 0) {
    let largest = 0;
    for (let band = 1; band < alloc.length; band++) {
      if (alloc[band] > alloc[largest]) {
        largest = band;
      }
    }
    if (drift > 0) {
      alloc[largest] += drift;
      return;
    }
    const removable = Math.min(alloc[largest], -drift);
    if (removable === 0) {
      return;
    }
    alloc[largest] -= removable;
    drift += removable;
  }
}

/**
 * What this tick should spawn and despawn to close the gap between the
 * allocation and what is actually alive.
 *
 * A band inside the deadband is left alone, boundary included: a delta sitting
 * exactly on the deadband is still noise, and reacting to it is what makes the
 * director oscillate at its own threshold. Both totals are capped zone-wide,
 * biggest gap first, and spawns are taken in full before despawns are
 * considered — being over-populated for one more tick is cheaper than
 * despawning an enemy a player was about to see.
 */
export const planAdjustments = concerns(
  SysTraceables.SYS_013_POPULATION_ALLOCATION_DECIDES_TARGET_AND_ADJUSTMENT_COUNTS_INDEPENDENT_OF_EXECUTION,
  realizes(
    [
      SwTraceables.SW_046_PLAN_ADJUSTMENTS_IGNORES_IN_DEADBAND_DELTAS_AND_NEVER_GOES_NEGATIVE,
      SwTraceables.SW_047_PLAN_ADJUSTMENTS_CAPS_TOTAL_SPAWNS_AND_DESPAWNS_AND_FAVOURS_SPAWNING,
    ],
    function planAdjustments(
      target: readonly number[],
      actual: readonly number[],
      cfg: DirectorConfig,
    ): AdjustmentPlan {
      const wanted: BandAdjustment[] = [];
      const excess: BandAdjustment[] = [];
      for (let band = 0; band < target.length; band++) {
        const delta = (target[band] ?? 0) - (actual[band] ?? 0);
        if (Math.abs(delta) <= cfg.deadband) {
          continue;
        }
        if (delta > 0) {
          wanted.push({ band, count: delta });
        } else {
          excess.push({ band, count: -delta });
        }
      }

      // Spawns first and in full, so their cap is never spent making room for
      // despawns; the two budgets are independent by construction.
      const spawns = takeUpTo(wanted, cfg.maxSpawnsPerTick);
      const despawns = takeUpTo(excess, cfg.maxDespawnsPerTick);
      return { spawns, despawns };
    },
  ),
);

/**
 * The first `budget` counts' worth of `wanted`, biggest band gap first so a
 * tight cap lands where the zone is furthest off target. Ties keep band order,
 * and a band whose share is cut to nothing is dropped rather than returned as
 * a zero-count entry.
 */
function takeUpTo(
  wanted: readonly BandAdjustment[],
  budget: number,
): BandAdjustment[] {
  const byNeed = [...wanted].sort(
    (left, right) => right.count - left.count || left.band - right.band,
  );
  const taken: BandAdjustment[] = [];
  let left = Math.max(0, budget);
  for (const entry of byNeed) {
    if (left === 0) {
      break;
    }
    const count = Math.min(entry.count, left);
    taken.push({ band: entry.band, count });
    left -= count;
  }
  return taken.sort((first, second) => first.band - second.band);
}

/**
 * Where a dead enemy comes back — or that it should not.
 *
 * This is the director's quiet half: most rebalancing happens here, at a
 * respawn that was going to happen anyway, rather than through a visible pop
 * near a player. If the band the enemy would return to is already at or over
 * target it retires; otherwise it re-rolls into whichever band across the zone
 * is furthest under target, which is not necessarily its own.
 */
export const pickRespawnBand = concerns(
  SysTraceables.SYS_013_POPULATION_ALLOCATION_DECIDES_TARGET_AND_ADJUSTMENT_COUNTS_INDEPENDENT_OF_EXECUTION,
  realizes(
    SwTraceables.SW_048_PASSIVE_RESPAWN_RETIRES_AN_OVER_TARGET_ENEMY_OR_RE_ROLLS_IT_INTO_THE_NEEDIEST_BAND,
    function pickRespawnBand(
      deadEnemyBand: number,
      targetByBand: readonly number[],
      actualByBand: readonly number[],
    ): RespawnDecision {
      // An enemy whose band no longer exists (a retuned zone drops a band
      // under a corpse still on its respawn timer) has no home to be at or
      // under target in. No spec covers it; retiring is the outcome that
      // cannot over-populate anything.
      const home = targetByBand[deadEnemyBand];
      if (home === undefined) {
        return 'retire';
      }
      if ((actualByBand[deadEnemyBand] ?? 0) >= home) {
        return 'retire';
      }

      // Seeded with the enemy's own band and compared strictly, so a tie
      // leaves it where it died: nothing is gained by moving an enemy to a
      // band that needs it exactly as much as home does.
      let neediest = deadEnemyBand;
      let largestShortfall = home - (actualByBand[deadEnemyBand] ?? 0);
      for (let band = 0; band < targetByBand.length; band++) {
        const shortfall = targetByBand[band] - (actualByBand[band] ?? 0);
        if (shortfall > largestShortfall) {
          largestShortfall = shortfall;
          neediest = band;
        }
      }
      return { band: neediest };
    },
  ),
);
