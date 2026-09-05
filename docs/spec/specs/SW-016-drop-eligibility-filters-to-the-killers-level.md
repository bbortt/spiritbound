**Title**
Drop eligibility filters definitions to the killer's character level

**Lens**: SW

**Status**: active

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
