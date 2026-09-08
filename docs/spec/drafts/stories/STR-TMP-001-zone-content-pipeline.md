**Title**
Zones become authored content, seeded from a new zones.json file

**Status**: planned

**Business Value**
The `zone` table already exists (`zoneId`/`name`/`minLevel`/
`recommendedLevel`/`maxLevel`/`description`) but nothing seeds it and
nothing reads from it — it is dead schema.
Activating it through the same
authored-content pipeline as cards and equipment turns zone design into a
data-authoring task instead of a code change, and lays the field-level
foundation (level bands, population sizing, spawn-director tuning, boss
config) that the rest of this increment's spawn-director and boss-cycle
stories build on.

**Problem / Context**
There is no `content/zones.json`, no validator, no loader, and no seeder
for the `zone` table — only a bare `zoneId: 1` literal floats around the
codebase with no backing row.
A new content file is needed to describe,
per zone: its level range, whether it is a tutorial zone, which rarities
it spawns, its level bands (for population allocation by band), its
population sizing, its spawn-director tuning, and its boss-cycle config.
This is authored content like `cards.json`/`equipment.json`, not
operator-tunable balance — per `ARCH-010`, that split keeps
`content/config.json` for global, operator-editable dials and content
files for authored, PR-reviewed data.
The `zone` table's existing
`recommendedLevel` column has no field in the original brief's zones.json
shape; grounding against the table found no spec anchored to the table's
current shape, so there is no supersession risk — it is folded into the
schema below as an optional field defaulting to `minLevel`, rather than
dropped or left unseeded, since it is cheap to carry and matches the
table exactly.

**Solution Approach**
The zone shape:

```json
{
  "slug": "hollow-vale",
  "zoneId": 1,
  "name": "Hollow Vale",
  "minLevel": 1,
  "maxLevel": 10,
  "recommendedLevel": 1, // optional, defaults to minLevel
  "tutorialZone": true,
  "spawnRarities": ["common"],
  "levelBands": [
    { "min": 1, "max": 2 },
    { "min": 3, "max": 4 },
    { "min": 5, "max": 6 },
    { "min": 7, "max": 8 },
    { "min": 9, "max": 10 }
  ],
  "population": {
    "base": 20,
    "perPlayer": 6,
    "min": 20,
    "max": 120,
    "floorPerOccupiedBand": 6,
    "maxBandSharePct": 0.5
  },
  "director": {
    "tickSeconds": 10,
    "deadband": 3,
    "maxSpawnsPerTick": 4,
    "maxDespawnsPerTick": 2,
    "minSpawnDistFromPlayerPx": 600,
    "despawnSafeDistPx": 900,
    "sustainedDeviationTicks": 3
  },
  "boss": {
    "slug": "vale-warden",
    "rarity": "uncommon",
    "level": 10,
    "cycleMinutes": 10,
    "windowMinutes": 5,
    "arenaX": 0,
    "arenaY": 0 // fixed spawn point, added — missing from the original brief's field list
  },
  "flavor": "Sunlight pools in the valley. Something under it does not.",
  "masteredMessage": "Hollow Vale has nothing left to teach you." // optional; content-authored, used by a later story in this increment
}
```

Add `content/zones.json` following the `content/cards.json` pattern
exactly: a Zod schema plus a `crossCheck` for whole-array/whole-object
invariants that don't fit per-field validation, a `loader.ts` split out
from the validator (so SpacetimeDB's esbuild bundle can tree-shake
`node:fs`), a `zones.test.ts` alongside asserting the shipped file
validates and each hard-error rule is enforced, and an idempotent
upsert-by-slug seeder (`_doSeedZones`/`seedZones`) called from `init` —
mirroring the existing `_doSeedCards`/`seedCards` shape.
The pipeline
mechanics themselves (author as JSON, validate, idempotently seed) are
already covered by `SYS-008` and `SW-030`; this story only adds the
validation invariants specific to zone content's own shape. `SYS-008`'s
and `SW-030`'s current wording names only cards/items by name (their
anchors today are `content/validate.ts`/`content/validateEquipment.ts`
and the `_doSeedCards`/`_doSeedItems` call sites) — at promotion, both
should get a `## Changes` entry widening their description to also cover
zone content, so the corpus text matches the new `content/validate*.ts`
and `seedZones` anchors this story adds to them.

**Acceptance Criteria**

- `content/zones.json` validates against the schema below and seeds one
  zone (`hollow-vale`, zoneId 1) via `seedZones`, upserting by `slug`.
- Level bands that leave a gap, overlap, or don't exactly cover
  `[minLevel, maxLevel]` are rejected.
- A population config where `min > max`, or where
  `floorPerOccupiedBand * levelBands.length > population.max`, is
  rejected with an error naming both the computed floor total and the
  configured max.
- A zone where `minSpawnDistFromPlayerPx >= despawnSafeDistPx` is
  rejected.
- A zone where `director.deadband < 1`, or `population.maxBandSharePct`
  falls outside `[0.2, 1.0]`, is rejected.
- A zone with an empty `spawnRarities`, or containing an invalid rarity
  value, is rejected.
- A zone where `boss.windowMinutes >= boss.cycleMinutes` is rejected.
- A `tutorialZone: true` zone with `minLevel !== 1` is rejected.

**Out of scope**

- Reading `zone` rows anywhere in reducers or rules — later stories in
  this increment (the spawn director, the boss cycle, the zone-mastery
  cutoff) are the first consumers of this data.
- Seeding a second zone.
Only `hollow-vale` (zoneId 1) ships as real
  content now; zone 2 does not exist yet, and the zone-mastery story
  guards for that explicitly rather than this story inventing it.
- The spawn director's runtime behaviour and enemy rarity/scaling — both
  are later stories in this increment; this story only defines the data
  they will read.

## Relations

**Realizes**

- [CON-TMP-001](../specs/CON-TMP-001-zone-level-bands-partition-the-zones-level-range-with-no-gap-or-overlap.md)
- [CON-TMP-002](../specs/CON-TMP-002-a-zones-population-floor-across-occupied-bands-can-never-exceed-its-max.md)
- [CON-TMP-003](../specs/CON-TMP-003-a-zones-minimum-spawn-distance-must-be-strictly-less-than-its-despawn-safe-distance.md)
- [CON-TMP-004](../specs/CON-TMP-004-zone-director-deadband-and-max-band-share-are-bounded.md)
- [CON-TMP-005](../specs/CON-TMP-005-a-zones-spawn-rarities-must-be-non-empty-and-all-valid.md)
- [CON-TMP-006](../specs/CON-TMP-006-a-zone-boss-window-must-be-shorter-than-its-cycle.md)
- [CON-TMP-007](../specs/CON-TMP-007-a-tutorial-zones-min-level-must-be-one.md)

**Related**

- [SYS-008](../specs/SYS-008-content-is-authored-as-json-validated-then-idempotently-seeded.md) — the generic content pipeline this story's seeder follows
- [SW-030](../specs/SW-030-seeding-upserts-content-by-slug-re-running-is-always-safe.md) — the idempotent upsert behaviour `seedZones` follows
- [ARCH-010](../specs/ARCH-010-config-json-is-operator-tunable-cards-and-equipment-json-are-content.md) — why zone tuning lives in zones.json, not config.json
- [ARCH-009](../specs/ARCH-009-content-loaders-are-split-from-pure-validators-so-spacetimedb-can-tree-shake-node-fs.md) — the validator/loader split `content/zonesLoader.ts` follows
