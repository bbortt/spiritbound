**Title**
Zone level bands partition the zone's level range with no gap or overlap

**Lens**: CON

**Status**: planned

**Description**
A zone's `levelBands` array, sorted by `min`, must be contiguous and must
exactly cover `[zone.minLevel, zone.maxLevel]`: the first band's `min`
equals `zone.minLevel`, the last band's `max` equals `zone.maxLevel`, and
each subsequent band's `min` is exactly one greater than the previous
band's `max`.
Any gap, overlap, or level left outside every band is
rejected at validation.

**Rationale**
Level bands are the unit the spawn director allocates population against
— every character in the zone must fall into exactly one band, or the
director's per-band demand count silently underserves or double-serves a
level range.
A gap strands players in an unallocated band with no target
population; an overlap lets one level count toward two bands' demand.
Both failure modes are invisible until a specific level range is actually
played, so they must be caught at content-authoring time, not discovered
by a player standing in a dead patch of the map.

**Verification Description**
`content/zones.test.ts` asserts the shipped `hollow-vale` bands validate,
and that mutations introducing a gap (e.g. bands `1-2` then `4-5`), an
overlap (e.g. `1-3` then `3-5`), or a range not starting at `minLevel` or
not ending at `maxLevel` are each rejected.

## Relations

**Realizes**

- [SYS-008](SYS-008-content-is-authored-as-json-validated-then-idempotently-seeded.md)
