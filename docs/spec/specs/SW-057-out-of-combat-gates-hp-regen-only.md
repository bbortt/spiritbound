**Title**
Out of combat gates HP regeneration only, measured from the last damage the character dealt or took

**Lens**: SW

**Status**: active

**Description**
A new `character.lastCombatAt` timestamp column is stamped with
`ctx.timestamp` by every path that resolves damage with the character on
either side of it: damage it receives (`_resolveAndApplyDamage`, whether
the source is an enemy cast, an enemy melee tick or `applyDamage`) and
damage it deals (`damageEnemy`).
HP regenerates only once `ctx.timestamp - lastCombatAt` has reached
`config.regen.outOfCombatSeconds` (6 s); a character that has never fought
(`lastCombatAt` unset) is out of combat immediately.
Dealing damage counts, so standing out of reach and whittling an enemy down
is combat.
Taking or landing a hit restarts the whole span rather than extending it by
one tick.
Spending MP on a cast that connects with nothing does not count — the stamp
is on resolved damage, not on the attempt.

**MP is not gated.** MP regenerates at its rate whether or not the
character is in combat, so `lastCombatAt` is read by the HP half of the
tick and ignored by the MP half.

**Rationale**
The gate needs a clock, and the `character` row has none that fits:
`createdAt` and `lastLevelUpAt` answer different questions, and `diedAt`
only ever fills in once.
Stamping it inside the damage-resolution paths rather than in each reducer
means a future damage source is in combat by construction rather than by
remembering to add a line.
Counting dealt damage as combat is what stops the obvious exploit of the
cheaper alternative: with only taken damage stamped, a ranged character
outside an enemy's `aggroRangePx` would regenerate at full rate while
killing it, which is not a retreat being rewarded but a fight being won for
free.

Leaving MP ungated is a deliberate asymmetry, not an oversight.
Gating MP would make a long fight unwinnable for a caster the moment the
bar empties, with no play available to refill it — the game has no
MP-restoring card, potion or effect of any kind today, and inventing one is
a content increment of its own rather than a prerequisite this story gets
to assume.
It also makes the two stats mean different things, which matches the
fiction: HP is a wound that needs quiet to close, MP is a reserve that
refills on its own.
And it makes the shipped character sheet honest without an edit — the
tooltips already read "HP restored per tick while out of combat" and "MP
restored per tick".

**Verification Description**
An integration test asserts a character damaged at T does not recover HP
before `T + outOfCombatSeconds` and does after; a second asserts a
character that _deals_ damage without taking any is likewise held off; a
third asserts a hit landing mid-recovery pushes the next HP regeneration a
full delay out rather than one tick; and a fourth asserts that through all
of the above, MP recovers on its normal schedule.

## Relations

**Realizes**

- [SYS-016](SYS-016-characters-recover-hp-and-mp-out-of-combat.md)

**Related**

- [SW-059](SW-059-one-regen-tick-restores-every-alive-characters-hp-and-mp.md) — the tick that consults this gate for HP
- [SW-058](SW-058-each-resource-carries-its-own-paid-up-to-stamp.md) — how the gate folds into HP's accrual window
- [SYS-009](SYS-009-server-operators-tune-balance-through-a-validated-config-file.md) — the delay is a dial

## Changes

- **2026-11-21** — Set active: implementation of STR-016 began.
  The spec is authored, reviewed and approved, so it now generates a
  traceable for the code written in this increment to anchor against.
