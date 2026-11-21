// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * Black-box integration tests for the account-graduation milestone, against a
 * LIVE published SpacetimeDB instance — same preconditions and same REST
 * client as death.integration.test.ts (see that file's header, and
 * spacetimedb/integration/client.ts).
 *
 * The flip these cover is death-gated and account-scoped: nothing about it is
 * reachable from a pure function, because it reads the `zone` table, writes
 * `account_progress`, and only ever fires from inside `_handleDeath`. A unit
 * test would have to mock all three; a real death against a real instance
 * proves the wiring instead.
 *
 * NOTE on what this can and cannot prove today: hollow-vale's `maxLevel` is
 * 10, which is also the literal the deprecated predecessor spec hardcoded, so
 * no end-to-end observation can currently distinguish `>= 10` from
 * `>= zone.maxLevel` — and the `tutorialZone: true` scoping is likewise
 * unobservable while zone 1 is the only zone. These tests therefore read the
 * threshold out of the live `zone` row rather than writing `10` anywhere, so
 * the day content re-authors that ceiling (or a second zone lands) they
 * follow the data instead of quietly passing against a stale number.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { callReducer, sqlRows, isServerUp } from './client';
import {
  createTestCharacter,
  raiseToLevel,
  type TestCharacter,
} from './helpers';
import {
  verifies,
  ConTraceables,
  SwTraceables,
} from '../../src/clew/traceables/clew';

beforeAll(async () => {
  const up = await isServerUp();
  if (!up) {
    throw new Error(
      'No SpacetimeDB instance reachable at ' +
        (process.env.SPACETIME_HOST ?? 'http://localhost:3000') +
        ' — run `pnpm run db:start` then `pnpm run spacetime:publish:local` first ' +
        '(see CLAUDE.md), or set SPACETIME_HOST to point at one that is already up.',
    );
  }
  // Idempotent upsert (zoneId is the key — see index.ts#_doSeedZones), so this
  // is safe even though init() already seeded zones at publish time.
  const { mintIdentity } = await import('./client');
  const seeder = await mintIdentity();
  await callReducer(seeder.token, 'seed_cards', {});
  await callReducer(seeder.token, 'seed_zones', {});
  // The starting-loadout tests below need the item definitions too.
  await callReducer(seeder.token, 'seed_items', {});
}, 30_000);

/** The tutorial zone every fresh life starts in, as the live instance has it. */
async function tutorialZone(
  token: string,
): Promise<{ zoneId: number; maxLevel: number }> {
  const rows = await sqlRows(
    token,
    'SELECT zone_id, max_level, tutorial_zone FROM zone',
  );
  const zone = rows.find((z) => z.tutorial_zone);
  if (!zone) throw new Error('no tutorial zone seeded on this instance');
  return { zoneId: zone.zone_id, maxLevel: zone.max_level };
}

async function readCharacter(
  char: TestCharacter,
): Promise<{ level: number; alive: boolean; zoneId: number }> {
  const [row] = await sqlRows(
    char.token,
    `SELECT level, alive, zone_id FROM character WHERE character_id = ${char.characterId}`,
  );
  if (!row) throw new Error(`character ${char.characterId} not found`);
  return { level: row.level, alive: row.alive, zoneId: row.zone_id };
}

/**
 * An identity's own account_progress row.
 *
 * SpacetimeDB SQL takes an Identity literal as a plain `0x`-prefixed hex
 * string, which is exactly the form POST /v1/identity hands back — so a test
 * can scope to its own account without the wire Identity encoding the rest of
 * this suite deliberately avoids (see client.ts#sqlRows).
 */
async function readProgress(
  char: TestCharacter,
): Promise<{ tutorialCompleted: boolean }> {
  const [row] = await sqlRows(
    char.token,
    `SELECT tutorial_completed FROM account_progress WHERE account_identity = 0x${char.identity}`,
  );
  if (!row) throw new Error('account_progress row not found for this identity');
  return { tutorialCompleted: row.tutorial_completed };
}

/**
 * Start the account's next life and immediately move it back to the private
 * sector its predecessor held — a new character spawns at the shared tutorial
 * start position, inside a seeded enemy's aggro range (see helpers.ts), so
 * the move is what keeps the rest of the test from racing a stray hit.
 */
async function restartLife(
  char: TestCharacter,
  spiritName: string,
): Promise<TestCharacter> {
  await callReducer(char.token, 'start_life', { spiritName });
  await callReducer(char.token, 'move', { x: char.x, y: char.y });
  const [row] = await sqlRows(
    char.token,
    `SELECT character_id FROM character WHERE account_identity = 0x${char.identity} AND alive = true`,
  );
  if (!row)
    throw new Error('restartLife: no living character after start_life');
  return { ...char, characterId: row.character_id };
}

async function killLethally(char: TestCharacter): Promise<void> {
  await callReducer(char.token, 'apply_damage', {
    targetCharacterId: char.characterId,
    rawDamage: 99_999,
    school: { physical: [] },
  });
}

verifies(
  ConTraceables.CON_033_TUTORIAL_COMPLETION_STAMPS_ON_DEATH_ONCE_THE_CHARACTERS_ZONE_APPROPRIATE_MAX_LEVEL_WAS_REACHED,
  () => {
    describe('tutorial completion stamps on death at the zone-authored ceiling', () => {
      it('flips the account flag once, and only once, for a death at the tutorial zone max level', async () => {
        const char = await createTestCharacter('GraduatingSpirit');
        const zone = await tutorialZone(char.token);

        const beforeLevelling = await readProgress(char);
        expect(
          beforeLevelling.tutorialCompleted,
          'a fresh account starts un-graduated',
        ).toBe(false);

        await raiseToLevel(char, zone.maxLevel);
        const atCeiling = await readCharacter(char);
        expect(atCeiling.level).toBe(zone.maxLevel);
        expect(atCeiling.zoneId).toBe(zone.zoneId);
        expect(
          (await readProgress(char)).tutorialCompleted,
          'reaching the ceiling alive must not graduate — the flip is death-gated',
        ).toBe(false);

        await killLethally(char);
        expect((await readCharacter(char)).alive).toBe(false);
        expect((await readProgress(char)).tutorialCompleted).toBe(true);

        // A second death with the flag already true: the guard is on the flag
        // being false, so this must be an ordinary no-op, not an error and not
        // a re-toggle. The new life starts below the ceiling, so it is a death
        // at a lower level than the first — which is exactly the case the
        // guard has to survive.
        const secondLife = await restartLife(char, 'GraduatingSpirit');
        await killLethally(secondLife);
        expect((await readCharacter(secondLife)).alive).toBe(false);
        expect(
          (await readProgress(char)).tutorialCompleted,
          'a later death must leave an already-graduated account alone',
        ).toBe(true);
      }, 60_000);

      it('leaves the account un-graduated for a death one level below the ceiling', async () => {
        const char = await createTestCharacter('NearlySpirit');
        const zone = await tutorialZone(char.token);

        await raiseToLevel(char, zone.maxLevel - 1);
        expect((await readCharacter(char)).level).toBe(zone.maxLevel - 1);

        await killLethally(char);
        expect((await readCharacter(char)).alive).toBe(false);
        expect(
          (await readProgress(char)).tutorialCompleted,
          'the ceiling is a threshold, not a participation prize',
        ).toBe(false);
      }, 60_000);
    });
  },
);

verifies(
  SwTraceables.SW_053_STARTLIFE_COMPUTES_THE_START_ZONE_FROM_TUTORIAL_COMPLETION_NOT_CALLER_INPUT,
  () => {
    describe('startLife picks the zone itself', () => {
      it('starts an un-graduated account in the tutorial zone', async () => {
        const char = await createTestCharacter('FirstLifeSpirit');
        const zone = await tutorialZone(char.token);
        expect((await readProgress(char)).tutorialCompleted).toBe(false);
        expect((await readCharacter(char)).zoneId).toBe(zone.zoneId);
      }, 30_000);

      it('falls a graduated account back to the tutorial zone while zone 2 does not exist', async () => {
        const char = await createTestCharacter('GraduatedSpirit');
        const zone = await tutorialZone(char.token);

        await raiseToLevel(char, zone.maxLevel);
        await killLethally(char);
        expect((await readProgress(char)).tutorialCompleted).toBe(true);

        // The graduated branch: the call must resolve and must not route to a
        // zone that was never seeded. Once zone 2 ships this expectation flips
        // to that zone — the reducer's shape does not have to.
        const graduated = await restartLife(char, 'GraduatedSpirit');
        const next = await readCharacter(graduated);
        expect(next.zoneId).toBe(zone.zoneId);

        const [seeded] = await sqlRows(
          char.token,
          `SELECT zone_id FROM zone WHERE zone_id = ${next.zoneId}`,
        );
        expect(
          seeded,
          'the chosen start zone must be a seeded one',
        ).toBeTruthy();
      }, 60_000);
    });
  },
);

/**
 * The character's equipped starter weapon, as two rows: the instance it owns
 * and the slot it sits in.
 *
 * `sqlRows` only decodes scalar columns, so the slot enum itself is not
 * readable here (see equipLevelGate.integration.test.ts#wireSlot) — which is
 * why the test below proves `main_hand` through its effect on a bare swing
 * instead, the only thing that reads that column server-side.
 */
async function readStarterWeapon(char: TestCharacter): Promise<{
  instances: Record<string, any>[];
  slotOrdinal: number | undefined;
}> {
  const [def] = await sqlRows(
    char.token,
    "SELECT item_def_id FROM item_definition WHERE slug = 'worn-dagger'",
  );
  if (!def) throw new Error('worn-dagger not seeded on this instance');

  const instances = await sqlRows(
    char.token,
    `SELECT item_instance_id FROM item_instance
       WHERE owner_character_id = ${char.characterId}
         AND item_def_id = ${def.item_def_id}`,
  );
  const equipped = instances.length
    ? await sqlRows(
        char.token,
        `SELECT slot_ordinal FROM equipped_item
           WHERE character_id = ${char.characterId}
             AND item_instance_id = ${instances[0].item_instance_id}`,
      )
    : [];

  return { instances, slotOrdinal: equipped[0]?.slot_ordinal };
}

/** Damage one bare right-click swing (cardDefId 0) takes off a fresh enemy. */
async function bareSwingDamage(char: TestCharacter): Promise<number> {
  await callReducer(char.token, 'spawn_enemy', {
    zoneId: 1,
    x: char.x,
    y: char.y,
    level: 2,
  });
  const [enemy] = await sqlRows(
    char.token,
    `SELECT enemy_id, current_hp FROM enemy
       WHERE pos_x = ${char.x} AND pos_y = ${char.y} AND alive = true`,
  );
  if (!enemy) throw new Error('bareSwingDamage: no enemy spawned');

  await callReducer(char.token, 'damage_enemy', {
    enemyId: enemy.enemy_id,
    cardDefId: 0,
  });
  const [after] = await sqlRows(
    char.token,
    `SELECT current_hp FROM enemy WHERE enemy_id = ${enemy.enemy_id}`,
  );
  return enemy.current_hp - (after?.current_hp ?? 0);
}

verifies(
  SwTraceables.SW_056_EVERY_LIFE_STARTS_WITH_THE_STARTER_WEAPON_EQUIPPED,
  () => {
    describe('a life starts armed', () => {
      it('grants and equips the worn dagger, and re-grants it on the next life', async () => {
        const char = await createTestCharacter('ArmedSpirit');

        const first = await readStarterWeapon(char);
        expect(first.instances).toHaveLength(1);
        expect(first.slotOrdinal).toBe(0);

        // An ItemInstance is character-owned, so the second life starts from
        // nothing owned — the point of the spec is that it is armed anyway.
        await killLethally(char);
        const next = await restartLife(char, 'ArmedSpirit');
        const second = await readStarterWeapon(next);
        expect(second.instances).toHaveLength(1);
        expect(second.slotOrdinal).toBe(0);
        expect(second.instances[0].item_instance_id).not.toBe(
          first.instances[0].item_instance_id,
        );
      }, 60_000);

      it('makes a bare swing do real damage instead of the 1-damage floor', async () => {
        // The only server-side reader of the slot enum is `_findEquippedWeapon`,
        // and a swing with nothing in main_hand feeds weaponDamage 0 through
        // `resolveHit` to its one-damage floor. So anything above that floor
        // proves the dagger is both owned and in the right slot, without
        // pinning the assertion to a balance number that is meant to be tuned.
        const char = await createTestCharacter('SwingingSpirit');
        expect(await bareSwingDamage(char)).toBeGreaterThan(1);
      }, 60_000);
    });
  },
);

verifies(
  ConTraceables.CON_035_A_GRADUATED_ACCOUNT_STARTS_BELOW_ITS_START_ZONES_MAX_LEVEL,
  () => {
    describe('a graduated account starts with XP headroom', () => {
      it('begins the next life below the max level of the zone it lands in', async () => {
        const char = await createTestCharacter('HeadroomSpirit');
        const zone = await tutorialZone(char.token);

        await raiseToLevel(char, zone.maxLevel);
        await killLethally(char);
        expect((await readProgress(char)).tutorialCompleted).toBe(true);

        // Both numbers are read from the live module, never restated here:
        // the point is the relationship between the starting level and the
        // ceiling of whatever zone the account was routed into, which has to
        // survive both a retuned ceiling and zone 2's arrival.
        const graduated = await restartLife(char, 'HeadroomSpirit');
        const next = await readCharacter(graduated);
        const [landed] = await sqlRows(
          char.token,
          `SELECT max_level FROM zone WHERE zone_id = ${next.zoneId}`,
        );
        expect(
          next.level,
          'a graduated life that starts at the ceiling can never earn XP (SW-050)',
        ).toBeLessThan(landed.max_level);
      }, 60_000);
    });
  },
);
