// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * Black-box integration tests for resource regeneration, against a LIVE
 * published SpacetimeDB instance — same preconditions and same REST client as
 * death.integration.test.ts (see that file's header, and
 * spacetimedb/integration/client.ts).
 *
 * Nothing here is reachable from a pure function: the arithmetic already has
 * unit tests in rules/regen.test.ts, and what these cover is the wiring the
 * unit tests cannot see — that a schedule actually fires, that the damage
 * paths stamp the clocks, and that a corpse is skipped.
 *
 * These tests spend real seconds waiting for a 1 s schedule. That is the point:
 * a regen bug is a bug about elapsed time, and mocking the clock would only
 * re-test the pure function. The waits are sized from the shipped dials, read
 * out of config.json rather than restated, so retuning the dials retunes the
 * test instead of breaking it.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { callReducer, sqlRows, isServerUp } from './client';
import { createTestCharacter, type TestCharacter } from './helpers';
import { loadConfig } from '../../content/configLoader';
import {
  verifies,
  SwTraceables,
  ConTraceables,
} from '../../src/clew/traceables/clew';

const { regen } = loadConfig();

/** A tick's worth of slack, so an assertion never races the schedule. */
const TICK_SLACK_MS = (regen.tickSeconds + 1) * 1000;

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

beforeAll(async () => {
  if (!(await isServerUp()))
    throw new Error(
      'No SpacetimeDB instance reachable — run `pnpm run db:start` then ' +
        '`pnpm run spacetime:publish:local` first (see CLAUDE.md).',
    );
}, 30_000);

async function readResources(
  char: TestCharacter,
): Promise<{ hp: number; mp: number; alive: boolean }> {
  const [row] = await sqlRows(
    char.token,
    `SELECT current_hp, current_mp, alive FROM character
       WHERE character_id = ${char.characterId}`,
  );
  if (!row) throw new Error(`character ${char.characterId} not found`);
  return { hp: row.current_hp, mp: row.current_mp, alive: row.alive };
}

/** Hurt the character without killing it, through the world-damage reducer. */
async function hurt(char: TestCharacter, rawDamage = 40): Promise<void> {
  await callReducer(char.token, 'apply_damage', {
    targetCharacterId: char.characterId,
    rawDamage,
    school: { physical: [] },
  });
}

verifies(
  SwTraceables.SW_059_ONE_REGEN_TICK_RESTORES_EVERY_ALIVE_CHARACTERS_HP_AND_MP,
  () => {
    describe('the regen schedule', () => {
      it('restores HP once the out-of-combat delay has passed', async () => {
        const char = await createTestCharacter('RegenSpirit');
        await hurt(char);
        const hurtAt = await readResources(char);
        expect(hurtAt.hp).toBeLessThan(100);

        // Wait out the gate, then let a few seconds of accrual happen.
        await sleep(regen.outOfCombatSeconds * 1000 + 8000);
        const healed = await readResources(char);

        const gained = healed.hp - hurtAt.hp;
        // At 0.5 HP/s, ~8 s of open window is ~4 HP. The bounds are wide
        // because the exact count depends on where the tick boundary fell,
        // but a 0 would mean the schedule never fired or the gate never
        // opened, and a jump to full would mean the window was not bounded.
        expect(gained).toBeGreaterThan(0);
        expect(gained).toBeLessThan(hurtAt.hp === 0 ? 1 : 100 - hurtAt.hp);
      }, 90_000);

      it('does not restore HP while the character is still in combat', async () => {
        const char = await createTestCharacter('InCombatSpirit');
        await hurt(char);
        const hurtAt = await readResources(char);

        // Well inside the delay, and past at least one tick: the schedule has
        // certainly run, and must have paid this character nothing.
        await sleep(Math.min(regen.outOfCombatSeconds * 1000 - 1000, 4000));
        expect((await readResources(char)).hp).toBe(hurtAt.hp);
      }, 60_000);
    });
  },
);

verifies(SwTraceables.SW_057_OUT_OF_COMBAT_GATES_HP_REGEN_ONLY, () => {
  describe('the out-of-combat gate', () => {
    it('never settles a backlog for the time spent fighting', async () => {
      const char = await createTestCharacter('NoBacklogSpirit');

      // Take damage repeatedly, so the character spends ~9 s in combat with a
      // steadily restamped clock.
      await hurt(char, 10);
      const start = await readResources(char);
      for (let i = 0; i < 3; i++) {
        await sleep(3000);
        await hurt(char, 10);
      }
      const beforeQuiet = await readResources(char);

      // Then go quiet for just over the delay plus two seconds of accrual.
      await sleep(regen.outOfCombatSeconds * 1000 + 2000 + TICK_SLACK_MS);
      const afterQuiet = await readResources(char);

      const gained = afterQuiet.hp - beforeQuiet.hp;
      // ~2-3 s of real window at 0.5 HP/s is 1-2 HP. A regen that paid from
      // the first hit instead would hand over ~7, and one that paid from the
      // character's creation would refill it outright.
      expect(gained).toBeGreaterThan(0);
      expect(gained).toBeLessThanOrEqual(4);
      expect(afterQuiet.hp).toBeLessThan(start.hp);
    }, 90_000);
  });
});

verifies(
  ConTraceables.CON_037_REGEN_ONLY_ADDS_INSIDE_A_LIVING_CHARACTERS_HEADROOM,
  () => {
    describe('regen stays inside the headroom', () => {
      it('leaves a dead character exactly as it died', async () => {
        const char = await createTestCharacter('CorpseSpirit');
        await callReducer(char.token, 'apply_damage', {
          targetCharacterId: char.characterId,
          rawDamage: 99_999,
          school: { physical: [] },
        });
        const dead = await readResources(char);
        expect(dead.alive).toBe(false);

        await sleep(regen.outOfCombatSeconds * 1000 + 4000);
        const later = await readResources(char);
        expect(later.hp).toBe(dead.hp);
        expect(later.mp).toBe(dead.mp);
        expect(later.alive).toBe(false);
      }, 90_000);

      it('never pushes an untouched character past its maxima', async () => {
        // A fresh character starts full, so every tick it sees has no headroom
        // at all — the clamp is the only thing keeping it from climbing.
        const char = await createTestCharacter('FullSpirit');
        const fresh = await readResources(char);

        await sleep(regen.outOfCombatSeconds * 1000 + 4000);
        const later = await readResources(char);
        expect(later.hp).toBe(fresh.hp);
        expect(later.mp).toBe(fresh.mp);
      }, 90_000);
    });
  },
);
