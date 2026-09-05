**Title**
A single item's moveSpeed modifier must stay under 0.5 and its evasion modifier under 0.20

**Lens**: CON

**Status**: active

**Description**
The equipment cross-check rejects any item whose `stats.moveSpeed` is
`>= 0.5` or whose `stats.evasion` is `>= 0.20`.

**Rationale**
Both are multiplier/percentage-shaped stats where a single item granting
too much would break the combat-mitigation cap
([CON-002](CON-002-glancing-avoidance-caps-at-twenty-percent-reduction.md),
which caps _total_ glancing reduction at 20%) or make movement trivially
dominant — the per-item ceiling keeps any one piece of gear from alone
reaching a value the rest of the system assumes is a combined, multi-source
total.

**Verification Description**
`content/equipment.test.ts` asserts an item with `moveSpeed >= 0.5` fails,
and one with `evasion >= 0.20` fails, independently of each other.

## Relations

**Realizes**

- [SYS-008](SYS-008-content-is-authored-as-json-validated-then-idempotently-seeded.md)

**Related**

- [CON-002](CON-002-glancing-avoidance-caps-at-twenty-percent-reduction.md)
