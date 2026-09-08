**Title**
Boss enemies never count toward band population, target, or actual accounting

**Lens**: CON

**Status**: planned

**Description**
Every count the director reads or computes — actual alive enemies per
band, the target allocation, and the demand used to derive it — excludes
any enemy with `isBoss === true`.
A live boss never inflates its band's
"actual" count and is never a candidate the director spawns, despawns, or
re-levels.

**Rationale**
The director's whole purpose is matching ambient population to player
load; a boss is a scheduled, deliberately-placed encounter with its own
independent lifecycle (`SYS-TMP-004`).
If a boss counted toward its band's
actual population, its presence would suppress ordinary spawns in that
band for the duration of its window, and its despawn (unconditional, on a
timer) would be indistinguishable from an ordinary population despawn if
it were ever counted the same way.

**Verification Description**
A unit test seeds a band's actual-count computation with a mix of
`isBoss: true` and `isBoss: false` enemies and asserts only the
non-boss enemies are counted; an integration test confirms a live boss
does not suppress or trigger a director spawn/despawn action in its band.

## Relations

**Realizes**

- [SYS-TMP-004](SYS-TMP-004-zone-bosses-run-an-independent-spawn-despawn-cycle-excluded-from-population-accounting.md)

**Related**

- [ARCH-TMP-001](ARCH-TMP-001-enemy-rarity-and-boss-flag-are-columns-on-the-flat-enemy-row.md) — the `isBoss` column this accounting exclusion reads
