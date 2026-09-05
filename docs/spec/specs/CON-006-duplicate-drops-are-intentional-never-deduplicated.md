**Title**
Duplicate card/item drops are intentional and never deduplicated

**Lens**: CON

**Status**: active

**Description**
The drop roll never checks whether the killer (or anyone) already owns a
copy of the selected card/item — duplicates are a fully expected,
unfiltered outcome.

**Rationale**
A second copy is merge fuel (a future merge system, not yet built) and
spirit-sacrifice fodder (`SACRIFICE_XP`, already live — see the Death &
Retention story).
Explicitly documented in `docs/BALANCE.md` as
intentional, not a bug, even though it currently feels like dead weight
because the merge UI doesn't exist yet.

**Verification Description**
Reviewed by confirming neither `_dropCardFromEnemy` nor
`_dropItemFromEnemy` queries the killer's existing `cardInstance`/
`itemInstance` rows before rolling — ownership is checked only at pickup
(proximity/zone), never as a drop-eligibility filter.

## Relations

**Realizes**

- [SYS-004](SYS-004-enemy-deaths-roll-level-gated-rarity-weighted-ground-drops.md)
