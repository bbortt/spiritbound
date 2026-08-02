# Spiritbound — Architecture Decisions

ADR-style record of system-structure decisions: where logic lives, how systems
communicate, and what's deliberately deferred. Owned by the `architect` skill.
Gameplay *numbers* live in `BALANCE.md`; table shapes live in `DATA_MODEL.puml`.
This file explains *why* the structure looks the way it does.

---

## SpacetimeDB + TypeScript modules chosen over a Java backend — 2026

**Context:** Needed a real-time multiplayer backend with networking,
subscriptions, and persistence built in, without hand-rolling concurrent I/O.
**Decision:** SpacetimeDB with TypeScript server modules (beta), one language
end-to-end (client + server).
**Consequences:** Auto-generated typed client bindings, reducer/transaction
model instead of arbitrary request handlers. Risk: TS modules are beta
(performance caveats), and the module is locked to the reducer model. Hedge:
keep reducers thin so the module could be ported to Rust/C# later if needed.

## Thin reducers, pure rules functions — 2026

**Context:** Reducers are the only way to mutate SpacetimeDB tables, but
mixing game-rule math directly into reducer bodies makes rules hard to test
and impossible to reuse outside the module (e.g. for client-side prediction
or unit tests).
**Decision:** Reducers in `spacetimedb/src/index.ts` do only: validate input,
call a pure function in `spacetimedb/src/rules/*.ts`, write the result to
tables. All scaling, retention, and hit-resolution math lives in `rules/` and
takes/returns plain data — no SpacetimeDB imports, no side effects.
**Consequences:** Rules functions (`resolveHit`, `computeRetention`,
`computeSpiritLevel`, etc.) are unit-testable in isolation and portable off
SpacetimeDB if the backend ever changes. Costs a small amount of
indirection (reducer → rules call → write) for every mutation.

## Login server deferred — 2026

**Context:** Spiritbound needs accounts, sessions, and credential handling,
but SpacetimeDB's beta TS modules are not where you want to keep auth secrets.
**Decision:** A separate, conventional login/auth service is planned but not
yet built. For now, the game module trusts SpacetimeDB's connection
`Identity` directly (`ctx.sender`) as if it were already a verified identity.
**Consequences:** Fast to prototype the vertical slice without standing up a
second service. Risk: there is currently no real credential layer — anyone
who can open a SpacetimeDB connection is "logged in" as that identity. This
must be closed before any real deployment; the seam is `ctx.sender`, so
swapping in verified identities later shouldn't require reworking reducers.

## Client-side hit detection, server-side damage application — 2026

**Context:** Combat is cursor-aimed (PoE-style); geometric hit detection
(cone/line/arc/circle vs. target position) is naturally cheap and immediate
on the client, but trusting the client with damage numbers would make the
server non-authoritative.
**Decision:** The client determines *whether* an attack geometrically
connects (aim vs. shape vs. target position) and tells the server "this
target was hit." The server (via `rules/combat.ts#resolveHit`) is the sole
authority on *how much* damage that translates to — level scaling, defense,
avoidance, crit — and is the only thing that writes to `currentHp`.
**Consequences:** Matches the design pillar "hitting is skill, mitigation is
stats." Client can never inflate its own damage. Costs one extra round-trip
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
row itself (`aggroState`). Death triggers a one-shot `enemyRespawnSchedule`
15s later.
**Consequences:** All enemy behavior is server state the client can only
read and interpolate between ticks — no client authority over aggro, damage
timing, or positioning. Coarser time resolution (500ms) than a per-frame
simulation, which is an accepted tradeoff for correctness and simplicity.

## Telegraph is client-visual-only; server owns cast damage — 2026

**Context:** Players need to *see* an incoming enemy attack (cast bar, ground
AoE indicator) far enough ahead to react, per the "preparation over
reaction" pillar — but that telegraph must never be something the client can
spoof or suppress to avoid damage.
**Decision:** The server tracks `castStartedAt` / `castDurationSeconds` on
the `Enemy` row and fires the actual damage (`_fireCast`, hits every
character within `attackRangePx`) purely server-side once the duration
elapses. The client only renders a countdown/indicator from the same
replicated fields — it has no ability to alter whether or how much damage
lands.
**Consequences:** Same trust boundary as basic combat: client renders,
server decides. The visual telegraph and the damage window are guaranteed to
agree because both derive from the same server-owned timestamp.

## Card drops as a transient table with scheduled cleanup — 2026

**Context:** Ground loot needs to appear, be visible to every player in the
zone, be pickable up once, and disappear after a timeout — without relying
on any client's clock.
**Decision:** `CardDrop` is a real table (not a client-side ephemeral
object). A repeating `cardDropCleanupSchedule` reducer runs every 10s and
deletes any drop older than 60s by comparing `createdAt` against
`ctx.timestamp`. Pickup (`pickupCard`) is itself a reducer that validates
zone + 80px proximity before granting the card and deleting the row.
**Consequences:** Despawn timing and pickup eligibility are both
server-authoritative and consistent for every observer — no client can see a
drop that's already gone, or grab one out of range. Costs a small, constant
per-tick table scan in the cleanup reducer (acceptable at current scale).

**Extended to items — 2026:** `ItemDrop` follows the identical pattern
(`_dropItemFromEnemy`, 40% independent roll, `pickupItem`). Rather than a
second scheduled reducer, `cardDropCleanup` was extended to sweep both
tables in the same 10s tick — one schedule, one age check, applied twice.

## ItemInstance/EquippedItem made public for the inventory UI — 2026

**Context:** The previous session deliberately made `itemInstance` and
`equippedItem` `public: false` ("character-owned, private"). Building
InventoryPanel/CharacterSheet requires the client to subscribe to a
character's own bag and gear, but this SDK's `public: false` means *no*
client subscription at all — there's no way to expose rows to only their
owner that way.
**Decision:** Flip both tables to `public: true`, matching the existing
`cardInstance`/`equippedCard` precedent (also owned-but-public, with the
client filtering to `ownerCharacterId === localCharacter.characterId` /
`characterId === ...` itself in `GameScene.ts`). No row-level security is
applied.
**Consequences:** Any connected client can subscribe to every character's
bag and equipped gear, not just their own — the same exposure `cardInstance`
already had, so this isn't a new class of leak for this codebase, just
extending an accepted one. The SDK does support real server-enforced
row-level security (`schema().clientVisibilityFilter.sql(...)`, found via
`node_modules/spacetimedb/src/server/schema.ts`) that could scope this to
`owner_character_id`'s account — not applied here to keep this change small
and consistent with the existing pattern; worth revisiting before anything
beyond a local vertical slice ships.

## Client-side effectiveStats duplication (CharacterSheet) — 2026

**Context:** `effective_stats` is explicitly a derived value that's "computed
in rules/ and never stored" (see this file's header comment on
`index.ts`). CharacterSheet needs to show a stat total, but SpacetimeDB has
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
sync-by-hand risk if `rules/stats.ts` changes. This is not a new pattern:
`CollectionPanel.ts` already duplicates `computeHandSlots`/
`computeAttunementSlots` from `rules/death.ts` with different (drifted)
numbers, which this change did not touch or fix — flagging it here since
it's now a second instance of the same risk class. If this keeps
recurring, worth a real fix (e.g. a reducer that returns computed values
via its own dedicated row, or a shared package built from `rules/`).

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
site) can't silently diverge. Re-running the seeder is always safe
(idempotent upsert, not append).

## Gear stats wired into combat via resolveHit — 2026

**Context:** `rules/combat.ts#resolveHit` and the `itemDefinition`/
`itemInstance`/`equippedItem` tables existed, but nothing called
`resolveHit` — `damageEnemy` and `applyDamage` took a client-computed flat
`damage` number and subtracted it directly from HP, and the enemy's
telegraphed cast (`_fireCast`) did the same. This meant gear stats had zero
effect on combat, and (per the "client renders, server decides" ADR above)
the server wasn't actually deciding damage at all.
**Decision:** `rules/stats.ts` adds `computeRaceBase`/`computeEffectiveStats`
(pure, race base + additive gear). `index.ts#buildEffectiveStats(ctx, char)`
reads a character's `equippedItem` rows and derives their live `StatBlock`
on every hit — never stored. `damageEnemy` now takes `cardDefId` (0 = bare
weapon swing) instead of a damage number; `_fireCast` and `applyDamage`
route through a shared `_resolveAndApplyDamage` helper. All three now call
`resolveHit` with the real attacker/defender `StatBlock`s.
**Consequences:** Client can no longer dictate damage — `GameScene.ts`'s two
`damageEnemy` call sites now send only `cardDefId`, matching the existing
hit-detection trust boundary (client confirms geometric connection, server
resolves damage). Enemies still have no `StatBlock` of their own (flat
`castDamage`/`damagePerHit`), so `EMPTY_STAT_BLOCK` stands in as their
attacker/defender stats until enemies get real stats. `equipItem`/
`unequipItem` (new) recompute maxHp/maxMp and proportionally rescale
current HP/MP around every gear change, via `_withProportionalResourceUpdate`.

**Extended to equipment — 2026:** `content/equipment.json` follows the
identical pattern (`content/validateEquipment.ts` Zod schema + cross-item
rules, `content/equipment.test.ts`, `seedItems` reducer upserting
`itemDefinition` by slug). One structural difference: the node:fs-touching
`loadEquipment()` (and cards' `loadCards()`) live in a separate loader file
(`equipmentLoader.ts` / `loader.ts`) from the pure Zod/validation code —
`spacetimedb/src/index.ts` imports only the pure `parseEquipment`/`parseCards`
functions, so esbuild's tree-shaking can drop `node:fs` from the bundle
entirely. SpacetimeDB's JS runtime has no `node:fs`, so a single-file version
that mixed the two failed at publish time with `Could not find module
"node:fs"` — the split is load-bearing, not just style.
