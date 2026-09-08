**Title**
A despawn target must be idle, undamaged, boss-free, and far from every player

**Lens**: CON

**Status**: planned

**Description**
An enemy is eligible for despawn only if all of the following hold at
once: `aggroState === idle`, `currentHp === maxHp`, `isBoss === false`,
and no alive player is within `despawnSafeDistPx` of it.
An enemy failing
any single condition is never despawned, regardless of how far its band
is over target.

**Rationale**
Removing an enemy mid-fight, damaged, or near a player would read as a
visible, unfair pop — an enemy vanishing that a player was tracking or
had already hurt.
Requiring the full, simultaneous set (not any one of
them) is what keeps despawns confined to enemies nobody is meaningfully
engaged with.

**Verification Description**
A unit test constructs an enemy satisfying three of the four conditions
and violating one, for each of the four conditions in turn, and asserts
it is never selected as a despawn candidate; only an enemy satisfying all
four is eligible.

## Relations

**Realizes**

- [SYS-TMP-003](SYS-TMP-003-a-scheduled-per-zone-tick-executes-population-allocation-and-gates-despawns-on-sustained-deviation.md)

**Related**

- [ARCH-TMP-001](ARCH-TMP-001-enemy-rarity-and-boss-flag-are-columns-on-the-flat-enemy-row.md) — the `isBoss` column this predicate reads
