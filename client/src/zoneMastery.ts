// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { realizes, SwTraceables } from '../../src/clew/traceables/clew';
import { rewardForKill } from './xpReward';

/**
 * zoneMastery.ts — what the client makes of a zone's max level.
 *
 * Two decisions, both plain TypeScript so they can be unit tested instead of
 * hiding inside the Scene (005-testing-contract §2): which of the two possible
 * zeros a kill's floating text is showing, and whether a level-up was the one
 * that finished a tutorial zone. The Scene keeps only the painting.
 */

/** The zone fields both decisions read, as they arrive on the subscribed row. */
export interface ZoneMasteryInfo {
  maxLevel: number;
  tutorialZone: boolean;
  masteredMessage?: string;
}

/** What the floating text over a corpse should say. */
export type KillXpDisplay =
  | { kind: 'granted'; amount: number }
  | { kind: 'noXp' }
  | { kind: 'zoneMastered' };

/**
 * Zero XP has two causes and the granted amount alone cannot tell them apart:
 * the killer has out-levelled the whole zone, or this particular mob was too
 * far beneath them. Only the first is worth calling mastery, so the zone
 * ceiling is checked first and the reward curve only consulted below it —
 * the same order the server grants in, for the same reason.
 *
 * A zone whose row has not arrived (or a character in no known zone) applies
 * no ceiling, leaving the display exactly as it was before mastery existed.
 */
export const classifyKillXp = realizes(
  SwTraceables.SW_051_ZONE_MASTERED_DISPLAYS_ONLY_WHEN_THE_ZERO_IS_CAUSED_BY_THE_ZONE_CAP,
  function classifyKillXp(
    enemyLevel: number,
    playerLevel: number,
    zone: ZoneMasteryInfo | undefined,
  ): KillXpDisplay {
    if (zone && playerLevel >= zone.maxLevel) return { kind: 'zoneMastered' };
    const amount = rewardForKill(enemyLevel, playerLevel);
    return amount > 0 ? { kind: 'granted', amount } : { kind: 'noXp' };
  },
);

/**
 * Whether this level-up is the one that finished a tutorial zone.
 *
 * A character's level only ever rises, so the below-to-at-or-above crossing
 * happens at most once — which is why the one-time message needs no persisted
 * flag. A life that *starts* at or above the ceiling (a graduated account's
 * next character) never crosses anything and correctly says nothing.
 */
export const crossedZoneMastery = realizes(
  SwTraceables.SW_052_TUTORIAL_COMPLETION_KEYS_OFF_THE_ZONES_MAX_LEVEL_AND_SHOWS_A_ONE_TIME_MESSAGE,
  function crossedZoneMastery(
    oldLevel: number,
    newLevel: number,
    zone: ZoneMasteryInfo | undefined,
  ): boolean {
    if (!zone?.tutorialZone) return false;
    return oldLevel < zone.maxLevel && newLevel >= zone.maxLevel;
  },
);
