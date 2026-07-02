import { describe, it, expect } from 'vitest';
import { validateCards } from './validate';
import { loadCards } from './loader';

const cards = loadCards();

describe('card definitions — schema', () => {
  it('all cards pass Zod schema validation', () => {
    const { valid, errors } = validateCards(cards);
    expect(valid, `Validation errors:\n${errors.join('\n')}`).toBe(true);
  });

  it('no duplicate slugs', () => {
    const slugs = cards.map(c => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('passive cards always have passiveKind defined', () => {
    for (const card of cards.filter(c => c.type === 'passive')) {
      expect(card.passiveKind, `${card.slug}: passive card missing passiveKind`).toBeDefined();
    }
  });

  it('active cards never have passiveKind defined', () => {
    for (const card of cards.filter(c => c.type === 'active')) {
      expect(card.passiveKind, `${card.slug}: active card must not have passiveKind`).toBeUndefined();
    }
  });
});

describe('card definitions — balance rules', () => {
  it('no card has basePower === 0', () => {
    for (const card of cards) {
      expect(card.basePower, `${card.slug}: basePower must be > 0`).toBeGreaterThan(0);
    }
  });

  it('legendary cards have minLevel >= 35', () => {
    for (const card of cards.filter(c => c.rarity === 'legendary')) {
      expect(card.minLevel, `${card.slug}: legendary must have minLevel >= 35`).toBeGreaterThanOrEqual(35);
    }
  });

  it('epic cards have minLevel >= 20', () => {
    for (const card of cards.filter(c => c.rarity === 'epic')) {
      expect(card.minLevel, `${card.slug}: epic must have minLevel >= 20`).toBeGreaterThanOrEqual(20);
    }
  });

  it('mpCost for ward passives is always 0', () => {
    for (const card of cards.filter(c => c.type === 'passive' && c.passiveKind === 'ward')) {
      expect(card.mpCost, `${card.slug}: ward passive must have mpCost === 0`).toBe(0);
    }
  });

  it('cooldownSeconds for actives is > 0', () => {
    for (const card of cards.filter(c => c.type === 'active')) {
      expect(card.cooldownSeconds, `${card.slug}: active card must have cooldown > 0`).toBeGreaterThan(0);
    }
  });
});

describe('card definitions — lore rules', () => {
  it('every card has a non-empty flavor string', () => {
    for (const card of cards) {
      expect(card.flavor, `${card.slug}: missing flavor text`).toBeTruthy();
    }
  });
});
