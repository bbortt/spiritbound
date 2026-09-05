**Title**
A ward passive card must have zero MP cost

**Lens**: CON

**Status**: active

**Description**
`content/validate.ts`'s `crossCheck` rejects any card with
`type: 'passive'`, `passiveKind: 'ward'`, and a nonzero `mpCost`.

**Rationale**
A quiet always-on mitigation effect (a ward, per `site/mechanics.md`'s
Cards and the Hand section) is never actively cast, so it cannot also
drain mana — an MP cost only makes sense for something the player
deliberately triggers.

**Verification Description**
`content/cards.test.ts` should assert a ward passive with `mpCost > 0` is
rejected, and one with `mpCost === 0` is accepted. (Confirm this exists;
add if missing per this story's Acceptance Criteria on rejection-path
coverage.)

## Relations

**Realizes**

- [SYS-008](SYS-008-content-is-authored-as-json-validated-then-idempotently-seeded.md)
