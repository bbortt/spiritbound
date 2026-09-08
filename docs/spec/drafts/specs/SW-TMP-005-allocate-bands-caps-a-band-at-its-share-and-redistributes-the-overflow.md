**Title**
allocateBands caps a band at its configured share and redistributes the overflow

**Lens**: SW

**Status**: planned

**Description**
After the floor-then-proportional pass, any band whose allocation exceeds
`floor(totalBudget * cfg.maxBandSharePct)` is capped at that value, and
the overflow (the amount cut) is redistributed to the other occupied
bands that are not themselves already at their cap.
If every occupied
band is already at its cap, the overflow is held rather than assigned
anywhere.

**Rationale**
Without a per-band cap, a single band with an overwhelming majority of
players could consume the zone's entire population budget, leaving every
other occupied band — even one with real players in it — at its bare
floor forever.
The cap keeps population spread across active areas of the
zone instead of collapsing entirely onto wherever the crowd currently is.

**Verification Description**
A unit test with a single occupied band and several unoccupied ones
asserts that band is capped at `floor(budget * maxBandSharePct)` and does
not consume the full budget; a unit test with one dominant occupied band
and two minor occupied bands asserts the dominant band's overflow lands
on the two minor bands rather than being discarded.

## Relations

**Realizes**

- [SYS-TMP-002](SYS-TMP-002-population-allocation-decides-target-and-adjustment-counts-independent-of-execution.md)

**Related**

- [SW-TMP-004](SW-TMP-004-allocate-bands-guarantees-each-occupied-bands-floor-before-proportional-split.md) — the allocation this cap is applied on top of
