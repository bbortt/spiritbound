# Implementation plan — zone content, enemy rarity, spawn director, boss cycle

**Status of this document:** hand-off plan for continuing work already
drafted.
Specs are drafted and grounded (`clew-context` run on all five
stories) but **not promoted** and **no code has been written**.
This file
tells the next agent exactly what to do, in what order, and where
everything goes.

## 0. Before writing any code: promote the drafts

The five stories and 36 specs in `docs/spec/drafts/{stories,specs}/` are
drafts with temporary ids (`STR-TMP-00N`, `SW-TMP-0NN`, etc.).
Per this
project's workflow (`.claude/.ai-project-context/000-agent-instructions.md`,
CLAUDE.md's clew section), code must anchor to **promoted, active** specs,
not drafts.

1. Read all five draft stories in `docs/spec/drafts/stories/` (they list
   every spec they realize) and skim the specs they link to.
2. Run the `clew-promote` skill on all five stories together (they form
   one increment and cross-reference each other — e.g. Story 4 realizes
   `ARCH-012` from Story 2).
   Promoting them together means the bound
   ids substitute consistently across all the cross-links in one pass.
3. **Two active specs need explicit handling at promotion, already
   flagged in the drafts — do not silently skip these:**
   - `CON-008` (`first-reaching-level-ten-stamps-tutorial-completed...`)
     is **superseded** by `CON-033` (Story 5). `CON-008`'s hardcoded
     `character.level >= 10` becomes `character.level >= zone.maxLevel`,
     scoped to `tutorialZone: true`.
     Mark `CON-008` deprecated once
     `CON-033` is promoted; do not leave both active with
     contradictory descriptions.
   - `SW-014` (`resetting-enemy-walks-to-spawn-healing-and-can-re-aggro`)
     is **partially superseded** — only its respawn-half claim ("a dead
     enemy is restored to full HP at its exact spawn position ...
     regardless of whether any character is nearby") is replaced by
     `SW-048`'s passive-rebalance decision.
     Its resetting-state-machine
     half (walk to spawn, heal per tick, mid-walk re-aggro) is unaffected
     and must stay active as-is.
     At promotion, narrow `SW-014`'s
     description to the resetting-state behavior only, and let the new
     promoted spec (from `SW-048`) own the respawn-outcome claim.
4. **One tension is deliberately left unresolved by design, not by
   oversight** — confirm this reading survives promotion:
   `CON-004` ("legendary drop weight is fixed at zero") is _not_
   superseded.
   Story 2's rarity-tier-shift function is designed so a
   zero-weight tier (legendary, today) can never become non-zero through
   the shift, specifically so `CON-004` keeps holding even once bosses
   exist.
   If a future story wants boss kills to unlock legendary loot, it
   must explicitly revisit `CON-004` — this increment does not.
5. After promotion, delete `docs/spec/drafts/stories/STR-TMP-*.md`,
   `docs/spec/drafts/specs/*-TMP-*.md`, and this file (or move this file's
   remaining checklist into a tracking issue) — `clew-promote` may do this
   for you; confirm the drafts folder is empty afterward.

## 1. Implementation order

Mirrors the dependency chain used while drafting — each story's specs
name the fields/functions the next story depends on by name.

### Story A — Zone content pipeline (was STR-010)

**New files**, following `content/cards.json` + `content/validate.ts` +
`content/loader.ts` + `content/cards.test.ts` exactly:

- `content/zones.json` — one entry, `hollow-vale` (zoneId 1).
  Full shape
  is in the story's Solution Approach section — copy it verbatim as the
  starting content, including `recommendedLevel: 1`, `boss.arenaX/arenaY`
  (pick an actual in-bounds coordinate for the zone map, not `0,0`), and
  `masteredMessage`.
- `content/validateZones.ts` (or `content/validate.ts`-sibling naming —
  match whatever convention the promoted spec ids' anchors expect) — Zod
  schema + `crossCheck` implementing all 7 promoted CON specs from this
  story.
  Each hard-error path needs a test in `content/zones.test.ts`
  naming the values in the assertion message where the spec requires it
  (band-vs-max, e.g.).
- `content/zonesLoader.ts` — Node-only `readFileSync`/`JSON.parse`, split
  out per `ARCH-009`, so `spacetimedb`'s esbuild bundle can tree-shake it.

**Modified**: `spacetimedb/src/index.ts`

- `zone` table already exists (`zoneId`/`name`/`minLevel`/
  `recommendedLevel`/`maxLevel`/`description`) — no schema change needed
  here, only new columns if the promoted spec set ends up wanting more
  (it doesn't; population/director/boss/levelBands/spawnRarities/
  tutorialZone/flavor/masteredMessage all live in `content/zones.json`,
  not the `zone` table — the table only needs what the client needs to
  read as an insertable row: keep it to `zoneId`/`name`/`minLevel`/
  `recommendedLevel`/`maxLevel`/`description` and confirm whether
  `tutorialZone` also needs to be a table column for client subscription
  — check the client's zone-mastered display logic in Story E before
  deciding; if the client needs `tutorialZone`/`maxLevel` at runtime it
  must be on the public `zone` row, not just in the content file).
- Add `_doSeedZones`/`seedZones`, mirroring `_doSeedCards`/`seedCards`
  (upsert by `slug`, `ctx.db.zone.zoneId.find(...)` — note `zoneId` is a
  plain `u32` PK, not autoinc, so the seeder sets it explicitly from the
  content file rather than leaving it `0n`).
  Call from `init`.

**Test**: `content/zones.test.ts` — schema validity + one `it` per CON
spec's rejection path (7 total), following `content/config.test.ts`'s
style for naming both computed values in an error message assertion.

### Story B — Enemy rarity and rarity-scaled stats/drops (was STR-011)

**Modified**: `spacetimedb/src/index.ts`

- Add `rarity: TRarity` and `isBoss: t.bool()` columns to the `enemy`
  table definition (~line 460-490).
- Update `_seedZone1Enemies` (or wherever enemies are currently seeded) to
  set `rarity: { tag: 'common' }, isBoss: false` for existing seeded
  enemies — nothing yet rolls a rarity at spawn time; that's Story D.

**New file**: `spacetimedb/src/rules/enemyScaling.ts`

- Header comment matching the existing `rules/*.ts` convention (pure, no
  SpacetimeDB imports).
- `RARITY_MULTIPLIERS` is **not** hardcoded here — it's sourced from
  `content/config.json`'s new `enemies.rarityMultipliers` key and passed
  into `computeEnemyStats` as a parameter (matches `CONFIG.dropRates.*`'s
  existing threading pattern).
- `computeEnemyStats(baseHp, baseDamage, level, rarity, multipliers): { maxHp, damagePerHit, castDamage }`.
- `spacetimedb/src/rules/enemyScaling.test.ts` — unit tests per the
  promoted SW spec's Verification Description.

**Modified**: `spacetimedb/src/rules/drops.ts`

- Add the drop-tier-shift pure function (name it e.g. `shiftRarityWeightsForMob(weights, mobRarity): RarityWeights`).
  Common mob → unchanged.
  Non-common → zero out `common`, redistribute
  proportional to the other four tiers' existing relative weight.
  A tier
  already at 0 (legendary, today) stays 0 — verify this explicitly in the
  test, it's the load-bearing property that keeps `CON-004` intact.
- `spacetimedb/src/rules/drops.test.ts` — add cases per the promoted SW
  spec.

**Modified**: `content/config.json` + `content/validateConfig.ts`

- Add `enemies.rarityMultipliers: { common: {hp,damage}, uncommon: {...}, rare: {...}, epic: {...}, legendary: {...} }`
  with the exact values from the brief: common 1.0/1.0, uncommon 2.5/1.4,
  rare 6.0/1.8, epic 15.0/2.4, legendary 40.0/3.2.
- New Zod sub-schema (do **not** reuse `RarityWeightsSchema` — that one
  is five `0..1` chances summing to 1.0, a different shape entirely).
  Validate every multiplier `>= 1.0` and strictly increasing common →
  legendary across both `hp` and `damage`.
- `content/config.test.ts` — add cases for the new key per the promoted
  CON spec.

### Story C — Spawn-director pure rules (was STR-012)

**New file**: `spacetimedb/src/rules/spawnDirector.ts` — four functions,
all pure, tuning passed as parameters (the zone's `population`/`director`
config from `content/zones.json`):

1. `computeTargetPopulation(playersInZone, cfg): number`
2. `allocateBands(totalBudget, demand, bandCount, cfg): number[]`
   — implement in the order the specs describe it (floor pass →
   proportional remainder → cap/redistribute → rounding-drift correction
   → empty-zone even-rest special case checked first, since it bypasses
   the rest of the pipeline entirely).
3. `planAdjustments(target, actual, cfg): { spawns: {band,count}[], despawns: {band,count}[] }`
4. `pickRespawnBand(deadEnemyBand, targetByBand, actualByBand): 'retire' | { band: number }`
   (or similar signature — this is the passive-respawn decision function
   `SW-048` describes).

**Test**: `spacetimedb/src/rules/spawnDirector.test.ts` — this is the
module the original brief calls out as "most worth testing hard." Include
a property test (the repo has no existing property-test precedent to
copy — check `004-technology-contract.md`/`package.json` for whether
`fast-check` or similar is already a devDependency; if not, either add it
(justify in the commit per `003-developer-guidelines.md`'s "no
unjustified new dependency" rule) or hand-roll a randomized-input loop
inside a plain `it`, whichever this codebase's existing test style
prefers — check with the user/`003` if genuinely unsure).
Cover every
case listed in Story 3's acceptance criteria: allocation sums exactly to
budget, lone-outlier band gets its floor, empty-zone even rest, single
occupied band capped + overflow, deadband boundary exact (`==` not just
`<`), rate limits never exceeded, no negative counts anywhere.

### Story D — Live spawn director and boss cycle (was STR-013)

**Modified**: `spacetimedb/src/index.ts`

- New table `zoneDirectorState`: `zoneId` (PK, FK to `zone`), per-band
  consecutive-over-target counters (shape: an array or one column per
  band — check the promoted spec's exact field expectations, or decide
  during implementation and document the choice in the PR), plus
  `bossSpawnedAt: t.option(t.timestamp())` and a "last time boss stopped
  being alive" timestamp for the boss cycle's own clock.
- New scheduled table + reducer `spawnDirectorTick`: **one row per zone**,
  each inserted with `ScheduleAt.interval(zone.director.tickSeconds * 1_000_000n)`
  (microseconds) — not a single global tick.
  Insert these rows from
  `_doSeedZones` (Story A) or from `init` after zones are seeded, one per
  seeded zone.
  The reducer body:
  1. Count alive characters per band (query `character` by `zoneId`,
     bucket by `levelBands`).
  2. Count alive non-boss enemies per band (query `enemy` by `zoneId`,
     filter `isBoss === false`, bucket by level against `levelBands`).
  3. Call `computeTargetPopulation`/`allocateBands`/`planAdjustments`.
  4. For each planned spawn: find a point `>= minSpawnDistFromPlayerPx`
     from every alive player in the zone (reuse/extend whatever spatial
     query `enemyAi.ts` already has for range checks); skip if none
     found.
     Roll level uniformly within the band, rarity from
     `zone.spawnRarities` (uniform, or weighted — brief doesn't specify a
     weighting within `spawnRarities`, treat as uniform unless told
     otherwise).
  5. For each planned despawn: check the sustained-deviation gate against
     `zoneDirectorState` (increment/reset the per-band counter every
     tick regardless of whether a despawn is planned this tick — the
     counter tracks "ticks over target," not "ticks a despawn fired");
     only delete rows once the threshold is met, and only enemies passing
     the full idle/undamaged/boss-free/far-from-player predicate.
- Change `respawnEnemy` (currently unconditional revive) to call
  `pickRespawnBand` from Story C: `'retire'` → delete the row; otherwise
  respawn with `level` re-rolled uniformly within the returned band, and
  recompute `maxHp`/`damagePerHit`/`castDamage` via `computeEnemyStats`
  for whatever rarity that enemy already has (rarity doesn't change on
  respawn, only level/band).
- New scheduled reducer `bossCycleTick`, single global interval (30s per
  the brief — this one is NOT per-zone).
  Per zone with a `boss` config:
  spawn/despawn per the promoted CON specs (unconditional window close,
  excluded from all director accounting, cycle timer restarts uniformly
  on kill or timeout).

**Client** (`client/src/scenes/GameScene.ts` and generated bindings):

- Regenerate SpacetimeDB client bindings after the schema changes above
  (`rarity`/`isBoss` on `enemy`, the new `zoneDirectorState` table) — see
  the memory note on `spacetime generate` in Docker if you hit the usual
  gotchas (no Node.js in the image, `--include-private`, etc. — check
  `ref_spacetimedb_generate.md`-style memory or ask the user).
- Boss rendering: in `_onEnemyInsert`, branch on `isBoss` — larger radius,
  a `lineStyle` stroke colored by `rarity` (uncommon = green, per the
  brief; pick a reasonable color per rarity tier consistent with however
  `enemyLevelBand.ts` already assigns colors, or ask `ability-balancer`/
  `lore-keeper` for a canonical rarity palette if one doesn't exist yet).
- Announcement banner: reuse the `_triggerLevelUp` fade-in/hold/fade-out
  pattern (`GameScene.ts` ~line 1511) for "The Vale Warden stirs." on
  boss spawn.
- HUD timer: new pure function (client-side, no Phaser import) formatting
  `"Warden: M:SS remaining"` / `"Warden returns in M:SS"` per `SW-049`
  — extract it so it's unit-testable, then wire it into `_createHud`/
  `_updateHud` following the existing HP/MP/XP-bar field conventions
  (`.setScrollFactor(0)`, matching depth/origin conventions).
- Unit test the pure formatting function; the glow color and banner fade
  itself are manual-QA only per the testing contract.

**Test**: integration tests in `spacetimedb/integration/` for the
scenarios named in the promoted SYS/CON specs' Verification Descriptions
(sustained-deviation threshold crossing, boss window force-close,
boss-excluded-from-accounting).
Prefer adding `it`s to an existing
`describe` over new files, per `005-testing-contract.md`.

### Story E — Zone mastery cutoff and tutorial routing (was STR-014)

**Modified**: `spacetimedb/src/rules/leveling.ts` or the `damageEnemy`
call site in `index.ts` — before calling `computeXpReward`, look up
`ctx.db.zone.zoneId.find(enemy.zoneId)` and short-circuit to zero XP if
`character.level >= zone.maxLevel`.
Keep this check separate from (before)
`computeXpReward`'s own level-gap falloff, so the two zero-causes stay
distinguishable for the client.

**Modified**: the death reducer (`spacetimedb/src/index.ts`, the function
containing `computeRetention`/the current `char.level >= 10` check,
~line 1137) — change the condition to
`char.level >= zone.maxLevel && zone.tutorialZone` (look up the
character's zone at time of death), keeping the death-gated,
flip-once-only mechanism otherwise unchanged.
This is the `CON-008`
supersession from step 0 above.

**Modified**: `startLife` (~line 955-1000) — compute `zoneId` server-side
from `progress.tutorialCompleted` (mirroring the existing `startLevel`
computation immediately above it) instead of trusting the caller's
`startZoneId` argument: `true` → zone 2 (guarded — check
`ctx.db.zone.zoneId.find(2)` exists; if not, fall back to zone 1 with a
`// TODO: route to zone 2 once it exists` comment), `false` → zone 1.
Confirm whether the `startZoneId` reducer parameter should be removed
entirely or just ignored — removing it is cleaner if nothing else calls
`startLife` with a meaningful value, but check call sites first.

**Client** (`GameScene.ts` + wherever the floating XP text /
`_showFloatingXp` lives):

- The client already computes `computeXpReward` client-side to decide
  `No XP` vs a number (`ARCH-011`).
  Add the same zone-cap check
  (`character.level >= zone.maxLevel`, using the already-subscribed
  `zone` table row) _before_ falling back to the existing level-gap
  check, and show `Zone mastered` instead of `No XP` when the cap is the
  cause.
- One-time message: track "have I shown this for the current character"
  purely client-side (a local flag/set keyed by `characterId`, reset per
  character since a level-up crossing only happens once per character
  anyway) — trigger on the level-up event that pushes `character.level`
  from below to at-or-above `zone.maxLevel` in a `tutorialZone: true`
  zone; render centered, using the existing death-summary-overlay or
  level-up-banner pattern (whichever reads better for a longer message);
  source the text from `zone.masteredMessage`.
- Confirm the public `zone` table actually exposes `maxLevel` and
  `tutorialZone` to the client (see the note in Story A about whether
  `tutorialZone` needs to be a `zone` table column, not just a
  content-file field — resolve this before writing the client code, since
  it changes what the table schema needs).

**Test**: `spacetimedb/src/rules/leveling.test.ts` (zone-cap zero-XP
case), an integration test for the death-reducer threshold change, and a
client-side unit test for the zone-mastered-vs-no-xp decision logic
(extracted pure function, not inline in `GameScene.ts`).

## 2. Final step: doc-keeper

Once all five stories are implemented, tested, and their specs anchored
(`clew-anchor`) and covered (`clew coverage` clean), run the `doc-keeper`
skill.
Per the original task brief, at minimum:

- `docs/DATA_MODEL.puml` needs `enemy.rarity`, `enemy.isBoss`, the new
  `zoneDirectorState` table, and the `zone` table's activated
  (seeded/read) status.
- `docs/GAME_DESIGN.md` needs the spawn director and zone-mastery cutoff
  folded into the **Resolved** section, and the "enemy difficulty tiers
  do not exist yet" placeholder note removed/updated.
- `docs/BALANCE.md` needs a pointer to `content/zones.json` for
  population/director/boss tuning, and the new
  `enemies.rarityMultipliers` config key documented alongside the
  existing enemy balance values.

## 3. Verification checklist (from the original task brief)

Re-run these manually once implementation is complete:

1. All new vitest suites pass; the `allocateBands` property test holds
   over randomized input.
2. Break `zones.json` (`floorPerOccupiedBand * bands > max`) — module
   init throws, naming both numbers.
3. Solo player at level 1: mobs cluster in band 0, a few elsewhere, total
   near `population.min`.
4. Level up to 9: within a few director ticks, band 4 gains mobs and
   band 0 thins, with no visible pop-in near the player.
5. Walk to a thinning area mid-rebalance: no mob vanishes within
   `despawnSafeDistPx` of the player.
6. Stand still 5 minutes killing nothing: population stays stable, no
   runaway spawning.
7. Boss appears on schedule, banner fires, HUD timer counts down,
   despawns after 5 minutes if unkilled.
8. Kill the boss: loot rolls one rarity tier up (and never reaches
   legendary, per the `CON-004` design choice above).
9. Reach level 10: "Zone mastered," XP stops.
