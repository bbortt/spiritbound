// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { describe, it, expect } from 'vitest';
import { computeRegenTick, hpWindowStartMicros, nothingToPay } from './regen';
import {
  verifies,
  SwTraceables,
  ConTraceables,
} from '../../../src/clew/traceables/clew';

const SECOND = 1_000_000n;

/** Run `ticks` successive 1 s ticks, carrying the stamp as the reducer does. */
function runTicks(
  ticks: number,
  ratePerSecond: number,
  opts: { current?: number; max?: number } = {},
) {
  let paidUpToMicros = 0n;
  let now = 0n;
  let current = opts.current ?? 0;
  const max = opts.max ?? 100;
  const granted: number[] = [];

  for (let i = 0; i < ticks; i++) {
    now += SECOND;
    const result = computeRegenTick({
      ratePerSecond,
      windowStartMicros: paidUpToMicros,
      nowMicros: now,
      current,
      max,
    });
    granted.push(result.granted);
    current += result.granted;
    paidUpToMicros = result.paidUpToMicros;
  }
  return { granted, current, paidUpToMicros, now };
}

verifies(
  SwTraceables.SW_058_EACH_RESOURCE_CARRIES_ITS_OWN_PAID_UP_TO_STAMP,
  () => {
    describe('computeRegenTick — the carry', () => {
      it('pays a 0.5/s rate as 1 every other tick, not 1 or 0 per tick', () => {
        const { granted, current } = runTicks(10, 0.5);
        expect(granted).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
        expect(current).toBe(5); // not 10 (round) and not 0 (floor)
      });

      it('advances the stamp only by the time it paid for', () => {
        const first = computeRegenTick({
          ratePerSecond: 0.5,
          windowStartMicros: 0n,
          nowMicros: SECOND,
          current: 0,
          max: 100,
        });
        // One second elapsed, nothing earned yet: the second is carried.
        expect(first.granted).toBe(0);
        expect(first.paidUpToMicros).toBe(0n);

        const second = computeRegenTick({
          ratePerSecond: 0.5,
          windowStartMicros: 0n,
          nowMicros: 2n * SECOND,
          current: 0,
          max: 100,
        });
        expect(second.granted).toBe(1);
        expect(second.paidUpToMicros).toBe(2n * SECOND);
      });

      it('keeps the fractional part of a rate above one per tick', () => {
        const result = computeRegenTick({
          ratePerSecond: 2.5,
          windowStartMicros: 0n,
          nowMicros: SECOND,
          current: 0,
          max: 100,
        });
        expect(result.granted).toBe(2);
        // 2 units at 2.5/s is 0.8 s of the 1 s elapsed; 0.2 s carries.
        expect(result.paidUpToMicros).toBe(800_000n);
      });

      it('holds a rate of 0.3/s to exactly 3 units over 10 s', () => {
        expect(runTicks(10, 0.3).current).toBe(3);
      });

      it('grants nothing when the window has not opened yet', () => {
        const result = computeRegenTick({
          ratePerSecond: 0.5,
          windowStartMicros: 10n * SECOND,
          nowMicros: 4n * SECOND,
          current: 0,
          max: 100,
        });
        expect(result.granted).toBe(0);
        expect(result.paidUpToMicros).toBe(10n * SECOND);
      });

      it('neither grants nor divides by a rate of 0', () => {
        const result = computeRegenTick({
          ratePerSecond: 0,
          windowStartMicros: 0n,
          nowMicros: 60n * SECOND,
          current: 10,
          max: 100,
        });
        expect(result.granted).toBe(0);
        expect(result.paidUpToMicros).toBe(0n);
      });
    });
  },
);

verifies(
  ConTraceables.CON_037_REGEN_ONLY_ADDS_INSIDE_A_LIVING_CHARACTERS_HEADROOM,
  () => {
    describe('computeRegenTick — headroom', () => {
      it('lands exactly on max rather than overshooting', () => {
        const result = computeRegenTick({
          ratePerSecond: 10,
          windowStartMicros: 0n,
          nowMicros: 10n * SECOND,
          current: 97,
          max: 100,
        });
        expect(result.granted).toBe(3);
      });

      it('leaves the stamp untouched when it can pay nothing, so the tick writes no row', () => {
        // A full character sits out a long quiet spell. The tick must report
        // "nothing happened" rather than advancing the stamp, or an idle
        // server writes one row per character per second.
        const input = {
          ratePerSecond: 0.5,
          windowStartMicros: 0n,
          nowMicros: 600n * SECOND,
          current: 100,
          max: 100,
        };
        const result = computeRegenTick(input);
        expect(result.granted).toBe(0);
        expect(result.paidUpToMicros).toBe(0n);
        expect(nothingToPay(input, result)).toBe(true);

        // Carrying a remainder is NOT "nothing happened" twice over: the
        // stamp is also unchanged, which is exactly why the caller can skip
        // the write and still pay correctly on the next tick.
        const carrying = {
          ratePerSecond: 0.5,
          windowStartMicros: 0n,
          nowMicros: SECOND,
          current: 0,
          max: 100,
        };
        expect(nothingToPay(carrying, computeRegenTick(carrying))).toBe(true);

        const paying = {
          ratePerSecond: 0.5,
          windowStartMicros: 0n,
          nowMicros: 2n * SECOND,
          current: 0,
          max: 100,
        };
        expect(nothingToPay(paying, computeRegenTick(paying))).toBe(false);
      });

      it('grants nothing to a resource already over its maximum', () => {
        // Reachable through a gear change that lowers maxHp.
        const result = computeRegenTick({
          ratePerSecond: 0.5,
          windowStartMicros: 0n,
          nowMicros: 60n * SECOND,
          current: 120,
          max: 100,
        });
        expect(result.granted).toBe(0);
      });
    });
  },
);

verifies(SwTraceables.SW_057_OUT_OF_COMBAT_GATES_HP_REGEN_ONLY, () => {
  describe('hpWindowStartMicros — the gate as a lower bound', () => {
    it('is the paid-up-to stamp for a character that never fought', () => {
      expect(hpWindowStartMicros(5n * SECOND, undefined, 6)).toBe(5n * SECOND);
    });

    it('pushes the window past the delay after combat', () => {
      expect(hpWindowStartMicros(5n * SECOND, 100n * SECOND, 6)).toBe(
        106n * SECOND,
      );
    });

    it('leaves a long-settled fight without a redeemable backlog', () => {
      // Damaged at 100s, delay 6s, now 120s: the window is 106..120, so only
      // 14 s accrue — not the whole span since the stamp at 5 s.
      const windowStart = hpWindowStartMicros(5n * SECOND, 100n * SECOND, 6);
      const result = computeRegenTick({
        ratePerSecond: 0.5,
        windowStartMicros: windowStart,
        nowMicros: 120n * SECOND,
        current: 10,
        max: 100,
      });
      expect(result.granted).toBe(7); // floor(0.5 * 14), not floor(0.5 * 115)
    });

    it('keeps the stamp when it is already past the delay', () => {
      expect(hpWindowStartMicros(200n * SECOND, 100n * SECOND, 6)).toBe(
        200n * SECOND,
      );
    });
  });
});
