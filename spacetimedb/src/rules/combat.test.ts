// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { describe, it, expect } from 'vitest';
import { resolveHit, resolveHeal, scalePower, type HitInput } from './combat';
import { EMPTY_STAT_BLOCK, type StatBlock } from '../types';
import {
  verifies,
  SwTraceables,
  ConTraceables,
} from '../../../src/clew/traceables/clew';

function stats(overrides: Partial<StatBlock>): StatBlock {
  return { ...EMPTY_STAT_BLOCK, ...overrides };
}

function baseInput(overrides: Partial<HitInput> = {}): HitInput {
  return {
    cardBasePower: 100,
    cardMergeLevel: 0,
    cardSchool: 'physical',
    cardBaseShape: 'cone',
    characterLevel: 0,
    weaponSchool: 'physical',
    weaponWidth: 0.4,
    weaponRange: 150,
    attackerStats: EMPTY_STAT_BLOCK,
    defenderStats: EMPTY_STAT_BLOCK,
    randomRoll: 0.99,
    ...overrides,
  };
}

verifies(
  [
    SwTraceables.SW_007_RESOLVE_HIT_COMBINES_SCALING_MITIGATION_AND_CRIT_INTO_ONE_DAMAGE_NUMBER,
    ConTraceables.CON_001_DAMAGE_NEVER_RESOLVES_BELOW_MIN_DAMAGE,
    ConTraceables.CON_002_GLANCING_AVOIDANCE_CAPS_AT_TWENTY_PERCENT_REDUCTION,
  ] as const,
  () => {
    describe('resolveHit', () => {
      it('scales base power by character level', () => {
        const noLevel = resolveHit(baseInput({ characterLevel: 0 }));
        const withLevel = resolveHit(baseInput({ characterLevel: 10 }));
        expect(withLevel.damage).toBeGreaterThan(noLevel.damage);
        expect(withLevel.damage).toBe(Math.round(scalePower(100, 10)));
      });

      it('applies the weapon attack bonus only when the card school matches the weapon school', () => {
        const matched = resolveHit(
          baseInput({
            cardSchool: 'physical',
            weaponSchool: 'physical',
            attackerStats: stats({ physicalAttack: 50 }),
          }),
        );
        const mismatched = resolveHit(
          baseInput({
            cardSchool: 'physical',
            weaponSchool: 'magical',
            attackerStats: stats({ physicalAttack: 50 }),
          }),
        );
        expect(matched.damage).toBeGreaterThan(mismatched.damage);
      });

      it('never resolves below MIN_DAMAGE even against overwhelming defense', () => {
        const result = resolveHit(
          baseInput({
            cardBasePower: 1,
            defenderStats: stats({ physicalDef: 100000 }),
          }),
        );
        expect(result.damage).toBeGreaterThanOrEqual(1);
      });

      it('never resolves below MIN_DAMAGE even at a guaranteed crit against overwhelming defense', () => {
        const result = resolveHit(
          baseInput({
            cardBasePower: 1,
            defenderStats: stats({ physicalDef: 100000 }),
            attackerStats: stats({ physicalCrit: 1 }),
            randomRoll: 0,
          }),
        );
        expect(result.damage).toBeGreaterThanOrEqual(1);
      });

      it('caps glancing avoidance at 20% even when defensive stats far exceed any accuracy counter', () => {
        const result = resolveHit(
          baseInput({
            defenderStats: stats({ evasion: 0.9, parry: 0.9 }),
            attackerStats: stats({ accuracy: 0 }),
          }),
        );
        expect(result.glancingFraction).toBe(0.2);
      });

      it('accuracy shrinks effective avoidance below the 20% cap', () => {
        const result = resolveHit(
          baseInput({
            defenderStats: stats({ evasion: 0.1, parry: 0.1 }),
            attackerStats: stats({ accuracy: 10 }),
          }),
        );
        expect(result.glancingFraction).toBeLessThan(0.1);
      });

      it('crits deal more damage than a guaranteed non-crit at the same inputs', () => {
        const crit = resolveHit(
          baseInput({
            attackerStats: stats({ physicalCrit: 1 }),
            randomRoll: 0,
          }),
        );
        const noCrit = resolveHit(
          baseInput({
            attackerStats: stats({ physicalCrit: 0 }),
            randomRoll: 0.99,
          }),
        );
        expect(crit.damage).toBeGreaterThan(noCrit.damage);
        expect(crit.isCrit).toBe(true);
        expect(noCrit.isCrit).toBe(false);
      });
    });
  },
);

verifies(
  SwTraceables.SW_009_RESOLVE_HEAL_SCALES_POWER_BY_LEVEL_AND_HEALING_BOOST,
  () => {
    describe('resolveHeal', () => {
      it('matches the exact formula: (scaledPower + magicAttack) * healingBoost, rounded', () => {
        const healed = resolveHeal({
          cardBasePower: 100,
          characterLevel: 10,
          healerStats: stats({ magicAttack: 20, healingBoost: 1.5 }),
        });
        const expected = Math.round((scalePower(100, 10) + 20) * 1.5);
        expect(healed).toBe(expected);
      });

      it('floors at 1 even for a negative or zero-power heal', () => {
        const healed = resolveHeal({
          cardBasePower: 0,
          characterLevel: 0,
          healerStats: stats({ magicAttack: 0, healingBoost: 0 }),
        });
        expect(healed).toBe(1);
      });
    });
  },
);
