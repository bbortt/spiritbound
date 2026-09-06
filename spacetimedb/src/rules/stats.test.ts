// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { describe, it, expect } from 'vitest';
import {
  computeRaceBase,
  computeEffectiveStats,
  type ItemDefinitionStats,
} from './stats';
import { EMPTY_STAT_BLOCK, type StatBlock } from '../types';
import { verifies, SwTraceables } from '../../../src/clew/traceables/clew';

function item(modifiers: Partial<StatBlock>): ItemDefinitionStats {
  return { statModifiers: { ...EMPTY_STAT_BLOCK, ...modifiers } };
}

verifies(
  SwTraceables.SW_004_EFFECTIVE_STATS_STACK_RACE_BASE_WITH_GEAR_ADDITIVELY,
  () => {
    describe('computeEffectiveStats', () => {
      it('returns the race base unchanged when no items are equipped', () => {
        const base = computeRaceBase(0);
        expect(computeEffectiveStats(base, [])).toEqual(base);
      });

      it('stacks every equipped item additively onto the race base', () => {
        const base = computeRaceBase(0);
        const a = item({ maxHp: 15, physicalDef: 8 });
        const b = item({ maxHp: 30, magicDef: 10 });

        const result = computeEffectiveStats(base, [a, b]);

        expect(result.maxHp).toBe(base.maxHp + 15 + 30);
        expect(result.physicalDef).toBe(base.physicalDef + 8);
        expect(result.magicDef).toBe(base.magicDef + 10);
        // A field neither item touches stays at the race base.
        expect(result.evasion).toBe(base.evasion);
      });

      it('a field only one item modifies reflects only that item', () => {
        const base = computeRaceBase(0);
        const a = item({ evasion: 0.03 });
        const result = computeEffectiveStats(base, [a]);
        expect(result.evasion).toBe(base.evasion + 0.03);
        expect(result.parry).toBe(base.parry);
      });
    });
  },
);
