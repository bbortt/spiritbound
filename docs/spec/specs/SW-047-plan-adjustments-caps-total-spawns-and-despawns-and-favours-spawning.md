**Title**
planAdjustments caps total spawns and despawns per tick and favours spawning when both are pending

**Lens**: SW

**Status**: active

**Description**
Across all bands in one call, `planAdjustments` caps the total spawn
count at `cfg.maxSpawnsPerTick` and the total despawn count at
`cfg.maxDespawnsPerTick` — both are zone-wide totals for the tick, not
per-band limits.
When both spawns and despawns are pending in the same
tick, spawns are computed and returned in full (up to their own cap)
before despawns are considered, so a tick that would otherwise do both is
never resolved by cutting spawns to make room for despawns.

**A cap that binds is spent biggest-gap-first.** When the eligible bands
want more than the tick allows, the band furthest from its target is
served first and takes as much of the remaining budget as it needs, then
the next, until the budget runs out; bands still unserved get nothing this
tick and are picked up by a later one.
Ties on gap size are broken by the lower band index, purely so the plan is
deterministic.
The returned plan is ordered by band — that is an output format, not the
allocation order.

**Rationale**
An unbounded director could spawn or despawn dozens of enemies in one
tick, which reads to a nearby player as mobs popping in or vanishing
around them.
Favouring spawns over despawns when both are pending is a
deliberate asymmetry: being slightly over-populated for one more tick is
harmless, while an aggressive despawn pass risks removing an enemy a
player is about to notice.

Serving the neediest band first, rather than spreading the cap evenly, is
the same priority `SW-048` applies within a band: a band sitting far below
target is the one a player can actually see is empty, while a band one
short of target looks correct either way.
Spreading a small cap across every band would give each of them a token
count and leave the visibly empty one still visibly empty for several more
ticks.

**Verification Description**
A unit test with demand exceeding `maxSpawnsPerTick` across multiple
bands asserts the total spawn count returned never exceeds the cap
(similarly for despawns) **and that the band with the largest gap is
served to its full need before any smaller-gap band receives anything**;
a unit test with both spawn- and despawn-eligible bands present in the
same call asserts the full eligible spawn count (up to its cap) is
returned unreduced regardless of pending despawns.

## Relations

**Realizes**

- [SYS-013](SYS-013-population-allocation-decides-target-and-adjustment-counts-independent-of-execution.md)

## Changes

- **2026-09-10** — Specified how a binding cap distributes across bands:
  biggest gap first, ties to the lower band index.
  Nothing said how the tick budget was to be divided, so the rule the
  implementation follows — the same "neediest first" priority `SW-048` uses
  inside a band — was invisible to anyone reading the specs alone, and an
  even split would have looked equally compliant while leaving a visibly
  empty band empty for several more ticks.
- **2026-09-08** — Set active: implementation of STR-012 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
