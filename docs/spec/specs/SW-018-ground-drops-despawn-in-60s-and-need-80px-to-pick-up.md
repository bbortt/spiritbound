**Title**
Ground drops despawn 60 seconds after creation and require 80px proximity to pick up

**Lens**: SW

**Status**: active

**Description**
A ground drop (card or item) is deleted by a repeating cleanup reducer
once `ctx.timestamp - createdAt >= 60s` (the cleanup itself runs every
10s, so actual despawn is delayed by up to that granularity).
Picking one
up requires the requesting character be in the same zone and within 80px
(checked via squared distance, no `sqrt`).
Card and item pickups follow
the identical shape, differing only in whether the resulting instance is
account-owned (`cardInstance`) or character-owned (`itemInstance`, since
gear dies with the body — see the Equipment and Death & Retention
stories).

**Rationale**
Server-owned despawn timing and proximity keep loot fair and consistent
for every observer — no client can see a drop that's already gone or grab
one out of range; squared-distance comparison avoids an unnecessary
`sqrt` per pickup check.

**Verification Description**
A unit test asserts a drop younger than 60s survives a cleanup pass and
one at/over 60s is deleted; a pickup attempt from just within vs. just
beyond 80px (squared-distance boundary) succeeds/fails accordingly.

## Relations

**Realizes**

- [SYS-004](SYS-004-enemy-deaths-roll-level-gated-rarity-weighted-ground-drops.md)
