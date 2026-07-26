# Spiritbound — Project Orientation

**A 2D/2.5D permadeath MMO RPG where cards define your abilities, spirits guard your soul, and death is (almost) permanent.**

## Design & Pillars

Read `docs/GAME_DESIGN.md` first. The core pillars:
1. Cards are your soul, gear is your body.
2. Preparation over reaction (spirits as bonfires).
3. PvE-first (no open PvP).
4. Every drop has value (gear loss = permanent economy sink).

## Key Documents

- **`docs/GAME_DESIGN.md`** — complete design: mechanics, progression, death, social, economy, tech stack.
- **`docs/LORE.md`** — canonical world: tone, cosmology, conspiracy, enemy types, story hooks.
- **`docs/DATA_MODEL.puml`** — SpacetimeDB schema (PlantUML). Tables, enums, relationships, all rules live in plain TS functions.
- **`docs/ARCHITECTURE.md`** — ADR-style log of system-structure decisions (where logic lives, how systems communicate).
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

1. **Equipment system** — fully designed in `DATA_MODEL.puml` and
   `GAME_DESIGN.md`, not yet implemented. Next major system: real stat
   system, gear economy, armor weight classes.
2. Expand content: more cards/enemies/zones once equipment lands.

## Open Questions (for later)

- World zones / level-gating / zone layout.
- Group revive under permadeath.
- Alliance: coalition vs persistent guild.
- Concrete balance numbers (await playtest).

---

When in doubt, **read the docs first**.
The skills, design, and lore are the source of truth — they're written to be read before coding.
