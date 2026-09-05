**Title**
Server balance config, spirit rarity ceilings, and level-scaled XP

**Status**: active

**Business Value**
Three gaps close together.
A server operator can retune drop rates, XP,
and enemy AI without editing TypeScript, which is what makes a custom
server viable at all.
The spirit gains the rarity ceiling the original
design named (`SpiritDefinition.rarity_ceiling`) but never implemented, so
spirit level gates what a player can wield and not only what survives
death.
And XP stops being flat: farming trivial mobs pays almost nothing,
while fighting up pays a small, capped bonus — the permadeath-safe shape
of "fight things your own size."

**Problem / Context**
Balance constants are scattered across `spacetimedb/src/rules/drops.ts`
(`CARD_DROP_CHANCE`, `ITEM_DROP_CHANCE`, `RARITY_DROP_WEIGHTS`),
`spacetimedb/src/rules/enemyAi.ts` (aggro/attack/deaggro ranges, chase and
reset speeds), and literals inside `spacetimedb/src/index.ts` (60 s
despawn, 80 px pickup, 15 s respawn).
Changing any of them is a code edit
and a redeploy.

Spirit level currently grants hand slots and attunement slots only; there
is no gate on which rarities a spirit can hold at all, so a level-1 spirit
can equip a legendary the moment one is found.

Every enemy awards a flat 25 XP (`CON-007` records this as a known
placeholder), and drop eligibility is filtered by the _killer's_ level, so
a level-20 player farming level-2 wolves both keeps full XP and pulls
level-20 gear out of them.

**Solution Approach**
Add `content/config.json` as a second, operator-owned content file beside
the authored `cards.json`/`equipment.json`, with its own Zod validator and
loader following the existing validator/loader split (`ARCH-009`).
The
server module loads and validates it once at module init and refuses to
start when it is invalid.
The pure rule functions keep taking their tuning
as parameters rather than importing the loader, so they stay pure and
unit-testable.

Add `computeRarityCeiling`/`canSpiritHandle` to `rules/death.ts` beside the
attunement logic, enforce them in `equipCard` and `toggleAttune`, and
mirror them in the client's existing `handSlots.ts` duplicate
(`ARCH-008`).

Give the enemy table a `level`, add a new pure `rules/leveling.ts` holding
`computeXpReward`, and switch drop eligibility from the killer's level to
the enemy's level plus two.

**Acceptance Criteria**

- `content/config.json` validates, and a config whose rarity weights do
  not sum to 1.0 is rejected with an error naming the actual sum.
- No balance constant this story moves remains hard-coded in
  `rules/drops.ts`, `rules/enemyAi.ts`, or `index.ts`.
- `computeRarityCeiling` returns common/uncommon/rare/epic/legendary at
  spirit levels 1/5/12/25/40, and `equipCard`/`toggleAttune` reject a card
  above the ceiling.
- `computeXpReward` pays base XP at equal level and inside the full-XP
  band, a capped bonus above level, a linear falloff beyond the band, and
  zero at or past the cutoff — never a negative number.
- Card and item drop pools filter on the enemy's level plus two.
- Every spec below whose behaviour is pure logic reaches Covered in
  `clew coverage`.
  The SYS specs, and the specs realized only inside a
  reducer or a Phaser panel, stay `realized`/`concerns`-anchored — matching
  how the existing corpus anchors its own SYS and reducer specs, since
  `005-testing-contract.md` unit-tests neither layer.

**Out of scope**

- Enemy difficulty tiers (varying HP/damage per enemy).
  This story gives
  the enemy a level and scales the reward by it; it does not differentiate
  the enemies themselves.
- Hot-reloading `config.json` without a redeploy — it is read once at
  module init.
- Making the config validator enforce the balance invariants `CON-003`
  and `CON-004` state (chase speed under player move speed; zero legendary
  weight).
  Moving those numbers into an operator-editable file puts them
  out of the validator's reach; `ARCH-010` records that tension and the
  config unit test asserts the shipped values, but guarding them in the
  schema is a separate decision.

## Relations

**Realizes**

- [SYS-009](../specs/SYS-009-server-operators-tune-balance-through-a-validated-config-file.md)
- [SYS-010](../specs/SYS-010-spirit-level-caps-the-card-rarity-a-player-can-hold-at-all.md)
- [SYS-011](../specs/SYS-011-xp-and-drop-eligibility-scale-with-the-enemys-own-level.md)
- [SW-031](../specs/SW-031-rarity-weights-must-sum-to-one-and-the-error-names-the-actual-sum.md)
- [SW-032](../specs/SW-032-the-xp-level-band-must-be-ordered-and-the-bonus-cap-bounded.md)
- [SW-033](../specs/SW-033-the-rarity-ceiling-steps-at-spirit-levels-five-twelve-twenty-five-and-forty.md)
- [SW-034](../specs/SW-034-equipping-or-attuning-above-the-ceiling-is-rejected-naming-the-ceiling.md)
- [SW-035](../specs/SW-035-cards-above-the-ceiling-render-locked-and-the-header-names-the-ceiling.md)
- [SW-036](../specs/SW-036-xp-falls-off-linearly-between-the-full-xp-band-and-the-zero-cutoff.md)
- [SW-037](../specs/SW-037-drop-eligibility-filters-to-the-enemys-level-plus-two.md)
- [SW-038](../specs/SW-038-enemy-level-renders-coloured-by-relative-difficulty-and-zero-reads-no-xp.md)
- [ARCH-010](../specs/ARCH-010-config-json-is-operator-tunable-cards-and-equipment-json-are-content.md)
- [ARCH-011](../specs/ARCH-011-the-client-duplicates-compute-xp-reward-to-render-the-floating-number.md)
- [CON-016](../specs/CON-016-an-invalid-config-refuses-to-start-the-module.md)
- [CON-017](../specs/CON-017-the-rarity-ceiling-and-the-attunement-slots-are-two-separate-gates.md)
- [CON-018](../specs/CON-018-the-above-level-xp-bonus-is-capped-so-over-pulling-never-pays.md)

**Related**

- [CON-007](../specs/CON-007-every-enemy-currently-awards-a-flat-xp-reward.md) — the flat-reward placeholder this story retires
- [CON-004](../specs/CON-004-legendary-drop-weight-is-zero.md) — the zero legendary weight now lives in the operator's config
- [CON-003](../specs/CON-003-chase-speed-is-always-slower-than-player-move-speed.md) — chase speed now lives in the operator's config
- [ARCH-009](../specs/ARCH-009-content-loaders-are-split-from-pure-validators-so-spacetimedb-can-tree-shake-node-fs.md) — the validator/loader split the config file follows
- [ARCH-008](../specs/ARCH-008-collection-panels-client-duplicate-is-corrected-to-match-rules-death-exactly.md) — the client duplicate the ceiling mirror joins
- [SW-016](../specs/SW-016-drop-eligibility-filters-to-the-killers-level.md) — the killer-level filter this story replaces
- [SW-018](../specs/SW-018-ground-drops-despawn-in-60s-and-need-80px-to-pick-up.md) — despawn and pickup numbers now come from config
