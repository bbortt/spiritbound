**Title**
HP and MP regeneration — the sustain stats finally do something

**Status**: active

**Business Value**
`hpRegen` and `mpRegen` are already primaries in the stat model
(`GAME_DESIGN.md`: Health → max HP + HP regen, Will → max MP + MP regen),
already seeded at 0.5 and 0.3 by `computeRaceBase`, already modifiable by
gear through `statModifiers`, and already shown on the character sheet with
the tooltips "HP restored per tick while out of combat" and "MP restored
per tick".
Nothing reads them.
The sheet promises mechanics the server does not have, which makes two race
primaries and two gear stat lines dead weight, and leaves the only way back
to full HP being a level-up or a death.
In a permadeath game where retreating is the correct play, recovering after
a retreat is what makes the retreat worth making.

**Problem / Context**
Three separate things are broken or missing today:

1. No server-side regeneration exists at all.
   The only scheduled reducers are `enemyTick`, `respawnEnemy` and
   `cardDropCleanup`; nothing ever writes `currentHp`/`currentMp` upward
   except `_grantXp`'s level-up refill and `_withProportionalResourceUpdate`'s
   gear rescale.
2. The MP bar lies.
   `GameScene.ts` holds `EMBER_MP_REGEN = 2` and adds it to a client-local
   `clientMp` every frame, so MP visibly refills and then snaps back to the
   server's untouched value on reconnect.
   This is the same client-authority mistake `ARCH-005` already rejected for
   the level-up refill.
3. "Out of combat" has nothing to measure.
   The `character` row carries `createdAt`, `diedAt` and `lastLevelUpAt` —
   no record of when the character last fought.

There is also a representation problem that is easy to ship wrong: the
regen rates are fractional (0.5, 0.3) while `currentHp`/`currentMp` are
`t.i32()`.
A tick that adds `Math.round(0.5)` heals 1 per tick — double the intended
rate — and `Math.floor` heals 0 forever.

**Solution Approach**
One scheduled reducer over every alive character, at an interval the
operator configures, with the sub-unit remainder carried in timestamps
rather than new fractional columns:

- Three new `character` columns: `lastCombatAt` (every damage path the
  character deals or receives stamps it), plus `lastHpRegenAt` and
  `lastMpRegenAt` — how much regen each resource has already been paid for.
- A tick grants `floor(rate × windowSeconds)` per resource and advances
  that resource's stamp by exactly the seconds it paid for, so 0.5 HP/s
  becomes 1 HP every 2 s with no drift and no rounding loss.
- MP's window starts at `lastMpRegenAt`; HP's starts at
  `max(lastHpRegenAt, lastCombatAt + outOfCombatSeconds)`, so a fight
  yields a zero-length window for HP with no special case and no backlog to
  settle afterwards.
- New `config.json` dials — `regen.tickSeconds: 1`,
  `regen.outOfCombatSeconds: 6` — validated by `validateConfig.ts` like
  every other dial, so the cadence is operator-tunable per `SYS-009` and a
  bad value refuses the module per `CON-016`.
- Delete `EMBER_MP_REGEN` and the `clientMp` accumulator; the bar renders
  the subscribed server value.

The two gates are asymmetric on purpose: HP waits for quiet, MP does not.
See `SW-057` for why, and "Out of scope" for the alternative that was
weighed against it.

**Acceptance Criteria**

- A character that stops taking and dealing damage recovers HP at its
  effective `hpRegen` rate and stops at its effective maximum.
- A character recovers MP at its effective `mpRegen` rate whether or not it
  is in combat.
- A character taking damage stops recovering HP, and does not receive a
  lump-sum catch-up when it next leaves combat.
- A dead character never regenerates either resource.
- A rate of 0.5 HP/s measurably yields 1 HP per 2 s over a span, not 1 per
  tick and not 0.
- `grep -r "MP_REGEN\|clientMp" client/src` returns nothing, and an MP value
  read from a fresh subscription matches what the bar was showing.
- The two new dials are in `config.json`, documented in `BALANCE.md`, and an
  invalid value refuses module start.
- Every spec below is anchored, with the unit-testable parts
  (`SW-058`'s arithmetic and window derivation) under `vitest` and the
  wiring (`SW-059`, `SW-057`, `CON-037`) under the integration
  suite.

**Out of scope**

- **MP-restoring cards, potions or effects.**
  Weighed as the alternative to ungating MP: if a caster could refill on
  purpose, MP could carry the same out-of-combat gate HP does, and the
  asymmetry below would disappear.
  That is a content increment with its own balance work (what an MP card
  costs, what it displaces in a hand capped at 10/5), so it is not a
  prerequisite this story takes on — and it stays open as the thing that
  would let MP's gate be revisited later.
- Spirit/bonfire interactions as a _faster_ or full recovery point — the
  bonfire pillar is its own increment; this story is only the passive rate.
- Out-of-combat movement-speed bonuses or any other out-of-combat effect.
  `lastCombatAt` makes them cheap later, but nothing else reads it here.
- A real Race table.
  The rates still come from `computeRaceBase`'s single hard-coded human,
  exactly as they do today.
- Healing _cards_ (`resolveHeal`, `SW-009`) — an active, MP-paid heal is a
  separate path and already specified.
- Enemy regeneration.
  A resetting enemy already heals under `SW-014`, on its own rules.

## Relations

**Realizes**

- [SYS-016](../specs/SYS-016-characters-recover-hp-and-mp-out-of-combat.md) — the system-level capability
- [SW-059](../specs/SW-059-one-regen-tick-restores-every-alive-characters-hp-and-mp.md)
- [SW-057](../specs/SW-057-out-of-combat-gates-hp-regen-only.md)
- [SW-058](../specs/SW-058-each-resource-carries-its-own-paid-up-to-stamp.md)
- [CON-037](../specs/CON-037-regen-only-adds-inside-a-living-characters-headroom.md)
- [ARCH-015](../specs/ARCH-015-regen-is-one-global-schedule-sized-by-config.md)

**Related**

- [ARCH-005](../specs/ARCH-005-hp-mp-refill-on-level-up-is-server-side-not-client.md) — the authority rule the client MP accumulator already breaks
- [SW-020](../specs/SW-020-a-level-increase-refills-hp-mp-and-stamps-the-level-up-timestamp.md) — the other server-side writer of these two columns
- [SW-003](../specs/SW-003-gear-change-rescales-current-hp-mp-proportionally.md) — the third writer, and why regen reads effective stats rather than race base
- [SYS-009](../specs/SYS-009-server-operators-tune-balance-through-a-validated-config-file.md) — where the two new dials belong
