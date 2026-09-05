**Title**
Drop eligibility filters definitions to the killer's character level

**Lens**: SW

**Status**: deprecated

**Description**
A successful roll's eligible pool is every `cardDefinition`/
`itemDefinition` whose `minCharacterLevel`/`minLevel` is `<=` the killing
character's level — a level-1 killer can never see a drop that requires a
higher level than they are.

**Rationale**
Keeps drop tables self-gating without a separate zone/level allowlist —
content authors set one number per item, and eligibility falls out of it
automatically as players level, matching the same per-item level gate
already used to gate equipping (`SW-001`) and casting.

**Verification Description**
A unit test with a mixed pool of definitions at various `minLevel`/
`minCharacterLevel` values and a fixed killer level asserts exactly the
definitions at or below that level are eligible, including a boundary
value exactly equal to the killer's level.

## Relations

**Realizes**

- [SYS-004](SYS-004-enemy-deaths-roll-level-gated-rarity-weighted-ground-drops.md)

## Changes

- **2026-09-05** — Deprecated by STR-009, superseded by `SW-037`.
  Filtering the drop pool by the _killer's_ level made a high-level player
  a loot multiplier over low-level enemies — the same wolf dropped level-20
  gear for a veteran and level-1 gear for a newcomer.
  Eligibility is now
  keyed to the enemy's own level plus two, so the drop describes what died.
  The per-definition `minLevel`/`minCharacterLevel` gate itself is
  unchanged; only the level it is compared against moved.
