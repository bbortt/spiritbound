// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { describe, it, expect } from 'vitest';
import { validateCards, type CardDef } from './validate';
import { loadCards } from './loader';
import { verifies, ConTraceables } from '../src/clew/traceables/clew';

const cards = loadCards();

/** A minimal, schema-valid active card, ready to mutate into a violation. */
function validActiveCard(overrides: Partial<CardDef> = {}): CardDef {
  return {
    slug: 'test-card',
    name: 'Test Card',
    rarity: 'common',
    type: 'active',
    school: 'physical',
    shape: 'cone',
    basePower: 10,
    cooldownSeconds: 1,
    mpCost: 5,
    minLevel: 1,
    flavor: 'A test card.',
    ...overrides,
  };
}

/** A minimal, schema-valid ward passive card, ready to mutate into a violation. */
function validWardCard(overrides: Partial<CardDef> = {}): CardDef {
  return {
    slug: 'test-ward',
    name: 'Test Ward',
    rarity: 'common',
    type: 'passive',
    passiveKind: 'ward',
    school: 'physical',
    shape: 'cone',
    basePower: 10,
    cooldownSeconds: 0,
    mpCost: 0,
    minLevel: 1,
    flavor: 'A test ward.',
    ...overrides,
  };
}

describe('card definitions — schema', () => {
  it('all cards pass Zod schema validation', () => {
    const { valid, errors } = validateCards(cards);
    expect(valid, `Validation errors:\n${errors.join('\n')}`).toBe(true);
  });

  it('no duplicate slugs', () => {
    const slugs = cards.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('passive cards always have passiveKind defined', () => {
    for (const card of cards.filter((c) => c.type === 'passive')) {
      expect(
        card.passiveKind,
        `${card.slug}: passive card missing passiveKind`,
      ).toBeDefined();
    }
  });

  it('active cards never have passiveKind defined', () => {
    for (const card of cards.filter((c) => c.type === 'active')) {
      expect(
        card.passiveKind,
        `${card.slug}: active card must not have passiveKind`,
      ).toBeUndefined();
    }
  });
});

describe('card definitions — balance rules', () => {
  it('no card has basePower === 0', () => {
    for (const card of cards) {
      expect(
        card.basePower,
        `${card.slug}: basePower must be > 0`,
      ).toBeGreaterThan(0);
    }
  });

  it('legendary cards have minLevel >= 35', () => {
    for (const card of cards.filter((c) => c.rarity === 'legendary')) {
      expect(
        card.minLevel,
        `${card.slug}: legendary must have minLevel >= 35`,
      ).toBeGreaterThanOrEqual(35);
    }
  });

  it('epic cards have minLevel >= 20', () => {
    for (const card of cards.filter((c) => c.rarity === 'epic')) {
      expect(
        card.minLevel,
        `${card.slug}: epic must have minLevel >= 20`,
      ).toBeGreaterThanOrEqual(20);
    }
  });

  it('mpCost for ward passives is always 0', () => {
    for (const card of cards.filter(
      (c) => c.type === 'passive' && c.passiveKind === 'ward',
    )) {
      expect(
        card.mpCost,
        `${card.slug}: ward passive must have mpCost === 0`,
      ).toBe(0);
    }
  });

  it('cooldownSeconds for actives is > 0', () => {
    for (const card of cards.filter((c) => c.type === 'active')) {
      expect(
        card.cooldownSeconds,
        `${card.slug}: active card must have cooldown > 0`,
      ).toBeGreaterThan(0);
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

// Rejection-path coverage: the balance-rule tests above only prove the
// *shipped* content complies; these prove the validator actually REJECTS a
// synthetic violation of each rule, not just that no violation happens to exist yet.

verifies(
  ConTraceables.CON_014_LEGENDARY_CARDS_NEED_MINLEVEL_THIRTY_FIVE_EPIC_CARDS_NEED_TWENTY,
  () => {
    describe('CON-014 rejection path', () => {
      it('rejects a legendary card with minLevel just under 35', () => {
        const { valid, errors } = validateCards([
          validActiveCard({ rarity: 'legendary', minLevel: 34 }),
        ]);
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(
          /legendary card must have minLevel >= 35/,
        );
      });

      it('accepts a legendary card at exactly minLevel 35', () => {
        const { valid } = validateCards([
          validActiveCard({ rarity: 'legendary', minLevel: 35 }),
        ]);
        expect(valid).toBe(true);
      });

      it('rejects an epic card with minLevel just under 20', () => {
        const { valid, errors } = validateCards([
          validActiveCard({ rarity: 'epic', minLevel: 19 }),
        ]);
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(/epic card must have minLevel >= 20/);
      });
    });
  },
);

verifies(
  ConTraceables.CON_015_A_WARD_PASSIVE_CARD_MUST_HAVE_ZERO_MP_COST,
  () => {
    describe('CON-015 rejection path', () => {
      it('rejects a ward passive with a nonzero mpCost', () => {
        const { valid, errors } = validateCards([validWardCard({ mpCost: 1 })]);
        expect(valid).toBe(false);
        expect(errors.join('\n')).toMatch(
          /ward passive must have mpCost === 0/,
        );
      });

      it('accepts a ward passive with mpCost === 0', () => {
        const { valid } = validateCards([validWardCard({ mpCost: 0 })]);
        expect(valid).toBe(true);
      });
    });
  },
);
