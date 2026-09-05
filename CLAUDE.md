# Spiritbound — Project Orientation

**A 2D/2.5D permadeath MMO RPG where cards define your abilities, spirits guard your soul, and death is (almost) permanent.**

## Design & Pillars

Read `docs/GAME_DESIGN.md` first.
The core pillars:

1. Cards are your soul, gear is your body.
2. Preparation over reaction (spirits as bonfires).
3. PvE-first (no open PvP).
4. Every drop has value (gear loss = permanent economy sink).

## Requirements & Traceability (clew)

This project uses **[clew](.clewrc.json)** for spec-to-code traceability on
all TypeScript code (server, client, content pipeline — see
`004-technology-contract.md`).
This is not optional tooling: it is how
requirements are recorded and how code proves it satisfies them.

- **Load `.claude/.ai-project-context/` in numerical order (000→006) before
  any task** — `000` is the agent bootstrap contract, `001` the charter,
  `002`/`004`/`005` the architecture/technology/testing contracts, `003`/`006`
  developer guidelines and spec conventions.
  These govern _how_ you work;
  they carry binding authority per `000`'s priority model.
- **`docs/spec/`** is the requirements corpus: `stories/` (the increments of
  work) and `specs/` (STK/SYS/SW/ARCH/NF/CON — the atomic, checkable
  requirements a story realizes), laid out per `.clewrc.json`.
  This is the
  source of truth for _what the system must do_, alongside the narrative
  design docs below.
- **Every new feature or behavior change**: draft the story/specs
  (`clew-draft`), ground them against existing code and specs
  (`clew-context`), get them approved and finalized (`clew-promote`), then
  implement with the spec set `active` and the code **and its test**
  **anchored** to it (`clew-implement` / `clew-anchor`).
  Writing that test —
  unit, integration, or both, per `005-testing-contract.md` §0 — is part of
  the task by default, not something to wait to be asked for; the same
  section also says what _not_ to bother testing, so this never becomes
  padding for its own sake.
  Run `clew-review` on the changed specs before calling the
  work done.
  Never write game-affecting code without a spec it anchors to.
- Check `clew status` / `clew coverage` / `clew check` when in doubt about
  what's covered.

## Key Documents

- **`docs/GAME_DESIGN.md`** — complete design: mechanics, progression, death, social, economy, tech stack.
- **`docs/LORE.md`** — canonical world: tone, cosmology, conspiracy, enemy types, story hooks.
- **`docs/DATA_MODEL.puml`** — SpacetimeDB schema (PlantUML).
  Tables, enums, relationships, all rules live in plain TS functions.
- **`docs/ARCHITECTURE.md`** — ADR-style log of system-structure decisions (where logic lives, how systems communicate). `docs/spec/architecture.md` is the current-state narrative clew's ARCH/CON specs check against.
- **`docs/BALANCE.md`** — shared numeric reference for `ability-balancer` / `item-balancer` (XP curves, combat constants, drop rates).

## Skills (Claude Code context owners)

Each skill owns a design domain and is referenced by its `SKILL.md`:

- **`architect`** — system structure, SpacetimeDB reducers/tables, server authority, login seam, subscriptions.
- **`lore-keeper`** — world canon, story, NPC flavor, naming consistency.
- **`ability-balancer`** — card/ability numbers, scaling, rarity, anti-power-creep.
- **`item-balancer`** — gear stats, weapons, consumables, drop rates, gear/card cross-seam.

When working on a feature that touches multiple domains, check the relevant skills to stay consistent.
See the shared seam between ability-balancer and item-balancer in their `SKILL.md` files.

## Tech Stack (decided)

- **Client:** TypeScript + Phaser (2D/2.5D isometric), browser-based, cursor-aimed (PoE-style).
- **Game backend:** SpacetimeDB with TypeScript server modules (beta).
  - Reducers are thin shells; game rules live in plain TS functions in `rules/`.
  - Keep the codebase portable: rules are not SpacetimeDB-specific.
- **Login server:** separate, conventional service.
  Game module trusts verified identity, not credentials.

## Next Steps

The original vertical slice is done: zone 1 with server-authoritative
enemies (aggro/chase/telegraph), card drops + pickup, spirit-gated hand
management (collection + spirit panels), death/retention loop with a death
summary screen, and cursor-aimed combat with held-key quick cast — plus a
player-facing Jekyll reference site (`site/`) generated from
`content/cards.json`.

1. **Equipment system** — content pipeline, server tables, equip/unequip
   reducers, `effective_stats` (race + gear), gear drops, and the client
   inventory/equip UI are all done (`content/equipment.json`,
   `ItemDefinition`/`ItemInstance`/`EquippedItem`/`ItemDrop`,
   `rules/stats.ts`, `seedItems`, `InventoryPanel`/`CharacterSheet`).
   Combat (`damageEnemy`, enemy casts) runs through `resolveHit` with real
   gear stats instead of client-trusted flat damage. `itemInstance`/
   `equippedItem` are public tables now (client needs to subscribe) with
   no row-level security yet — see `ARCHITECTURE.md`.
   Still needed: a real
   Race table, ward-passive stats feeding effective_stats, sets.
2. **XP-from-kills progression loop** — done.
   Enemies award `xpReward`
   (25, zone-1) on death via a shared `_grantXp` helper; character XP,
   account-wide `totalXpAllLives`, and level-ups (with HP/MP refill) all
   work, plus a client XP bar, floating "+N XP" text, and level-up VFX.
   Drops are now level-gated and rarity-weighted (both cards and items),
   and drop rates were rebalanced down (25%/20%, from 70%/40%) — see
   `BALANCE.md`.
   Still needed: enemy difficulty tiers (flat 25 XP / 100 HP
   everywhere), a merge UI to make duplicate drops feel useful.
3. Expand content: more cards/enemies/zones/items now that gear is fully wired.

## Open Questions (for later)

- World zones / level-gating / zone layout.
- Group revive under permadeath.
- Alliance: coalition vs persistent guild.
- Concrete balance numbers (await playtest).

---

When in doubt, **read the docs first**.
The skills, design, lore, and `docs/spec/` requirements corpus are the source of truth — they're written to be read before coding.
