import { describe, it, expect } from 'vitest';
import { validateEquipment, loadEquipment } from './validateEquipment';

const items = loadEquipment();

describe('equipment — schema', () => {
  it('all items pass Zod schema validation', () => {
    const { valid, errors } = validateEquipment(items);
    expect(valid, `Validation errors:\n${errors.join('\n')}`).toBe(true);
  });

  it('no duplicate slugs', () => {
    const slugs = items.map(i => i.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('main_hand items always have weaponSchool + geometry', () => {
    for (const item of items.filter(i => i.slot === 'main_hand')) {
      expect(item.weaponSchool, `${item.slug}: main_hand item missing weaponSchool`).not.toBeNull();
      expect(item.geometryShape, `${item.slug}: main_hand item missing geometryShape`).not.toBeNull();
      expect(item.geometryWidth, `${item.slug}: main_hand item missing geometryWidth`).not.toBeNull();
      expect(item.geometryRange, `${item.slug}: main_hand item missing geometryRange`).not.toBeNull();
    }
  });

  it('non-weapon slots never have weaponSchool', () => {
    for (const item of items.filter(i => i.slot !== 'main_hand')) {
      expect(item.weaponSchool, `${item.slug}: non-weapon item must not have weaponSchool`).toBeNull();
    }
  });

  it('armorWeight null for weapons and off_hand items', () => {
    for (const item of items.filter(i => i.slot === 'main_hand' || i.slot === 'off_hand')) {
      expect(item.armorWeight, `${item.slug}: ${item.slot} item must not have armorWeight`).toBeNull();
    }
  });
});

describe('equipment — balance rules', () => {
  it('wide weapons (width > 1.0) have total damage stats <= 20', () => {
    for (const item of items.filter(i => i.slot === 'main_hand' && (i.geometryWidth ?? 0) > 1.0)) {
      const totalDamage =
        (item.stats.weaponDamage ?? 0) +
        (item.stats.physicalAttack ?? 0) +
        (item.stats.magicAttack ?? 0);
      expect(totalDamage, `${item.slug}: wide weapon has total damage > 20 (power-vs-area violation)`).toBeLessThanOrEqual(20);
    }
  });

  it('no item has evasion >= 0.20', () => {
    for (const item of items) {
      if (item.stats.evasion !== undefined) {
        expect(item.stats.evasion, `${item.slug}: evasion must be < 0.20`).toBeLessThan(0.20);
      }
    }
  });

  it('no item has moveSpeed >= 0.5', () => {
    for (const item of items) {
      if (item.stats.moveSpeed !== undefined) {
        expect(item.stats.moveSpeed, `${item.slug}: moveSpeed must be < 0.5`).toBeLessThan(0.5);
      }
    }
  });

  it('epic items have at least one stat >= 20', () => {
    for (const item of items.filter(i => i.rarity === 'epic')) {
      const statValues = Object.values(item.stats) as number[];
      const maxStat = statValues.length > 0 ? Math.max(...statValues) : 0;
      expect(maxStat, `${item.slug}: epic item must have at least one stat >= 20`).toBeGreaterThanOrEqual(20);
    }
  });

  it('legendary items have at least one stat >= 40', () => {
    for (const item of items.filter(i => i.rarity === 'legendary')) {
      const statValues = Object.values(item.stats) as number[];
      const maxStat = statValues.length > 0 ? Math.max(...statValues) : 0;
      expect(maxStat, `${item.slug}: legendary item must have at least one stat >= 40`).toBeGreaterThanOrEqual(40);
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
