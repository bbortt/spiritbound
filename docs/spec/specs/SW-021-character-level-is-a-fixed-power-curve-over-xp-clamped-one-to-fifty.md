**Title**
Character level is a fixed power curve over XP, clamped to 1-50

**Lens**: SW

**Status**: active

**Description**
`computeCharacterLevel(xp) = clamp(1, 50, floor((xp/80)^0.55))` — a pure
function of total per-life XP, with no other input (no character-specific
modifiers).

**Rationale**
Explicitly a placeholder power curve (`docs/BALANCE.md`) targeting
"1–10 fast, 10–30 medium, 30–50 slower" — not yet validated against that
goal, pending playtest; the clamp at 1 and 50 are hard floor/ceiling
regardless of formula output at extreme XP values.

**Verification Description**
A unit test in `spacetimedb/src/rules/death.test.ts` asserts level 1 at
xp=0, the clamp holds at very large xp (never exceeds 50) and at xp=0
(never below 1), and that the curve is monotonically non-decreasing over
a swept range of xp values.

## Relations

**Realizes**

- [SYS-005](SYS-005-killing-enemies-grants-xp-that-levels-up-the-character.md)

**Related**

- [ARCH-006](ARCH-006-client-level-curve-duplicates-compute-character-level-and-derives-thresholds-by-binary-search.md)
