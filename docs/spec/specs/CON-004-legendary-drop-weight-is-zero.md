**Title**
Legendary rarity weight in the drop roll is fixed at zero

**Lens**: CON

**Status**: active

**Description**
The legendary rarity-tier weight in the drop roll is fixed at 0 — no
random roll value can ever select it as the drop tier.

**Rationale**
Explicit design decision (`docs/BALANCE.md`) — legendaries are reserved
for bosses and dungeon tiers, neither of which exist yet; trash-mob kills
must never be a legendary source.

**Verification Description**
A unit test sweeps `randomRoll` across its full 0..1 domain and asserts
legendary is never the picked tier.

## Relations

**Realizes**

- [SYS-004](SYS-004-enemy-deaths-roll-level-gated-rarity-weighted-ground-drops.md)
