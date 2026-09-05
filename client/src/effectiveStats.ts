import type { StatBlock, ItemDefinition } from './db';
import {
  ArchTraceables,
  SwTraceables,
  concerns,
} from '../../src/clew/traceables/clew';

/**
 * Mirrors spacetimedb/src/rules/stats.ts#computeRaceBase(0) exactly. The server
 * never transmits a computed effectiveStats value (it's derived fresh in
 * reducers and never stored — see index.ts's own "derived values ... are
 * computed in rules/ and never stored" rule), so any client-side display of
 * total stats has to redo the same pure math. Keep this in sync by hand if
 * rules/stats.ts changes.
 */
export const RACE_BASE: StatBlock = {
  power: 10,
  knowledge: 10,
  health: 12,
  will: 10,
  agility: 10,
  precision: 10,
  maxHp: 100,
  hpRegen: 0.5,
  maxMp: 60,
  mpRegen: 0.3,
  moveSpeed: 1.0,
  weaponDamage: 0,
  physicalAttack: 0,
  magicAttack: 0,
  attackSpeed: 1.0,
  castingSpeed: 1.0,
  physicalCrit: 0,
  magicCrit: 0,
  accuracy: 0,
  magicAccuracy: 0,
  healingBoost: 1.0,
  physicalDef: 0,
  magicDef: 0,
  evasion: 0,
  parry: 0,
  block: 0,
  magicResist: 0,
};

/**
 * Mirrors rules/stats.ts#computeEffectiveStats — race base + additive gear.
 * The server-side function is the canonical `realizes` for SW-004; this is a
 * display-only duplicate, hence `concerns` rather than `realizes` here.
 */
export const computeEffectiveStats = concerns(
  [
    ArchTraceables.ARCH_002_CLIENT_EFFECTIVE_STATS_IS_A_HAND_SYNCED_DUPLICATE,
    SwTraceables.SW_004_EFFECTIVE_STATS_STACK_RACE_BASE_WITH_GEAR_ADDITIVELY,
  ],
  function computeEffectiveStats(equippedDefs: ItemDefinition[]): StatBlock {
    const total = { ...RACE_BASE };
    for (const def of equippedDefs) {
      for (const key of Object.keys(total) as (keyof StatBlock)[]) {
        (total as any)[key] += def.statModifiers[key];
      }
    }
    return total;
  },
);
