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

1. **Data model → code:** SpacetimeDB tables from `DATA_MODEL.puml`,
  + core reducers (`move`, `cast_ability`, `die`),
  + core rules functions (`resolve_hit`, `on_death`).
2. **Vertical slice:** one zone, a few cards, one spirit, combat loop, death loop.
3. **Phaser client:** movement, ability cast-toward-cursor, basic UI.

## Open Questions (for later)

- World zones / level-gating / zone layout.
- Group revive under permadeath.
- Alliance: coalition vs persistent guild.
- Concrete balance numbers (await playtest).

---

When in doubt, **read the docs first**.
The skills, design, and lore are the source of truth — they're written to be read before coding.
