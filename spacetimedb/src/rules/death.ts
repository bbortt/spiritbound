/**
 * rules/death.ts — card retention logic on permadeath.
 * Pure functions: no SpacetimeDB imports, no side effects.
 * The reducer in index.ts calls these and then writes results to tables.
 */

import type { Rarity, AttunementSlots, HandSlots } from '../types';

// ─── Spirit level curves ──────────────────────────────────────────────────────
// These are stubs pending real playtest data (ability-balancer owns the numbers).
// The curves are isolated here so they're easy to tune without touching reducers.

/**
 * Convert accumulated bond XP into a spirit level (1–50).
 * Placeholder curve: roughly log-shaped so early levels feel fast.
 * To be replaced with a real XP table once playtest data exists.
 */
export function computeSpiritLevel(bondXp: bigint): number {
  // ~100 XP = level 1, ~10 000 XP = level 10, ~1 000 000 XP = level 50
  const xp = Number(bondXp);
  return Math.max(1, Math.min(50, Math.floor(Math.log10(xp + 1) * 17)));
}

/**
 * XP awarded for sacrificing a card of a given rarity.
 * Burning a legendary is a real decision: 3 000 XP vs ~10 for a common.
 */
export const SACRIFICE_XP: Record<Rarity, bigint> = {
  common:    10n,
  uncommon:  50n,
  rare:      200n,
  epic:      800n,
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
export function computeAttunementSlots(spiritLevel: number): AttunementSlots {
  const l = spiritLevel;
  return {
    common:    Math.min(8,  Math.floor(l * 0.6) + 1),
    uncommon:  Math.min(6,  Math.floor(l * 0.4)),
    rare:      Math.min(4,  Math.floor(l * 0.2)),
    epic:      Math.min(2,  Math.floor(l * 0.08)),
    legendary: Math.min(1,  l >= 30 ? 1 : 0),       // unlocks at spirit level 30
  };
}

// ─── Hand slots (how many cards can be equipped) ──────────────────────────────

/**
 * Active and passive hand slots granted by spirit level.
 * Starts 2/1 at level 1; caps at 10/5 around spirit level 40.
 * Spirit level is the gate, not character level.
 */
export function computeHandSlots(spiritLevel: number): HandSlots {
  const l = spiritLevel;
  return {
    active:  Math.min(10, 2 + Math.floor(l * 0.2)),
    passive: Math.min(5,  1 + Math.floor(l * 0.1)),
  };
}

// ─── Retention logic ─────────────────────────────────────────────────────────

export interface CardForRetention {
  cardInstanceId: bigint;
  rarity:         Rarity;
  attuned:        boolean;
}

export interface RetentionResult {
  /** Card IDs that survive death (attuned + within rarity slot budget). */
  surviving: Set<bigint>;
  /** Card IDs to be permanently deleted. */
  lost:      Set<bigint>;
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
export function computeRetention(
  cards:  CardForRetention[],
  slots:  AttunementSlots,
): RetentionResult {
  const surviving = new Set<bigint>();
  const lost      = new Set<bigint>();

  // Separate attuned from un-attuned
  const attuned   = cards.filter(c => c.attuned);
  const unAttuned = cards.filter(c => !c.attuned);

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
}

// ─── Character level curve ────────────────────────────────────────────────────

/**
 * Convert accumulated character XP into a level (1–50).
 * Design goals: 1-10 fast, 10-30 medium, 30-50 slower.
 * After death, reaching prior level should take ~40-50% of original time.
 * Stub — replace with real XP table after playtest.
 */
export function computeCharacterLevel(xp: bigint): number {
  const x = Number(xp);
  // Rough power curve; real values owned by ability-balancer in BALANCE.md
  return Math.max(1, Math.min(50, Math.floor(Math.pow(x / 80, 0.55))));
}
