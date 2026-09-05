import {
  ArchTraceables,
  SwTraceables,
  concerns,
} from '../../src/clew/traceables/clew';

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
