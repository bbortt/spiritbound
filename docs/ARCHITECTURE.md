# Spiritbound — Architecture Decisions

ADR-style record of system-structure decisions: where logic lives, how systems
communicate, and what's deliberately deferred.
Owned by the `architect` skill.
Gameplay _numbers_ live in `BALANCE.md`; table shapes live in `DATA_MODEL.puml`.
This file explains _why_ the structure looks the way it does.

---

## SpacetimeDB + TypeScript modules chosen over a Java backend — 2026

**Context:** Needed a real-time multiplayer backend with networking,
subscriptions, and persistence built in, without hand-rolling concurrent I/O.
**Decision:** SpacetimeDB with TypeScript server modules (beta), one language
end-to-end (client + server).
**Consequences:** Auto-generated typed client bindings, reducer/transaction
model instead of arbitrary request handlers.
Risk: TS modules are beta
(performance caveats), and the module is locked to the reducer model.
Hedge:
keep reducers thin so the module could be ported to Rust/C# later if needed.

## Thin reducers, pure rules functions — 2026

**Context:** Reducers are the only way to mutate SpacetimeDB tables, but
mixing game-rule math directly into reducer bodies makes rules hard to test
and impossible to reuse outside the module (e.g. for client-side prediction
or unit tests).
**Decision:** Reducers in `spacetimedb/src/index.ts` do only: validate input,
call a pure function in `spacetimedb/src/rules/*.ts`, write the result to
tables.
All scaling, retention, and hit-resolution math lives in `rules/` and
takes/returns plain data — no SpacetimeDB imports, no side effects.
**Consequences:** Rules functions (`resolveHit`, `computeRetention`,
`computeSpiritLevel`, etc.) are unit-testable in isolation and portable off
SpacetimeDB if the backend ever changes.
Costs a small amount of
indirection (reducer → rules call → write) for every mutation.

## Login server deferred — 2026

**Context:** Spiritbound needs accounts, sessions, and credential handling,
but SpacetimeDB's beta TS modules are not where you want to keep auth secrets.
**Decision:** A separate, conventional login/auth service is planned but not
yet built.
For now, the game module trusts SpacetimeDB's connection
`Identity` directly (`ctx.sender`) as if it were already a verified identity.
**Consequences:** Fast to prototype the vertical slice without standing up a
second service.
Risk: there is currently no real credential layer — anyone
who can open a SpacetimeDB connection is "logged in" as that identity.
This
must be closed before any real deployment; the seam is `ctx.sender`, so
swapping in verified identities later shouldn't require reworking reducers.

## Client-side hit detection, server-side damage application — 2026

**Context:** Combat is cursor-aimed (PoE-style); geometric hit detection
(cone/line/arc/circle vs. target position) is naturally cheap and immediate
on the client, but trusting the client with damage numbers would make the
server non-authoritative.
**Decision:** The client determines _whether_ an attack geometrically
connects (aim vs. shape vs. target position) and tells the server "this
target was hit." The server (via `rules/combat.ts#resolveHit`) is the sole
authority on _how much_ damage that translates to — level scaling, defense,
avoidance, crit — and is the only thing that writes to `currentHp`.
**Consequences:** Matches the design pillar "hitting is skill, mitigation is
stats." Client can never inflate its own damage.
Costs one extra round-trip
per landed hit (client confirms geometry → server resolves damage) versus a
fully client-authoritative model.

## Enemy AI as a server-authoritative scheduled tick — 2026

**Context:** Enemies need to chase, telegraph, and attack players without any
per-enemy client trust, and without the server needing a continuous
per-frame simulation loop (which SpacetimeDB reducers aren't built for).
**Decision:** A single repeating scheduled reducer, `enemyTick`, fires every
500ms (`enemyTickSchedule`, an Interval schedule that never deletes its row)
and steps every enemy through a five-state machine
(`idle → chasing → casting → cooldown → resetting`) stored on the `Enemy`
row itself (`aggroState`).
Death triggers a one-shot `enemyRespawnSchedule`
15s later.
**Consequences:** All enemy behavior is server state the client can only
read and interpolate between ticks — no client authority over aggro, damage
timing, or positioning.
Coarser time resolution (500ms) than a per-frame
simulation, which is an accepted tradeoff for correctness and simplicity.

## Telegraph is client-visual-only; server owns cast damage — 2026

**Context:** Players need to _see_ an incoming enemy attack (cast bar, ground
AoE indicator) far enough ahead to react, per the "preparation over
reaction" pillar — but that telegraph must never be something the client can
spoof or suppress to avoid damage.
**Decision:** The server tracks `castStartedAt` / `castDurationSeconds` on
the `Enemy` row and fires the actual damage (`_fireCast`, hits every
character within `attackRangePx`) purely server-side once the duration
elapses.
The client only renders a countdown/indicator from the same
replicated fields — it has no ability to alter whether or how much damage
lands.
**Consequences:** Same trust boundary as basic combat: client renders,
server decides.
The visual telegraph and the damage window are guaranteed to
agree because both derive from the same server-owned timestamp.

## Card drops as a transient table with scheduled cleanup — 2026

**Context:** Ground loot needs to appear, be visible to every player in the
zone, be pickable up once, and disappear after a timeout — without relying
on any client's clock.
**Decision:** `CardDrop` is a real table (not a client-side ephemeral
object).
A repeating `cardDropCleanupSchedule` reducer runs every 10s and
deletes any drop older than 60s by comparing `createdAt` against
`ctx.timestamp`.
Pickup (`pickupCard`) is itself a reducer that validates
zone + 80px proximity before granting the card and deleting the row.
**Consequences:** Despawn timing and pickup eligibility are both
server-authoritative and consistent for every observer — no client can see a
drop that's already gone, or grab one out of range.
Costs a small, constant
per-tick table scan in the cleanup reducer (acceptable at current scale).

**Extended to items — 2026:** `ItemDrop` follows the identical pattern
(`_dropItemFromEnemy`, 40% independent roll, `pickupItem`).
Rather than a
second scheduled reducer, `cardDropCleanup` was extended to sweep both
tables in the same 10s tick — one schedule, one age check, applied twice.

## ItemInstance/EquippedItem made public for the inventory UI — 2026

**Context:** The previous session deliberately made `itemInstance` and
`equippedItem` `public: false` ("character-owned, private").
Building
InventoryPanel/CharacterSheet requires the client to subscribe to a
character's own bag and gear, but this SDK's `public: false` means _no_
client subscription at all — there's no way to expose rows to only their
owner that way.
**Decision:** Flip both tables to `public: true`, matching the existing
`cardInstance`/`equippedCard` precedent (also owned-but-public, with the
client filtering to `ownerCharacterId === localCharacter.characterId` /
`characterId === ...` itself in `GameScene.ts`).
No row-level security is
applied.
**Consequences:** Any connected client can subscribe to every character's
bag and equipped gear, not just their own — the same exposure `cardInstance`
already had, so this isn't a new class of leak for this codebase, just
extending an accepted one.
The SDK does support real server-enforced
row-level security (`schema().clientVisibilityFilter.sql(...)`, found via
`node_modules/spacetimedb/src/server/schema.ts`) that could scope this to
`owner_character_id`'s account — not applied here to keep this change small
and consistent with the existing pattern; worth revisiting before anything
beyond a local vertical slice ships.

## Client-side effectiveStats duplication (CharacterSheet) — 2026

**Context:** `effective_stats` is explicitly a derived value that's "computed
in rules/ and never stored" (see this file's header comment on
`index.ts`).
CharacterSheet needs to show a stat total, but SpacetimeDB has
no query-style RPC — only table subscriptions and reducer calls — so there
is no way for the client to ask the server "what are my effective stats"
without the server writing them to a row (which the architecture rule
forbids).
**Decision:** `client/src/effectiveStats.ts` re-implements
`rules/stats.ts#computeRaceBase`/`computeEffectiveStats` byte-for-byte in
TypeScript, imported by both `CharacterSheet.ts` and `GameScene.ts` (for the
top HP/MP HUD bar, which — before this change — used a stale
`100 + level*15` formula left over from before gear-based stats existed).
**Consequences:** Two copies of the same pure math, one per language
boundary, with no compiler or test enforcing they match — a real
sync-by-hand risk if `rules/stats.ts` changes.
This is not a new pattern:
`CollectionPanel.ts` already duplicates `computeHandSlots`/
`computeAttunementSlots` from `rules/death.ts` with different (drifted)
numbers, which this change did not touch or fix — flagging it here since
it's now a second instance of the same risk class.
If this keeps
recurring, worth a real fix (e.g. a reducer that returns computed values
via its own dedicated row, or a shared package built from `rules/`).

## Client-side computeCharacterLevel duplication (XP bar) — 2026

**Context:** The client needs to render an XP bar (current level's progress
toward the next) and detect level-ups reactively, but — same constraint as
the `effectiveStats` ADR above — SpacetimeDB has no query-style RPC, only
table subscriptions and reducer calls, and the architecture rule is that
derived values (a level computed from XP) are never stored on a row.
The
server does store `character.xp` and now `character.level`/
`lastLevelUpAt` directly (since level is checked and written by `_grantXp`
on every kill), but the _thresholds_ (how much XP each level boundary
needs) are only known by evaluating `computeCharacterLevel` — the client
has no way to ask the server "how much XP until level 6."
**Decision:** `client/src/levelCurve.ts` duplicates
`rules/death.ts#computeCharacterLevel` byte-for-byte, then derives
`xpForLevel` (binary search over the duplicated function, rather than
hand-inverting the curve as a second formula) and `xpProgress` (current
level + XP band) on top of it.
Both copies carry a comment pointing at the
other file.
**Consequences:** A second sync-by-hand risk of the same class as the
`effectiveStats` duplication — if `rules/death.ts#computeCharacterLevel`'s
curve shape changes, the client's XP bar will silently show wrong
thresholds until someone remembers to copy the change over.
Deriving
`xpForLevel` by binary search (instead of algebraically inverting the
curve) means at least the _inversion_ can never drift even if the curve
itself does — only the one duplicated function needs to stay in sync, not
two independently-written ones.
Same long-term fix as the `effectiveStats`
entry: a shared package built from `rules/`, or a server-computed row, if
this pattern keeps recurring (it's now the third instance, alongside
`effectiveStats.ts` and `CollectionPanel.ts`'s drifted hand-slot copy).

## HP/MP refill on level-up implemented server-side, not client-side — 2026

**Context:** The level-up feature spec described HP/MP refill under a
"CLIENT" heading (alongside the level-up VFX), but `currentHp`/`currentMp`
are permadeath-sensitive values that only the server may write, per the
"client renders, server decides" trust boundary established for combat
above.
**Decision:** The refill happens inside `_grantXp` (server-side,
`index.ts`) at the moment a level-up is detected — `currentHp`/`currentMp`
are set to the character's new max via `buildEffectiveStats`, in the same
write as the XP/level/`lastLevelUpAt` update.
The client only reacts to the
resulting `character` row change (already full HP/MP by the time it sees
the update) to play the refill visually; it never computes or requests the
refill itself.
**Consequences:** A deliberate deviation from the literal spec wording,
consistent with every other HP-writing path in this codebase (combat,
gear-swap rescaling).
Keeps the invariant "only the server ever writes
currentHp/currentMp" exception-free.

## Content pipeline: cards.json is the single source of truth — 2026

**Context:** Card definitions need to be authored by a human (or
`ability-balancer`), validated against balance rules, and reliably pushed
into the `cardDefinition` table without ever going stale relative to the
file.
**Decision:** `content/cards.json` is parsed and checked by a Zod schema plus
cross-field rules (`content/validate.ts` — e.g. legendary cards must have
`minLevel >= 35`), covered by `content/cards.test.ts` (vitest), then upserted
into `cardDefinition` by the `seedCards` reducer using **slug as the
idempotency key** (`ctx.db.cardDefinition.slug.find(card.slug)` decides
insert vs. update). `site/_data/cards.json` is a synced copy (via
`site:sync-cards`) so the player-facing Jekyll site's card pages are
generated from the same source.
**Consequences:** Cards can never be hand-edited directly into the database
— every change goes through the file → validator → seeder path, so
`content/cards.json` and the live `cardDefinition` table (and the public
site) can't silently diverge.
Re-running the seeder is always safe
(idempotent upsert, not append).

## Gear stats wired into combat via resolveHit — 2026

**Context:** `rules/combat.ts#resolveHit` and the `itemDefinition`/
`itemInstance`/`equippedItem` tables existed, but nothing called
`resolveHit` — `damageEnemy` and `applyDamage` took a client-computed flat
`damage` number and subtracted it directly from HP, and the enemy's
telegraphed cast (`_fireCast`) did the same.
This meant gear stats had zero
effect on combat, and (per the "client renders, server decides" ADR above)
the server wasn't actually deciding damage at all.
**Decision:** `rules/stats.ts` adds `computeRaceBase`/`computeEffectiveStats`
(pure, race base + additive gear). `index.ts#buildEffectiveStats(ctx, char)`
reads a character's `equippedItem` rows and derives their live `StatBlock`
on every hit — never stored. `damageEnemy` now takes `cardDefId` (0 = bare
weapon swing) instead of a damage number; `_fireCast` and `applyDamage`
route through a shared `_resolveAndApplyDamage` helper.
All three now call
`resolveHit` with the real attacker/defender `StatBlock`s.
**Consequences:** Client can no longer dictate damage — `GameScene.ts`'s two
`damageEnemy` call sites now send only `cardDefId`, matching the existing
hit-detection trust boundary (client confirms geometric connection, server
resolves damage).
Enemies still have no `StatBlock` of their own (flat
`castDamage`/`damagePerHit`), so `EMPTY_STAT_BLOCK` stands in as their
attacker/defender stats until enemies get real stats. `equipItem`/
`unequipItem` (new) recompute maxHp/maxMp and proportionally rescale
current HP/MP around every gear change, via `_withProportionalResourceUpdate`.

**Extended to equipment — 2026:** `content/equipment.json` follows the
identical pattern (`content/validateEquipment.ts` Zod schema + cross-item
rules, `content/equipment.test.ts`, `seedItems` reducer upserting
`itemDefinition` by slug).
One structural difference: the node:fs-touching
`loadEquipment()` (and cards' `loadCards()`) live in a separate loader file
(`equipmentLoader.ts` / `loader.ts`) from the pure Zod/validation code —
`spacetimedb/src/index.ts` imports only the pure `parseEquipment`/`parseCards`
functions, so esbuild's tree-shaking can drop `node:fs` from the bundle
entirely.
SpacetimeDB's JS runtime has no `node:fs`, so a single-file version
that mixed the two failed at publish time with `Could not find module
"node:fs"` — the split is load-bearing, not just style.

## clew spec retrofit: drops.ts and enemyAi.ts extracted from index.ts — 2026

**Context:** Adopting `clew` for spec-to-code traceability (see
`docs/spec/architecture.md`) required every SW/CON spec to anchor to real,
testable code.
Two areas of game-rule math were living directly inside
`index.ts` reducers, coupled to `ctx`/`ctx.random()`, in violation of this
file's own "thin reducers, pure rules functions" rule (see above): the
drop-roll rarity-weighting/level-gating logic, and the enemy aggro/chase/
telegraph/reset state machine.
**Decision:** Extracted both into new pure-function modules —
`spacetimedb/src/rules/drops.ts` (`pickWeightedRarity`, `pickLevelAndRarityGated`,
`CARD_DROP_CHANCE`/`ITEM_DROP_CHANCE`/`RARITY_DROP_WEIGHTS`, randomness taken
as parameters rather than read from `ctx`) and `spacetimedb/src/rules/enemyAi.ts`
(`findClosestInRange`, `decideChasing`, `hasCastElapsed`, `decideCooldown`,
`decideResetting`, plus the already-pure `distSq`/`moveToward`, with "now"
and every position/timing value passed in rather than read from
`ctx.timestamp`). `index.ts`'s `_dropCardFromEnemy`/`_dropItemFromEnemy` and
`enemyTick` now call into these instead of containing the logic inline.
**Consequences:** Both modules are now unit-tested
(`rules/drops.test.ts`, `rules/enemyAi.test.ts`) the same way `rules/combat.ts`
and `rules/death.ts` already were — closing what had been an
architecture-rule violation with no test coverage at all.
No behavior change;
this was a pure extraction, verified by the full test suite staying green and
the esbuild bundle still producing byte-identical `node:fs`-free output.

## CollectionPanel's hand-slot/attunement duplicate was drifted — found and fixed — 2026

**Context:** While anchoring the Hand/Card Management specs, `client/src/ui/
CollectionPanel.ts` was found to carry its own local `computeHandSlots`/
`computeAttunementSlots` functions — a _fourth_ instance of the client/server
duplication-risk class (alongside `effectiveStats.ts`, `levelCurve.ts`, and
now this one) — whose formulas no longer matched `rules/death.ts` (e.g. at
spirit level 1, the client said 3 active slots; the server says 2) and whose
`computeAttunementSlots` returned a single combined number instead of the
server's real per-rarity breakdown.
The panel's own attunement-budget display
(`rarityBudget`) also hardcoded fixed per-rarity caps (`Common: 3, Uncommon:
2, ...`) unrelated to spirit level entirely.
**Decision:** Corrected and extracted the duplicate into `client/src/
handSlots.ts`, matching `rules/death.ts` exactly (including the real
per-rarity `AttunementSlots` shape); `CollectionPanel.ts` now imports from it,
derives `rarityBudget` from the real per-rarity slots, and its `canAttune`
check was fixed to gate per-rarity (matching the server's `toggleAttune`)
rather than against a single combined total.
**Consequences:** A real, previously-unnoticed UI bug (wrong slot counts,
wrong attune-availability decisions once spirit level or card rarity mix
diverged from the hardcoded assumptions) — not just a documentation gap.
Fixed as part of the same change that made it testable
(`client/src/handSlots.test.ts` cross-checks the corrected client copy
against `rules/death.ts`'s real output), consistent with the existing
`effectiveStats.ts`/`levelCurve.ts` duplication pattern.

## `content/config.json` splits operator configuration from authored content — 2026

**Context:** Every balance dial lived in code: `CARD_DROP_CHANCE`/
`ITEM_DROP_CHANCE`/`RARITY_DROP_WEIGHTS` in `rules/drops.ts`, the aggro/attack/
deaggro ranges and chase/reset speeds in `rules/enemyAi.ts`, and the 60s
despawn / 80px pickup / 15s respawn literals inline in `index.ts`.
Retuning a
server therefore meant editing TypeScript and republishing — which makes a
"custom server" not meaningfully custom.
`content/` already held authored
content (`cards.json`, `equipment.json`) with a validator/loader pipeline, so
the question was whether operator dials belong in the same place.

**Decision:** They do, but as a distinct _kind_ of file with a different owner.
`content/` now holds two kinds:

- **content** — `cards.json`, `equipment.json`.
  Authored by designers, seeded
  into tables, changed by a content pull request.
- **operator configuration** — `config.json`.
  Balance dials a server operator
  is expected to edit on their own deployment.
  Never seeded; read straight
  into the module's runtime constants.

Both go through the same discipline: a Zod schema in a pure validator
(`validateConfig.ts`), a `node:fs` loader split out per the existing
tree-shaking decision (`configLoader.ts`), validation at module load, and a
throw that stops the module rather than a warning that lets it run.

The pure rule modules do **not** import the config.
`rules/drops.ts` takes a
`RarityWeights` argument; `rules/enemyAi.ts` takes an `EnemyAiTuning`
argument; `rules/leveling.ts` takes a `LevelDiffTuning` argument.
`index.ts` —
the one place that already owns runtime wiring — loads the config once at
module init and passes the values in.

**Consequences:** A server operator can retune the economy without forking the
code, and `BALANCE.md` finally has a single file to point at instead of three
modules.
Keeping the rules parameterised rather than letting them read a config
singleton preserves what the testing contract depends on: a rule function's
output is a function of its arguments, so a test fixes the tuning instead of
the process's environment.

The cost, recorded rather than resolved: **two constraints that used to be
guaranteed by code are now numbers in a file an operator may edit, and the
schema does not enforce either.** `CON-003` (chase speed always under the
player's move speed) and `CON-004` (zero legendary drop weight) were both
code-level invariants; they are now `config.json` values.
The shipped config
honours both, and `enemyAi.test.ts` and `config.test.ts` assert that it does —
so this repository's own values stay correct.
What is gone is the guarantee
for a _modified_ deployment.
Adding schema-level guards for both would close
it, and is a deliberate follow-up decision rather than an oversight (see
`STR-009`'s Out of scope).

## The client duplicates `computeXpReward` to render the floating XP number — 2026

**Context:** The floating "+N XP" text read `enemy.xpReward` straight off the
row.
Once the reward scales by the player-to-enemy level gap, that column no
longer holds the number that was granted — the reward depends on _who_ killed
the enemy — so it was removed from the table entirely, leaving the client with
no source for the value.
Rows carry state; they do not carry the outcome of a
reducer call.

**Decision:** Duplicate it.
`client/src/xpReward.ts` carries a byte-for-byte
copy of `rules/leveling.ts#computeXpReward` plus a copy of the `xp` block of
`config.json`, and the client computes the number from the enemy row's `level`
and the local character's level.

The alternatives were worse.
Writing the granted amount back to the enemy row
would store a derived, per-killer value on a shared row — exactly what
`index.ts`'s own header forbids.
Shipping the operator's balance file to every
browser for one number is disproportionate.
Duplication is the pattern this
codebase has already chosen twice at the same boundary
(`client/src/levelCurve.ts`, `client/src/handSlots.ts`), and it is the one with
a precedent for keeping the copies honest.

**Consequences:** A fourth hand-synced duplicate, with the usual drift risk —
mitigated the same way as the others: `client/src/xpReward.test.ts` sweeps
every level pair from 1–50 and asserts the client's output equals the server
function's, and `content/config.test.ts` asserts the client's copied `xp`
block still matches the shipped `config.json`.
That second check is the one
that actually bites: a retuned config nobody mirrored into the client would
otherwise make the floating number silently disagree with the XP granted.
It
lives on the content side because the client's `tsconfig` cannot see the
`node:fs` loader.
