**Title**
`itemInstance`/`equippedItem` are public tables filtered by ownership on the client, not by row-level security

**Lens**: ARCH

**Status**: active

**Description**
`itemInstance` and `equippedItem` are declared `public: true` so any
connected client can subscribe to them, matching the pre-existing
`cardInstance`/`equippedCard` precedent.
Ownership is enforced only where
it matters for permadeath integrity — server-side, inside reducers
(`equipItem`/`unequipItem`, see `SW-001`) — never at the subscription
layer.
The client is expected to filter what it renders to
`ownerCharacterId === localCharacter.characterId` itself; nothing prevents
a client from also subscribing to and reading every other character's bag
and gear.

**Rationale**
SpacetimeDB's TypeScript SDK has no owner-scoped subscription primitive by
default; the SDK does support `schema().clientVisibilityFilter.sql(...)`
for real row-level security, but applying it was deliberately deferred to
keep this change small and consistent with the existing
`cardInstance`/`equippedCard` exposure, which already carried the same
risk before this table was added.
This is an accepted, already-present
class of leak, not a new one introduced here — but is flagged as worth
revisiting before anything beyond a local vertical slice ships.

**Verification Description**
Reviewed by inspecting the table declarations (`public: true`) and
confirming no `clientVisibilityFilter` is applied; any change adding
real row-level security should update or retire this spec rather than
silently narrowing exposure it describes.

## Relations

**Related**

- [SW-001](SW-001-equip-requires-ownership-and-matching-slot.md) — where ownership actually is enforced (server-side, in the reducer)
