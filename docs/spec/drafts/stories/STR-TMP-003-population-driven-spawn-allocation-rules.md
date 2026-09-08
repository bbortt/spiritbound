**Title**
Population-driven spawn allocation is pure, testable rule logic

**Status**: planned

**Business Value**
The map today has no notion of "enough" or "too many" enemies — mobs sit
where they were seeded, forever, regardless of how many players are
where.
A population-allocation module is the brain the spawn-director
reducer (a later story in this increment) executes against: given a
budget and where players actually are, it decides how many enemies each
level band should hold and what to do about the gap between that and
reality, without ever touching a database or a clock itself.

**Problem / Context**
There is no equivalent of "target population" anywhere in the codebase.
Building this logic straight into a reducer would make its many edge
cases (an empty zone, one lone outlier player, a deadband boundary, a
capped band) untestable except through slow, non-deterministic
integration tests — exactly what `005-testing-contract.md` says pure
logic should never be.

**Solution Approach**
A new pure module, `rules/spawnDirector.ts`, with three functions and no
SpacetimeDB imports: `computeTargetPopulation` (how big the zone's budget
should be, given player count), `allocateBands` (how that budget splits
across level bands, given where players are), and `planAdjustments` (what
to spawn or despawn this tick, given the target and the actual count).
Each takes its tuning as a parameter — the zone's `population`/`director`
config from `content/zones.json`, per this increment's zone-content
story — never reading config internally, matching the existing
`rules/drops.ts`/`rules/leveling.ts` convention.

**Acceptance Criteria**

- `computeTargetPopulation` clamps `base + playersInZone * perPlayer`
  between `population.min` and `population.max`.
- `allocateBands` gives every occupied band `floorPerOccupiedBand` before
  distributing the remainder proportional to player share, caps any band
  at `maxBandSharePct` of budget with overflow redistributed to other
  occupied bands, corrects rounding drift onto the largest band so the
  output always sums exactly to the input budget, and returns an even
  resting distribution (never all-zero) when no band is occupied.
- `planAdjustments` ignores a per-band delta within the deadband, never
  emits a negative spawn or despawn count, caps total spawns and total
  despawns per tick at their configured maxima, and gives spawns priority
  over despawns when both are pending in the same tick.
- A fourth pure function decides passive-respawn placement: given a dead
  enemy's zone state, it either signals "retire" (that enemy's band is at
  or over target) or returns the band index that most needs population
  for the enemy to re-roll its level into.
- Every function above reaches 100% branch coverage in `clew coverage`,
  including a property test asserting `allocateBands`'s output always
  sums to its input budget across randomized demand vectors.

**Out of scope**

- Any SpacetimeDB reducer, scheduling, or table — this story is pure
  functions and their unit tests only.
Wiring them into a live,
  scheduled director is the next story in this increment.
- The boss cycle entirely — bosses are excluded from this module's
  population accounting by the next story, not by anything here.

## Relations

**Realizes**

- [SYS-TMP-002](../specs/SYS-TMP-002-population-allocation-decides-target-and-adjustment-counts-independent-of-execution.md)
- [SW-TMP-003](../specs/SW-TMP-003-compute-target-population-clamps-base-plus-per-player-scaling.md)
- [SW-TMP-004](../specs/SW-TMP-004-allocate-bands-guarantees-each-occupied-bands-floor-before-proportional-split.md)
- [SW-TMP-005](../specs/SW-TMP-005-allocate-bands-caps-a-band-at-its-share-and-redistributes-the-overflow.md)
- [SW-TMP-006](../specs/SW-TMP-006-allocate-bands-corrects-rounding-drift-onto-the-largest-band.md)
- [SW-TMP-007](../specs/SW-TMP-007-allocate-bands-rests-evenly-across-bands-when-none-are-occupied.md)
- [SW-TMP-008](../specs/SW-TMP-008-plan-adjustments-ignores-in-deadband-deltas-and-never-goes-negative.md)
- [SW-TMP-009](../specs/SW-TMP-009-plan-adjustments-caps-total-spawns-and-despawns-and-favours-spawning.md)
- [SW-TMP-010](../specs/SW-TMP-010-passive-respawn-retires-an-over-target-enemy-or-re-rolls-it-into-the-neediest-band.md)
