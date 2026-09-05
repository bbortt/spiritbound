**Title**
An empty rarity tier falls back to the full eligible pool; an empty pool drops nothing, never errors

**Lens**: CON

**Status**: active

**Description**
If the weight-picked rarity tier has no eligible (level-gated) definitions,
selection falls back to sampling the entire eligible pool regardless of
rarity.
If the eligible pool itself is empty, the enemy simply drops
nothing — neither path ever throws.

**Rationale**
A low-level zone may not yet have any epic-tier content unlocked at all;
the fallback keeps a "should have dropped something" roll from silently
wasting the drop entirely.
The empty-pool case (e.g. a level so low
nothing at all qualifies) must degrade gracefully rather than crash the
reducer, which also has to grant XP and update enemy state in the same
call.

**Verification Description**
A unit test with an eligible pool containing zero definitions of the
rolled tier asserts a fallback pick from the full pool; a unit test with a
fully empty eligible pool asserts no drop and no exception thrown.

## Relations

**Realizes**

- [SYS-004](SYS-004-enemy-deaths-roll-level-gated-rarity-weighted-ground-drops.md)

**Related**

- [SW-017](SW-017-a-rarity-tier-is-weight-picked-then-sampled-within-tier.md)
