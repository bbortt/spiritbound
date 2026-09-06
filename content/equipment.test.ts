// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { describe, it, expect } from 'vitest';
import {
  validateEquipment,
  loadEquipment,
  type ItemDef,
} from './validateEquipment';
import { verifies, ConTraceables } from '../src/clew/traceables/clew';

const items = loadEquipment();

/** A minimal, schema-valid non-weapon item, ready to mutate into a violation. */
function validArmorItem(overrides: Partial<ItemDef> = {}): ItemDef {
  return {
    slug: 'test-item',
    name: 'Test Item',
    category: 'equipment',
    slot: 'chest',
    rarity: 'common',
    minLevel: 1,
    armorWeight: 'cloth',
    weaponSchool: null,
    geometryShape: null,
    geometryWidth: null,
    geometryRange: null,
    stats: { physicalDef: 5 },
    flavor: 'A test item.',
    ...overrides,
  };
}

/** A minimal, schema-valid main_hand weapon, ready to mutate into a violation. */
function validWeaponItem(overrides: Partial<ItemDef> = {}): ItemDef {
  return {
    slug: 'test-weapon',
    name: 'Test Weapon',
    category: 'equipment',
    slot: 'main_hand',
    rarity: 'common',
    minLevel: 1,
    armorWeight: null,
    weaponSchool: 'physical',
    geometryShape: 'cone',
    geometryWidth: 0.4,
    geometryRange: 120,
    stats: { weaponDamage: 8 },
    flavor: 'A test weapon.',
    ...overrides,
  };
}

describe('equipment — schema', () => {
  it('all items pass Zod schema validation', () => {
    const { valid, errors } = validateEquipment(items);
    expect(valid, `Validation errors:\n${errors.join('\n')}`).toBe(true);
  });

  it('no duplicate slugs', () => {
    const slugs = items.map((i) => i.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('main_hand items always have weaponSchool + geometry', () => {
    for (const item of items.filter((i) => i.slot === 'main_hand')) {
      expect(
        item.weaponSchool,
        `${item.slug}: main_hand item missing weaponSchool`,
      ).not.toBeNull();
      expect(
        item.geometryShape,
        `${item.slug}: main_hand item missing geometryShape`,
      ).not.toBeNull();
      expect(
        item.geometryWidth,
        `${item.slug}: main_hand item missing geometryWidth`,
      ).not.toBeNull();
      expect(
        item.geometryRange,
        `${item.slug}: main_hand item missing geometryRange`,
      ).not.toBeNull();
    }
  });

  it('non-weapon slots never have weaponSchool', () => {
    for (const item of items.filter((i) => i.slot !== 'main_hand')) {
      expect(
        item.weaponSchool,
        `${item.slug}: non-weapon item must not have weaponSchool`,
      ).toBeNull();
    }
  });

  it('armorWeight null for weapons and off_hand items', () => {
    for (const item of items.filter(
      (i) => i.slot === 'main_hand' || i.slot === 'off_hand',
    )) {
      expect(
        item.armorWeight,
        `${item.slug}: ${item.slot} item must not have armorWeight`,
      ).toBeNull();
    }
  });
});

describe('equipment — balance rules', () => {
  it('wide weapons (width > 1.0) have total damage stats <= 20', () => {
    for (const item of items.filter(
      (i) => i.slot === 'main_hand' && (i.geometryWidth ?? 0) > 1.0,
    )) {
      const totalDamage =
        (item.stats.weaponDamage ?? 0) +
        (item.stats.physicalAttack ?? 0) +
        (item.stats.magicAttack ?? 0);
      expect(
        totalDamage,
        `${item.slug}: wide weapon has total damage > 20 (power-vs-area violation)`,
      ).toBeLessThanOrEqual(20);
    }
  });

  it('no item has evasion >= 0.20', () => {
    for (const item of items) {
      if (item.stats.evasion !== undefined) {
        expect(
          item.stats.evasion,
          `${item.slug}: evasion must be < 0.20`,
        ).toBeLessThan(0.2);
      }
    }
  });

  it('no item has moveSpeed >= 0.5', () => {
    for (const item of items) {
      if (item.stats.moveSpeed !== undefined) {
        expect(
          item.stats.moveSpeed,
          `${item.slug}: moveSpeed must be < 0.5`,
        ).toBeLessThan(0.5);
      }
    }
  });

  it('epic items have at least one stat >= 20', () => {
    for (const item of items.filter((i) => i.rarity === 'epic')) {
      const statValues = Object.values(item.stats) as number[];
      const maxStat = statValues.length > 0 ? Math.max(...statValues) : 0;
      expect(
        maxStat,
        `${item.slug}: epic item must have at least one stat >= 20`,
      ).toBeGreaterThanOrEqual(20);
    }
  });

  it('legendary items have at least one stat >= 40', () => {
    for (const item of items.filter((i) => i.rarity === 'legendary')) {
      const statValues = Object.values(item.stats) as number[];
      const maxStat = statValues.length > 0 ? Math.max(...statValues) : 0;
      expect(
        maxStat,
        `${item.slug}: legendary item must have at least one stat >= 40`,
      ).toBeGreaterThanOrEqual(40);
    }
  });
});

describe('equipment — lore rules', () => {
  it('every item has a non-empty flavor string', () => {
    for (const item of items) {
      expect(item.flavor, `${item.slug}: missing flavor text`).toBeTruthy();
    }
  });
});

// Rejection-path coverage: every compliance-only assertion above proves the
// *shipped* content is legal; these prove the validator actually REJECTS a
// synthetic violation of each rule, not just that no violation happens to exist yet.

verifies(
  ConTraceables.CON_009_MAIN_HAND_ITEMS_REQUIRE_FULL_WEAPON_GEOMETRY_EVERYTHING_ELSE_FORBIDS_IT,
  () => {
    describe('CON-009 rejection path', () => {
      it('rejects a main_hand item missing weaponSchool', () => {
        const { valid, errors } = validateEquipment([
          validWeaponItem({ weaponSchool: null }),
        ]);
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(
          /weaponSchool is required for main_hand/,
        );
      });

      it('rejects a non-main_hand item that sets weaponSchool', () => {
        const { valid, errors } = validateEquipment([
          validArmorItem({ weaponSchool: 'physical' }),
        ]);
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(/weaponSchool must be null/);
      });
    });
  },
);

verifies(
  ConTraceables.CON_010_ARMOR_WEIGHT_IS_FORBIDDEN_ON_MAIN_HAND_AND_OFF_HAND_ITEMS,
  () => {
    describe('CON-010 rejection path', () => {
      it('rejects a main_hand item with a non-null armorWeight', () => {
        const { valid, errors } = validateEquipment([
          validWeaponItem({ armorWeight: 'plate' }),
        ]);
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(/armorWeight must be null/);
      });
    });
  },
);

verifies(
  ConTraceables.CON_011_EPIC_ITEMS_NEED_A_STAT_OF_TWENTY_LEGENDARY_ITEMS_NEED_FORTY,
  () => {
    describe('CON-011 rejection path', () => {
      it('rejects an epic item whose max stat is just under 20', () => {
        const { valid, errors } = validateEquipment([
          validArmorItem({ rarity: 'epic', stats: { physicalDef: 19 } }),
        ]);
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(
          /epic item must have at least one stat >= 20/,
        );
      });

      it('accepts an epic item whose max stat is exactly 20', () => {
        const { valid } = validateEquipment([
          validArmorItem({ rarity: 'epic', stats: { physicalDef: 20 } }),
        ]);
        expect(valid).toBe(true);
      });

      it('rejects a legendary item whose max stat is just under 40', () => {
        const { valid, errors } = validateEquipment([
          validArmorItem({ rarity: 'legendary', stats: { physicalDef: 39 } }),
        ]);
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(
          /legendary item must have at least one stat >= 40/,
        );
      });
    });
  },
);

verifies(
  ConTraceables.CON_012_PER_ITEM_MOVESPEED_AND_EVASION_MODIFIERS_ARE_CAPPED,
  () => {
    describe('CON-012 rejection path', () => {
      it('rejects an item with moveSpeed at exactly 0.5 (the >= boundary)', () => {
        const { valid, errors } = validateEquipment([
          validArmorItem({ stats: { moveSpeed: 0.5 } }),
        ]);
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(
          /moveSpeed is a multiplier and must be < 0.5/,
        );
      });

      it('accepts an item with moveSpeed just under 0.5', () => {
        const { valid } = validateEquipment([
          validArmorItem({ stats: { moveSpeed: 0.49 } }),
        ]);
        expect(valid).toBe(true);
      });

      it('rejects an item with evasion at exactly 0.20 (the >= boundary)', () => {
        const { valid, errors } = validateEquipment([
          validArmorItem({ stats: { evasion: 0.2 } }),
        ]);
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(/evasion is capped at 0.20/);
      });
    });
  },
);

verifies(
  ConTraceables.CON_013_A_WIDE_MAIN_HAND_WEAPON_CAPS_ITS_TOTAL_DAMAGE_STATS_AT_TWENTY,
  () => {
    describe('CON-013 rejection path', () => {
      it('rejects a wide (width > 1.0) weapon with combined damage stats over 20', () => {
        const { valid, errors } = validateEquipment([
          validWeaponItem({
            geometryWidth: 1.8,
            stats: { weaponDamage: 15, magicAttack: 6 },
          }),
        ]);
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(/power-vs-area/);
      });

      it('accepts a wide weapon whose combined damage stats are exactly 20 (the shipped Apprentice Staff boundary)', () => {
        const { valid } = validateEquipment([
          validWeaponItem({
            geometryWidth: 1.8,
            stats: { weaponDamage: 6, magicAttack: 14 },
          }),
        ]);
        expect(valid).toBe(true);
      });
    });
  },
);
