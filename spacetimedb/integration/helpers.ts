/**
 * spacetimedb/integration/helpers.ts — test-setup helpers shared by the
 * integration suite. Each helper is a black-box sequence of real reducer
 * calls + SQL reads against a live instance, the same as any other client.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  mintIdentity,
  callReducer,
  sqlRows,
  type TestIdentity,
} from './client';

/**
 * `seedCards` assigns `cardDefId = index + 1` over content/cards.json, stable
 * and 1-based (see spacetimedb/src/index.ts#_doSeedCards) — reading the same
 * file here maps a dropped card's def id back to its rarity without needing
 * to filter on the `rarity` enum column in SQL (SpacetimeDB's SQL enum-literal
 * syntax could not be worked out from the CLI's own error messages; reading
 * the source-of-truth content file directly sidesteps it entirely).
 */
const CARDS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../content/cards.json',
);
const CARD_RARITY_BY_DEF_ID: Record<number, string> = (() => {
  const cards = JSON.parse(readFileSync(CARDS_PATH, 'utf-8')) as {
    rarity: string;
  }[];
  return Object.fromEntries(cards.map((c, i) => [i + 1, c.rarity]));
})();

/**
 * (480, 432) is the vertical-slice's tutorial start position — deliberately
 * inside a seeded enemy's AGGRO_RANGE (see docs/BALANCE.md). A character left
 * there gets attacked within a tick or two. Every test character must move
 * away immediately after start_life, to a position unique enough that this
 * test (and every other concurrently-running one) can always find its own
 * character/enemies/drops by position instead of decoding the wire Identity
 * encoding.
 */
// Base offset must differ across separate `vitest run` processes, not just
// within one run — a fixed counter starting at 0 every process start would
// hand out the exact same coordinates a previous (e.g. failed, or killed
// mid-farm) run already used, landing a fresh character on top of that run's
// still-alive, now-hostile leftover farming enemies.
let sector = Math.floor(Date.now() / 10) % 1_000_000;
function nextSector(): { x: number; y: number } {
  // Spread sectors far apart (1000px) and far from the seeded zone-1 enemies
  // (which sit within the first few thousand px of the map origin).
  sector += 1;
  return { x: 1_000_000 + sector * 1000, y: 1_000_000 + sector * 1000 };
}

/**
 * SpacetimeDB's SQL endpoint rejects `ORDER BY ... LIMIT` together
 * ("Unsupported"), so every "give me the newest matching row" lookup here
 * fetches the plain WHERE-filtered set and picks the max id client-side
 * instead.
 */
function latestBy<T extends Record<string, any>>(
  rows: T[],
  idField: string,
): T | undefined {
  return rows.reduce<T | undefined>(
    (best, row) => (!best || row[idField] > best[idField] ? row : best),
    undefined,
  );
}

export interface TestCharacter extends TestIdentity {
  characterId: number;
  x: number;
  y: number;
}

/**
 * Mint a fresh identity, start a life, and move immediately to a private,
 * uniquely-positioned sector. Asserts the character survived the move (fails
 * loudly, rather than silently continuing, if the tutorial-hazard window
 * ever does land a hit before the move takes effect).
 */
export async function createTestCharacter(
  spiritName = 'IntegrationTestSpirit',
): Promise<TestCharacter> {
  const identity = await mintIdentity();
  await callReducer(identity.token, 'start_life', {
    spiritName,
    startZoneId: 1,
  });

  const { x, y } = nextSector();
  await callReducer(identity.token, 'move', { x, y });

  const [char] = await sqlRows(
    identity.token,
    `SELECT character_id, alive, current_hp FROM character WHERE pos_x = ${x} AND pos_y = ${y}`,
  );
  if (!char)
    throw new Error('createTestCharacter: character not found after move');
  if (!char.alive || char.current_hp <= 0) {
    throw new Error(
      `createTestCharacter: character died before setup completed (hp=${char.current_hp}) — ` +
        'likely damaged during the brief tutorial-spawn window before move() landed',
    );
  }

  return { ...identity, characterId: char.character_id, x, y };
}

/** The card_instance_id of a character's single equipped active-slot card. */
export async function findEquippedCardInstanceId(
  token: string,
  characterId: number,
): Promise<number> {
  const [row] = await sqlRows(
    token,
    `SELECT card_instance_id FROM equipped_card WHERE character_id = ${characterId}`,
  );
  if (!row)
    throw new Error(`no equipped card found for character ${characterId}`);
  return row.card_instance_id;
}

/**
 * Kill enemies spawned at the character's own position, using the character's
 * already-equipped card (cast at cardDefId 1, ember-strike, granted on first
 * life — see startLife in index.ts) to one-or-few-shot each one, until at
 * least one item drop appears at that position. Item drops are a probabilistic
 * ITEM_DROP_CHANCE (20%) roll per kill (see rules/drops.ts) — there is no
 * deterministic "grant an item" reducer, so this is the only black-box way to
 * get a real ItemInstance onto a test character. Capped at maxKills so a
 * regression in the drop roll fails the test instead of hanging forever.
 */
export async function farmItemDrop(
  char: TestCharacter,
  maxKills = 60,
): Promise<{ itemDropId: number; itemDefId: number }> {
  for (let i = 0; i < maxKills; i++) {
    await callReducer(char.token, 'spawn_enemy', {
      zoneId: 1,
      x: char.x,
      y: char.y,
    });
    const enemy = latestBy(
      await sqlRows(
        char.token,
        `SELECT enemy_id, current_hp FROM enemy WHERE pos_x = ${char.x} AND pos_y = ${char.y} AND alive = true`,
      ),
      'enemy_id',
    );
    if (!enemy) continue;

    // A single ember-strike hit does ~20-30 damage against an unmitigated
    // 100 HP enemy; a handful of casts always finishes it off.
    for (let hit = 0; hit < 6; hit++) {
      await callReducer(char.token, 'damage_enemy', {
        enemyId: enemy.enemy_id,
        cardDefId: 1,
      });
      const [check] = await sqlRows(
        char.token,
        `SELECT alive FROM enemy WHERE enemy_id = ${enemy.enemy_id}`,
      );
      if (!check || !check.alive) break;
    }

    const drop = latestBy(
      await sqlRows(
        char.token,
        `SELECT item_drop_id, item_def_id FROM item_drop WHERE pos_x = ${char.x} AND pos_y = ${char.y}`,
      ),
      'item_drop_id',
    );
    if (drop)
      return { itemDropId: drop.item_drop_id, itemDefId: drop.item_def_id };
  }
  throw new Error(
    `farmItemDrop: no item drop after ${maxKills} kills — check ITEM_DROP_CHANCE / seedItems ran`,
  );
}

/**
 * Like farmItemDrop, but for card drops, retrying until one of the given
 * rarity appears (common is weighted 60% of successful rolls — see
 * rules/drops.ts#RARITY_DROP_WEIGHTS — so this resolves quickly in practice).
 * Picks the card up and returns its new card_instance_id.
 */
export async function farmCardOfRarity(
  char: TestCharacter,
  rarity: string,
  maxKills = 80,
): Promise<number> {
  for (let i = 0; i < maxKills; i++) {
    await callReducer(char.token, 'spawn_enemy', {
      zoneId: 1,
      x: char.x,
      y: char.y,
    });
    const enemy = latestBy(
      await sqlRows(
        char.token,
        `SELECT enemy_id FROM enemy WHERE pos_x = ${char.x} AND pos_y = ${char.y} AND alive = true`,
      ),
      'enemy_id',
    );
    if (!enemy) continue;

    for (let hit = 0; hit < 6; hit++) {
      await callReducer(char.token, 'damage_enemy', {
        enemyId: enemy.enemy_id,
        cardDefId: 1,
      });
      const [check] = await sqlRows(
        char.token,
        `SELECT alive FROM enemy WHERE enemy_id = ${enemy.enemy_id}`,
      );
      if (!check || !check.alive) break;
    }

    const drop = latestBy(
      await sqlRows(
        char.token,
        `SELECT drop_id, card_def_id FROM card_drop WHERE pos_x = ${char.x} AND pos_y = ${char.y}`,
      ),
      'drop_id',
    );
    if (!drop) continue;
    if (CARD_RARITY_BY_DEF_ID[drop.card_def_id] !== rarity) continue; // wrong tier, leave it, try again

    await callReducer(char.token, 'pickup_card', { dropId: drop.drop_id });
    const inst = latestBy(
      await sqlRows(
        char.token,
        `SELECT card_instance_id FROM card_instance WHERE card_def_id = ${drop.card_def_id}`,
      ),
      'card_instance_id',
    );
    if (inst) return inst.card_instance_id;
  }
  throw new Error(
    `farmCardOfRarity: no ${rarity} card drop after ${maxKills} kills`,
  );
}
