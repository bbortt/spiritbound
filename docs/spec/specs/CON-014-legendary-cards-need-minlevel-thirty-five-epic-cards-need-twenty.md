**Title**
Legendary cards need minLevel thirty-five, epic cards need twenty

**Lens**: CON

**Status**: active

**Description**
`content/validate.ts`'s `crossCheck` rejects a legendary card with
`minLevel < 35` or an epic card with `minLevel < 20` — rarity has a hard
floor on how early a card can become available, independent of whatever
`basePower`/`cooldownSeconds` it's given.

**Rationale**
Prevents a high-rarity card from being reachable at a low character
level purely by giving it a low `minLevel`, which would let rarity and
power-curve pacing drift apart — see the Drop System story's level-gating
specs, which rely on `minLevel`/`minCharacterLevel` being a meaningful,
rarity-consistent gate.

**Verification Description**
`content/cards.test.ts` should assert a legendary/epic card just under
its floor is rejected, and one at exactly the floor is accepted. (Confirm
this exists; add if missing per this story's Acceptance Criteria on
rejection-path coverage.)

## Relations

**Realizes**

- [SYS-008](SYS-008-content-is-authored-as-json-validated-then-idempotently-seeded.md)
