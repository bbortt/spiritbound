// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

/**
 * Black-box integration tests for the prologue flag, against a LIVE published
 * SpacetimeDB instance — same preconditions and same REST client as
 * death.integration.test.ts (see that file's header, and
 * spacetimedb/integration/client.ts).
 *
 * `markPrologueSeen` reads and writes `account_progress` through the module
 * context and has no pure function inside it, so a unit test could only assert
 * a mock — the same reason the tutorial-graduation flip is covered here rather
 * than in vitest's unit run. No character is created: the flag is
 * account-scoped, and the whole point of this spec is that it is readable and
 * writable before a life exists.
 *
 * NOTE on the one acceptance criterion this cannot reach: "a call from an
 * identity with no account_progress row fails with a SenderError". `onConnect`
 * inserts that row for every identity the moment it connects, and a REST
 * reducer call is a connection — so there is no way to be the caller of a
 * reducer and not have the row. The guard stays in the reducer because it is
 * the trust seam (`onConnect` owns row creation), but it is unreachable from a
 * client and is therefore asserted by review of index.ts#markPrologueSeen.
 *
 * NOTE on the strength of the "disturbs no other column" assertion: every other
 * column of a fresh account is at its zero value, so the comparison would also
 * hold for an update that clobbered them. Carrying non-default XP or milestones
 * in here costs a character, a level grind and a death (see
 * tutorialCompletion.integration.test.ts#raiseToLevel) — worth adding the day
 * `markPrologueSeen` stops being a one-field spread.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  callReducer,
  mintIdentity,
  sqlRows,
  isServerUp,
  type TestIdentity,
} from './client';
import { verifies, ConTraceables } from '../../src/clew/traceables/clew';

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
}, 30_000);

type Progress = {
  prologueSeen: boolean;
  tutorialCompleted: boolean;
  totalXpAllLives: unknown;
  unlockedMilestoneIds: unknown;
};

/**
 * The identity's own `account_progress` row, every column this spec promises
 * not to disturb included — see tutorialCompletion.integration.test.ts for why
 * an Identity goes into SQL as a plain `0x` hex literal. `unlocked_milestone_ids`
 * is a Vec and so comes back as whatever raw JSON the wire format uses, which
 * is fine here: it is only ever compared against another read of itself.
 */
async function readProgress(id: TestIdentity): Promise<Progress> {
  const [row] = await sqlRows(
    id.token,
    'SELECT prologue_seen, tutorial_completed, total_xp_all_lives, unlocked_milestone_ids ' +
      `FROM account_progress WHERE account_identity = 0x${id.identity}`,
  );
  if (!row) throw new Error('account_progress row not found for this identity');
  return {
    prologueSeen: row.prologue_seen,
    tutorialCompleted: row.tutorial_completed,
    totalXpAllLives: row.total_xp_all_lives,
    unlockedMilestoneIds: row.unlocked_milestone_ids,
  };
}

verifies(
  ConTraceables.CON_036_THE_PROLOGUE_FLAG_IS_ACCOUNT_SCOPED_SERVER_HELD_AND_FLIPS_AT_MOST_ONCE,
  () => {
    describe('the prologue flag is server-held and flips at most once', () => {
      it('starts false on a fresh account, flips true once, and ignores a second call', async () => {
        // No setup call needed: `onConnect` inserts the account row on this
        // identity's first contact with the instance, read included.
        const id = await mintIdentity();

        const before = await readProgress(id);
        expect(
          before.prologueSeen,
          'a fresh account has not seen the prologue',
        ).toBe(false);

        await callReducer(id.token, 'mark_prologue_seen', {});
        expect((await readProgress(id)).prologueSeen).toBe(true);

        // The client fires this on both the finish path and the skip path, and
        // a resumed session can reach both — so the second call has to be an
        // ordinary no-op rather than a surfaced failure.
        await callReducer(id.token, 'mark_prologue_seen', {});
        const after = await readProgress(id);
        expect(after.prologueSeen).toBe(true);

        // Nothing else on the row moves, in either call.
        expect(after.tutorialCompleted).toBe(before.tutorialCompleted);
        expect(after.totalXpAllLives).toEqual(before.totalXpAllLives);
        expect(after.unlockedMilestoneIds).toEqual(before.unlockedMilestoneIds);
      }, 30_000);

      it('is account-scoped: one account seeing it leaves another alone', async () => {
        const seen = await mintIdentity();
        const unseen = await mintIdentity();

        await callReducer(seen.token, 'mark_prologue_seen', {});

        expect((await readProgress(seen)).prologueSeen).toBe(true);
        expect(
          (await readProgress(unseen)).prologueSeen,
          'the flag is per-account, not global',
        ).toBe(false);
      }, 30_000);
    });
  },
);
