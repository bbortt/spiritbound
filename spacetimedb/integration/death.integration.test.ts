// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * Black-box integration tests against a LIVE, published SpacetimeDB instance
 * (the same local dev loop `pnpm run db:start` + `pnpm run
 * spacetime:publish:local` stands up) — real HTTP calls, real reducers, real
 * table reads, no mocks. This is the same workflow used to verify the
 * feature manually during development, automated so it can be re-run instead
 * of re-typed.
 *
 * Precondition: a SpacetimeDB instance for database "spiritbound" must
 * already be running and published (SPACETIME_HOST env var to point at a
 * non-default host; see spacetimedb/integration/client.ts). This suite does
 * not start Docker or publish the module itself — see the root README/
 * CLAUDE.md for the `db:start` / `spacetime:publish:local` scripts.
 *
 * Covers the permadeath retention rules from the Death & Retention story
 * (docs/spec/stories/): gear is always lost, cards survive death only if
 * attuned. Each `describe`/`it` below carries its own `verifies()` anchor to
 * the exact spec it covers — see those anchors for the specific ids.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { callReducer, sqlRows, isServerUp, ReducerError } from './client';
import {
  createTestCharacter,
  findEquippedCardInstanceId,
  farmItemDrop,
  farmCardOfRarity,
  type TestCharacter,
} from './helpers';
import {
  verifies,
  SwTraceables,
  SysTraceables,
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
  // Idempotent upserts (slug is the key) — safe to call even if a previous
  // run, or the developer, already seeded this instance.
  const { mintIdentity } = await import('./client');
  const seeder = await mintIdentity();
  await callReducer(seeder.token, 'seed_cards', {});
  await callReducer(seeder.token, 'seed_items', {});
}, 30_000);

async function killLethally(char: TestCharacter): Promise<void> {
  await callReducer(char.token, 'apply_damage', {
    targetCharacterId: char.characterId,
    rawDamage: 99_999,
    school: { physical: [] },
  });
}

verifies(
  SysTraceables.SYS_006_DEATH_DESTROYS_GEAR_AND_UN_ATTUNED_CARDS_KEEPS_ONLY_WHAT_WAS_ATTUNED,
  () => {
    describe('permadeath: gear and card retention', () => {
      it('an attuned card survives death; the un-equipped, un-attuned copy of it does not', async () => {
        // Two independent characters so each gets its own fresh tutorial-grant
        // card (startLife auto-grants + auto-equips one "ember-strike" per
        // account's first life) — one attuned before death, one left as-is.
        const survivor = await createTestCharacter('AttunedSpirit');
        const casualty = await createTestCharacter('UnattunedSpirit');

        const survivorCardId = await findEquippedCardInstanceId(
          survivor.token,
          survivor.characterId,
        );
        const casualtyCardId = await findEquippedCardInstanceId(
          casualty.token,
          casualty.characterId,
        );

        await callReducer(survivor.token, 'toggle_attune', {
          cardInstanceId: survivorCardId,
        });
        const [beforeDeath] = await sqlRows(
          survivor.token,
          `SELECT attuned FROM card_instance WHERE card_instance_id = ${survivorCardId}`,
        );
        expect(beforeDeath.attuned).toBe(true);

        await killLethally(survivor);
        await killLethally(casualty);

        const [survivorChar] = await sqlRows(
          survivor.token,
          `SELECT alive, current_hp FROM character WHERE character_id = ${survivor.characterId}`,
        );
        expect(survivorChar.alive).toBe(false);
        expect(survivorChar.current_hp).toBe(0);

        const survivorCard = await sqlRows(
          survivor.token,
          `SELECT card_instance_id FROM card_instance WHERE card_instance_id = ${survivorCardId}`,
        );
        expect(survivorCard, 'attuned card must survive death').toHaveLength(1);

        const casualtyCard = await sqlRows(
          casualty.token,
          `SELECT card_instance_id FROM card_instance WHERE card_instance_id = ${casualtyCardId}`,
        );
        expect(
          casualtyCard,
          'un-attuned card must be destroyed on death',
        ).toHaveLength(0);

        // Equipped-card slots always clear on death, independent of attunement
        // (retention decides whether the underlying card instance itself
        // survives — being equipped never does).
        const survivorEquip = await sqlRows(
          survivor.token,
          `SELECT equipped_card_id FROM equipped_card WHERE character_id = ${survivor.characterId}`,
        );
        expect(survivorEquip).toHaveLength(0);
      }, 30_000);

      verifies(
        SwTraceables.SW_025_ATTUNING_PAST_A_RARITY_SLOT_BUDGET_IS_REJECTED_UN_ATTUNING_NEVER_IS,
        () =>
          it("attuning a second common card past a level-1 spirit's one-slot common budget is rejected", async () => {
            // A fresh spirit is level 1: computeAttunementSlots(1).common === 1
            // (see rules/death.ts and its unit tests) — this test proves the
            // *reducer* actually enforces that budget end-to-end over real HTTP
            // calls, which the pure-function unit tests can't, since they never
            // touch toggleAttune's ownership/lookup/error-throwing wiring.
            const char = await createTestCharacter('BudgetSpirit');
            const firstCardId = await findEquippedCardInstanceId(
              char.token,
              char.characterId,
            );
            await callReducer(char.token, 'toggle_attune', {
              cardInstanceId: firstCardId,
            });

            const secondCommonCardId = await farmCardOfRarity(char, 'common');

            await expect(
              callReducer(char.token, 'toggle_attune', {
                cardInstanceId: secondCommonCardId,
              }),
            ).rejects.toThrow(ReducerError);

            const [second] = await sqlRows(
              char.token,
              `SELECT attuned FROM card_instance WHERE card_instance_id = ${secondCommonCardId}`,
            );
            expect(
              second.attuned,
              'rejected attune must not have taken effect',
            ).toBe(false);
          }, 90_000),
      );
    });
  },
);

verifies(
  SwTraceables.SW_026_DEATH_ALWAYS_DESTROYS_GEAR_AND_A_SPIRITLESS_ACCOUNT_LOSES_EVERY_CARD,
  () => {
    describe('permadeath: gear is always lost', () => {
      it('a picked-up item instance is destroyed on death, whether or not it was ever equipped', async () => {
        const char = await createTestCharacter('GearSpirit');
        const drop = await farmItemDrop(char);

        await callReducer(char.token, 'pickup_item', {
          dropId: drop.itemDropId,
        });
        const [beforeDeath] = await sqlRows(
          char.token,
          `SELECT item_instance_id FROM item_instance WHERE item_def_id = ${drop.itemDefId}`,
        );
        expect(
          beforeDeath,
          'pickup must create a real item_instance row',
        ).toBeTruthy();

        await killLethally(char);

        const afterDeath = await sqlRows(
          char.token,
          `SELECT item_instance_id FROM item_instance WHERE item_instance_id = ${beforeDeath.item_instance_id}`,
        );
        expect(
          afterDeath,
          'item instance must be destroyed on death',
        ).toHaveLength(0);
      }, 60_000);
    });
  },
);

describe('sanity: reducers reject bad input the same way over HTTP as in-process', () => {
  it('toggle_attune on a nonexistent card raises a SenderError (HTTP 530)', async () => {
    const char = await createTestCharacter('SanitySpirit');
    await expect(
      callReducer(char.token, 'toggle_attune', { cardInstanceId: 999_999_999 }),
    ).rejects.toThrow(ReducerError);
  });
});
