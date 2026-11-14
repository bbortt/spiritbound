// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * Black-box integration tests for the equip min-level gate, against a LIVE,
 * published SpacetimeDB instance — see death.integration.test.ts for the
 * precondition this suite shares (`pnpm run db:start` +
 * `pnpm run spacetime:publish:local`). The spec this covers is named by the
 * `verifies` anchor below.
 *
 * The gate only became reachable once equipment.json shipped items above
 * minLevel 1: drops are gated on the ENEMY's level plus headroom and pickup is
 * proximity-only, so a level-1 character can carry gear ten levels above it.
 * There is no "grant an item" reducer, so this farms a real drop the same way
 * the death suite does.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { callReducer, sqlRows, isServerUp } from './client';
import {
  characterLevel,
  createTestCharacter,
  latestBy,
  raiseToLevel,
  type TestCharacter,
} from './helpers';
import { loadEquipment } from '../../content/equipmentLoader';
import { SwTraceables, verifies } from '../../src/clew/traceables/clew';

const ITEMS = loadEquipment();

/**
 * The level the enemies farmed here are given. `helpers.farmItemDrop` farms at
 * the zone-1 seed level (2), which caps drop eligibility at minLevel 4
 * (enemy level + 2 — see rules/drops.ts) while every kill grants XP: the
 * character out-levels the only gear it can find, and the gate stops being
 * reachable. Farming high instead puts the top of equipment.json's intro tier
 * in the pool and leaves a gap the farming XP cannot close.
 */
const FARM_ENEMY_LEVEL = 8;

/**
 * Where the farming happens, relative to the character's own sector. Killed
 * enemies respawn (config.enemies.respawnSeconds), so level-8 ones are left
 * standing here after this test finishes: the offset is off the 1000px sector
 * diagonal `helpers.nextSector` walks, and far enough from every sector on it
 * that no later test's character can be aggroed by this test's leftovers.
 *
 * Each round steps one stride further along x so respawns cannot pile up on
 * the coordinate the character later walks onto to pick the drop up: at
 * `maxHp` 100 and 8 damage a tick, a dozen accumulated level-8 enemies kill it
 * mid-pickup, and permadeath destroys the instance — which would surface as
 * the wholly misleading "pickup must create an item_instance row".
 * 40 rounds of stride stay inside the 50_000px gap to the sector diagonal.
 */
const FARM_OFFSET_X_PX = 1500;
const FARM_OFFSET_Y_PX = -50_000;
const FARM_STRIDE_PX = 250;

/**
 * equipment.json declares slots snake_case (`main_hand`), but the wire format
 * takes the module's camelCase variant aliases: sending `main_hand` is
 * rejected with "unknown variant `main_hand`, expected one of ... `mainHand`,
 * `offHand` ...". Single-word slots are identical under both spellings, so
 * only the two compound ones can expose this — behind a probabilistic drop.
 */
function wireSlot(slot: string): string {
  return slot.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Kill high-level enemies at a position away from the character until a drop
 * lands that the character cannot yet equip, then walk over and pick it up.
 *
 * `damageEnemy` checks the zone, not the distance, so the kill happens from
 * across the map and the enemy's own damage never enters the picture. The
 * level comparison is made against the character's level *now*, not 1, because
 * the kills themselves grant XP.
 *
 * `sqlRows` only decodes scalar columns, so the slot comes from
 * equipment.json by slug rather than from the (Option<Sum>) column.
 */
async function farmUnequippableItem(char: TestCharacter, rounds = 40) {
  const y = char.y + FARM_OFFSET_Y_PX;
  let unkilled = 0;

  for (let round = 0; round < rounds; round++) {
    const x = char.x + FARM_OFFSET_X_PX + round * FARM_STRIDE_PX;

    await callReducer(char.token, 'spawn_enemy', {
      zoneId: 1,
      x,
      y,
      level: FARM_ENEMY_LEVEL,
    });
    // A killed enemy respawns on a timer, so even this round's own coordinate
    // can hold more than one row: take the newest rather than an arbitrary
    // one, or the loop re-kills whichever row the server returns first.
    const enemy = latestBy(
      await sqlRows(
        char.token,
        `SELECT enemy_id FROM enemy WHERE pos_x = ${x} AND pos_y = ${y} AND alive = true`,
      ),
      'enemy_id',
    );
    if (!enemy) continue;

    // `spawnEnemy` hardcodes 100 maxHp and ignores its `level` argument for
    // combat stats — level only drives XP and drop eligibility — so this is
    // the same handful of casts the level-2 farm in helpers.ts needs.
    let killed = false;
    for (let hit = 0; hit < 8; hit++) {
      await callReducer(char.token, 'damage_enemy', {
        enemyId: enemy.enemy_id,
        cardDefId: 1,
      });
      const [check] = await sqlRows(
        char.token,
        `SELECT alive FROM enemy WHERE enemy_id = ${enemy.enemy_id}`,
      );
      if (!check || !check.alive) {
        killed = true;
        break;
      }
    }
    // Only a kill rolls for a drop, so a survivor means the round was wasted
    // and the hit budget no longer matches the enemy's health — counted so the
    // give-up message below can say so instead of blaming the drop roll.
    if (!killed) {
      unkilled++;
      continue;
    }

    const drops = await sqlRows(
      char.token,
      `SELECT item_drop_id, item_def_id FROM item_drop WHERE pos_x = ${x} AND pos_y = ${y}`,
    );
    const level = await characterLevel(char);

    for (const drop of drops) {
      const [def] = await sqlRows(
        char.token,
        `SELECT slug, min_level FROM item_definition WHERE item_def_id = ${drop.item_def_id}`,
      );
      if (!def || def.min_level <= level) continue;

      const content = ITEMS.find((i) => i.slug === def.slug);
      if (!content?.slot)
        throw new Error(`no slot for ${def.slug} in equipment.json`);

      // Pickup is range-checked (config.drops.pickupRangePx), so close the
      // distance the kill did not need — then retreat, because the enemy
      // killed here respawns on a timer and would otherwise spend the rest of
      // the test attacking a character standing on its spawn point.
      await callReducer(char.token, 'move', { x, y });
      await callReducer(char.token, 'pickup_item', {
        dropId: drop.item_drop_id,
      });
      await callReducer(char.token, 'move', { x: char.x, y: char.y });

      // Walking into the respawn's range is the one point this farm can get
      // the character killed, and permadeath destroys the instance — fail on
      // that here rather than three assertions later as a missing row.
      const [alive] = await sqlRows(
        char.token,
        `SELECT alive FROM character WHERE character_id = ${char.characterId}`,
      );
      if (!alive?.alive)
        throw new Error(
          `farmUnequippableItem: the character died collecting ${def.slug} — ` +
            'a respawn at the pickup coordinate out-damaged its 100 maxHp',
        );

      return {
        minLevel: def.min_level as number,
        slug: def.slug as string,
        slot: content.slot,
      };
    }
  }
  throw new Error(
    `farmUnequippableItem: no drop above the character's level in ${rounds} ` +
      `rounds (${unkilled} of them left the enemy alive) — with kills ` +
      'landing, equipment.json spreads minLevel across 1..10, so either the ' +
      'drop roll or the level curve has regressed; with kills failing, the ' +
      "8-hit budget no longer matches spawnEnemy's maxHp",
  );
}

async function equippedRows(char: TestCharacter) {
  return sqlRows(
    char.token,
    `SELECT equipped_item_id FROM equipped_item WHERE character_id = ${char.characterId}`,
  );
}

beforeAll(async () => {
  if (!(await isServerUp()))
    throw new Error(
      'SpacetimeDB is not reachable — start it and publish the module first',
    );
});

verifies(SwTraceables.SW_055_EQUIP_ENFORCES_THE_ITEMS_MIN_LEVEL, () => {
  describe('equip min-level gate', () => {
    it('refuses an over-level item, then accepts it once the character has the level', async () => {
      const char = await createTestCharacter('LevelGateSpirit');
      const item = await farmUnequippableItem(char);

      const [inst] = await sqlRows(
        char.token,
        `SELECT item_instance_id FROM item_instance WHERE owner_character_id = ${char.characterId}`,
      );
      expect(inst, 'pickup must create an item_instance row').toBeTruthy();

      const equip = () =>
        callReducer(char.token, 'equip_item', {
          itemInstanceId: inst.item_instance_id,
          slot: { [wireSlot(item.slot)]: [] },
          slotOrdinal: 0,
        });

      expect(
        await characterLevel(char),
        'the farmed item must still be above the character’s level',
      ).toBeLessThan(item.minLevel);

      await expect(
        equip(),
        `${item.slug} (minLevel ${item.minLevel}) must be refused below that level`,
      ).rejects.toThrow(
        // Pinned to this gate's own message. `ReducerError` alone would also
        // be satisfied by "not owned", "not equippable" or a malformed slot
        // argument, so the assertion would survive deleting the gate.
        new RegExp(`Requires character level ${item.minLevel}`),
      );

      expect(
        await equippedRows(char),
        'a refused equip must not write an equipped_item row',
      ).toHaveLength(0);

      // Land exactly on the required level, so the same call proves the
      // boundary is inclusive rather than merely passing somewhere above it.
      await raiseToLevel(char, item.minLevel);
      expect(
        await characterLevel(char),
        'raiseToLevel must land on the requirement, not past it',
      ).toBe(item.minLevel);

      await equip();
      expect(
        await equippedRows(char),
        'the same equip must succeed once the level requirement is met',
      ).toHaveLength(1);
    }, 120_000);
  });
});
