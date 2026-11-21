**Title**
Characters recover HP once they stop fighting, and MP continuously

**Lens**: SYS

**Status**: active

**Description**
A living character's HP and MP climb back toward their effective maxima at
the rate its `hpRegen`/`mpRegen` effective stats name, with no action, item
or reducer call by the player.
The two halves are gated differently, deliberately:

- **HP** recovers only while the character is out of combat.
  Fighting suspends the recovery; it does not reduce what has already been
  recovered.
- **MP** recovers continuously, in combat and out.

Recovery is the server's, as every other write to `currentHp`/`currentMp`
is: the client subscribes and renders, and never advances the value on its
own.

**Rationale**
Health and Will are two of the five primaries in `GAME_DESIGN.md`, and each
one's second half is a regeneration rate.
Without this capability both primaries are half dead, `hpRegen`/`mpRegen`
gear lines modify nothing, and the character sheet's own tooltips describe
mechanics that do not exist.

HP's gate decides the shape of retreat.
Permadeath makes disengaging the correct play far more often than in a
respawn game, and a chase is deliberately always escapable
(`GAME_DESIGN.md`: chase speed < player speed).
If escaping left the character permanently at the HP it escaped with, the
only ways back to full would be a level-up or a death — so the game would
reward dying over retreating, which inverts the pillar.

MP is ungated because the game has no way to restore MP on purpose: no
potion, no card, no effect.
Gating it would mean a caster whose bar empties mid-fight has no play
available at all, which is a worse mechanic than a trickle — and the
alternative, shipping MP-restoring cards first, is a content increment this
story would then depend on.
The asymmetry also reads correctly: a wound needs quiet to close, a reserve
refills on its own.

**Verification Description**
Observed end-to-end against a live instance: a character left alone after
taking damage is seen to climb back to its effective maxHp and stop there;
the same character taking a hit mid-recovery is seen to hold its HP
instead of continuing to climb, while its MP keeps rising throughout.
The software specs this capability decomposes into carry the exact rate,
gate and invariant assertions.

## Relations

**Related**

- [SYS-009](SYS-009-server-operators-tune-balance-through-a-validated-config-file.md) — the cadence and the out-of-combat delay are operator dials, not constants
- [SYS-001](SYS-001-equip-gear-to-change-combat-stats.md) — gear's `hpRegen`/`mpRegen` lines only mean something once this exists

## Changes

- **2026-11-21** — Set active: implementation of STR-016 began.
  The spec is authored, reviewed and approved, so it now generates a
  traceable for the code written in this increment to anchor against.
