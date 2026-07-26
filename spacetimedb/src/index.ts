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
 * card collection, equipped hand, move, damage, permadeath, card retention, enemies.
 * Gear, location spirits, groups, dungeons, and sets are deferred to v2.
 */

import { schema, table, t } from 'spacetimedb/server';
import { SenderError } from 'spacetimedb/server';
import { ScheduleAt } from 'spacetimedb';

// @ts-ignore — JSON import resolved by esbuild; loader.ts (node:fs) is tree-shaken from this bundle
import cardsJson from '../../content/cards.json';
import { parseCards } from '../../content/validate';

// @ts-ignore — JSON import resolved by esbuild; the node:fs path in validateEquipment.ts
// (loadEquipment) is tree-shaken from this bundle since only parseEquipment is used here.
import equipmentJson from '../../content/equipment.json';
import { parseEquipment } from '../../content/validateEquipment';

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
const TAggroState  = t.enum('AggroState',  { idle: t.unit(), chasing: t.unit(), casting: t.unit(), cooldown: t.unit(), resetting: t.unit() });
const TArmorWeight = t.enum('ArmorWeight', { cloth: t.unit(), chain: t.unit(), plate: t.unit() });
const TItemCategory = t.enum('ItemCategory', {
  equipment: t.unit(), consumable: t.unit(), material: t.unit(),
  quest: t.unit(), revival: t.unit(), dungeon_key: t.unit(),
});
const TEquipSlot = t.enum('EquipSlot', {
  head: t.unit(), chest: t.unit(), hands: t.unit(), legs: t.unit(), boots: t.unit(),
  main_hand: t.unit(), off_hand: t.unit(), necklace: t.unit(), ring: t.unit(), earring: t.unit(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT TABLES  (static game data — written by tooling, read by everyone)
// ═══════════════════════════════════════════════════════════════════════════════

const zone = table(
  { name: 'zone', public: true },
  {
    zoneId:           t.u32().primaryKey(),
    name:             t.string(),
    minLevel:         t.u32(),
    recommendedLevel: t.u32(),
    maxLevel:         t.u32(),
    description:      t.string(),
  },
);

const cardDefinition = table(
  {
    name: 'card_definition',
    public: true,
    indexes: [{ accessor: 'slug', algorithm: 'btree', columns: ['slug'] }],
    constraints: [{ name: 'card_definition_slug_key', constraint: 'unique', columns: ['slug'] }],
  },
  {
    cardDefId:          t.u32().primaryKey(),
    slug:               t.string(),
    name:               t.string(),
    rarity:             TRarity,
    cardType:           TCardType,
    passiveKind:        TPassiveKind,
    scalingSchool:      TSchool,
    baseShape:          TShape,
    basePower:          t.f32(),
    baseCooldown:       t.f32(),
    mpCost:             t.i32(),
    minCharacterLevel:  t.u32(),
    flavor:             t.string(),
  },
);

const itemDefinition = table(
  {
    name: 'item_definition',
    public: true,
    indexes: [{ accessor: 'slug', algorithm: 'btree', columns: ['slug'] }],
    constraints: [{ name: 'item_definition_slug_key', constraint: 'unique', columns: ['slug'] }],
  },
  {
    itemDefId:      t.u64().primaryKey().autoInc(),
    slug:           t.string(),
    name:           t.string(),
    rarity:         TRarity,
    category:       TItemCategory,
    slot:           t.option(TEquipSlot),      // null unless EQUIPMENT
    armorWeight:    t.option(TArmorWeight),    // armor pieces only
    weaponSchool:   t.option(TSchool),         // main_hand weapons only
    geometryShape:  t.option(TShape),          // main_hand weapons only
    geometryWidth:  t.option(t.f32()),         // main_hand weapons only
    geometryRange:  t.option(t.f32()),         // main_hand weapons only
    statModifiers:  TStatBlock,                // additive stats this item grants
    flavor:         t.string(),
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNT-LEVEL TABLES  (survive permadeath)
// ═══════════════════════════════════════════════════════════════════════════════

const accountProgress = table(
  { name: 'account_progress', public: true },
  {
    accountIdentity:       t.identity().primaryKey(),
    totalXpAllLives:       t.u64(),
    tutorialCompleted:     t.bool(),
    unlockedMilestoneIds:  t.array(t.u32()),
  },
);

const personalSpirit = table(
  { name: 'personal_spirit', public: true },
  {
    accountIdentity:  t.identity().primaryKey(),
    name:             t.string(),
    level:            t.u32(),
    bondXp:           t.u64(),
  },
);

const cardInstance = table(
  {
    name: 'card_instance',
    public: true,
    indexes: [{ accessor: 'by_owner', algorithm: 'btree', columns: ['ownerIdentity'] }],
  },
  {
    cardInstanceId:  t.u64().primaryKey().autoInc(),
    ownerIdentity:   t.identity(),
    cardDefId:       t.u32(),
    mergeLevel:      t.u32(),
    attuned:         t.bool(),
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// CHARACTER-LEVEL TABLES  (lost on permadeath)
// ═══════════════════════════════════════════════════════════════════════════════

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

const equippedCard = table(
  {
    name: 'equipped_card',
    public: true,
    indexes: [
      { accessor: 'by_character', algorithm: 'btree', columns: ['characterId'] },
    ],
  },
  {
    equippedCardId:   t.u64().primaryKey().autoInc(),
    characterId:      t.u64(),
    cardInstanceId:   t.u64(),
    slotType:         TCardType,
    slotIndex:        t.u32(),
  },
);

/** Physical item owned by a CHARACTER (not account) — destroyed on death, the body. */
const itemInstance = table(
  {
    name: 'item_instance',
    public: false,
    indexes: [{ accessor: 'by_character', algorithm: 'btree', columns: ['ownerCharacterId'] }],
  },
  {
    itemInstanceId:    t.u64().primaryKey().autoInc(),
    ownerCharacterId:  t.u64(),
    itemDefId:         t.u64(),
    quantity:          t.u32(),   // 1 for equipment, stackable for consumables
  },
);

const equippedItem = table(
  {
    name: 'equipped_item',
    public: false,
    indexes: [{ accessor: 'by_character', algorithm: 'btree', columns: ['characterId'] }],
  },
  {
    equippedItemId:  t.u64().primaryKey().autoInc(),
    characterId:     t.u64(),
    itemInstanceId:  t.u64(),
    slot:            TEquipSlot,
    slotOrdinal:     t.u32(),   // 0/1 for the two rings & two earrings
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// LOOT TABLES
// ═══════════════════════════════════════════════════════════════════════════════

/** Ground drop — spawned on enemy death, despawned after 60 s or on pickup. */
const cardDrop = table(
  {
    name: 'card_drop',
    public: true,
    indexes: [{ accessor: 'by_zone', algorithm: 'btree', columns: ['zoneId'] }],
  },
  {
    dropId:    t.u64().primaryKey().autoInc(),
    cardDefId: t.u32(),
    zoneId:    t.u32(),
    posX:      t.f32(),
    posY:      t.f32(),
    createdAt: t.timestamp(),
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// ENEMY TABLES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Enemy — server-authoritative mob state.
 * Chases players within aggro range, casts a telegraphed AoE in attack range,
 * and resets back to its spawn point (healing as it goes) if it loses its target.
 * spawnX/spawnY stores the original position so the respawn/reset logic can reset.
 */
const enemy = table(
  {
    name: 'enemy',
    public: true,
    indexes: [
      { accessor: 'by_zone', algorithm: 'btree', columns: ['zoneId'] },
    ],
  },
  {
    enemyId:               t.u64().primaryKey().autoInc(),
    zoneId:                t.u32(),
    posX:                  t.f32(),
    posY:                  t.f32(),
    spawnX:                t.f32(),
    spawnY:                t.f32(),
    currentHp:             t.i32(),
    maxHp:                 t.i32(),
    alive:                 t.bool(),
    damagePerHit:          t.i32(),
    attackRangePx:         t.f32(),
    attackCooldownSeconds: t.f32(),
    lastAttackAt:          t.option(t.timestamp()),
    aggroState:            TAggroState,
    targetCharacterId:     t.option(t.u64()),
    lastSeenTargetAt:      t.option(t.timestamp()),
    castStartedAt:         t.option(t.timestamp()),
    castDurationSeconds:   t.f32(),
    castShape:             TShape,
    castDamage:            t.i32(),
  },
);

// Row schema for card-drop cleanup schedule
const cardDropCleanupRow = t.row({
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
});

// Fires every 10 s; deletes drops older than 60 s.
const cardDropCleanupSchedule = table(
  { name: 'card_drop_cleanup_schedule', scheduled: () => cardDropCleanup },
  cardDropCleanupRow,
);

// Row schemas extracted to break the forward/backward type-reference cycle:
// table references reducer (via thunk), reducer references row schema (explicit).
// Using the same RowBuilder object for both ensures the SDK deduplicates the type
// and produces (0: &N) in the module definition — which is what SpacetimeDB expects.
const enemyTickRow = t.row({
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
});
const enemyRespawnRow = t.row({
  scheduledId: t.u64().primaryKey().autoInc(),
  scheduledAt: t.scheduleAt(),
  enemyId:     t.u64(),
});

// Repeating schedule: fires enemyTick every 500 ms (Interval keeps the row alive).
const enemyTickSchedule = table(
  { name: 'enemy_tick_schedule', scheduled: () => enemyTick },
  enemyTickRow,
);

// One-shot schedule: fires respawnEnemy once 15 s after enemy death (Time deletes row after fire).
const enemyRespawnSchedule = table(
  { name: 'enemy_respawn_schedule', scheduled: () => respawnEnemy },
  enemyRespawnRow,
);

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

const db = schema({
  zone,
  cardDefinition,
  itemDefinition,
  accountProgress,
  personalSpirit,
  cardInstance,
  character,
  equippedCard,
  itemInstance,
  equippedItem,
  cardDrop,
  enemy,
  enemyTickSchedule,
  enemyRespawnSchedule,
  cardDropCleanupSchedule,
});

export default db;

// Validate card data at module load — module refuses to start if cards.json is invalid.
// In Node.js contexts use loadCards() from content/validate; here we bundle the JSON statically.
const CARD_DEFS = parseCards(cardsJson as unknown[]);

// Validate equipment data at module load — module refuses to start if equipment.json is invalid.
const ITEM_DEFS = parseEquipment(equipmentJson as unknown[]);

// An item's `stats` in equipment.json is a partial StatBlock (only the fields it grants).
// Missing fields default to 0 — these are additive MODIFIERS, not a character's base stats,
// so (unlike a fresh character) an absent multiplier field means "no change", not "1.0".
const ZERO_STAT_MODIFIERS: StatBlock = {
  power: 0, knowledge: 0, health: 0, will: 0, agility: 0, precision: 0,
  maxHp: 0, hpRegen: 0, maxMp: 0, mpRegen: 0, moveSpeed: 0,
  weaponDamage: 0, physicalAttack: 0, magicAttack: 0,
  attackSpeed: 0, castingSpeed: 0,
  physicalCrit: 0, magicCrit: 0, accuracy: 0, magicAccuracy: 0, healingBoost: 0,
  physicalDef: 0, magicDef: 0, evasion: 0, parry: 0, block: 0, magicResist: 0,
};

// ═══════════════════════════════════════════════════════════════════════════════
// LIFECYCLE HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export const onConnect = db.clientConnected((ctx) => {
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

/** Runs once when the module is first published. Seeds cards/items + enemies and starts the damage ticker. */
export const init = db.init((ctx) => {
  _doSeedCards(ctx);
  _doSeedItems(ctx);
  _seedZone1Enemies(ctx);
  ctx.db.enemyTickSchedule.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.interval(500_000n),     // fire every 500 ms
  });
  ctx.db.cardDropCleanupSchedule.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.interval(10_000_000n),  // fire every 10 s
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REDUCERS — card seeding
// ═══════════════════════════════════════════════════════════════════════════════

function _doSeedCards(ctx: any): void {
  let inserted = 0;
  let updated  = 0;

  for (let i = 0; i < CARD_DEFS.length; i++) {
    const card      = CARD_DEFS[i];
    const cardDefId = i + 1;  // stable 1-based ID; slug is the idempotency key

    const rowData = {
      slug:              card.slug,
      name:              card.name,
      rarity:            { tag: card.rarity },
      cardType:          { tag: card.type },
      passiveKind:       { tag: card.passiveKind ?? 'none' },
      scalingSchool:     { tag: card.school },
      baseShape:         { tag: card.shape },
      basePower:         card.basePower,
      baseCooldown:      card.cooldownSeconds,
      mpCost:            card.mpCost,
      minCharacterLevel: card.minLevel,
      flavor:            card.flavor,
    };

    const existing = ctx.db.cardDefinition.slug.find(card.slug);
    if (existing) {
      ctx.db.cardDefinition.cardDefId.update({ cardDefId: existing.cardDefId, ...rowData });
      updated++;
    } else {
      ctx.db.cardDefinition.insert({ cardDefId, ...rowData });
      inserted++;
    }
  }

  console.log(`[seedCards] ${inserted} inserted, ${updated} updated`);
}

/**
 * seedCards — upserts all cards from content/cards.json into cardDefinition.
 * TODO: restrict to module owner identity before shipping to production.
 */
export const seedCards = db.reducer(
  {},
  (ctx) => { _doSeedCards(ctx); },
);

// ═══════════════════════════════════════════════════════════════════════════════
// REDUCERS — item seeding
// ═══════════════════════════════════════════════════════════════════════════════

function _doSeedItems(ctx: any): void {
  let inserted = 0;
  let updated  = 0;

  for (const item of ITEM_DEFS) {
    const rowData = {
      slug:           item.slug,
      name:           item.name,
      rarity:         { tag: item.rarity },
      category:       { tag: item.category },
      slot:           item.slot          ? { tag: item.slot }          : undefined,
      armorWeight:    item.armorWeight   ? { tag: item.armorWeight }   : undefined,
      weaponSchool:   item.weaponSchool  ? { tag: item.weaponSchool }  : undefined,
      geometryShape:  item.geometryShape ? { tag: item.geometryShape } : undefined,
      geometryWidth:  item.geometryWidth  ?? undefined,
      geometryRange:  item.geometryRange  ?? undefined,
      statModifiers:  { ...ZERO_STAT_MODIFIERS, ...item.stats },
      flavor:         item.flavor,
    };

    const existing = ctx.db.itemDefinition.slug.find(item.slug);
    if (existing) {
      ctx.db.itemDefinition.itemDefId.update({ itemDefId: existing.itemDefId, ...rowData });
      updated++;
    } else {
      ctx.db.itemDefinition.insert({ itemDefId: 0n, ...rowData });
      inserted++;
    }
  }

  console.log(`[seedItems] ${inserted} inserted, ${updated} updated`);
}

/**
 * seedItems — upserts all items from content/equipment.json into itemDefinition.
 * TODO: restrict to module owner identity before shipping to production.
 */
export const seedItems = db.reducer(
  {},
  (ctx) => { _doSeedItems(ctx); },
);

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVATE REDUCER HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function activeCharacter(ctx: any) {
  const chars = [...ctx.db.character.by_account.filter(ctx.sender)];
  return chars.find((c: any) => c.alive) ?? null;
}

function startingHp(level: number): number { return 100 + level * 15; }
function startingMp(level: number): number { return  50 + level * 8; }

function _seedZone1Enemies(ctx: any): void {
  const TILE = 48;
  const half = TILE / 2;
  const spawns = [
    { x: 10 * TILE + half, y: 8 * TILE + half },
    { x: 30 * TILE + half, y: 8 * TILE + half },
    { x: 50 * TILE + half, y: 8 * TILE + half },
  ];
  for (const pos of spawns) {
    ctx.db.enemy.insert({
      enemyId:               0n,
      zoneId:                1,
      posX:                  pos.x,
      posY:                  pos.y,
      spawnX:                pos.x,
      spawnY:                pos.y,
      currentHp:             100,
      maxHp:                 100,
      alive:                 true,
      damagePerHit:          8,
      attackRangePx:         220,
      attackCooldownSeconds: 3.0,
      lastAttackAt:          undefined,
      aggroState:            { tag: 'idle' },
      targetCharacterId:     undefined,
      lastSeenTargetAt:      undefined,
      castStartedAt:         undefined,
      castDurationSeconds:   1.8,
      castShape:             { tag: 'circle' },
      castDamage:            15,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REDUCERS — character lifecycle
// ═══════════════════════════════════════════════════════════════════════════════

export const startLife = db.reducer(
  { spiritName: t.string(), startZoneId: t.u32() },
  (ctx, { spiritName, startZoneId }) => {
    if (activeCharacter(ctx)) throw new SenderError('Already has an active character');

    const progress = ctx.db.accountProgress.accountIdentity.find(ctx.sender);
    if (!progress) throw new SenderError('Account not initialised — reconnect to trigger onConnect');

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
      characterId:      0n,
      accountIdentity:  ctx.sender,
      level:            startLevel,
      xp:               0n,
      zoneId:           startZoneId,
      posX:             480,   // tile (10,8) — first enemy spawn area, grass
      posY:             432,
      currentHp:        startingHp(startLevel),
      currentMp:        startingMp(startLevel),
      alive:            true,
      createdAt:        ctx.timestamp,
      diedAt:           undefined,
    });

    // First-ever life: grant the tutorial starting hand (1 active card, auto-equipped).
    // On subsequent lives the player re-equips surviving attuned cards at a spirit.
    const ownedCards = [...ctx.db.cardInstance.by_owner.filter(ctx.sender)];
    if (ownedCards.length === 0) {
      const emberDef = ctx.db.cardDefinition.slug.find('ember-strike');
      if (emberDef) {
        ctx.db.cardInstance.insert({
          cardInstanceId: 0n,
          ownerIdentity:  ctx.sender,
          cardDefId:      emberDef.cardDefId,
          mergeLevel:     0,
          attuned:        false,
        });
        // Query back to get the autoInc ID for both the character and card instance.
        const newChar = [...ctx.db.character.by_account.filter(ctx.sender)].find((c: any) => c.alive);
        const newCard = [...ctx.db.cardInstance.by_owner.filter(ctx.sender)]
          .find((ci: any) => ci.cardDefId === emberDef.cardDefId);
        if (newChar && newCard) {
          ctx.db.equippedCard.insert({
            equippedCardId: 0n,
            characterId:    (newChar as any).characterId,
            cardInstanceId: (newCard as any).cardInstanceId,
            slotType:       { tag: 'active' },
            slotIndex:      0,
          });
        }
      }
    }
  },
);

export const move = db.reducer(
  { x: t.f32(), y: t.f32() },
  (ctx, { x, y }) => {
    const char = activeCharacter(ctx);
    if (!char) throw new SenderError('No active character');
    ctx.db.character.characterId.update({ ...char, posX: x, posY: y });
  },
);

export const grantXp = db.reducer(
  { amount: t.u64() },
  (ctx, { amount }) => {
    const char = activeCharacter(ctx);
    if (!char) return;

    const newXp    = char.xp + amount;
    const newLevel = computeCharacterLevel(newXp);
    ctx.db.character.characterId.update({ ...char, xp: newXp, level: newLevel });

    const progress = ctx.db.accountProgress.accountIdentity.find(ctx.sender);
    if (progress) {
      ctx.db.accountProgress.accountIdentity.update({
        ...progress,
        totalXpAllLives: progress.totalXpAllLives + amount,
      });
    }
  },
);

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
  ctx.db.character.characterId.update({
    ...char,
    alive:    false,
    currentHp: 0,
    diedAt:   ctx.timestamp,
  });

  const hand = [...ctx.db.equippedCard.by_character.filter(char.characterId)];
  for (const slot of hand) {
    ctx.db.equippedCard.equippedCardId.delete(slot.equippedCardId);
  }

  const spirit = ctx.db.personalSpirit.accountIdentity.find(char.accountIdentity);
  if (!spirit) {
    const allCards = [...ctx.db.cardInstance.by_owner.filter(char.accountIdentity)];
    for (const ci of allCards) {
      ctx.db.cardInstance.cardInstanceId.delete(ci.cardInstanceId);
    }
    return;
  }

  const slots = computeAttunementSlots(spirit.level);
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

    ctx.db.cardInstance.cardInstanceId.delete(cardInstanceId);

    const xpGain   = SACRIFICE_XP[def.rarity.tag as keyof typeof SACRIFICE_XP] ?? 10n;
    const newBondXp = spirit.bondXp + xpGain;
    const newLevel  = computeSpiritLevel(newBondXp);
    ctx.db.personalSpirit.accountIdentity.update({ ...spirit, bondXp: newBondXp, level: newLevel });
  },
);

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

    if (def.minCharacterLevel > char.level)
      throw new SenderError(
        `Requires character level ${def.minCharacterLevel} (you are ${char.level})`
      );

    const spirit = ctx.db.personalSpirit.accountIdentity.find(ctx.sender);
    if (!spirit) throw new SenderError('No spirit bonded');

    const handSlots = computeHandSlots(spirit.level);
    const hand      = [...ctx.db.equippedCard.by_character.filter(char.characterId)];
    const tag       = slotType.tag as 'active' | 'passive';
    const count     = hand.filter((e: any) => e.slotType.tag === tag).length;
    const cap       = tag === 'active' ? handSlots.active : handSlots.passive;

    const existingInSlot = hand.find(
      (e: any) => e.slotType.tag === tag && e.slotIndex === slotIndex
    );
    if (!existingInSlot && count >= cap)
      throw new SenderError(`${tag} hand is full (${count}/${cap} — spirit level ${spirit.level})`);

    if (existingInSlot) {
      ctx.db.equippedCard.equippedCardId.delete(existingInSlot.equippedCardId);
    }

    ctx.db.equippedCard.insert({
      equippedCardId: 0n,
      characterId:    char.characterId,
      cardInstanceId,
      slotType,
      slotIndex,
    });
  },
);

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

// ═══════════════════════════════════════════════════════════════════════════════
// REDUCERS — enemy combat
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * spawnEnemy — insert one enemy at a given world position.
 * Useful for testing; seeding is handled by init().
 */
export const spawnEnemy = db.reducer(
  { zoneId: t.u32(), x: t.f32(), y: t.f32() },
  (ctx, { zoneId, x, y }) => {
    ctx.db.enemy.insert({
      enemyId:               0n,
      zoneId,
      posX:                  x,
      posY:                  y,
      spawnX:                x,
      spawnY:                y,
      currentHp:             100,
      maxHp:                 100,
      alive:                 true,
      damagePerHit:          8,
      attackRangePx:         220,
      attackCooldownSeconds: 3.0,
      lastAttackAt:          undefined,
      aggroState:            { tag: 'idle' },
      targetCharacterId:     undefined,
      lastSeenTargetAt:      undefined,
      castStartedAt:         undefined,
      castDurationSeconds:   1.8,
      castShape:             { tag: 'circle' },
      castDamage:            15,
    });
  },
);

/**
 * damageEnemy — apply player-initiated damage to an enemy.
 * Client sends enemyId + damage amount after confirming a geometric hit locally.
 * Server validates that the caller is alive and in the same zone.
 */
export const damageEnemy = db.reducer(
  { enemyId: t.u64(), damage: t.i32(), school: TSchool },
  (ctx, { enemyId, damage }) => {
    const char = activeCharacter(ctx);
    if (!char) throw new SenderError('No active character');

    const e = ctx.db.enemy.enemyId.find(enemyId);
    if (!e || !e.alive) return;
    if (e.zoneId !== char.zoneId) throw new SenderError('Enemy not in same zone');

    const newHp = e.currentHp - damage;
    if (newHp <= 0) {
      ctx.db.enemy.enemyId.update({ ...e, currentHp: 0, alive: false });
      // Schedule respawn 15 s from now
      ctx.db.enemyRespawnSchedule.insert({
        scheduledId: 0n,
        scheduledAt: ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch + 15_000_000n),
        enemyId:     e.enemyId,
      });
      // Roll a card drop (70% chance)
      _dropCardFromEnemy(ctx, e, char);
    } else {
      ctx.db.enemy.enemyId.update({ ...e, currentHp: newHp });
    }
  },
);

/** Roll a ground card drop when an enemy dies. 70% chance, random eligible card. */
function _dropCardFromEnemy(ctx: any, e: any, char: any): void {
  if (ctx.random() >= 0.7) return;
  const allDefs  = [...ctx.db.cardDefinition];
  const eligible = allDefs.filter((def: any) => def.minCharacterLevel <= char.level);
  if (eligible.length === 0) return;
  const def = eligible[ctx.random.integerInRange(0, eligible.length - 1)];
  ctx.db.cardDrop.insert({
    dropId:    0n,
    cardDefId: def.cardDefId,
    zoneId:    e.zoneId,
    posX:      e.posX,
    posY:      e.posY,
    createdAt: ctx.timestamp,
  });
}

/** pickupCard — player picks up a ground drop within 80 px. */
export const pickupCard = db.reducer(
  { dropId: t.u64() },
  (ctx, { dropId }) => {
    const char = activeCharacter(ctx);
    if (!char) throw new SenderError('No active character');

    const drop = ctx.db.cardDrop.dropId.find(dropId);
    if (!drop) throw new SenderError('Drop not found');
    if (drop.zoneId !== char.zoneId) throw new SenderError('Drop not in same zone');

    const dx = char.posX - drop.posX;
    const dy = char.posY - drop.posY;
    if (dx * dx + dy * dy > 80 * 80) throw new SenderError('Too far from drop');

    ctx.db.cardInstance.insert({
      cardInstanceId: 0n,
      ownerIdentity:  ctx.sender,
      cardDefId:      drop.cardDefId,
      mergeLevel:     0,
      attuned:        false,
    });
    ctx.db.cardDrop.dropId.delete(dropId);

    const def = ctx.db.cardDefinition.cardDefId.find(drop.cardDefId);
    console.log(`[pickup] ${def?.name ?? '?'} → ${ctx.sender.toHexString().slice(0, 8)}...`);
  },
);

/** cardDropCleanup — runs every 10 s, deletes drops older than 60 s. */
export const cardDropCleanup = db.reducer(
  { scheduleRow: cardDropCleanupRow },
  (ctx, _args: any) => {
    const maxAgeUs = 60_000_000n;
    for (const drop of ctx.db.cardDrop) {
      if (ctx.timestamp.microsSinceUnixEpoch - drop.createdAt.microsSinceUnixEpoch >= maxAgeUs) {
        ctx.db.cardDrop.dropId.delete(drop.dropId);
      }
    }
  },
);

// ─── Chase AI tuning constants ────────────────────────────────────────────────
const AGGRO_RANGE       = 300;  // px — enemy notices a player and starts chasing
const ATTACK_RANGE      = 180;  // px — enemy stops and starts casting
const DEAGGRO_RANGE     = 500;  // px — player has escaped, enemy resets
const CHASE_SPEED       = 110;  // px/s — always slower than the player's 180 px/s
const RESET_SPEED       = 80;   // px/s — walking back to spawn
const RESET_HP_PER_TICK = 10;   // HP restored per tick while resetting
const TICK_SECONDS      = 0.5;  // enemyTick fires every 500 ms

function _distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Step at most `maxStep` px from (fromX,fromY) toward (toX,toY); snaps if closer than that. */
function _moveToward(fromX: number, fromY: number, toX: number, toY: number, maxStep: number) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= maxStep) return { x: toX, y: toY };
  return { x: fromX + (dx / dist) * maxStep, y: fromY + (dy / dist) * maxStep };
}

/** Closest alive character in the enemy's zone within AGGRO_RANGE, or null. */
function _findAggroTarget(ctx: any, zoneId: number, posX: number, posY: number): any | null {
  let closest: any = null;
  let closestD2 = AGGRO_RANGE * AGGRO_RANGE;
  for (const c of [...ctx.db.character.by_zone.filter(zoneId)]) {
    if (!(c as any).alive) continue;
    const d2 = _distSq(posX, posY, (c as any).posX, (c as any).posY);
    if (d2 <= closestD2) { closest = c; closestD2 = d2; }
  }
  return closest;
}

/** Fire the telegraphed AoE: damage every alive character still within attackRangePx. */
function _fireCast(ctx: any, e: any): void {
  for (const c of [...ctx.db.character.by_zone.filter(e.zoneId)]) {
    if (!(c as any).alive) continue;
    if (_distSq((c as any).posX, (c as any).posY, e.posX, e.posY) > e.attackRangePx * e.attackRangePx) continue;
    const newHp = (c as any).currentHp - e.castDamage;
    if (newHp <= 0) {
      _handleDeath(ctx, c);
    } else {
      ctx.db.character.characterId.update({ ...(c as any), currentHp: newHp });
    }
  }
}

/**
 * enemyTick — runs every 500 ms (Interval schedule, row never deleted).
 * Drives a five-state aggro machine per enemy:
 *   idle → chasing → casting → cooldown → (chasing | casting) or resetting → idle
 * Damage fires only after castDurationSeconds, hitting every character in the AoE.
 */
export const enemyTick = db.reducer(
  { scheduleRow: enemyTickRow },
  (ctx, _args: any) => {
    for (const e of ctx.db.enemy) {
      if (!e.alive) continue;

      const state = e.aggroState.tag as 'idle' | 'chasing' | 'casting' | 'cooldown' | 'resetting';

      if (state === 'idle') {
        const target = _findAggroTarget(ctx, e.zoneId, e.posX, e.posY);
        if (target) {
          ctx.db.enemy.enemyId.update({
            ...e,
            aggroState:        { tag: 'chasing' },
            targetCharacterId: (target as any).characterId,
          });
        }

      } else if (state === 'chasing') {
        const target = e.targetCharacterId !== undefined
          ? ctx.db.character.characterId.find(e.targetCharacterId)
          : null;

        if (!target || !target.alive) {
          ctx.db.enemy.enemyId.update({
            ...e,
            aggroState:        { tag: 'resetting' },
            targetCharacterId: undefined,
          });
          continue;
        }

        const d2 = _distSq(e.posX, e.posY, target.posX, target.posY);
        if (d2 > DEAGGRO_RANGE * DEAGGRO_RANGE) {
          ctx.db.enemy.enemyId.update({
            ...e,
            aggroState:       { tag: 'resetting' },
            lastSeenTargetAt: ctx.timestamp,
          });
        } else if (d2 <= ATTACK_RANGE * ATTACK_RANGE) {
          ctx.db.enemy.enemyId.update({
            ...e,
            aggroState:    { tag: 'casting' },
            castStartedAt: ctx.timestamp,
          });
        } else {
          const step = CHASE_SPEED * TICK_SECONDS;
          const { x, y } = _moveToward(e.posX, e.posY, target.posX, target.posY, step);
          ctx.db.enemy.enemyId.update({ ...e, posX: x, posY: y });
        }

      } else if (state === 'casting') {
        // Check whether the cast duration has elapsed
        if (e.castStartedAt === undefined) continue;
        const elapsedUs  = ctx.timestamp.microsSinceUnixEpoch - e.castStartedAt.microsSinceUnixEpoch;
        const durationUs = BigInt(Math.round(e.castDurationSeconds * 1_000_000));
        if (elapsedUs >= durationUs) {
          _fireCast(ctx, e);
          ctx.db.enemy.enemyId.update({
            ...e,
            aggroState:    { tag: 'cooldown' },
            castStartedAt: undefined,
            lastAttackAt:  ctx.timestamp,
          });
        }

      } else if (state === 'cooldown') {
        const target = e.targetCharacterId !== undefined
          ? ctx.db.character.characterId.find(e.targetCharacterId)
          : null;

        if (!target || !target.alive) {
          ctx.db.enemy.enemyId.update({
            ...e,
            aggroState:        { tag: 'resetting' },
            targetCharacterId: undefined,
          });
          continue;
        }

        if (_distSq(e.posX, e.posY, target.posX, target.posY) > ATTACK_RANGE * ATTACK_RANGE) {
          // Target moved out of attack range mid-cooldown — re-engage by chasing.
          ctx.db.enemy.enemyId.update({ ...e, aggroState: { tag: 'chasing' } });
          continue;
        }

        // Still in range: return to idle-cooldown-wait, then recast once the timer elapses.
        if (e.lastAttackAt === undefined) continue;
        const elapsedUs  = ctx.timestamp.microsSinceUnixEpoch - e.lastAttackAt.microsSinceUnixEpoch;
        const cooldownUs = BigInt(Math.round(e.attackCooldownSeconds * 1_000_000));
        if (elapsedUs >= cooldownUs) {
          ctx.db.enemy.enemyId.update({
            ...e,
            aggroState:    { tag: 'casting' },
            castStartedAt: ctx.timestamp,
          });
        }

      } else if (state === 'resetting') {
        const step = RESET_SPEED * TICK_SECONDS;
        const { x, y } = _moveToward(e.posX, e.posY, e.spawnX, e.spawnY, step);
        const newHp = Math.min(e.maxHp, e.currentHp + RESET_HP_PER_TICK);

        const reAggro = _findAggroTarget(ctx, e.zoneId, x, y);
        if (reAggro) {
          ctx.db.enemy.enemyId.update({
            ...e,
            posX: x, posY: y, currentHp: newHp,
            aggroState:        { tag: 'chasing' },
            targetCharacterId: (reAggro as any).characterId,
          });
        } else if (x === e.spawnX && y === e.spawnY) {
          ctx.db.enemy.enemyId.update({
            ...e,
            posX: x, posY: y, currentHp: e.maxHp,
            aggroState:        { tag: 'idle' },
            targetCharacterId: undefined,
          });
        } else {
          ctx.db.enemy.enemyId.update({ ...e, posX: x, posY: y, currentHp: newHp });
        }
      }
    }
  },
);

/**
 * respawnEnemy — fired once 15 s after an enemy dies.
 * Restores the enemy to full HP at its spawn position.
 */
export const respawnEnemy = db.reducer(
  { scheduleRow: enemyRespawnRow },
  (ctx, args: any) => {
    const { enemyId } = args.scheduleRow;
    const e = ctx.db.enemy.enemyId.find(enemyId);
    if (!e || e.alive) return;
    ctx.db.enemy.enemyId.update({
      ...e,
      currentHp:         e.maxHp,
      alive:              true,
      posX:               e.spawnX,
      posY:               e.spawnY,
      lastAttackAt:       undefined,
      aggroState:         { tag: 'idle' },
      targetCharacterId:  undefined,
      lastSeenTargetAt:   undefined,
      castStartedAt:      undefined,
    });
  },
);
