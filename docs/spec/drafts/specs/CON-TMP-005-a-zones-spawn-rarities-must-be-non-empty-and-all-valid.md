**Title**
A zone's spawn rarities must be non-empty and all valid

**Lens**: CON

**Status**: planned

**Description**
A zone's `spawnRarities` array must contain at least one entry, and every
entry must be one of the five valid `Rarity` values (`common`, `uncommon`,
`rare`, `epic`, `legendary`).
An empty array, or any entry outside that
set, is rejected at validation.

**Rationale**
`spawnRarities` is the pool the spawn director rolls a new enemy's rarity
from.
An empty pool breaks every spawn action in that zone silently — the
director has nothing to roll and either throws mid-tick or produces no
enemies at all, neither of which is a failure a content author would
catch by reading the JSON.
An invalid rarity string would similarly only
surface the first time the director tries to roll it.

**Verification Description**
`content/zones.test.ts` asserts the shipped `hollow-vale` config
(`["common"]`) validates, and that an empty array and an array containing
an invalid string (e.g. `"mythic"`) are each rejected.

## Relations

**Realizes**

- [SYS-008](SYS-008-content-is-authored-as-json-validated-then-idempotently-seeded.md)
