**Title**
Client level curve duplicates computeCharacterLevel and derives thresholds by binary search

**Lens**: ARCH

**Status**: active

**Description**
`client/src/levelCurve.ts` duplicates `rules/death.ts#computeCharacterLevel`
byte-for-byte (the client needs to render an XP bar and detect level-ups
reactively, but SpacetimeDB has no query-style RPC to ask "how much XP
until level 6," and the threshold values are derived, never stored).
`xpForLevel` is then derived by binary search over the duplicated
function rather than a second, independently-written inversion formula,
and `xpProgress` (current level + XP band) is built on top of that.

**Rationale**
This is the third instance of the same hand-sync duplication risk class
in this codebase (alongside `client/src/effectiveStats.ts` and
`CollectionPanel.ts`'s hand-slot/attunement copy — see the Equipment and
Hand/Card Management stories); deriving the inversion by binary search
means only the one duplicated curve function needs to stay in sync, not
two independently-authored formulas.

**Verification Description**
`client/src/levelCurve.test.ts` (new) asserts the client's
`xpForLevel`/`xpProgress`/duplicated `computeCharacterLevel` agree with
`spacetimedb/src/rules/death.ts#computeCharacterLevel`'s actual output
across a swept range of XP/level values — this is the practical
cross-boundary check the manual-review-only ADRs for the other two
duplication instances don't have, precisely because binary-search
inversion makes it checkable this way.

## Relations

**Related**

- [SW-021](SW-021-character-level-is-a-fixed-power-curve-over-xp-clamped-one-to-fifty.md)
- [STR-005](../stories/STR-005-xp-and-leveling.md)
