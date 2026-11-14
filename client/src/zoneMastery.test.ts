// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { describe, it, expect } from 'vitest';
import {
  classifyKillXp,
  crossedZoneMastery,
  killXpLabel,
  type ZoneMasteryInfo,
} from './zoneMastery';
import { verifies, SwTraceables } from '../../src/clew/traceables/clew';

/** Hollow Vale as content/zones.json authors it. */
const TUTORIAL_ZONE: ZoneMasteryInfo = {
  maxLevel: 10,
  tutorialZone: true,
  masteredMessage: 'Hollow Vale has nothing left to teach you.',
};

/** A hypothetical later zone: same ceiling shape, no tutorial graduation. */
const ORDINARY_ZONE: ZoneMasteryInfo = { maxLevel: 25, tutorialZone: false };

verifies(
  SwTraceables.SW_051_ZONE_MASTERED_DISPLAYS_ONLY_WHEN_THE_ZERO_IS_CAUSED_BY_THE_ZONE_CAP,
  () => {
    describe('classifyKillXp', () => {
      it('reads a zero at the zone ceiling as mastery, not as a beneath-you kill', () => {
        expect(classifyKillXp(10, 10, TUTORIAL_ZONE)).toEqual({
          kind: 'zoneMastered',
        });
        expect(classifyKillXp(10, 14, TUTORIAL_ZONE)).toEqual({
          kind: 'zoneMastered',
        });
      });

      it('still reads a far-below-level kill under the ceiling as no XP', () => {
        // Level 9 in a maxLevel-10 zone: under the cap, but 8 levels above the
        // mob — exactly the level-gap cutoff, so the reward is zero on its own.
        expect(classifyKillXp(1, 9, TUTORIAL_ZONE)).toEqual({ kind: 'noXp' });
      });

      it('reports the granted amount when the kill actually pays', () => {
        expect(classifyKillXp(9, 9, TUTORIAL_ZONE)).toEqual({
          kind: 'granted',
          amount: 25,
        });
      });

      it('applies the ceiling in a non-tutorial zone too — mastery is not a tutorial-only idea', () => {
        expect(classifyKillXp(25, 25, ORDINARY_ZONE)).toEqual({
          kind: 'zoneMastered',
        });
      });

      it('falls back to the plain reward curve when no zone row is known', () => {
        expect(classifyKillXp(2, 40, undefined)).toEqual({ kind: 'noXp' });
        expect(classifyKillXp(40, 40, undefined)).toEqual({
          kind: 'granted',
          amount: 25,
        });
      });
    });
  },
);

verifies(
  SwTraceables.SW_052_TUTORIAL_COMPLETION_KEYS_OFF_THE_ZONES_MAX_LEVEL_AND_SHOWS_A_ONE_TIME_MESSAGE,
  () => {
    describe('crossedZoneMastery', () => {
      it('fires on the level-up that first reaches the tutorial zone ceiling', () => {
        expect(crossedZoneMastery(9, 10, TUTORIAL_ZONE)).toBe(true);
      });

      it('fires when a multi-level jump vaults past the ceiling', () => {
        expect(crossedZoneMastery(8, 12, TUTORIAL_ZONE)).toBe(true);
      });

      it('does not fire again on a later level-up above the ceiling', () => {
        expect(crossedZoneMastery(10, 11, TUTORIAL_ZONE)).toBe(false);
        expect(crossedZoneMastery(14, 15, TUTORIAL_ZONE)).toBe(false);
      });

      it('does not fire below the ceiling', () => {
        expect(crossedZoneMastery(7, 9, TUTORIAL_ZONE)).toBe(false);
      });

      it('stays silent outside a tutorial zone, however high the level-up', () => {
        expect(crossedZoneMastery(24, 25, ORDINARY_ZONE)).toBe(false);
      });

      it('stays silent when no zone row is known', () => {
        expect(crossedZoneMastery(9, 10, undefined)).toBe(false);
      });
    });
  },
);

describe('killXpLabel', () => {
  it('reads the granted amount as a quantity', () => {
    expect(killXpLabel({ kind: 'granted', amount: 25 })).toBe('+25 XP');
  });

  it('keeps the two causes of zero apart', () => {
    // The whole point of KillXpDisplay: a mastered zone and a beneath-you kill
    // both grant nothing, and must not read the same.
    expect(killXpLabel({ kind: 'zoneMastered' })).toBe('Zone mastered');
    expect(killXpLabel({ kind: 'noXp' })).toBe('No XP');
    expect(killXpLabel({ kind: 'zoneMastered' })).not.toBe(
      killXpLabel({ kind: 'noXp' }),
    );
  });

  it('words a zero grant as a category rather than "+0 XP"', () => {
    expect(killXpLabel({ kind: 'granted', amount: 0 })).toBe('+0 XP');
    // ...which is why classifyKillXp never returns a zero `granted`.
    expect(classifyKillXp(1, 9, TUTORIAL_ZONE)).toEqual({ kind: 'noXp' });
  });
});
