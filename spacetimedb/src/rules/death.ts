// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * rules/death.ts — card retention logic on permadeath.
 * Pure functions: no SpacetimeDB imports, no side effects.
 * The reducer in index.ts calls these and then writes results to tables.
 */

import type { Rarity, AttunementSlots, HandSlots } from '../types';
import { RARITY_ORDER } from '../types';
import {
  concerns,
  realizes,
  ArchTraceables,
  ConTraceables,
  SwTraceables,
  SysTraceables,
} from '../../../src/clew/traceables/clew';

// ─── Spirit level curves ──────────────────────────────────────────────────────
// These are stubs pending real playtest data (ability-balancer owns the numbers).
// The curves are isolated here so they're easy to tune without touching reducers.

/**
 * Convert accumulated bond XP into a spirit level (1–50).
 * Placeholder curve: roughly log-shaped so early levels feel fast.
 * To be replaced with a real XP table once playtest data exists.
 */
export const computeSpiritLevel = realizes(
  SwTraceables.SW_024_SPIRIT_LEVEL_IS_A_LOG_SHAPED_CURVE_OVER_BOND_XP,
  function computeSpiritLevel(bondXp: bigint): number {
    // ~100 XP = level 1, ~10 000 XP = level 10, ~1 000 000 XP = level 50
    const xp = Number(bondXp);
    return Math.max(1, Math.min(50, Math.floor(Math.log10(xp + 1) * 17)));
  },
);

/**
 * XP awarded for sacrificing a card of a given rarity.
 * Burning a legendary is a real decision: 3 000 XP vs ~10 for a common.
 */
export const SACRIFICE_XP: Record<Rarity, bigint> = {
  common: 10n,
  uncommon: 50n,
  rare: 200n,
  epic: 800n,
  legendary: 3000n,
};

// ─── Attunement slots (card survival on death) ────────────────────────────────

/**
 * How many cards of each rarity the spirit can hold safe across death.
 * Slots grow with spirit level; legendary slots are deliberately scarce.
 *
 * Design rule: you cannot hoard 10 legendaries through death.
 * You choose WHICH legendary is worth saving.
 */
export const computeAttunementSlots = realizes(
  SwTraceables.SW_023_ATTUNEMENT_SLOTS_PER_RARITY_GROW_WITH_SPIRIT_LEVEL_LEGENDARY_GATED_AT_THIRTY,
  function computeAttunementSlots(spiritLevel: number): AttunementSlots {
    const l = spiritLevel;
    return {
      common: Math.min(8, Math.floor(l * 0.6) + 1),
      uncommon: Math.min(6, Math.floor(l * 0.4)),
      rare: Math.min(4, Math.floor(l * 0.2)),
      epic: Math.min(2, Math.floor(l * 0.08)),
      legendary: Math.min(1, l >= 30 ? 1 : 0), // unlocks at spirit level 30
    };
  },
);

// ─── Rarity ceiling (what the spirit can hold at all) ─────────────────────────

/**
 * The highest card rarity this spirit can equip/swap.
 * Separate from attunement (what survives death) — this is
 * about what the spirit can HANDLE at all.
 *
 * The thresholds sit deliberately below the attunement thresholds for the same
 * tiers (rare at 12 here vs a first rare slot around 10 and a legendary slot at
 * 30 there): a player gets to wield a tier for a stretch of levels before they
 * can protect it, so an above-tier card is a risk before it is an asset.
 */
export const computeRarityCeiling = concerns(
  SysTraceables.SYS_010_SPIRIT_LEVEL_CAPS_THE_CARD_RARITY_A_PLAYER_CAN_HOLD_AT_ALL,
  realizes(
    SwTraceables.SW_033_THE_RARITY_CEILING_STEPS_AT_SPIRIT_LEVELS_FIVE_TWELVE_TWENTY_FIVE_AND_FORTY,
    function computeRarityCeiling(spiritLevel: number): Rarity {
      if (spiritLevel >= 40) return 'legendary';
      if (spiritLevel >= 25) return 'epic';
      if (spiritLevel >= 12) return 'rare';
      if (spiritLevel >= 5) return 'uncommon';
      return 'common';
    },
  ),
);

/**
 * Can a spirit of this level hold a card of this rarity at all?
 *
 * This is the EQUIP gate. It never consults the attunement budget and the
 * attunement budget never consults it — two separate spirit gates.
 */
export const canSpiritHandle = concerns(
  ConTraceables.CON_017_THE_RARITY_CEILING_AND_THE_ATTUNEMENT_SLOTS_ARE_TWO_SEPARATE_GATES,
  realizes(
    SwTraceables.SW_033_THE_RARITY_CEILING_STEPS_AT_SPIRIT_LEVELS_FIVE_TWELVE_TWENTY_FIVE_AND_FORTY,
    function canSpiritHandle(spiritLevel: number, cardRarity: Rarity): boolean {
      const ceiling = computeRarityCeiling(spiritLevel);
      return RARITY_ORDER.indexOf(cardRarity) <= RARITY_ORDER.indexOf(ceiling);
    },
  ),
);

/** Human-readable rarity, for the ceiling messages shown to players. */
export function rarityLabel(rarity: Rarity): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

/**
 * The rejection message shared by equipCard and toggleAttune, so the two paths
 * cannot drift into telling the player two different things.
 */
export const rarityCeilingError = realizes(
  SwTraceables.SW_034_EQUIPPING_OR_ATTUNING_ABOVE_THE_CEILING_IS_REJECTED_NAMING_THE_CEILING,
  function rarityCeilingError(spiritLevel: number, cardRarity: Rarity): string {
    const ceiling = computeRarityCeiling(spiritLevel);
    return (
      `Your spirit (Lv ${spiritLevel}) cannot handle ${cardRarity} cards yet — ` +
      `it can hold up to ${ceiling}. Level your spirit or find a stronger ` +
      `location spirit.`
    );
  },
);

// ─── Hand slots (how many cards can be equipped) ──────────────────────────────

/**
 * Active and passive hand slots granted by spirit level.
 * Starts 2/1 at level 1; caps at 10/5 around spirit level 40.
 * Spirit level is the gate, not character level.
 */
export const computeHandSlots = concerns(
  SysTraceables.SYS_007_THE_HAND_IS_A_SPIRIT_LEVEL_GATED_CARD_LOADOUT,
  realizes(
    SwTraceables.SW_027_HAND_SLOT_CAPS_GROW_WITH_SPIRIT_LEVEL_INDEPENDENTLY_FOR_ACTIVE_AND_PASSIVE,
    function computeHandSlots(spiritLevel: number): HandSlots {
      const l = spiritLevel;
      return {
        active: Math.min(10, 2 + Math.floor(l * 0.2)),
        passive: Math.min(5, 1 + Math.floor(l * 0.1)),
      };
    },
  ),
);

// ─── Retention logic ─────────────────────────────────────────────────────────

export interface CardForRetention {
  cardInstanceId: bigint;
  rarity: Rarity;
  attuned: boolean;
}

export interface RetentionResult {
  /** Card IDs that survive death (attuned + within rarity slot budget). */
  surviving: Set<bigint>;
  /** Card IDs to be permanently deleted. */
  lost: Set<bigint>;
}

/**
 * Compute which cards survive permadeath.
 *
 * Rules:
 * - Only ATTUNED cards are eligible to survive.
 * - Attuned cards consume a rarity-specific slot on the spirit.
 * - If more cards are attuned in a rarity tier than slots allow
 *   (e.g. UI allowed an extra attune before spirit leveled down),
 *   excess cards are lost (fail-safe, not normal path).
 * - Un-attuned cards are always lost.
 *
 * No RNG — the player decided what was safe before venturing out.
 */
export const computeRetention = realizes(
  SwTraceables.SW_022_ONLY_ATTUNED_CARDS_SURVIVE_CONSUMING_A_RARITY_SLOT_EACH,
  function computeRetention(
    cards: CardForRetention[],
    slots: AttunementSlots,
  ): RetentionResult {
    const surviving = new Set<bigint>();
    const lost = new Set<bigint>();

    // Separate attuned from un-attuned
    const attuned = cards.filter((c) => c.attuned);
    const unAttuned = cards.filter((c) => !c.attuned);

    // Process attuned cards, consuming slots per rarity
    const remaining = { ...slots };
    for (const card of attuned) {
      const r = card.rarity;
      if (remaining[r] > 0) {
        remaining[r]--;
        surviving.add(card.cardInstanceId);
      } else {
        // Over-attuned (UI should prevent this, but guard anyway)
        lost.add(card.cardInstanceId);
      }
    }

    // Un-attuned are always destroyed
    for (const card of unAttuned) {
      lost.add(card.cardInstanceId);
    }

    return { surviving, lost };
  },
);

// ─── Character level curve ────────────────────────────────────────────────────

/**
 * Convert accumulated character XP into a level (1–50).
 * Design goals: 1-10 fast, 10-30 medium, 30-50 slower.
 * After death, reaching prior level should take ~40-50% of original time.
 * Stub — replace with real XP table after playtest.
 *
 * Duplicated byte-for-byte at client/src/levelCurve.ts (the client's XP bar
 * needs this curve but can't import across the client/server module boundary
 * — see ARCHITECTURE.md). Keep both copies in sync by hand.
 */
export const computeCharacterLevel = concerns(
  ArchTraceables.ARCH_006_CLIENT_LEVEL_CURVE_DUPLICATES_COMPUTE_CHARACTER_LEVEL_AND_DERIVES_THRESHOLDS_BY_BINARY_SEARCH,
  realizes(
    SwTraceables.SW_021_CHARACTER_LEVEL_IS_A_FIXED_POWER_CURVE_OVER_XP_CLAMPED_ONE_TO_FIFTY,
    function computeCharacterLevel(xp: bigint): number {
      const x = Number(xp);
      // Rough power curve; real values owned by ability-balancer in BALANCE.md
      return Math.max(1, Math.min(50, Math.floor(Math.pow(x / 80, 0.55))));
    },
  ),
);
