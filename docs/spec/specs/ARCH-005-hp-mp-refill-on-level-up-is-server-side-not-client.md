**Title**
HP/MP refill on level-up is server-side, not client, keeping currentHp/currentMp exception-free

**Lens**: ARCH

**Status**: active

**Description**
Although the original level-up feature description put HP/MP refill
under a "CLIENT" heading alongside the VFX, `currentHp`/`currentMp` are
permadeath-sensitive values only the server may write (the same trust
boundary as combat), so the refill happens inside `_grantXp` server-side
in the same write as the XP/level/`lastLevelUpAt` update; the client only
reacts to the resulting row change to play the refill visually.

**Rationale**
Keeps the invariant "only the server ever writes currentHp/currentMp"
exception-free across every path in the codebase (combat, gear-swap
rescaling, and now level-up).

**Verification Description**
Reviewed by confirming no client code path calls a reducer or otherwise
attempts to set currentHp/currentMp directly around a level-up — it only
renders in response to the character row's own change.

## Relations

**Related**

- [STR-005](../stories/STR-005-xp-and-leveling.md)
- [SW-020](SW-020-a-level-increase-refills-hp-mp-and-stamps-the-level-up-timestamp.md)
