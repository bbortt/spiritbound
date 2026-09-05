import { describe, it, expect } from 'vitest';
import { RACE_BASE, computeEffectiveStats } from './effectiveStats';
import {
  computeRaceBase,
  computeEffectiveStats as serverComputeEffectiveStats,
} from '../../spacetimedb/src/rules/stats';
import {
  ArchTraceables,
  SwTraceables,
  verifies,
} from '../../src/clew/traceables/clew';
import type { ItemDefinition, StatBlock } from './db';

function item(mods: Partial<StatBlock>): ItemDefinition {
  const statModifiers = { ...zeroStats(), ...mods };
  return { statModifiers } as ItemDefinition;
}

function zeroStats(): StatBlock {
  const zeroed = { ...RACE_BASE };
  for (const key of Object.keys(zeroed) as (keyof StatBlock)[]) {
    (zeroed as any)[key] = 0;
  }
  return zeroed;
}

verifies(
  SwTraceables.SW_004_EFFECTIVE_STATS_STACK_RACE_BASE_WITH_GEAR_ADDITIVELY,
  () => {
    describe('computeEffectiveStats', () => {
      it('returns exactly the race base when no items are equipped', () => {
        expect(computeEffectiveStats([])).toEqual(RACE_BASE);
      });

      it('adds a single item modifier on top of the race base', () => {
        const result = computeEffectiveStats([
          item({ physicalAttack: 8, maxHp: 15 }),
        ]);
        expect(result.physicalAttack).toBe(RACE_BASE.physicalAttack + 8);
        expect(result.maxHp).toBe(RACE_BASE.maxHp + 15);
        // A field neither item touches stays at race base.
        expect(result.magicAttack).toBe(RACE_BASE.magicAttack);
      });

      it('sums modifiers additively across multiple items, including a field only one touches', () => {
        const result = computeEffectiveStats([
          item({ physicalAttack: 8, weaponDamage: 12 }),
          item({ physicalAttack: 6, maxMp: 25 }),
        ]);
        expect(result.physicalAttack).toBe(RACE_BASE.physicalAttack + 8 + 6);
        expect(result.weaponDamage).toBe(RACE_BASE.weaponDamage + 12);
        expect(result.maxMp).toBe(RACE_BASE.maxMp + 25);
        // A field no item touches stays at race base.
        expect(result.evasion).toBe(RACE_BASE.evasion);
      });
    });
  },
);

verifies(
  ArchTraceables.ARCH_002_CLIENT_EFFECTIVE_STATS_IS_A_HAND_SYNCED_DUPLICATE,
  () => {
    describe('client RACE_BASE / computeEffectiveStats match the server exactly', () => {
      it('RACE_BASE agrees with rules/stats.ts#computeRaceBase(0)', () => {
        expect(RACE_BASE).toEqual(computeRaceBase(0));
      });

      it('computeEffectiveStats agrees with the server for the same race base + item modifiers', () => {
        const mods = [
          { statModifiers: { ...zeroStats(), physicalAttack: 8, maxHp: 15 } },
          { statModifiers: { ...zeroStats(), magicDef: 10 } },
        ];
        const clientResult = computeEffectiveStats(mods as ItemDefinition[]);
        const serverResult = serverComputeEffectiveStats(
          computeRaceBase(0),
          mods,
        );
        expect(clientResult).toEqual(serverResult);
      });
    });
  },
);
