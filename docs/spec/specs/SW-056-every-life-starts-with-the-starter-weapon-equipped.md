**Title**
Every life starts with the starter weapon granted and equipped in main_hand

**Lens**: SW

**Status**: active

**Description**
`startLife` grants the new character one `worn-dagger` `ItemInstance` and
equips it in `main_hand` ordinal 0, on every life rather than only the
first.
`ItemInstance` is character-owned, so a life that follows a death inherits
no gear at all and would otherwise swing bare-handed.
The grant is keyed on the `worn-dagger` `ItemDefinition` existing: if
`seedItems` has not run, `startLife` still creates the character and its
starting hand, it just hands out no weapon.

**Rationale**
A bare-handed swing resolves to `MIN_DAMAGE` — `SW-008` substitutes
`weaponDamage` for the card's base power on a `cardDefId 0` swing, and an
unarmed character's effective `weaponDamage` is 0, so every basic attack
did exactly 1 damage against a 100 HP enemy.
The first fight of a new life therefore took ~100 right-clicks, which
reads as a broken game rather than as a difficulty curve.
Granting the weapon that `equipment.json` already defines as the level-1
common main-hand fixes it without retuning a single number: `weaponDamage`
12 plus `physicalAttack` 8, level-scaled, puts a swing at 21 damage, so a
zone-1 enemy dies in five hits.
Re-granting on every life keeps the floor where permadeath needs it — a
returning player is poor, not helpless — and matches the cards side, which
already re-grants the tutorial hand when a life starts with nothing owned.

**Verification Description**
An integration test calls `start_life`, then reads the character's
`item_instance` and `equipped_item` rows: exactly one instance of the
`worn-dagger` definition, equipped in `main_hand` at ordinal 0.

## Relations

**Realizes**

- [SYS-001](SYS-001-equip-gear-to-change-combat-stats.md)

**Related**

- [SW-008](SW-008-bare-weapon-swing-substitutes-weapon-stats-for-a-card.md) — why an unarmed swing resolves to 1 damage
- [SW-053](SW-053-startlife-computes-the-start-zone-from-tutorial-completion-not-caller-input.md) — the same reducer's other server-side starting decision
- [CON-001](CON-001-damage-never-resolves-below-min-damage.md) — the floor an unarmed swing was hitting
