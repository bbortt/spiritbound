// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * rules/regen.ts — how much a resource recovers on one tick, and how much of
 * the elapsed time that payment consumes.
 *
 * Pure functions: no SpacetimeDB imports, no side effects. Time arrives as
 * microsecond counts (what `ctx.timestamp.microsSinceUnixEpoch` gives) rather
 * than as a Timestamp, so the arithmetic stays independent of the host.
 */

import {
  realizes,
  SwTraceables,
  ConTraceables,
} from '../../../src/clew/traceables/clew';

const MICROS_PER_SECOND = 1_000_000;

export interface RegenInput {
  /** Effective hpRegen/mpRegen — units per **second**, not per tick. */
  ratePerSecond: number;
  /**
   * The instant this resource has already been paid up to. For MP that is
   * `lastMpRegenAt`; for HP it is the later of `lastHpRegenAt` and the moment
   * the out-of-combat delay expired, so a fight yields no window at all.
   */
  windowStartMicros: bigint;
  nowMicros: bigint;
  current: number;
  max: number;
}

export interface RegenResult {
  /** Whole units to add to the resource. Never negative. */
  granted: number;
  /** The new paid-up-to stamp. Never earlier than `windowStartMicros`. */
  paidUpToMicros: bigint;
}

/** True when this tick changed nothing, so the caller must not write a row. */
export function nothingToPay(input: RegenInput, result: RegenResult): boolean {
  return (
    result.granted === 0 && result.paidUpToMicros === input.windowStartMicros
  );
}

/**
 * Compute one resource's tick.
 *
 * The sub-unit remainder is carried by *not* advancing the stamp all the way
 * to now: it moves forward by exactly the time the granted whole units paid
 * for, so 0.5/s pays 1 every two seconds forever instead of rounding to 1 per
 * tick (double rate) or 0 per tick (dead stat).
 *
 * This never resets a stamp to escape a stale window. A resource sitting full
 * for an hour would otherwise have an hour of redeemable regen waiting for the
 * first point of damage — so the paths that *lower* a resource, or re-base its
 * maximum, restamp its clock instead. Doing it there costs no extra write
 * (those paths already update the row) and keeps this tick silent on an idle
 * server, where the alternative was a row update per character per second.
 */
export const computeRegenTick = realizes(
  [
    SwTraceables.SW_058_EACH_RESOURCE_CARRIES_ITS_OWN_PAID_UP_TO_STAMP,
    ConTraceables.CON_037_REGEN_ONLY_ADDS_INSIDE_A_LIVING_CHARACTERS_HEADROOM,
  ] as const,
  function computeRegenTick(input: RegenInput): RegenResult {
    const { ratePerSecond, windowStartMicros, nowMicros, current, max } = input;

    // Nothing payable: a zero rate (which would also divide by zero below), a
    // window that has not opened, a full resource, or not enough elapsed time
    // to have earned a whole unit. The stamp is returned untouched, so the
    // caller can tell "nothing happened" from "something did" and skip the
    // write entirely — see `nothingToPay` below.
    const headroom = max - current;
    if (ratePerSecond <= 0 || headroom <= 0) {
      return { granted: 0, paidUpToMicros: windowStartMicros };
    }

    const elapsedMicros = nowMicros - windowStartMicros;
    if (elapsedMicros <= 0n) {
      return { granted: 0, paidUpToMicros: windowStartMicros };
    }

    const elapsedSeconds = Number(elapsedMicros) / MICROS_PER_SECOND;
    const earned = Math.floor(ratePerSecond * elapsedSeconds);
    if (earned <= 0) return { granted: 0, paidUpToMicros: windowStartMicros };

    const granted = Math.min(earned, headroom);
    if (granted < earned) {
      // Filled up with window to spare — which is the normal outcome for
      // anyone who idles or logs off for a while, not just an exotic case.
      // The surplus must be discarded rather than carried: a character that
      // sat out an hour would otherwise hold ~an hour of redeemable regen and
      // have the next hit healed back on the following tick. This branch
      // always grants something, so writing the row costs nothing extra.
      return { granted, paidUpToMicros: nowMicros };
    }

    const paidMicros = BigInt(
      Math.round((granted / ratePerSecond) * MICROS_PER_SECOND),
    );
    return { granted, paidUpToMicros: windowStartMicros + paidMicros };
  },
);

/**
 * When HP is allowed to start accruing: the later of what it has already been
 * paid for and the moment the out-of-combat delay expired. MP does not use
 * this — it accrues straight from its own stamp, in combat and out.
 *
 * Expressing the gate as a lower bound on the window, rather than as an event
 * that clears a stamp, is what keeps a long fight from leaving a redeemable
 * backlog without any writer having to remember to clear anything.
 */
export const hpWindowStartMicros = realizes(
  SwTraceables.SW_057_OUT_OF_COMBAT_GATES_HP_REGEN_ONLY,
  function hpWindowStartMicros(
    lastHpRegenAtMicros: bigint,
    lastCombatAtMicros: bigint | undefined,
    outOfCombatSeconds: number,
  ): bigint {
    if (lastCombatAtMicros === undefined) return lastHpRegenAtMicros;
    const delayMicros = BigInt(
      Math.round(outOfCombatSeconds * MICROS_PER_SECOND),
    );
    return maxOf(lastHpRegenAtMicros, lastCombatAtMicros + delayMicros);
  },
);

function maxOf(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}
