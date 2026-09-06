// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * rules/stats.ts — effective stat computation (race base + gear).
 * Pure functions: no SpacetimeDB imports, no side effects.
 */

import { addStats, type StatBlock } from '../types';
import {
  realizes,
  concerns,
  SwTraceables,
  SysTraceables,
  ArchTraceables,
} from '../../../src/clew/traceables/clew';

/**
 * Structural subset of an equipped item's definition. Kept minimal (rather than
 * importing the SpacetimeDB itemDefinition row type) so this file stays free of
 * SpacetimeDB imports and portable, matching the rest of rules/.
 */
export interface ItemDefinitionStats {
  statModifiers: StatBlock;
}

/**
 * Race base stats — vertical slice: one hard-coded human placeholder.
 * A real Race table with per-race distributions comes later; keeping this
 * isolated here means swapping it out won't touch combat or reducer code.
 */
export const computeRaceBase = concerns(
  SysTraceables.SYS_001_EQUIP_GEAR_TO_CHANGE_COMBAT_STATS,
  function computeRaceBase(_raceId: number): StatBlock {
    return {
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
  },
);

/**
 * Stack race base + every equipped item's stat modifiers additively.
 * Never stored on any row — always derived fresh from current gear.
 */
export const computeEffectiveStats = concerns(
  ArchTraceables.ARCH_002_CLIENT_EFFECTIVE_STATS_IS_A_HAND_SYNCED_DUPLICATE,
  realizes(
    SwTraceables.SW_004_EFFECTIVE_STATS_STACK_RACE_BASE_WITH_GEAR_ADDITIVELY,
    function computeEffectiveStats(
      raceBase: StatBlock,
      equippedItems: ItemDefinitionStats[],
    ): StatBlock {
      return equippedItems.reduce(
        (acc, item) => addStats(acc, item.statModifiers),
        raceBase,
      );
    },
  ),
);
