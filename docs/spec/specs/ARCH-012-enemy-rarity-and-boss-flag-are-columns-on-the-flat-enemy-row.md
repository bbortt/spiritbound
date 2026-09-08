**Title**
Enemy rarity and boss flag are columns on the flat enemy row, not a new EnemyDefinition table

**Lens**: ARCH

**Status**: planned

**Description**
`enemy.rarity` and `enemy.isBoss` are added directly to the existing flat
`enemy` row.
This deliberately does not introduce an `EnemyDefinition`
content table analogous to `CardDefinition`/`ItemDefinition` — enemies
have no content-authored definition/instance split today, and this story
does not add one.
A zone's `boss.slug` (from `content/zones.json`) is
display/flavor metadata only — it names the boss for the client
announcement banner — and is never a foreign key into anything, for the
same reason.

**Rationale**
Cards and items are player-collected, so a definition/instance split lets
one authored definition back many owned instances.
Enemies are not
collected or owned — every row is spawned, scaled, and eventually deleted
by the director.
Introducing a full `EnemyDefinition` table now would mean
designing content-authoring, validation, and seeding for enemy archetypes
before any part of this increment needs one — the spawn director rolls a
level and rarity, not a specific archetype.
Keeping the flat-row shape
minimizes scope; an `EnemyDefinition` table is a real, separate future
option if enemy archetypes (not just level/rarity) need to vary, and this
decision does not foreclose it.

**Verification Description**
Reviewed at the `enemy` table definition in `spacetimedb/src/index.ts`:
confirms `rarity`/`isBoss` are columns on `enemy` itself, and that no new
content file or table introduces an enemy definition/instance split.

## Relations

**Related**

- [STR-011](../stories/STR-011-enemy-rarity-scales-hp-damage-and-drop-tables.md) — the story this decision serves
