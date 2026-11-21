**Title**
Regeneration is one global schedule sized by config, not a per-character timer or a rider on the enemy tick

**Lens**: ARCH

**Status**: active

**Description**
Regeneration gets exactly one scheduled row, inserted at `init` like
`enemy_tick_schedule` and `card_drop_cleanup_schedule`, firing a single
`resourceRegen` reducer that scans characters.
It is not one schedule per character, and it is not folded into
`enemyTick`.
Its interval comes from `config.regen.tickSeconds` rather than a literal in
`init`, the way each zone director's interval comes from its configured
tick seconds (`ARCH-013`), and the whole of regeneration stays server-side:
the client subscribes to `character` and renders what it finds, holding no
local accumulator of its own (`ARCH-005`).

**Rationale**
Per-character schedules would put a mutable scheduled row on the player
lifecycle — created at `startLife`, deleted at death, leaked on any path
that forgets — to buy nothing: the work is a scan either way, and the
character count is the same number.
Folding it into `enemyTick` is the more tempting mistake, since that
reducer already fires every 500 ms and already walks rows.
It is rejected on two counts: 500 ms is the cadence enemy chase/telegraph
AI needs, not the cadence a 0.5 HP/s rate needs, so regen would inherit a
tick rate chosen for something else and be re-tuned whenever AI is; and
`enemyTick` is per-enemy, so a zone with no enemies would stop healing the
characters standing in it.
Taking the interval from config rather than a constant follows `ARCH-010`'s
split — the cadence is an operator's tuning dial, not authored content —
and keeps a server operator from needing a rebuild to slow regen down.
Keeping the client out of it is not a new decision, just the one `ARCH-005`
already made for the level-up refill, applied to the writer that currently
breaks it: `GameScene`'s `EMBER_MP_REGEN` accumulator advances MP the
server never granted.
Because MP regenerates in combat too (`SW-057`), that accumulator is
not merely unauthorized — it becomes redundant, since the thing it was
faking is now a real server-side rate the client can simply render.

**Verification Description**
Reviewed by confirming there is exactly one regen schedule row inserted at
`init`, that its interval is read from the validated config rather than
written as a literal, that `enemyTick` contains no resource-recovery code,
and that `grep -r "MP_REGEN\|clientMp" client/src` finds nothing after the
client accumulator is removed.

## Relations

**Realizes**

- [SYS-016](SYS-016-characters-recover-hp-and-mp-out-of-combat.md)

**Related**

- [ARCH-005](ARCH-005-hp-mp-refill-on-level-up-is-server-side-not-client.md) — the authority rule this extends to regen
- [ARCH-004](ARCH-004-enemy-tick-is-one-scheduled-reducer-driving-a-five-state-machine.md) — the schedule this deliberately does not ride on
- [ARCH-013](ARCH-013-each-zones-director-runs-on-its-own-scheduled-interval-sized-to-its-configured-tick-seconds.md) — the config-sized-interval pattern this follows
- [ARCH-010](ARCH-010-config-json-is-operator-tunable-cards-and-equipment-json-are-content.md) — why the cadence is a dial and not content

## Changes

- **2026-11-21** — Set active: implementation of STR-016 began.
  The spec is authored, reviewed and approved, so it now generates a
  traceable for the code written in this increment to anchor against.
