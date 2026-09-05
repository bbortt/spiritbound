**Title**
XP & Leveling — kills grant XP that levels up the character with a visible refill

**Status**: active

**Business Value**
XP-from-kills is the moment-to-moment progression loop that makes combat
feel like it's going somewhere, distinct from the permanent card/spirit
progression that survives death — it's the loop `CLAUDE.md`'s Next Steps
previously called "the missing progression loop," now shipped.

**Problem / Context**
This is a retrofit story: the XP/leveling loop already shipped in a prior
session and is live in the codebase.
No spec currently records what it
actually does, so nothing catches a future regression (e.g. a level-up
that stops refilling HP/MP, or a client XP bar silently drifting from the
server's curve) as a spec violation rather than a silently-changed
behavior.

**Solution Approach**
Author SW specs for the grant/level-up/curve behaviors; one CON spec for
the current flat-XP-per-kill placeholder; two ARCH specs restating the
existing HP/MP-refill-server-side and client-curve-duplication decisions.
Anchor each to the existing implementing code; add vitest unit tests
(anchored too) for the pure logic — `computeCharacterLevel`
(`spacetimedb/src/rules/death.ts`, shared file — a sibling Death &
Retention story also anchors tests into it for other functions, so this
file is not solely owned by this story) and `client/src/levelCurve.ts`
(currently untested).

**Acceptance Criteria**

- Every spec below is anchored to the code that already realizes it.
- `computeCharacterLevel` gets a unit test in
  `spacetimedb/src/rules/death.test.ts`.
- `client/src/levelCurve.ts` gets a unit test asserting its
  `xpForLevel`/`xpProgress`/duplicated `computeCharacterLevel` agree with
  the server's actual curve output across a swept range of XP/level
  values — this is the one place a cross-boundary equality check is
  practical, since the client derives its inversion by binary search over
  the same duplicated formula rather than a second, independently-written
  one.
- `clew coverage` shows every spec in this story as Covered.
- No existing XP/leveling behavior changes — this is a documentation-and-
  test retrofit, not a feature change.

**Out of scope**

- What grants the XP in the first place beyond "an enemy died" — the
  Enemy AI story owns the kill event itself; this story owns what happens
  to XP/level once granted.
- Spirit bond XP / attunement — a completely separate progression track
  (Death & Retention story), keyed to spirit level, not character level.
- Enemy difficulty tiers (`CON-007` records today's flat-reward
  placeholder but does not resolve it) — `CLAUDE.md`'s Next Steps already
  lists this as still-needed future work.

## Relations

**Realizes**

- [SYS-005](../specs/SYS-005-killing-enemies-grants-xp-that-levels-up-the-character.md)
- [SW-019](../specs/SW-019-grant-xp-raises-per-life-xp-and-lifetime-xp-in-one-call.md)
- [SW-020](../specs/SW-020-a-level-increase-refills-hp-mp-and-stamps-the-level-up-timestamp.md)
- [SW-021](../specs/SW-021-character-level-is-a-fixed-power-curve-over-xp-clamped-one-to-fifty.md)
- [CON-007](../specs/CON-007-every-enemy-currently-awards-a-flat-xp-reward.md)
- [ARCH-005](../specs/ARCH-005-hp-mp-refill-on-level-up-is-server-side-not-client.md)
- [ARCH-006](../specs/ARCH-006-client-level-curve-duplicates-compute-character-level-and-derives-thresholds-by-binary-search.md)
