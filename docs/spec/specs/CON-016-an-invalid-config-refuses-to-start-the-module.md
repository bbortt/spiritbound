**Title**
An invalid config refuses to start the module

**Lens**: CON

**Status**: active

**Description**
`config.json` is parsed and validated once, at module initialisation.
A
validation failure throws, and the throw is not caught: the module does not
initialise, and no reducer runs.
There is no fallback to defaults and no
partial application of a config that failed.

**Rationale**
A server that starts on an invalid balance file is worse than one that
does not start: play proceeds, an economy runs on numbers nobody chose,
and the mistake surfaces days later as a distribution that cannot be
explained.
Failing at init makes the operator's typo cost a publish, not a
week of play.
This is the same fail-loud rule the authored content
already follows via `parseCards`/`parseEquipment`.

**Verification Description**
Reviewed at the module-init call site for the unguarded `loadConfig()`/
`parseConfig()`; `content/config.test.ts` asserts the parse throws on an
invalid document rather than returning a default.

## Relations

**Realizes**

- [SYS-009](SYS-009-server-operators-tune-balance-through-a-validated-config-file.md)

## Changes

- **2026-09-05** — Set active: implementation of STR-009 began.
  The spec is authored and approved, so it now generates a traceable for the
  code written in this increment to anchor against.
