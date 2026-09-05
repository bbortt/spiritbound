**Title**
An idle enemy aggroes onto the closest alive character within AGGRO_RANGE in its zone

**Lens**: SW

**Status**: active

**Description**
Each tick, an idle enemy scans every alive character in its own zone and,
if at least one is within AGGRO_RANGE (300px), aggroes onto the single
closest one — transitioning `idle` → `chasing` and recording that
character's id as `targetCharacterId`.
If none are in range, it stays
idle.
A character exactly at the AGGRO_RANGE boundary counts as in range;
one beyond it does not.

**Rationale**
Closest-in-range (rather than first-found in iteration order, or a random
pick among candidates in range) makes aggro feel spatially fair and
predictable to a player watching an enemy from a distance.

**Verification Description**
A unit test of the extracted transition logic supplies multiple candidate
characters at various distances (some within range, some beyond, one
exactly at the boundary) and asserts the nearest in-range character is
targeted, and that no aggro occurs when every candidate is beyond
AGGRO_RANGE.

## Relations

**Realizes**

- [SYS-003](SYS-003-enemies-aggro-chase-and-attack-under-server-authority.md)
