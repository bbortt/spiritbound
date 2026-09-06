// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import {
  ArchTraceables,
  ConTraceables,
  SysTraceables,
  SwTraceables,
  concerns,
} from '../../src/clew/traceables/clew';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const RARITY_ORDER: readonly Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
] as const;

export interface AttunementSlots {
  common: number;
  uncommon: number;
  rare: number;
  epic: number;
  legendary: number;
}

export interface HandSlots {
  active: number;
  passive: number;
}

/**
 * Mirrors spacetimedb/src/rules/death.ts#computeHandSlots and
 * #computeAttunementSlots exactly. Previously this project carried a
 * DRIFTED local copy directly in CollectionPanel.ts (a single combined
 * attunement number instead of a per-rarity breakdown, and formulas that no
 * longer matched the server) — corrected here and extracted so it can be
 * unit-tested against the real server formulas. The server-side functions
 * are the canonical implementation; this client copy is `concerns`-only.
 */
export const computeHandSlots = concerns(
  [
    SwTraceables.SW_027_HAND_SLOT_CAPS_GROW_WITH_SPIRIT_LEVEL_INDEPENDENTLY_FOR_ACTIVE_AND_PASSIVE,
    ArchTraceables.ARCH_008_COLLECTION_PANELS_CLIENT_DUPLICATE_IS_CORRECTED_TO_MATCH_RULES_DEATH_EXACTLY,
  ],
  function computeHandSlots(spiritLevel: number): HandSlots {
    const l = spiritLevel;
    return {
      active: Math.min(10, 2 + Math.floor(l * 0.2)),
      passive: Math.min(5, 1 + Math.floor(l * 0.1)),
    };
  },
);

export const computeAttunementSlots = concerns(
  ArchTraceables.ARCH_008_COLLECTION_PANELS_CLIENT_DUPLICATE_IS_CORRECTED_TO_MATCH_RULES_DEATH_EXACTLY,
  function computeAttunementSlots(spiritLevel: number): AttunementSlots {
    const l = spiritLevel;
    return {
      common: Math.min(8, Math.floor(l * 0.6) + 1),
      uncommon: Math.min(6, Math.floor(l * 0.4)),
      rare: Math.min(4, Math.floor(l * 0.2)),
      epic: Math.min(2, Math.floor(l * 0.08)),
      legendary: Math.min(1, l >= 30 ? 1 : 0),
    };
  },
);

/**
 * Mirrors spacetimedb/src/rules/death.ts#computeRarityCeiling and
 * #canSpiritHandle exactly — the panels need to know which cards to lock
 * before the player clicks, but the server's copy stays canonical and is what
 * actually enforces the gate. Keep both copies in sync by hand.
 */
export const computeRarityCeiling = concerns(
  [
    SysTraceables.SYS_010_SPIRIT_LEVEL_CAPS_THE_CARD_RARITY_A_PLAYER_CAN_HOLD_AT_ALL,
    ArchTraceables.ARCH_008_COLLECTION_PANELS_CLIENT_DUPLICATE_IS_CORRECTED_TO_MATCH_RULES_DEATH_EXACTLY,
  ],
  function computeRarityCeiling(spiritLevel: number): Rarity {
    if (spiritLevel >= 40) return 'legendary';
    if (spiritLevel >= 25) return 'epic';
    if (spiritLevel >= 12) return 'rare';
    if (spiritLevel >= 5) return 'uncommon';
    return 'common';
  },
);

export const canSpiritHandle = concerns(
  [
    ConTraceables.CON_017_THE_RARITY_CEILING_AND_THE_ATTUNEMENT_SLOTS_ARE_TWO_SEPARATE_GATES,
    ArchTraceables.ARCH_008_COLLECTION_PANELS_CLIENT_DUPLICATE_IS_CORRECTED_TO_MATCH_RULES_DEATH_EXACTLY,
  ],
  function canSpiritHandle(spiritLevel: number, cardRarity: Rarity): boolean {
    const ceiling = computeRarityCeiling(spiritLevel);
    return RARITY_ORDER.indexOf(cardRarity) <= RARITY_ORDER.indexOf(ceiling);
  },
);

/** "uncommon" → "Uncommon", for the ceiling text shown to players. */
export function rarityLabel(rarity: Rarity): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

/** The spirit-panel header line, e.g. "Spirit Lv 8 — can handle up to Uncommon cards". */
export const spiritCeilingHeadline = concerns(
  SwTraceables.SW_035_CARDS_ABOVE_THE_CEILING_RENDER_LOCKED_AND_THE_HEADER_NAMES_THE_CEILING,
  function spiritCeilingHeadline(spiritLevel: number): string {
    const ceiling = rarityLabel(computeRarityCeiling(spiritLevel));
    return `Spirit Lv ${spiritLevel} — can handle up to ${ceiling} cards`;
  },
);
