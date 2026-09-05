**Title**
config.json is operator-tunable; cards.json and equipment.json are content

**Lens**: ARCH

**Status**: active

**Description**
`content/` now holds two kinds of file with different owners.
`cards.json`
and `equipment.json` are **content**: authored by the game's designers,
seeded into tables, and changed by a content pull request.
`config.json`
is **operator configuration**: balance dials a server operator is expected
to edit on their own deployment, never seeded, read straight into the
module's runtime constants.

Both go through the same discipline — a Zod schema in a pure validator, a
`node:fs` loader split out per `ARCH-009`, validation at module load, and a
throw that stops the module rather than a warning that lets it run.

The pure rule modules do not import the config.
They keep taking their
tuning as explicit parameters, and the reducer module — the one place that
already owns runtime wiring — passes the loaded values in.

**Rationale**
The split names who may change what, which the old layout could not: with
every dial hard-coded in `rules/`, "retune your server" and "change the
game's content" were the same action, a code edit.
Keeping the rules pure
rather than letting them read a config singleton preserves the property
`005-testing-contract.md` depends on — a rule function's output is a
function of its arguments, so a test fixes the tuning instead of the
process's environment.

The tension this creates, recorded rather than resolved: two constraints
that were previously guaranteed by code — `CON-003` (chase speed always
under player move speed) and `CON-004` (zero legendary drop weight) — are
now numbers in a file an operator may edit, and the config schema does not
enforce either.
The shipped `config.json` honours both and
`content/config.test.ts` asserts that it does, so the repository's own
values remain correct; what is gone is the guarantee for a _modified_
deployment.

**Verification Description**
Reviewed by confirming `content/validateConfig.ts` holds no `node:fs`
import, that `spacetimedb/src/rules/*.ts` import neither the loader nor the
config JSON, and that `index.ts` loads and validates once at module init.

## Relations

**Realizes**

- [SYS-009](SYS-009-server-operators-tune-balance-through-a-validated-config-file.md)

**Related**

- [ARCH-009](ARCH-009-content-loaders-are-split-from-pure-validators-so-spacetimedb-can-tree-shake-node-fs.md) — the validator/loader split reused here
- [CON-003](CON-003-chase-speed-is-always-slower-than-player-move-speed.md) — now operator-editable, unenforced by the schema
- [CON-004](CON-004-legendary-drop-weight-is-zero.md) — now operator-editable, unenforced by the schema

## Changes

- **2026-09-05** — Set active: implementation of STR-009 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
