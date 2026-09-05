**Title**
Drop eligibility filters to the enemy's level plus two

**Lens**: SW

**Status**: active

**Description**
On an enemy death the card pool is filtered to definitions whose
`minCharacterLevel` is at most the enemy's level plus two, and the item
pool to definitions whose `minLevel` is at most the same bound.
The
killer's own level no longer takes part in either filter.

**Rationale**
Keying the pool to the killer made a high-level player a walking loot
multiplier over low-level mobs: the same wolf dropped level-1 gear for a
new character and level-20 gear for a veteran.
Keying it to the enemy
makes the drop describe what died.
The `+2` headroom keeps a zone's own
tier reachable rather than capping a zone-2 enemy at exactly level-2
loot — it is generosity within the enemy's band, not a reintroduction of
the player's.

**Verification Description**
Reviewed at `_dropCardFromEnemy`/`_dropItemFromEnemy` for the filter
reading the enemy row's level rather than the character's.

## Relations

**Realizes**

- [SYS-011](SYS-011-xp-and-drop-eligibility-scale-with-the-enemys-own-level.md)

**Related**

- [SW-016](SW-016-drop-eligibility-filters-to-the-killers-level.md) — the killer-level filter this replaces

## Changes

- **2026-09-05** — Set active: implementation of STR-009 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
