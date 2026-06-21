/**
 * index.ts — Spiritbound SpacetimeDB server module (vertical slice).
 *
 * Architecture rules (see .claude/skills/architect/SKILL.md):
 *   - Reducers are THIN SHELLS: validate → call pure rules fn → write rows.
 *   - All game logic lives in rules/ with no SpacetimeDB imports.
 *   - ctx.sender is the only trusted identity source — never trust args.
 *   - Tables hold STATE only; derived values (effectiveStats, slotCounts)
 *     are computed in rules/ and never stored.
 *
 * Vertical slice covers: account bootstrap, character lifecycle, personal spirit,
 * card collection, equipped hand, move, damage, permadeath, and card retention.
 * Gear, location spirits, groups, dungeons, and sets are deferred to v2.
 */

import { schema, table, t } from 'spacetimedb/server';
import { SenderError } from 'spacetimedb/server';

import {
  computeSpiritLevel,
  computeAttunementSlots,
  computeHandSlots,
  computeCharacterLevel,
  computeRetention,
  SACRIFICE_XP,
  type CardForRetention,
} from './rules/death';

import { resolveHit, resolveHeal } from './rules/combat';
import type { StatBlock } from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM SPACETIMEDB TYPES
// ═══════════════════════════════════════════════════════════════════════════════

const TStatBlock = t.object('StatBlock', {
  power:          t.i32(),
  knowledge:      t.i32(),
  health:         t.i32(),
  will:           t.i32(),
  agility:        t.i32(),
  precision:      t.i32(),
  maxHp:          t.i32(),
  hpRegen:        t.f32(),
  maxMp:          t.i32(),
  mpRegen:        t.f32(),
  moveSpeed:      t.f32(),
  weaponDamage:   t.i32(),
  physicalAttack: t.i32(),
  magicAttack:    t.i32(),
  attackSpeed:    t.f32(),
  castingSpeed:   t.f32(),
  physicalCrit:   t.f32(),
  magicCrit:      t.f32(),
  accuracy:       t.i32(),
  magicAccuracy:  t.i32(),
  healingBoost:   t.f32(),
  physicalDef:    t.i32(),
  magicDef:       t.i32(),
  evasion:        t.f32(),
  parry:          t.f32(),
  block:          t.f32(),
  magicResist:    t.f32(),
});

const TRarity      = t.enum('Rarity',      { common: t.unit(), uncommon: t.unit(), rare: t.unit(), epic: t.unit(), legendary: t.unit() });
const TCardType    = t.enum('CardType',    { active: t.unit(), passive: t.unit() });
const TPassiveKind = t.enum('PassiveKind', { ward: t.unit(), triggered: t.unit(), none: t.unit() });
const TSchool      = t.enum('DamageSchool',{ physical: t.unit(), magical: t.unit() });
const TShape       = t.enum('ShapeType',   { cone: t.unit(), line: t.unit(), arc: t.unit(), circle: t.unit() });

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT TABLES  (static game data — written by tooling, read by everyone)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Zone — a region of the world.
 * Zones gate access by level (min_level = hard gate; recommended_level = soft hint).
 */
const zone = table(
  { name: 'zone', public: true },
  {
    zoneId:           t.u32().primaryKey(),
    name:             t.string(),
    minLevel:         t.u32(),   // hard gate
    recommendedLevel: t.u32(),   // soft hint shown to player
    maxLevel:         t.u32(),
    description:      t.string(),
  },
);

/**
 * CardDefinition — the static blueprint for a card.
 * Never mutated after content is loaded. One row per card type.
 */
const cardDefinition = table(
  { name: 'card_definition', public: true },
  {
    cardDefId:          t.u32().primaryKey(),
    name:               t.string(),
    rarity:             TRarity,
    cardType:           TCardType,
    passiveKind:        TPassiveKind,   // 'none' when cardType = active
    scalingSchool:      TSchool,        // which attack stat powers this card
    baseShape:          TShape,         // weapon geometry_modifier will bend this
    basePower:          t.f32(),
    baseCooldown:       t.f32(),
    mpCost:             t.i32(),
    minCharacterLevel:  t.u32(),        // must re-earn after death before equipping again
    flavor:             t.string(),     // lore-keeper domain
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNT-LEVEL TABLES  (survive permadeath)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * AccountProgress — cross-death milestone tracking.
 * total_xp_all_lives never resets; it drives account-level unlocks.
 */
const accountProgress = table(
  { name: 'account_progress', public: false },
  {
    accountIdentity:       t.identity().primaryKey(),
    totalXpAllLives:       t.u64(),
    tutorialCompleted:     t.bool(),      // true → next character starts at level 10
    unlockedMilestoneIds:  t.array(t.u32()),
  },
);

/**
 * PersonalSpirit — the one thread that never dies.
 *
 * Design: 1:1 with Account. Persists across all character deaths.
 * bond_xp accumulates from card sacrifices across ALL lives.
 * Slot counts (hand + attunement) are DERIVED from level — see rules/death.ts.
 *
 * Lore: the spirit always finds its way back, perhaps weakened, but unbroken.
 */
const personalSpirit = table(
  { name: 'personal_spirit', public: false },
  {
    accountIdentity:  t.identity().primaryKey(),  // 1:1 — accountIdentity is the PK
    name:             t.string(),
    level:            t.u32(),
    bondXp:           t.u64(),    // NEVER resets — accumulates across all lives
  },
);

/**
 * CardInstance — a specific copy of a card, owned at the account level.
 * Account-owned = survives permadeath (subject to spirit retention).
 * attuned = true → guaranteed to survive if spirit has a slot of that rarity.
 */
const cardInstance = table(
  {
    name: 'card_instance',
    public: false,
    indexes: [{ accessor: 'by_owner', algorithm: 'btree', columns: ['ownerIdentity'] }],
  },
  {
    cardInstanceId:  t.u64().primaryKey().autoInc(),
    ownerIdentity:   t.identity(),
    cardDefId:       t.u32(),
    mergeLevel:      t.u32(),    // adds EFFECTS (not raw power) — see ability-balancer
    attuned:         t.bool(),   // player's "save this one" decision before venturing out
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// CHARACTER-LEVEL TABLES  (lost on permadeath)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Character — one life. On death: alive → false, gear deleted, unretained cards deleted.
 * A new character is created for the next life; the spirit carries over.
 *
 * effectiveStats is DERIVED (race base + gear + ward passives) — never stored here.
 */
const character = table(
  {
    name: 'character',
    public: true,
    indexes: [
      { accessor: 'by_account', algorithm: 'btree', columns: ['accountIdentity'] },
      { accessor: 'by_zone',    algorithm: 'btree', columns: ['zoneId'] },
    ],
  },
  {
    characterId:      t.u64().primaryKey().autoInc(),
    accountIdentity:  t.identity(),
    level:            t.u32(),
    xp:               t.u64(),
    zoneId:           t.u32(),
    posX:             t.f32(),
    posY:             t.f32(),
    currentHp:        t.i32(),
    currentMp:        t.i32(),
    alive:            t.bool(),
    createdAt:        t.timestamp(),
    diedAt:           t.option(t.timestamp()),
  },
);

/**
 * EquippedCard — the Hand: which cards are currently in the deck.
 * Scoped to a character (lost on death — cards themselves survive via cardInstance).
 * Changed only at a spirit (location spirit for high-rarity; personal spirit for minor).
 */
const equippedCard = table(
  {
    name: 'equipped_card',
    public: false,
    indexes: [{ accessor: 'by_character', algorithm: 'btree', columns: ['characterId'] }],
  },
  {
    equippedCardId:   t.u64().primaryKey().autoInc(),
    characterId:      t.u64(),
    cardInstanceId:   t.u64(),
    slotType:         TCardType,   // 'active' (max 10) or 'passive' (max 5)
    slotIndex:        t.u32(),     // 0-indexed within slot type
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

const db = schema({
  zone,
  cardDefinition,
  accountProgress,
  personalSpirit,
  cardInstance,
  character,
  equippedCard,
});

export default db;

// ═══════════════════════════════════════════════════════════════════════════════
// LIFECYCLE HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export const onConnect = db.clientConnected((ctx) => {
  // Ensure accountProgress row exists for new players on first connect.
  const existing = ctx.db.accountProgress.accountIdentity.find(ctx.sender);
  if (!existing) {
    ctx.db.accountProgress.insert({
      accountIdentity:      ctx.sender,
      totalXpAllLives:      0n,
      tutorialCompleted:    false,
      unlockedMilestoneIds: [],
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVATE REDUCER HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Find the caller's living character, or null. */
function activeCharacter(ctx: any) {
  const chars = [...ctx.db.character.by_account.filter(ctx.sender)];
  return chars.find((c: any) => c.alive) ?? null;
}

/** Default HP/MP for a fresh character at a given level (placeholder until gear system lands). */
function startingHp(level: number): number { return 100 + level * 15; }
function startingMp(level: number): number { return  50 + level * 8; }

// ═══════════════════════════════════════════════════════════════════════════════
// REDUCERS — character lifecycle
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * startLife — create a new character and (if needed) bond a personal spirit.
 * Called once for the very first life; also called after permadeath to start the next.
 * If the account has tutorialCompleted, the character starts at level 10.
 */
export const startLife = db.reducer(
  { spiritName: t.string(), startZoneId: t.u32() },
  (ctx, { spiritName, startZoneId }) => {
    if (activeCharacter(ctx)) throw new SenderError('Already has an active character');

    const progress = ctx.db.accountProgress.accountIdentity.find(ctx.sender);
    if (!progress) throw new SenderError('Account not initialised — reconnect to trigger onConnect');

    // Bond a spirit on first life; it persists forever after.
    const existingSpirit = ctx.db.personalSpirit.accountIdentity.find(ctx.sender);
    if (!existingSpirit) {
      ctx.db.personalSpirit.insert({
        accountIdentity: ctx.sender,
        name:     spiritName,
        level:    1,
        bondXp:   0n,
      });
    }

    const startLevel = progress.tutorialCompleted ? 10 : 1;
    ctx.db.character.insert({
      characterId:      0n,       // autoInc
      accountIdentity:  ctx.sender,
      level:            startLevel,
      xp:               0n,
      zoneId:           startZoneId,
      posX:             0,
      posY:             0,
      currentHp:        startingHp(startLevel),
      currentMp:        startingMp(startLevel),
      alive:            true,
      createdAt:        ctx.timestamp,
      diedAt:           undefined,
    });
  },
);

/**
 * move — update the active character's position.
 * Server trusts client position for the vertical slice;
 * add server-side validation (speed cap, wall collision) in a later pass.
 */
export const move = db.reducer(
  { x: t.f32(), y: t.f32() },
  (ctx, { x, y }) => {
    const char = activeCharacter(ctx);
    if (!char) throw new SenderError('No active character');
    ctx.db.character.characterId.update({ ...char, posX: x, posY: y });
  },
);

/**
 * grantXp — reward XP to the active character and accumulate to account total.
 * Typically called by server-side enemy-kill reducers (not directly by clients in prod).
 */
export const grantXp = db.reducer(
  { amount: t.u64() },
  (ctx, { amount }) => {
    const char = activeCharacter(ctx);
    if (!char) return;

    const newXp    = char.xp + amount;
    const newLevel = computeCharacterLevel(newXp);
    ctx.db.character.characterId.update({ ...char, xp: newXp, level: newLevel });

    // Always accumulate to account (never resets)
    const progress = ctx.db.accountProgress.accountIdentity.find(ctx.sender);
    if (progress) {
      ctx.db.accountProgress.accountIdentity.update({
        ...progress,
        totalXpAllLives: progress.totalXpAllLives + amount,
      });
    }
  },
);

/**
 * applyDamage — inflict damage on a target character.
 *
 * In the vertical slice this is called by the client (self-reporting or simple AI).
 * TODO v2: move damage application to server-side enemy AI reducers and validate
 *          that ctx.sender is an authorised source for this target.
 */
export const applyDamage = db.reducer(
  { targetCharacterId: t.u64(), rawDamage: t.i32() },
  (ctx, { targetCharacterId, rawDamage }) => {
    const char = ctx.db.character.characterId.find(targetCharacterId);
    if (!char || !char.alive) return;

    const newHp = char.currentHp - rawDamage;
    if (newHp <= 0) {
      _handleDeath(ctx, char);
    } else {
      ctx.db.character.characterId.update({ ...char, currentHp: newHp });
    }
  },
);

// ─── Internal: permadeath handler ─────────────────────────────────────────────

function _handleDeath(ctx: any, char: any): void {
  // 1. Mark character dead
  ctx.db.character.characterId.update({
    ...char,
    alive:    false,
    currentHp: 0,
    diedAt:   ctx.timestamp,
  });

  // 2. Clear the hand (equippedCard rows are character-scoped; cards themselves survive)
  const hand = [...ctx.db.equippedCard.by_character.filter(char.characterId)];
  for (const slot of hand) {
    ctx.db.equippedCard.equippedCardId.delete(slot.equippedCardId);
  }

  // Gear (ItemInstance) deletion goes here once the gear system is built.

  // 3. Card retention via spirit
  const spirit = ctx.db.personalSpirit.accountIdentity.find(char.accountIdentity);
  if (!spirit) {
    // No spirit bonded yet — lose all cards (extreme edge case)
    const allCards = [...ctx.db.cardInstance.by_owner.filter(char.accountIdentity)];
    for (const ci of allCards) {
      ctx.db.cardInstance.cardInstanceId.delete(ci.cardInstanceId);
    }
    return;
  }

  const slots = computeAttunementSlots(spirit.level);

  // JOIN: fetch rarity from cardDefinition for each cardInstance
  const cards: CardForRetention[] = [...ctx.db.cardInstance.by_owner.filter(char.accountIdentity)]
    .map((ci: any) => {
      const def = ctx.db.cardDefinition.cardDefId.find(ci.cardDefId);
      return {
        cardInstanceId: ci.cardInstanceId,
        rarity:         (def?.rarity.tag ?? 'common') as any,
        attuned:        ci.attuned,
      };
    });

  const { lost } = computeRetention(cards, slots);
  for (const id of lost) {
    ctx.db.cardInstance.cardInstanceId.delete(id);
  }

  // 4. Mark tutorial complete if applicable
  const progress = ctx.db.accountProgress.accountIdentity.find(char.accountIdentity);
  if (progress && char.level >= 10 && !progress.tutorialCompleted) {
    ctx.db.accountProgress.accountIdentity.update({
      ...progress,
      tutorialCompleted: true,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REDUCERS — spirit
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * sacrificeCard — destroy a card to gain bond XP for the personal spirit.
 * A weighty, permanent decision: more XP for rarer cards.
 */
export const sacrificeCard = db.reducer(
  { cardInstanceId: t.u64() },
  (ctx, { cardInstanceId }) => {
    const card = ctx.db.cardInstance.cardInstanceId.find(cardInstanceId);
    if (!card || !card.ownerIdentity.equals(ctx.sender))
      throw new SenderError('Card not found or not owned');

    const def = ctx.db.cardDefinition.cardDefId.find(card.cardDefId);
    if (!def) throw new SenderError('Card definition missing');

    const spirit = ctx.db.personalSpirit.accountIdentity.find(ctx.sender);
    if (!spirit) throw new SenderError('No spirit bonded');

    // Destroy the card first
    ctx.db.cardInstance.cardInstanceId.delete(cardInstanceId);

    // Level the spirit
    const xpGain   = SACRIFICE_XP[def.rarity.tag as keyof typeof SACRIFICE_XP] ?? 10n;
    const newBondXp = spirit.bondXp + xpGain;
    const newLevel  = computeSpiritLevel(newBondXp);
    ctx.db.personalSpirit.accountIdentity.update({ ...spirit, bondXp: newBondXp, level: newLevel });
  },
);

/**
 * toggleAttune — mark/unmark a card as "guaranteed to survive death".
 * Consumes one rarity-specific attunement slot on the spirit.
 * The player decides this BEFORE venturing out — no RNG, just preparation.
 */
export const toggleAttune = db.reducer(
  { cardInstanceId: t.u64() },
  (ctx, { cardInstanceId }) => {
    const card = ctx.db.cardInstance.cardInstanceId.find(cardInstanceId);
    if (!card || !card.ownerIdentity.equals(ctx.sender))
      throw new SenderError('Card not found or not owned');

    const def = ctx.db.cardDefinition.cardDefId.find(card.cardDefId);
    if (!def) throw new SenderError('Card definition missing');

    const spirit = ctx.db.personalSpirit.accountIdentity.find(ctx.sender);
    if (!spirit) throw new SenderError('No spirit bonded');

    if (!card.attuned) {
      // Check slot budget before allowing attunement
      const slots      = computeAttunementSlots(spirit.level);
      const rarityTag  = def.rarity.tag as keyof typeof slots;
      const slotMax    = slots[rarityTag];
      const allOwned   = [...ctx.db.cardInstance.by_owner.filter(ctx.sender)];
      const usedSlots  = allOwned.filter((ci: any) => {
        if (!ci.attuned || ci.cardInstanceId === cardInstanceId) return false;
        const d = ctx.db.cardDefinition.cardDefId.find(ci.cardDefId);
        return d?.rarity.tag === rarityTag;
      }).length;

      if (usedSlots >= slotMax)
        throw new SenderError(`No ${rarityTag} attunement slots remaining (spirit level ${spirit.level})`);
    }

    ctx.db.cardInstance.cardInstanceId.update({ ...card, attuned: !card.attuned });
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// REDUCERS — hand management
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * equipCard — place a card from the account's collection into the active Hand.
 *
 * Can only be done at a spirit (proximity check is a TODO for v2 — add
 * a zone/spirit check once SpiritDefinition and location spirits are built).
 * Slot caps are derived from spirit level (computeHandSlots).
 */
export const equipCard = db.reducer(
  { cardInstanceId: t.u64(), slotType: TCardType, slotIndex: t.u32() },
  (ctx, { cardInstanceId, slotType, slotIndex }) => {
    const char = activeCharacter(ctx);
    if (!char) throw new SenderError('No active character');

    const card = ctx.db.cardInstance.cardInstanceId.find(cardInstanceId);
    if (!card || !card.ownerIdentity.equals(ctx.sender))
      throw new SenderError('Card not found or not owned');

    const def = ctx.db.cardDefinition.cardDefId.find(card.cardDefId);
    if (!def) throw new SenderError('Card definition missing');

    // Enforce min character level
    if (def.minCharacterLevel > char.level)
      throw new SenderError(
        `Requires character level ${def.minCharacterLevel} (you are ${char.level})`
      );

    // Enforce hand slot cap (derived from spirit level)
    const spirit = ctx.db.personalSpirit.accountIdentity.find(ctx.sender);
    if (!spirit) throw new SenderError('No spirit bonded');

    const handSlots = computeHandSlots(spirit.level);
    const hand      = [...ctx.db.equippedCard.by_character.filter(char.characterId)];
    const tag       = slotType.tag as 'active' | 'passive';
    const count     = hand.filter((e: any) => e.slotType.tag === tag).length;
    const cap       = tag === 'active' ? handSlots.active : handSlots.passive;

    // Check if we're replacing an existing slot (doesn't count toward cap)
    const existingInSlot = hand.find(
      (e: any) => e.slotType.tag === tag && e.slotIndex === slotIndex
    );
    if (!existingInSlot && count >= cap)
      throw new SenderError(`${tag} hand is full (${count}/${cap} — spirit level ${spirit.level})`);

    // Remove whatever was in this slot
    if (existingInSlot) {
      ctx.db.equippedCard.equippedCardId.delete(existingInSlot.equippedCardId);
    }

    ctx.db.equippedCard.insert({
      equippedCardId: 0n,   // autoInc
      characterId:    char.characterId,
      cardInstanceId,
      slotType,
      slotIndex,
    });
  },
);

/**
 * unequipCard — remove a card from the Hand back to the collection.
 * Also only allowed at a spirit (TODO: add proximity check in v2).
 */
export const unequipCard = db.reducer(
  { equippedCardId: t.u64() },
  (ctx, { equippedCardId }) => {
    const char = activeCharacter(ctx);
    if (!char) throw new SenderError('No active character');

    const slot = ctx.db.equippedCard.equippedCardId.find(equippedCardId);
    if (!slot || slot.characterId !== char.characterId)
      throw new SenderError('Equipped card not found on this character');

    ctx.db.equippedCard.equippedCardId.delete(equippedCardId);
  },
);
