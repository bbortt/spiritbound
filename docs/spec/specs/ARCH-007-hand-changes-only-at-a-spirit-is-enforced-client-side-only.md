**Title**
"Hand changes only at a spirit" is enforced client-side only — the server accepts equipCard/unequipCard from anywhere

**Lens**: ARCH

**Status**: active

**Description**
The design rule "you can only change your Hand at a spirit"
(`site/mechanics.md`, `docs/GAME_DESIGN.md`) is enforced entirely
client-side today: `CollectionPanel.ts` tracks `_nearSpirit` and only
enables its equip button (`canEquip = this._nearSpirit && ...`) when near
a spirit or in spirit-panel mode, showing "Visit a spirit to manage your
hand" otherwise — but the server's `equipCard`/`unequipCard` reducers
accept the call unconditionally from any connected identity, with no
location or spirit-proximity check whatsoever.

**Rationale**
This is a real, previously-undocumented trust-boundary gap, not a
deliberate design choice — recorded here in the same spirit as the
"Login server deferred" ADR's honesty about what is and isn't actually
enforced, so a future pass closing it (adding a server-side
spirit-proximity check to both reducers) has a clear point to update.

**Verification Description**
Reviewed by confirming `equipCard`/`unequipCard`'s reducer bodies contain
no spirit-distance or spirit-presence check.
Closing this gap should
update this spec's Status/Description rather than silently changing the
reducers out from under it.

## Relations

**Related**

- [STR-007](../stories/STR-007-hand-card-management.md)
