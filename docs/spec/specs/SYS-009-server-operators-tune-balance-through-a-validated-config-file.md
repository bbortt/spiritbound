**Title**
Server operators tune balance through a validated config file, not code

**Lens**: SYS

**Status**: active

**Description**
Drop rates, XP tuning, ground-drop lifetime and pickup range, and the
enemy AI ranges and speeds are read from `content/config.json` at module
init.
A server operator changes them by editing that file and
republishing; no balance number this file owns may stay hard-coded in a
rule module or a reducer.

This covers only the numbers the file declares.
Values that are not
balance dials — the enemy tick interval, the reset heal per tick — stay in
code.

**Rationale**
A custom server is only meaningfully custom if its operator can retune the
economy without forking the TypeScript.
Keeping the dials in one declared
file also gives `BALANCE.md` a single place to point at, instead of the
three modules the constants were spread across.

**Verification Description**
Reviewed by grepping `spacetimedb/src` for the retired constant names and
literals (`CARD_DROP_CHANCE`, `ITEM_DROP_CHANCE`, `AGGRO_RANGE`,
`ATTACK_RANGE`, `DEAGGRO_RANGE`, `CHASE_SPEED`, `RESET_SPEED`, the 60 s /
80 px / 15 s literals) and confirming each now resolves from the loaded
config; and by `content/config.test.ts` proving the shipped file
validates.

## Relations

**Related**

- [SYS-008](SYS-008-content-is-authored-as-json-validated-then-idempotently-seeded.md) — the authored-content pipeline this config file sits beside

## Changes

- **2026-09-05** — Set active: implementation of STR-009 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
