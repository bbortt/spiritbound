**Title**
The client's effective-stats formula is a hand-synced duplicate of the server's, not a shared module

**Lens**: ARCH

**Status**: active

**Description**
`client/src/effectiveStats.ts` re-implements
`spacetimedb/src/rules/stats.ts#computeRaceBase`/`computeEffectiveStats`
byte-for-byte in a second file, rather than the client importing the
server's `rules/` module.
Both copies carry a comment pointing at the
other file.
There is no compiler or test that enforces the two stay
identical — a person changing one must remember to change the other.

**Rationale**
SpacetimeDB has no query-style RPC (only table subscriptions and reducer
calls), and effective stats are explicitly never persisted (`SW-004`),
so the client has no way to ask the server "what are my effective stats" —
it must compute a display copy locally.
This is the first of three
instances of the same duplication risk class in this codebase (the others
are `client/src/levelCurve.ts`'s copy of `computeCharacterLevel`, and
`CollectionPanel.ts`'s copy of `computeHandSlots`/`computeAttunementSlots`
— see the Hand/Card Management and XP & Leveling stories).
No shared
package or server-computed-row alternative has been built yet; this spec
records the accepted tradeoff, not a recommendation to leave it
unaddressed forever.

**Verification Description**
Reviewed by diffing `client/src/effectiveStats.ts#computeEffectiveStats`
against `spacetimedb/src/rules/stats.ts#computeEffectiveStats` (and their
respective race-base constants) on any change to either — the two must
compute identical output for identical input.
No automated equality test
exists across the module boundary (client and server are separate
TypeScript projects, per `004-technology-contract.md`); this remains a
manual review gate, named explicitly here as a deferred point that a
future shared-`rules/`-package effort would resolve.

## Relations

**Related**

- [SW-004](SW-004-effective-stats-stack-race-base-with-gear-additively.md) — the formula being duplicated
