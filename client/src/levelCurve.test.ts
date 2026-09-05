import { describe, it, expect } from 'vitest';
import { computeCharacterLevel, xpForLevel, xpProgress } from './levelCurve';
import {
  SwTraceables,
  ArchTraceables,
  verifies,
} from '../../src/clew/traceables/clew';

// Try the real cross-package import first so this test genuinely catches drift
// against the server's actual formula.
let serverComputeCharacterLevel: ((xp: bigint) => number) | null = null;
let usedFallbackOracle = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const serverModule = await import('../../spacetimedb/src/rules/death.ts');
  serverComputeCharacterLevel = serverModule.computeCharacterLevel;
} catch {
  usedFallbackOracle = true;
}

// Fallback oracle: docs/BALANCE.md's documented formula, used only if the
// cross-package import above doesn't resolve (client and server are separate
// TypeScript projects per 004-technology-contract.md).
function oracleComputeCharacterLevel(xp: bigint): number {
  const x = Number(xp);
  return Math.max(1, Math.min(50, Math.floor(Math.pow(x / 80, 0.55))));
}

verifies(
  [
    SwTraceables.SW_021_CHARACTER_LEVEL_IS_A_FIXED_POWER_CURVE_OVER_XP_CLAMPED_ONE_TO_FIFTY,
    ArchTraceables.ARCH_006_CLIENT_LEVEL_CURVE_DUPLICATES_COMPUTE_CHARACTER_LEVEL_AND_DERIVES_THRESHOLDS_BY_BINARY_SEARCH,
  ],
  () => {
    describe('computeCharacterLevel (client duplicate)', () => {
      it('matches the server curve across a swept range of XP values', () => {
        const oracle = usedFallbackOracle
          ? oracleComputeCharacterLevel
          : serverComputeCharacterLevel!;
        const xps = [
          0n,
          1n,
          10n,
          79n,
          80n,
          100n,
          500n,
          1000n,
          5000n,
          20000n,
          100000n,
          5000000n,
        ];
        for (const xp of xps) {
          expect(computeCharacterLevel(xp)).toBe(oracle(xp));
        }
      });

      it('clamps to level 1 at zero XP and never exceeds level 50', () => {
        expect(computeCharacterLevel(0n)).toBe(1);
        expect(computeCharacterLevel(10_000_000_000n)).toBe(50);
      });

      it('is monotonically non-decreasing as XP increases', () => {
        let prev = computeCharacterLevel(0n);
        for (let xp = 0n; xp <= 200000n; xp += 4000n) {
          const level = computeCharacterLevel(xp);
          expect(level).toBeGreaterThanOrEqual(prev);
          prev = level;
        }
      });
    });

    describe('xpForLevel', () => {
      it('returns 0 for level 1 or below', () => {
        expect(xpForLevel(1)).toBe(0n);
        expect(xpForLevel(0)).toBe(0n);
      });

      it('is the smallest xp at which computeCharacterLevel reaches that level', () => {
        for (const level of [2, 5, 10, 25, 40, 50]) {
          const xp = xpForLevel(level);
          expect(computeCharacterLevel(xp)).toBeGreaterThanOrEqual(level);
          if (xp > 0n)
            expect(computeCharacterLevel(xp - 1n)).toBeLessThan(level);
        }
      });

      it('clamps above level 50 to the same value as level 50', () => {
        expect(xpForLevel(75)).toBe(xpForLevel(50));
      });
    });

    describe('xpProgress', () => {
      it('reports the current level and a band that contains the given xp', () => {
        const xp = 5000n;
        const progress = xpProgress(xp);
        expect(progress.level).toBe(computeCharacterLevel(xp));
        expect(progress.levelStart).toBeLessThanOrEqual(xp);
        expect(progress.levelEnd).toBeGreaterThan(xp);
      });

      it('at level 50, levelEnd equals levelStart (no further band)', () => {
        const progress = xpProgress(10_000_000_000n);
        expect(progress.level).toBe(50);
        expect(progress.levelEnd).toBe(progress.levelStart);
      });
    });
  },
);
