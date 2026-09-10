// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

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

// @ts-ignore — JSON import resolved by esbuild; the node:fs path in configLoader.ts
// is tree-shaken from this bundle since only parseConfig is used here.
import configJson from '../../content/config.json';
import { parseConfig } from '../../content/validateConfig';

// @ts-ignore — JSON import resolved by esbuild; zonesLoader.ts (node:fs) is tree-shaken from this bundle
import zonesJson from '../../content/zones.json';
import { parseZones } from '../../content/validateZones';

import {
  computeSpiritLevel,
  computeAttunementSlots,
  computeHandSlots,
  computeCharacterLevel,
  computeRetention,
  canSpiritHandle,
  rarityCeilingError,
  SACRIFICE_XP,
  type CardForRetention,
} from './rules/death';
import { computeKillXpReward } from './rules/leveling';

import { resolveHit, resolveHeal } from './rules/combat';
import { EMPTY_STAT_BLOCK, type StatBlock } from './types';
import { computeEffectiveStats, computeRaceBase } from './rules/stats';
import { pickWeightedRarity, pickLevelAndRarityGated } from './rules/drops';
import {
  distSq,
  findClosestInRange,
  decideChasing,
  hasCastElapsed,
  decideCooldown,
  decideResetting,
  type AggroCandidate,
} from './rules/enemyAi';
import {
  realizes,
  concerns,
  SwTraceables,
  ConTraceables,
  ArchTraceables,
  SysTraceables,
} from '../../src/clew/traceables/clew';

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER CONFIG  (owned by the server OPERATOR — content/config.json)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Balance dials — drop chances and rarity weights, XP tuning, ground-drop
// lifetime and pickup range, enemy AI ranges and speeds — are read once, here,
// at module init. A validation failure throws out of module initialisation and
// the module does not start: no defaults, no partial application.
//
// The pure rule modules in ./rules/ never import this; they take their tuning
// as parameters, and this file passes it in.
const CONFIG = concerns(
  [
    ArchTraceables.ARCH_010_CONFIG_JSON_IS_OPERATOR_TUNABLE_CARDS_AND_EQUIPMENT_JSON_ARE_CONTENT,
    ConTraceables.CON_016_AN_INVALID_CONFIG_REFUSES_TO_START_THE_MODULE,
  ] as const,
  parseConfig(configJson),
);

/** Microsecond forms of the configured durations, for the schedule/timestamp maths. */
const DROP_DESPAWN_US = BigInt(
  Math.round(CONFIG.drops.despawnSeconds * 1_000_000),
);
const ENEMY_RESPAWN_US = BigInt(
  Math.round(CONFIG.enemies.respawnSeconds * 1_000_000),
);
/** Squared pickup range, so the reducers can compare without a square root. */
const PICKUP_RANGE_SQ = CONFIG.drops.pickupRangePx * CONFIG.drops.pickupRangePx;

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM SPACETIMEDB TYPES
// ═══════════════════════════════════════════════════════════════════════════════

const TStatBlock = t.object('StatBlock', {
  power: t.i32(),
  knowledge: t.i32(),
  health: t.i32(),
  will: t.i32(),
  agility: t.i32(),
  precision: t.i32(),
  maxHp: t.i32(),
  hpRegen: t.f32(),
  maxMp: t.i32(),
  mpRegen: t.f32(),
  moveSpeed: t.f32(),
  weaponDamage: t.i32(),
  physicalAttack: t.i32(),
  magicAttack: t.i32(),
  attackSpeed: t.f32(),
  castingSpeed: t.f32(),
  physicalCrit: t.f32(),
  magicCrit: t.f32(),
  accuracy: t.i32(),
  magicAccuracy: t.i32(),
  healingBoost: t.f32(),
  physicalDef: t.i32(),
  magicDef: t.i32(),
  evasion: t.f32(),
  parry: t.f32(),
  block: t.f32(),
  magicResist: t.f32(),
});

const TRarity = t.enum('Rarity', {
  common: t.unit(),
  uncommon: t.unit(),
  rare: t.unit(),
  epic: t.unit(),
  legendary: t.unit(),
});
const TCardType = t.enum('CardType', { active: t.unit(), passive: t.unit() });
const TPassiveKind = t.enum('PassiveKind', {
  ward: t.unit(),
  triggered: t.unit(),
  none: t.unit(),
});
const TSchool = t.enum('DamageSchool', {
  physical: t.unit(),
  magical: t.unit(),
});
const TShape = t.enum('ShapeType', {
  cone: t.unit(),
  line: t.unit(),
  arc: t.unit(),
  circle: t.unit(),
});
const TAggroState = t.enum('AggroState', {
  idle: t.unit(),
  chasing: t.unit(),
  casting: t.unit(),
  cooldown: t.unit(),
  resetting: t.unit(),
});
const TArmorWeight = t.enum('ArmorWeight', {
  cloth: t.unit(),
  chain: t.unit(),
  plate: t.unit(),
});
const TItemCategory = t.enum('ItemCategory', {
  equipment: t.unit(),
  consumable: t.unit(),
  material: t.unit(),
  quest: t.unit(),
  revival: t.unit(),
  dungeon_key: t.unit(),
});
const TEquipSlot = t.enum('EquipSlot', {
  head: t.unit(),
  chest: t.unit(),
  hands: t.unit(),
  legs: t.unit(),
  boots: t.unit(),
  main_hand: t.unit(),
  off_hand: t.unit(),
  necklace: t.unit(),
  ring: t.unit(),
  earring: t.unit(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT TABLES  (static game data — written by tooling, read by everyone)
// ═══════════════════════════════════════════════════════════════════════════════

const zone = table(
  { name: 'zone', public: true },
  {
    zoneId: t.u32().primaryKey(),
    name: t.string(),
    minLevel: t.u32(),
    recommendedLevel: t.u32(),
    maxLevel: t.u32(),
    description: t.string(),
    // The remaining zones.json fields (population/director/boss/levelBands/
    // spawnRarities) stay server-side content; these two are here because the
    // client reads them off the row it already subscribes to.
    tutorialZone: t.bool(),
    masteredMessage: t.option(t.string()),
  },
);

const cardDefinition = table(
  {
    name: 'card_definition',
    public: true,
    indexes: [{ accessor: 'slug', algorithm: 'btree', columns: ['slug'] }],
    constraints: [
      {
        name: 'card_definition_slug_key',
        constraint: 'unique',
        columns: ['slug'],
      },
    ],
  },
  {
    cardDefId: t.u32().primaryKey(),
    slug: t.string(),
    name: t.string(),
    rarity: TRarity,
    cardType: TCardType,
    passiveKind: TPassiveKind,
    scalingSchool: TSchool,
    baseShape: TShape,
    basePower: t.f32(),
    baseCooldown: t.f32(),
    mpCost: t.i32(),
    minCharacterLevel: t.u32(),
    flavor: t.string(),
  },
);

const itemDefinition = table(
  {
    name: 'item_definition',
    public: true,
    indexes: [{ accessor: 'slug', algorithm: 'btree', columns: ['slug'] }],
    constraints: [
      {
        name: 'item_definition_slug_key',
        constraint: 'unique',
        columns: ['slug'],
      },
    ],
  },
  {
    itemDefId: t.u64().primaryKey().autoInc(),
    slug: t.string(),
    name: t.string(),
    rarity: TRarity,
    minLevel: t.u32(), // level-gates item drops, mirrors CardDefinition.minCharacterLevel
    category: TItemCategory,
    slot: t.option(TEquipSlot), // null unless EQUIPMENT
    armorWeight: t.option(TArmorWeight), // armor pieces only
    weaponSchool: t.option(TSchool), // main_hand weapons only
    geometryShape: t.option(TShape), // main_hand weapons only
    geometryWidth: t.option(t.f32()), // main_hand weapons only
    geometryRange: t.option(t.f32()), // main_hand weapons only
    statModifiers: TStatBlock, // additive stats this item grants
    flavor: t.string(),
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNT-LEVEL TABLES  (survive permadeath)
// ═══════════════════════════════════════════════════════════════════════════════

const accountProgress = table(
  { name: 'account_progress', public: true },
  {
    accountIdentity: t.identity().primaryKey(),
    totalXpAllLives: t.u64(),
    tutorialCompleted: t.bool(),
    unlockedMilestoneIds: t.array(t.u32()),
  },
);

const personalSpirit = table(
  { name: 'personal_spirit', public: true },
  {
    accountIdentity: t.identity().primaryKey(),
    name: t.string(),
    level: t.u32(),
    bondXp: t.u64(),
  },
);

const cardInstance = table(
  {
    name: 'card_instance',
    public: true,
    indexes: [
      { accessor: 'by_owner', algorithm: 'btree', columns: ['ownerIdentity'] },
    ],
  },
  {
    cardInstanceId: t.u64().primaryKey().autoInc(),
    ownerIdentity: t.identity(),
    cardDefId: t.u32(),
    mergeLevel: t.u32(),
    attuned: t.bool(),
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
      {
        accessor: 'by_account',
        algorithm: 'btree',
        columns: ['accountIdentity'],
      },
      { accessor: 'by_zone', algorithm: 'btree', columns: ['zoneId'] },
    ],
  },
  {
    characterId: t.u64().primaryKey().autoInc(),
    accountIdentity: t.identity(),
    level: t.u32(),
    xp: t.u64(),
    zoneId: t.u32(),
    posX: t.f32(),
    posY: t.f32(),
    currentHp: t.i32(),
    currentMp: t.i32(),
    alive: t.bool(),
    createdAt: t.timestamp(),
    diedAt: t.option(t.timestamp()),
    lastLevelUpAt: t.option(t.timestamp()), // client watches this to trigger the level-up effect
  },
);

const equippedCard = table(
  {
    name: 'equipped_card',
    public: true,
    indexes: [
      {
        accessor: 'by_character',
        algorithm: 'btree',
        columns: ['characterId'],
      },
    ],
  },
  {
    equippedCardId: t.u64().primaryKey().autoInc(),
    characterId: t.u64(),
    cardInstanceId: t.u64(),
    slotType: TCardType,
    slotIndex: t.u32(),
  },
);

/** Physical item owned by a CHARACTER (not account) — destroyed on death, the body. */
const itemInstance = realizes(
  ArchTraceables.ARCH_001_ITEM_TABLES_PUBLIC_WITH_CLIENT_SIDE_OWNERSHIP_FILTER,
  table(
    {
      name: 'item_instance',
      public: true,
      indexes: [
        {
          accessor: 'by_character',
          algorithm: 'btree',
          columns: ['ownerCharacterId'],
        },
      ],
    },
    {
      itemInstanceId: t.u64().primaryKey().autoInc(),
      ownerCharacterId: t.u64(),
      itemDefId: t.u64(),
      quantity: t.u32(), // 1 for equipment, stackable for consumables
    },
  ),
);

const equippedItem = realizes(
  ArchTraceables.ARCH_001_ITEM_TABLES_PUBLIC_WITH_CLIENT_SIDE_OWNERSHIP_FILTER,
  table(
    {
      name: 'equipped_item',
      public: true,
      indexes: [
        {
          accessor: 'by_character',
          algorithm: 'btree',
          columns: ['characterId'],
        },
      ],
    },
    {
      equippedItemId: t.u64().primaryKey().autoInc(),
      characterId: t.u64(),
      itemInstanceId: t.u64(),
      slot: TEquipSlot,
      slotOrdinal: t.u32(), // 0/1 for the two rings & two earrings
    },
  ),
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
    dropId: t.u64().primaryKey().autoInc(),
    cardDefId: t.u32(),
    zoneId: t.u32(),
    posX: t.f32(),
    posY: t.f32(),
    createdAt: t.timestamp(),
  },
);

/** Ground drop — spawned on enemy death, despawned after 60 s or on pickup. */
const itemDrop = table(
  {
    name: 'item_drop',
    public: true,
    indexes: [{ accessor: 'by_zone', algorithm: 'btree', columns: ['zoneId'] }],
  },
  {
    itemDropId: t.u64().primaryKey().autoInc(),
    itemDefId: t.u64(),
    zoneId: t.u32(),
    posX: t.f32(),
    posY: t.f32(),
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
const enemy = realizes(
  ArchTraceables.ARCH_012_ENEMY_RARITY_AND_BOSS_FLAG_ARE_COLUMNS_ON_THE_FLAT_ENEMY_ROW,
  table(
    {
      name: 'enemy',
      public: true,
      indexes: [
        { accessor: 'by_zone', algorithm: 'btree', columns: ['zoneId'] },
      ],
    },
    {
      enemyId: t.u64().primaryKey().autoInc(),
      zoneId: t.u32(),
      /** Set on spawn. Drives the XP reward and the drop-pool level gate. */
      level: t.u32(),
      /**
       * The second difficulty axis beside level: scales maxHp/damage through
       * computeEnemyStats and raises the drop table's floor through
       * shiftRarityWeightsForMob. Nothing rolls this at spawn time yet — every
       * enemy is seeded `common` until the spawn director lands.
       */
      rarity: TRarity,
      /** Zone-boss marker. No boss spawns yet; the boss cycle owns this. */
      isBoss: t.bool(),
      posX: t.f32(),
      posY: t.f32(),
      spawnX: t.f32(),
      spawnY: t.f32(),
      currentHp: t.i32(),
      maxHp: t.i32(),
      alive: t.bool(),
      damagePerHit: t.i32(),
      attackRangePx: t.f32(),
      attackCooldownSeconds: t.f32(),
      lastAttackAt: t.option(t.timestamp()),
      aggroState: TAggroState,
      targetCharacterId: t.option(t.u64()),
      lastSeenTargetAt: t.option(t.timestamp()),
      castStartedAt: t.option(t.timestamp()),
      castDurationSeconds: t.f32(),
      castShape: TShape,
      castDamage: t.i32(),
    },
  ),
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
  enemyId: t.u64(),
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
  itemDrop,
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

// Validate zone data at module load — module refuses to start if zones.json is invalid.
const ZONE_DEFS = parseZones(zonesJson as unknown[]);

// An item's `stats` in equipment.json is a partial StatBlock (only the fields it grants).
// Missing fields default to 0 — these are additive MODIFIERS, not a character's base stats,
// so (unlike a fresh character) an absent multiplier field means "no change", not "1.0".
const ZERO_STAT_MODIFIERS: StatBlock = {
  power: 0,
  knowledge: 0,
  health: 0,
  will: 0,
  agility: 0,
  precision: 0,
  maxHp: 0,
  hpRegen: 0,
  maxMp: 0,
  mpRegen: 0,
  moveSpeed: 0,
  weaponDamage: 0,
  physicalAttack: 0,
  magicAttack: 0,
  attackSpeed: 0,
  castingSpeed: 0,
  physicalCrit: 0,
  magicCrit: 0,
  accuracy: 0,
  magicAccuracy: 0,
  healingBoost: 0,
  physicalDef: 0,
  magicDef: 0,
  evasion: 0,
  parry: 0,
  block: 0,
  magicResist: 0,
};

// ═══════════════════════════════════════════════════════════════════════════════
// LIFECYCLE HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export const onConnect = db.clientConnected((ctx) => {
  const existing = ctx.db.accountProgress.accountIdentity.find(ctx.sender);
  if (!existing) {
    ctx.db.accountProgress.insert({
      accountIdentity: ctx.sender,
      totalXpAllLives: 0n,
      tutorialCompleted: false,
      unlockedMilestoneIds: [],
    });
  }
});

/** Runs once when the module is first published. Seeds cards/items/zones + enemies and starts the damage ticker. */
export const init = db.init((ctx) => {
  _doSeedCards(ctx);
  _doSeedItems(ctx);
  _doSeedZones(ctx);
  _seedZone1Enemies(ctx);
  ctx.db.enemyTickSchedule.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.interval(500_000n), // fire every 500 ms
  });
  ctx.db.cardDropCleanupSchedule.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.interval(10_000_000n), // fire every 10 s
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REDUCERS — card seeding
// ═══════════════════════════════════════════════════════════════════════════════

const _doSeedCards = realizes(
  SwTraceables.SW_030_SEEDING_UPSERTS_CONTENT_BY_SLUG_RE_RUNNING_IS_ALWAYS_SAFE,
  function _doSeedCards(ctx: any): void {
    let inserted = 0;
    let updated = 0;

    for (let i = 0; i < CARD_DEFS.length; i++) {
      const card = CARD_DEFS[i];
      const cardDefId = i + 1; // stable 1-based ID; slug is the idempotency key

      const rowData = {
        slug: card.slug,
        name: card.name,
        rarity: { tag: card.rarity },
        cardType: { tag: card.type },
        passiveKind: { tag: card.passiveKind ?? 'none' },
        scalingSchool: { tag: card.school },
        baseShape: { tag: card.shape },
        basePower: card.basePower,
        baseCooldown: card.cooldownSeconds,
        mpCost: card.mpCost,
        minCharacterLevel: card.minLevel,
        flavor: card.flavor,
      };

      const existing = ctx.db.cardDefinition.slug.find(card.slug);
      if (existing) {
        ctx.db.cardDefinition.cardDefId.update({
          cardDefId: existing.cardDefId,
          ...rowData,
        });
        updated++;
      } else {
        ctx.db.cardDefinition.insert({ cardDefId, ...rowData });
        inserted++;
      }
    }

    console.log(`[seedCards] ${inserted} inserted, ${updated} updated`);
  },
);

/**
 * seedCards — upserts all cards from content/cards.json into cardDefinition.
 * TODO: restrict to module owner identity before shipping to production.
 */
export const seedCards = db.reducer({}, (ctx) => {
  _doSeedCards(ctx);
});

// ═══════════════════════════════════════════════════════════════════════════════
// REDUCERS — item seeding
// ═══════════════════════════════════════════════════════════════════════════════

const _doSeedItems = realizes(
  SwTraceables.SW_030_SEEDING_UPSERTS_CONTENT_BY_SLUG_RE_RUNNING_IS_ALWAYS_SAFE,
  function _doSeedItems(ctx: any): void {
    let inserted = 0;
    let updated = 0;

    for (const item of ITEM_DEFS) {
      const rowData = {
        slug: item.slug,
        name: item.name,
        rarity: { tag: item.rarity },
        minLevel: item.minLevel,
        category: { tag: item.category },
        slot: item.slot ? { tag: item.slot } : undefined,
        armorWeight: item.armorWeight ? { tag: item.armorWeight } : undefined,
        weaponSchool: item.weaponSchool
          ? { tag: item.weaponSchool }
          : undefined,
        geometryShape: item.geometryShape
          ? { tag: item.geometryShape }
          : undefined,
        geometryWidth: item.geometryWidth ?? undefined,
        geometryRange: item.geometryRange ?? undefined,
        statModifiers: { ...ZERO_STAT_MODIFIERS, ...item.stats },
        flavor: item.flavor,
      };

      const existing = ctx.db.itemDefinition.slug.find(item.slug);
      if (existing) {
        ctx.db.itemDefinition.itemDefId.update({
          itemDefId: existing.itemDefId,
          ...rowData,
        });
        updated++;
      } else {
        ctx.db.itemDefinition.insert({ itemDefId: 0n, ...rowData });
        inserted++;
      }
    }

    console.log(`[seedItems] ${inserted} inserted, ${updated} updated`);
  },
);

/**
 * seedItems — upserts all items from content/equipment.json into itemDefinition.
 * TODO: restrict to module owner identity before shipping to production.
 */
export const seedItems = db.reducer({}, (ctx) => {
  _doSeedItems(ctx);
});

// ═══════════════════════════════════════════════════════════════════════════════
// REDUCERS — zone seeding
// ═══════════════════════════════════════════════════════════════════════════════

const _doSeedZones = realizes(
  SwTraceables.SW_030_SEEDING_UPSERTS_CONTENT_BY_SLUG_RE_RUNNING_IS_ALWAYS_SAFE,
  function _doSeedZones(ctx: any): void {
    let inserted = 0;
    let updated = 0;

    for (const zone of ZONE_DEFS) {
      // zoneId is a plain u32 primary key authored in the content file, not an
      // autoInc column — it is the idempotency key, so it is set explicitly.
      const rowData = {
        zoneId: zone.zoneId,
        name: zone.name,
        minLevel: zone.minLevel,
        recommendedLevel: zone.recommendedLevel ?? zone.minLevel,
        maxLevel: zone.maxLevel,
        description: zone.flavor,
        tutorialZone: zone.tutorialZone,
        masteredMessage: zone.masteredMessage ?? undefined,
      };

      const existing = ctx.db.zone.zoneId.find(zone.zoneId);
      if (existing) {
        ctx.db.zone.zoneId.update(rowData);
        updated++;
      } else {
        ctx.db.zone.insert(rowData);
        inserted++;
      }
    }

    console.log(`[seedZones] ${inserted} inserted, ${updated} updated`);
  },
);

/**
 * seedZones — upserts all zones from content/zones.json into zone.
 * TODO: restrict to module owner identity before shipping to production.
 */
export const seedZones = db.reducer({}, (ctx) => {
  _doSeedZones(ctx);
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVATE REDUCER HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function activeCharacter(ctx: any) {
  const chars = [...ctx.db.character.by_account.filter(ctx.sender)];
  return chars.find((c: any) => c.alive) ?? null;
}

// Vertical slice: one hard-coded race. Real Race table comes later (see rules/stats.ts).
const RACE_BASE: StatBlock = computeRaceBase(0);

/** All sources (race base + every equipped item) stacked additively. Never stored. */
function buildEffectiveStats(ctx: any, character: any): StatBlock {
  const slots = [
    ...ctx.db.equippedItem.by_character.filter(character.characterId),
  ];
  const items: { statModifiers: StatBlock }[] = [];
  for (const s of slots) {
    const inst = ctx.db.itemInstance.itemInstanceId.find(
      (s as any).itemInstanceId,
    );
    if (!inst) continue;
    const def = ctx.db.itemDefinition.itemDefId.find(inst.itemDefId);
    if (!def) continue;
    items.push(def);
  }
  return computeEffectiveStats(RACE_BASE, items);
}

/** The character's equipped main_hand ItemDefinition, or null if bare-handed. */
function _findEquippedWeapon(ctx: any, characterId: bigint): any | null {
  const slots = [...ctx.db.equippedItem.by_character.filter(characterId)];
  const mainHand = slots.find((s: any) => s.slot.tag === 'main_hand');
  if (!mainHand) return null;
  const inst = ctx.db.itemInstance.itemInstanceId.find(
    (mainHand as any).itemInstanceId,
  );
  if (!inst) return null;
  return ctx.db.itemDefinition.itemDefId.find(inst.itemDefId) ?? null;
}

/**
 * Recompute a character's maxHp/maxMp before and after a gear-changing mutation,
 * then scale currentHp/currentMp by the same ratio (never just clamp — gaining
 * maxHp should feel like a gain, not a wasted overflow).
 */
const _withProportionalResourceUpdate = realizes(
  SwTraceables.SW_003_GEAR_CHANGE_RESCALES_CURRENT_HP_MP_PROPORTIONALLY,
  function _withProportionalResourceUpdate(
    ctx: any,
    char: any,
    mutate: () => void,
  ): void {
    const before = buildEffectiveStats(ctx, char);
    mutate();
    const after = buildEffectiveStats(ctx, char);
    const fresh = ctx.db.character.characterId.find(char.characterId);
    if (!fresh) return;

    const hpRatio = before.maxHp > 0 ? after.maxHp / before.maxHp : 1;
    const mpRatio = before.maxMp > 0 ? after.maxMp / before.maxMp : 1;
    const newHp = Math.max(
      1,
      Math.min(after.maxHp, Math.round(fresh.currentHp * hpRatio)),
    );
    const newMp = Math.max(
      0,
      Math.min(after.maxMp, Math.round(fresh.currentMp * mpRatio)),
    );

    ctx.db.character.characterId.update({
      ...fresh,
      currentHp: newHp,
      currentMp: newMp,
    });
  },
);

/**
 * Shared damage path for anything that hits a character: resolves the hit through
 * resolveHit() using the target's real effectiveStats for mitigation, then writes
 * currentHp (or triggers death). cardBaseShape/weapon fields only affect the
 * returned geometry, not the damage number, so safe defaults are fine here.
 */
const _resolveAndApplyDamage = realizes(
  ArchTraceables.ARCH_003_CLIENT_CONFIRMS_HIT_GEOMETRY_SERVER_RESOLVES_DAMAGE,
  function _resolveAndApplyDamage(
    ctx: any,
    target: any,
    params: {
      cardBasePower: number;
      cardSchool: 'physical' | 'magical';
      cardBaseShape: 'cone' | 'line' | 'arc' | 'circle';
      attackerStats: StatBlock;
      attackerLevel: number;
      weaponSchool?: 'physical' | 'magical';
      weaponWidth?: number;
      weaponRange?: number;
    },
  ): void {
    const defenderStats = buildEffectiveStats(ctx, target);
    const result = resolveHit({
      cardBasePower: params.cardBasePower,
      cardMergeLevel: 0,
      cardSchool: params.cardSchool,
      cardBaseShape: params.cardBaseShape,
      characterLevel: params.attackerLevel,
      weaponSchool: params.weaponSchool ?? params.cardSchool,
      weaponWidth: params.weaponWidth ?? 0.4,
      weaponRange: params.weaponRange ?? 150,
      attackerStats: params.attackerStats,
      defenderStats,
      randomRoll: ctx.random(),
    });

    const newHp = target.currentHp - result.damage;
    if (newHp <= 0) {
      _handleDeath(ctx, target);
    } else {
      ctx.db.character.characterId.update({ ...target, currentHp: newHp });
    }
  },
);

/**
 * Award XP to a character — bumps character.xp/level AND
 * accountProgress.totalXpAllLives (which never resets, even across deaths).
 * Shared by the public grantXp reducer and the kill-XP path in damageEnemy,
 * so there is exactly one place this logic lives.
 */
const _grantXp = realizes(
  ArchTraceables.ARCH_005_HP_MP_REFILL_ON_LEVEL_UP_IS_SERVER_SIDE_NOT_CLIENT,
  realizes(
    [
      SwTraceables.SW_019_GRANT_XP_RAISES_PER_LIFE_XP_AND_LIFETIME_XP_IN_ONE_CALL,
      SwTraceables.SW_020_A_LEVEL_INCREASE_REFILLS_HP_MP_AND_STAMPS_THE_LEVEL_UP_TIMESTAMP,
    ] as const,
    function _grantXp(ctx: any, char: any, amount: bigint): void {
      const newXp = char.xp + amount;
      const newLevel = computeCharacterLevel(newXp);
      const leveledUp = newLevel > char.level;

      // Leveling up refills HP/MP to the new max. This is done here (server-side,
      // persisted) rather than as a client-side illusion, since currentHp is
      // permadeath-sensitive and must stay authoritative — the client's level-up
      // flourish just reacts to lastLevelUpAt/currentHp changing, it doesn't set them.
      let currentHp = char.currentHp;
      let currentMp = char.currentMp;
      if (leveledUp) {
        const maxes = buildEffectiveStats(ctx, char);
        currentHp = maxes.maxHp;
        currentMp = maxes.maxMp;
      }

      ctx.db.character.characterId.update({
        ...char,
        xp: newXp,
        level: newLevel,
        currentHp,
        currentMp,
        lastLevelUpAt: leveledUp ? ctx.timestamp : char.lastLevelUpAt,
      });

      const progress = ctx.db.accountProgress.accountIdentity.find(
        char.accountIdentity,
      );
      if (progress) {
        ctx.db.accountProgress.accountIdentity.update({
          ...progress,
          totalXpAllLives: progress.totalXpAllLives + amount,
        });
      }
    },
  ),
);

/** Zone-1 enemies are level 2 — see docs/BALANCE.md for the zone/level table. */
const ZONE_1_ENEMY_LEVEL = concerns(
  SysTraceables.SYS_011_XP_AND_DROP_ELIGIBILITY_SCALE_WITH_THE_ENEMYS_OWN_LEVEL,
  2,
);

/**
 * Every enemy this module inserts today is a plain trash mob. Nothing rolls a
 * rarity or promotes a boss yet — the spawn director and the boss cycle own
 * that — so both insert sites seed the baseline explicitly rather than letting
 * the two new columns drift apart.
 */
const SEEDED_ENEMY_RARITY = concerns(
  SysTraceables.SYS_012_ENEMY_DIFFICULTY_SCALES_WITH_RARITY_AS_WELL_AS_LEVEL,
  { tag: 'common' } as const,
);

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
      enemyId: 0n,
      zoneId: 1,
      level: ZONE_1_ENEMY_LEVEL,
      rarity: SEEDED_ENEMY_RARITY,
      isBoss: false,
      posX: pos.x,
      posY: pos.y,
      spawnX: pos.x,
      spawnY: pos.y,
      currentHp: 100,
      maxHp: 100,
      alive: true,
      damagePerHit: 8,
      attackRangePx: 220,
      attackCooldownSeconds: 3.0,
      lastAttackAt: undefined,
      aggroState: { tag: 'idle' },
      targetCharacterId: undefined,
      lastSeenTargetAt: undefined,
      castStartedAt: undefined,
      castDurationSeconds: 1.8,
      castShape: { tag: 'circle' },
      castDamage: 15,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REDUCERS — character lifecycle
// ═══════════════════════════════════════════════════════════════════════════════

/** Hollow Vale — where an account that has not finished the tutorial belongs. */
const TUTORIAL_ZONE_ID = 1;

/** Where a graduated account belongs once that zone is authored and seeded. */
const GRADUATE_ZONE_ID = 2;

/**
 * What level a graduated account's next life starts at — deliberately below
 * the tutorial zone's ceiling, not at it.
 *
 * Starting at the ceiling composed two correct rules into a broken account: a
 * kill grants zero XP once the killer is at or above the zone's `maxLevel`, and
 * while zone 2 is unseeded the graduated branch below falls back to zone 1 — so
 * a graduate could never earn XP again. Two levels of headroom is what the
 * tutorial-skip promise asks for: past the floor, not comfortable
 * (GAME_DESIGN.md). The value is a stopgap that returns to 10 when zone 2
 * ships; what has to stay true either way is that the level is strictly below
 * the ceiling of whatever zone the account actually lands in, which is the
 * constraint the anchor on `startLife` below names.
 */
const GRADUATE_START_LEVEL = 8;

export const startLife = realizes(
  [
    SwTraceables.SW_053_STARTLIFE_COMPUTES_THE_START_ZONE_FROM_TUTORIAL_COMPLETION_NOT_CALLER_INPUT,
    ConTraceables.CON_035_A_GRADUATED_ACCOUNT_STARTS_BELOW_ITS_START_ZONES_MAX_LEVEL,
  ] as const,
  db.reducer({ spiritName: t.string() }, (ctx, { spiritName }) => {
    if (activeCharacter(ctx))
      throw new SenderError('Already has an active character');

    const progress = ctx.db.accountProgress.accountIdentity.find(ctx.sender);
    if (!progress)
      throw new SenderError(
        'Account not initialised — reconnect to trigger onConnect',
      );

    const existingSpirit = ctx.db.personalSpirit.accountIdentity.find(
      ctx.sender,
    );
    if (!existingSpirit) {
      ctx.db.personalSpirit.insert({
        accountIdentity: ctx.sender,
        name: spiritName,
        level: 1,
        bondXp: 0n,
      });
    }

    const startLevel = progress.tutorialCompleted ? GRADUATE_START_LEVEL : 1;
    // Which zone a life begins in is the server's decision, exactly as the
    // starting level above it is — a graduated account moves on from the
    // tutorial zone, a new one starts in it, and neither is the caller's to
    // choose. The routing itself is already final: the fallback is keyed on
    // whether the graduate zone is actually seeded, so it stops applying by
    // itself rather than needing this code changed again.
    // TODO: author zone 2's content — until it is seeded, a graduated account
    // restarts in the tutorial zone, which is why GRADUATE_START_LEVEL sits
    // below that zone's ceiling instead of at it.
    const graduatedZone = ctx.db.zone.zoneId.find(GRADUATE_ZONE_ID);
    const startZoneId =
      progress.tutorialCompleted && graduatedZone
        ? GRADUATE_ZONE_ID
        : TUTORIAL_ZONE_ID;
    ctx.db.character.insert({
      characterId: 0n,
      accountIdentity: ctx.sender,
      level: startLevel,
      xp: 0n,
      zoneId: startZoneId,
      posX: 480, // tile (10,8) — first enemy spawn area, grass
      posY: 432,
      currentHp: RACE_BASE.maxHp,
      currentMp: RACE_BASE.maxMp,
      alive: true,
      createdAt: ctx.timestamp,
      diedAt: undefined,
      lastLevelUpAt: undefined,
    });

    // First-ever life: grant the tutorial starting hand (1 active card, auto-equipped).
    // On subsequent lives the player re-equips surviving attuned cards at a spirit.
    const ownedCards = [...ctx.db.cardInstance.by_owner.filter(ctx.sender)];
    if (ownedCards.length === 0) {
      const emberDef = ctx.db.cardDefinition.slug.find('ember-strike');
      if (emberDef) {
        ctx.db.cardInstance.insert({
          cardInstanceId: 0n,
          ownerIdentity: ctx.sender,
          cardDefId: emberDef.cardDefId,
          mergeLevel: 0,
          attuned: false,
        });
        // Query back to get the autoInc ID for both the character and card instance.
        const newChar = [
          ...ctx.db.character.by_account.filter(ctx.sender),
        ].find((c: any) => c.alive);
        const newCard = [
          ...ctx.db.cardInstance.by_owner.filter(ctx.sender),
        ].find((ci: any) => ci.cardDefId === emberDef.cardDefId);
        if (newChar && newCard) {
          ctx.db.equippedCard.insert({
            equippedCardId: 0n,
            characterId: (newChar as any).characterId,
            cardInstanceId: (newCard as any).cardInstanceId,
            slotType: { tag: 'active' },
            slotIndex: 0,
          });
        }
      }
    }
  }),
);

export const move = db.reducer({ x: t.f32(), y: t.f32() }, (ctx, { x, y }) => {
  const char = activeCharacter(ctx);
  if (!char) throw new SenderError('No active character');
  ctx.db.character.characterId.update({ ...char, posX: x, posY: y });
});

export const grantXp = db.reducer({ amount: t.u64() }, (ctx, { amount }) => {
  const char = activeCharacter(ctx);
  if (!char) return;
  _grantXp(ctx, char, amount);
});

export const applyDamage = db.reducer(
  { targetCharacterId: t.u64(), rawDamage: t.i32(), school: TSchool },
  (ctx, { targetCharacterId, rawDamage, school }) => {
    const char = ctx.db.character.characterId.find(targetCharacterId);
    if (!char || !char.alive) return;

    // No attacker character behind rawDamage (e.g. a scripted/world source), so it
    // gets no level scaling or attack-stat bonus — it's still run through the
    // target's real effectiveStats so gear (physicalDef/evasion/etc.) mitigates it.
    _resolveAndApplyDamage(ctx, char, {
      cardBasePower: rawDamage,
      cardSchool: school.tag as 'physical' | 'magical',
      cardBaseShape: 'circle',
      attackerStats: EMPTY_STAT_BLOCK,
      attackerLevel: 0,
    });
  },
);

// ─── Internal: permadeath handler ─────────────────────────────────────────────

const _handleDeath = concerns(
  SysTraceables.SYS_006_DEATH_DESTROYS_GEAR_AND_UN_ATTUNED_CARDS_KEEPS_ONLY_WHAT_WAS_ATTUNED,
  realizes(
    [
      SwTraceables.SW_026_DEATH_ALWAYS_DESTROYS_GEAR_AND_A_SPIRITLESS_ACCOUNT_LOSES_EVERY_CARD,
      ConTraceables.CON_033_TUTORIAL_COMPLETION_STAMPS_ON_DEATH_ONCE_THE_CHARACTERS_ZONE_APPROPRIATE_MAX_LEVEL_WAS_REACHED,
    ] as const,
    function _handleDeath(ctx: any, char: any): void {
      ctx.db.character.characterId.update({
        ...char,
        alive: false,
        currentHp: 0,
        diedAt: ctx.timestamp,
      });

      const hand = [
        ...ctx.db.equippedCard.by_character.filter(char.characterId),
      ];
      for (const slot of hand) {
        ctx.db.equippedCard.equippedCardId.delete(slot.equippedCardId);
      }

      // "Gear is your body" — no exceptions. Equipped items and the underlying
      // ItemInstances (character-owned, unlike account-owned CardInstances) are
      // destroyed outright, not retained like attuned cards.
      const gear = [
        ...ctx.db.equippedItem.by_character.filter(char.characterId),
      ];
      for (const g of gear) {
        ctx.db.equippedItem.equippedItemId.delete(g.equippedItemId);
      }
      const items = [
        ...ctx.db.itemInstance.by_character.filter(char.characterId),
      ];
      for (const it of items) {
        ctx.db.itemInstance.itemInstanceId.delete(it.itemInstanceId);
      }

      const spirit = ctx.db.personalSpirit.accountIdentity.find(
        char.accountIdentity,
      );
      if (!spirit) {
        const allCards = [
          ...ctx.db.cardInstance.by_owner.filter(char.accountIdentity),
        ];
        for (const ci of allCards) {
          ctx.db.cardInstance.cardInstanceId.delete(ci.cardInstanceId);
        }
        return;
      }

      const slots = computeAttunementSlots(spirit.level);
      const cards: CardForRetention[] = [
        ...ctx.db.cardInstance.by_owner.filter(char.accountIdentity),
      ].map((ci: any) => {
        const def = ctx.db.cardDefinition.cardDefId.find(ci.cardDefId);
        return {
          cardInstanceId: ci.cardInstanceId,
          rarity: (def?.rarity.tag ?? 'common') as any,
          attuned: ci.attuned,
        };
      });

      const { lost } = computeRetention(cards, slots);
      for (const id of lost) {
        ctx.db.cardInstance.cardInstanceId.delete(id);
      }

      // Graduating the account is the tutorial zone's call, at whatever level
      // that zone is authored to end at — not a literal repeated here. A death
      // in any other zone, at any level, leaves the flag alone; the flip stays
      // death-gated and still happens at most once, since it is guarded on the
      // flag being false.
      const progress = ctx.db.accountProgress.accountIdentity.find(
        char.accountIdentity,
      );
      const deathZone = ctx.db.zone.zoneId.find(char.zoneId);
      if (
        progress &&
        deathZone &&
        deathZone.tutorialZone &&
        char.level >= deathZone.maxLevel &&
        !progress.tutorialCompleted
      ) {
        ctx.db.accountProgress.accountIdentity.update({
          ...progress,
          tutorialCompleted: true,
        });
      }
    },
  ),
);

// ═══════════════════════════════════════════════════════════════════════════════
// REDUCERS — spirit
// ═══════════════════════════════════════════════════════════════════════════════

export const sacrificeCard = realizes(
  SwTraceables.SW_029_SACRIFICING_A_CARD_PERMANENTLY_REMOVES_IT_FROM_THE_COLLECTION,
  db.reducer({ cardInstanceId: t.u64() }, (ctx, { cardInstanceId }) => {
    const card = ctx.db.cardInstance.cardInstanceId.find(cardInstanceId);
    if (!card || !card.ownerIdentity.equals(ctx.sender))
      throw new SenderError('Card not found or not owned');

    const def = ctx.db.cardDefinition.cardDefId.find(card.cardDefId);
    if (!def) throw new SenderError('Card definition missing');

    const spirit = ctx.db.personalSpirit.accountIdentity.find(ctx.sender);
    if (!spirit) throw new SenderError('No spirit bonded');

    ctx.db.cardInstance.cardInstanceId.delete(cardInstanceId);

    const xpGain =
      SACRIFICE_XP[def.rarity.tag as keyof typeof SACRIFICE_XP] ?? 10n;
    const newBondXp = spirit.bondXp + xpGain;
    const newLevel = computeSpiritLevel(newBondXp);
    ctx.db.personalSpirit.accountIdentity.update({
      ...spirit,
      bondXp: newBondXp,
      level: newLevel,
    });
  }),
);

export const toggleAttune = concerns(
  SysTraceables.SYS_010_SPIRIT_LEVEL_CAPS_THE_CARD_RARITY_A_PLAYER_CAN_HOLD_AT_ALL,
  realizes(
    [
      SwTraceables.SW_025_ATTUNING_PAST_A_RARITY_SLOT_BUDGET_IS_REJECTED_UN_ATTUNING_NEVER_IS,
      SwTraceables.SW_034_EQUIPPING_OR_ATTUNING_ABOVE_THE_CEILING_IS_REJECTED_NAMING_THE_CEILING,
    ] as const,
    db.reducer({ cardInstanceId: t.u64() }, (ctx, { cardInstanceId }) => {
      const card = ctx.db.cardInstance.cardInstanceId.find(cardInstanceId);
      if (!card || !card.ownerIdentity.equals(ctx.sender))
        throw new SenderError('Card not found or not owned');

      const def = ctx.db.cardDefinition.cardDefId.find(card.cardDefId);
      if (!def) throw new SenderError('Card definition missing');

      const spirit = ctx.db.personalSpirit.accountIdentity.find(ctx.sender);
      if (!spirit) throw new SenderError('No spirit bonded');

      if (!card.attuned) {
        // The ceiling gate comes first: you cannot protect what you cannot hold.
        // Un-attuning skips it entirely — letting a card go is never blocked.
        if (!canSpiritHandle(spirit.level, def.rarity.tag)) {
          throw new SenderError(
            rarityCeilingError(spirit.level, def.rarity.tag),
          );
        }

        const slots = computeAttunementSlots(spirit.level);
        const rarityTag = def.rarity.tag as keyof typeof slots;
        const slotMax = slots[rarityTag];
        const allOwned = [...ctx.db.cardInstance.by_owner.filter(ctx.sender)];
        const usedSlots = allOwned.filter((ci: any) => {
          if (!ci.attuned || ci.cardInstanceId === cardInstanceId) return false;
          const d = ctx.db.cardDefinition.cardDefId.find(ci.cardDefId);
          return d?.rarity.tag === rarityTag;
        }).length;

        if (usedSlots >= slotMax)
          throw new SenderError(
            `No ${rarityTag} attunement slots remaining (spirit level ${spirit.level})`,
          );
      }

      ctx.db.cardInstance.cardInstanceId.update({
        ...card,
        attuned: !card.attuned,
      });
    }),
  ),
);

// ═══════════════════════════════════════════════════════════════════════════════
// REDUCERS — hand management
// ═══════════════════════════════════════════════════════════════════════════════

export const equipCard = concerns(
  [
    SysTraceables.SYS_007_THE_HAND_IS_A_SPIRIT_LEVEL_GATED_CARD_LOADOUT,
    SysTraceables.SYS_010_SPIRIT_LEVEL_CAPS_THE_CARD_RARITY_A_PLAYER_CAN_HOLD_AT_ALL,
  ] as const,
  realizes(
    [
      SwTraceables.SW_028_EQUIP_CARD_ENFORCES_LEVEL_GATE_AND_HAND_SLOT_CAP_REPLACING_ONLY_THE_EXACT_SLOT,
      SwTraceables.SW_034_EQUIPPING_OR_ATTUNING_ABOVE_THE_CEILING_IS_REJECTED_NAMING_THE_CEILING,
    ] as const,
    db.reducer(
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
            `Requires character level ${def.minCharacterLevel} (you are ${char.level})`,
          );

        const spirit = ctx.db.personalSpirit.accountIdentity.find(ctx.sender);
        if (!spirit) throw new SenderError('No spirit bonded');

        // What the spirit can HANDLE at all, checked before the slot budget —
        // a rarity it cannot hold is not a "hand is full" problem.
        if (!canSpiritHandle(spirit.level, def.rarity.tag)) {
          throw new SenderError(
            rarityCeilingError(spirit.level, def.rarity.tag),
          );
        }

        const handSlots = computeHandSlots(spirit.level);
        const hand = [
          ...ctx.db.equippedCard.by_character.filter(char.characterId),
        ];
        const tag = slotType.tag as 'active' | 'passive';
        const count = hand.filter((e: any) => e.slotType.tag === tag).length;
        const cap = tag === 'active' ? handSlots.active : handSlots.passive;

        const existingInSlot = hand.find(
          (e: any) => e.slotType.tag === tag && e.slotIndex === slotIndex,
        );
        if (!existingInSlot && count >= cap)
          throw new SenderError(
            `${tag} hand is full (${count}/${cap} — spirit level ${spirit.level})`,
          );

        if (existingInSlot) {
          ctx.db.equippedCard.equippedCardId.delete(
            existingInSlot.equippedCardId,
          );
        }

        ctx.db.equippedCard.insert({
          equippedCardId: 0n,
          characterId: char.characterId,
          cardInstanceId,
          slotType,
          slotIndex,
        });
      },
    ),
  ),
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
// REDUCERS — equipment
// ═══════════════════════════════════════════════════════════════════════════════

export const equipItem = concerns(
  SysTraceables.SYS_001_EQUIP_GEAR_TO_CHANGE_COMBAT_STATS,
  realizes(
    [
      SwTraceables.SW_001_EQUIP_REQUIRES_OWNERSHIP_AND_MATCHING_SLOT,
      SwTraceables.SW_002_EQUIP_AUTO_REPLACES_SAME_SLOT_ORDINAL_OCCUPANT,
    ] as const,
    db.reducer(
      { itemInstanceId: t.u64(), slot: TEquipSlot, slotOrdinal: t.u32() },
      (ctx, { itemInstanceId, slot, slotOrdinal }) => {
        const char = activeCharacter(ctx);
        if (!char) throw new SenderError('No active character');

        const inst = ctx.db.itemInstance.itemInstanceId.find(itemInstanceId);
        if (!inst || inst.ownerCharacterId !== char.characterId)
          throw new SenderError('Item not found or not owned');

        const def = ctx.db.itemDefinition.itemDefId.find(inst.itemDefId);
        if (!def || !def.slot) throw new SenderError('Item is not equippable');
        if (def.slot.tag !== slot.tag)
          throw new SenderError(
            `Item belongs in ${def.slot.tag}, not ${slot.tag}`,
          );

        _withProportionalResourceUpdate(ctx, char, () => {
          const existing = [
            ...ctx.db.equippedItem.by_character.filter(char.characterId),
          ].find(
            (s: any) =>
              s.slot.tag === slot.tag && s.slotOrdinal === slotOrdinal,
          );
          if (existing) {
            ctx.db.equippedItem.equippedItemId.delete(existing.equippedItemId);
          }

          ctx.db.equippedItem.insert({
            equippedItemId: 0n,
            characterId: char.characterId,
            itemInstanceId,
            slot,
            slotOrdinal,
          });
        });
      },
    ),
  ),
);

export const unequipItem = db.reducer(
  { equippedItemId: t.u64() },
  (ctx, { equippedItemId }) => {
    const char = activeCharacter(ctx);
    if (!char) throw new SenderError('No active character');

    const slot = ctx.db.equippedItem.equippedItemId.find(equippedItemId);
    if (!slot || slot.characterId !== char.characterId)
      throw new SenderError('Equipped item not found on this character');

    _withProportionalResourceUpdate(ctx, char, () => {
      ctx.db.equippedItem.equippedItemId.delete(equippedItemId);
    });
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
  { zoneId: t.u32(), x: t.f32(), y: t.f32(), level: t.u32() },
  (ctx, { zoneId, x, y, level }) => {
    ctx.db.enemy.insert({
      enemyId: 0n,
      zoneId,
      level: level > 0 ? level : ZONE_1_ENEMY_LEVEL,
      rarity: SEEDED_ENEMY_RARITY,
      isBoss: false,
      posX: x,
      posY: y,
      spawnX: x,
      spawnY: y,
      currentHp: 100,
      maxHp: 100,
      alive: true,
      damagePerHit: 8,
      attackRangePx: 220,
      attackCooldownSeconds: 3.0,
      lastAttackAt: undefined,
      aggroState: { tag: 'idle' },
      targetCharacterId: undefined,
      lastSeenTargetAt: undefined,
      castStartedAt: undefined,
      castDurationSeconds: 1.8,
      castShape: { tag: 'circle' },
      castDamage: 15,
    });
  },
);

/**
 * damageEnemy — resolve a player-initiated hit against an enemy.
 * Client confirms the geometric connection locally (aim + weapon shape vs target
 * position) and tells the server which card (if any) it hit with; the server is
 * the sole authority on how much damage that becomes — cardDefId 0 means a bare
 * weapon swing (no card), matching cardDefinition's 1-based ids.
 */
export const damageEnemy = realizes(
  ArchTraceables.ARCH_003_CLIENT_CONFIRMS_HIT_GEOMETRY_SERVER_RESOLVES_DAMAGE,
  realizes(
    SwTraceables.SW_008_BARE_WEAPON_SWING_SUBSTITUTES_WEAPON_STATS_FOR_A_CARD,
    db.reducer(
      { enemyId: t.u64(), cardDefId: t.u32() },
      (ctx, { enemyId, cardDefId }) => {
        const char = activeCharacter(ctx);
        if (!char) throw new SenderError('No active character');

        const e = ctx.db.enemy.enemyId.find(enemyId);
        if (!e || !e.alive) return;
        if (e.zoneId !== char.zoneId)
          throw new SenderError('Enemy not in same zone');

        const weapon = _findEquippedWeapon(ctx, char.characterId);
        const weaponSchool = (weapon?.weaponSchool?.tag ?? 'physical') as
          'physical' | 'magical';
        const weaponWidth = weapon?.geometryWidth ?? 0.4;
        const weaponRange = weapon?.geometryRange ?? 150;
        const attackerStats = buildEffectiveStats(ctx, char);

        let cardBasePower: number;
        let cardSchool: 'physical' | 'magical';
        let cardBaseShape: 'cone' | 'line' | 'arc' | 'circle';

        if (cardDefId !== 0) {
          const def = ctx.db.cardDefinition.cardDefId.find(cardDefId);
          if (!def) throw new SenderError('Card definition not found');
          cardBasePower = def.basePower;
          cardSchool = def.scalingSchool.tag as 'physical' | 'magical';
          cardBaseShape = def.baseShape.tag as
            'cone' | 'line' | 'arc' | 'circle';
        } else {
          // Bare weapon swing — no card. Feeds the weapon's own weaponDamage stat
          // through the same scaling/mitigation pipeline as a card cast.
          cardBasePower = attackerStats.weaponDamage;
          cardSchool = weaponSchool;
          cardBaseShape = (weapon?.geometryShape?.tag ?? 'cone') as
            'cone' | 'line' | 'arc' | 'circle';
        }

        const result = resolveHit({
          cardBasePower,
          cardMergeLevel: 0,
          cardSchool,
          cardBaseShape,
          characterLevel: char.level,
          weaponSchool,
          weaponWidth,
          weaponRange,
          attackerStats,
          defenderStats: EMPTY_STAT_BLOCK, // enemies have no gear/stats yet
          randomRoll: ctx.random(),
        });

        const newHp = e.currentHp - result.damage;
        if (newHp <= 0) {
          ctx.db.enemy.enemyId.update({ ...e, currentHp: 0, alive: false });
          // Schedule respawn, at the configured delay
          ctx.db.enemyRespawnSchedule.insert({
            scheduledId: 0n,
            scheduledAt: ScheduleAt.time(
              ctx.timestamp.microsSinceUnixEpoch + ENEMY_RESPAWN_US,
            ),
            enemyId: e.enemyId,
          });
          // Reward scales with the gap between the killer and what they killed:
          // trivial mobs pay nothing, above-level mobs pay a capped bonus — and
          // a killer who has out-levelled the enemy's whole zone earns nothing
          // there at all, checked ahead of the curve rather than clamped after.
          const killZone = ctx.db.zone.zoneId.find(e.zoneId);
          const xp = computeKillXpReward(
            CONFIG.xp.baseMonsterXp,
            e.level,
            char.level,
            killZone?.maxLevel,
            CONFIG.xp.levelDiffPenalty,
          );
          if (xp > 0) _grantXp(ctx, char, BigInt(xp));
          // Independent drop rolls, level-gated + rarity-weighted (see BALANCE.md).
          _dropCardFromEnemy(ctx, e, char);
          _dropItemFromEnemy(ctx, e, char);
        } else {
          ctx.db.enemy.enemyId.update({ ...e, currentHp: newHp });
        }
      },
    ),
  ),
);

/**
 * How far above the enemy's own level a definition may still be eligible.
 * Headroom inside the enemy's band — not a reintroduction of the killer's level.
 */
const DROP_LEVEL_HEADROOM = 2;

/**
 * Roll a ground card drop when an enemy dies. Rarity-weighted, and gated by the
 * ENEMY's level rather than the killer's, so a level-2 wolf drops level-2 loot
 * no matter who kills it.
 */
const _dropCardFromEnemy = realizes(
  [
    SwTraceables.SW_015_CARD_AND_ITEM_DROPS_ARE_INDEPENDENT_PER_DEATH_ROLLS,
    SwTraceables.SW_037_DROP_ELIGIBILITY_FILTERS_TO_THE_ENEMYS_LEVEL_PLUS_TWO,
  ] as const,
  concerns(
    ConTraceables.CON_006_DUPLICATE_DROPS_ARE_INTENTIONAL_NEVER_DEDUPLICATED,
    function _dropCardFromEnemy(ctx: any, e: any, _char: any): void {
      if (ctx.random() >= CONFIG.dropRates.cards.baseChance) return;
      const maxLevel = e.level + DROP_LEVEL_HEADROOM;
      const allDefs = [...ctx.db.cardDefinition];
      const eligible = allDefs
        .filter((def: any) => def.minCharacterLevel <= maxLevel)
        .map((def: any) => ({ ...def, rarity: def.rarity.tag }));
      const def = pickLevelAndRarityGated(
        eligible,
        ctx.random(),
        ctx.random(),
        CONFIG.dropRates.cards.rarityWeights,
      );
      if (!def) return;
      ctx.db.cardDrop.insert({
        dropId: 0n,
        cardDefId: def.cardDefId,
        zoneId: e.zoneId,
        posX: e.posX,
        posY: e.posY,
        createdAt: ctx.timestamp,
      });
    },
  ),
);

/**
 * Roll a ground item drop when an enemy dies. Rarity-weighted, gated by the
 * enemy's level plus headroom, independent of the card drop roll.
 */
const _dropItemFromEnemy = realizes(
  SwTraceables.SW_037_DROP_ELIGIBILITY_FILTERS_TO_THE_ENEMYS_LEVEL_PLUS_TWO,
  concerns(
    ConTraceables.CON_006_DUPLICATE_DROPS_ARE_INTENTIONAL_NEVER_DEDUPLICATED,
    function _dropItemFromEnemy(ctx: any, e: any, _char: any): void {
      if (ctx.random() >= CONFIG.dropRates.gear.baseChance) return;
      const maxLevel = e.level + DROP_LEVEL_HEADROOM;
      const allDefs = [...ctx.db.itemDefinition];
      const eligible = allDefs
        .filter((def: any) => def.minLevel <= maxLevel)
        .map((def: any) => ({ ...def, rarity: def.rarity.tag }));
      const def = pickLevelAndRarityGated(
        eligible,
        ctx.random(),
        ctx.random(),
        CONFIG.dropRates.gear.rarityWeights,
      );
      if (!def) return;
      ctx.db.itemDrop.insert({
        itemDropId: 0n,
        itemDefId: def.itemDefId,
        zoneId: e.zoneId,
        posX: e.posX,
        posY: e.posY,
        createdAt: ctx.timestamp,
      });
    },
  ),
);

/** pickupCard — player picks up a ground drop within 80 px. */
export const pickupCard = realizes(
  SwTraceables.SW_018_GROUND_DROPS_DESPAWN_IN_60S_AND_NEED_80PX_TO_PICK_UP,
  db.reducer({ dropId: t.u64() }, (ctx, { dropId }) => {
    const char = activeCharacter(ctx);
    if (!char) throw new SenderError('No active character');

    const drop = ctx.db.cardDrop.dropId.find(dropId);
    if (!drop) throw new SenderError('Drop not found');
    if (drop.zoneId !== char.zoneId)
      throw new SenderError('Drop not in same zone');

    const dx = char.posX - drop.posX;
    const dy = char.posY - drop.posY;
    if (dx * dx + dy * dy > PICKUP_RANGE_SQ)
      throw new SenderError('Too far from drop');

    ctx.db.cardInstance.insert({
      cardInstanceId: 0n,
      ownerIdentity: ctx.sender,
      cardDefId: drop.cardDefId,
      mergeLevel: 0,
      attuned: false,
    });
    ctx.db.cardDrop.dropId.delete(dropId);

    const def = ctx.db.cardDefinition.cardDefId.find(drop.cardDefId);
    console.log(
      `[pickup] ${def?.name ?? '?'} → ${ctx.sender.toHexString().slice(0, 8)}...`,
    );
  }),
);

/**
 * pickupItem — player picks up a ground item drop within 80 px.
 * ItemInstance is CHARACTER-owned (unlike CardInstance, which is account-owned) —
 * it dies with the character on permadeath, so ownerCharacterId is always the FK
 * that matters here, not the account identity.
 */
export const pickupItem = realizes(
  SwTraceables.SW_018_GROUND_DROPS_DESPAWN_IN_60S_AND_NEED_80PX_TO_PICK_UP,
  db.reducer({ dropId: t.u64() }, (ctx, { dropId }) => {
    const char = activeCharacter(ctx);
    if (!char) throw new SenderError('No active character');

    const drop = ctx.db.itemDrop.itemDropId.find(dropId);
    if (!drop) throw new SenderError('Drop not found');
    if (drop.zoneId !== char.zoneId)
      throw new SenderError('Drop not in same zone');

    const dx = char.posX - drop.posX;
    const dy = char.posY - drop.posY;
    if (dx * dx + dy * dy > PICKUP_RANGE_SQ)
      throw new SenderError('Too far from drop');

    ctx.db.itemInstance.insert({
      itemInstanceId: 0n,
      ownerCharacterId: char.characterId,
      itemDefId: drop.itemDefId,
      quantity: 1,
    });
    ctx.db.itemDrop.itemDropId.delete(dropId);

    const def = ctx.db.itemDefinition.itemDefId.find(drop.itemDefId);
    console.log(
      `[pickup] ${def?.name ?? '?'} → ${ctx.sender.toHexString().slice(0, 8)}...`,
    );
  }),
);

/** cardDropCleanup — runs every 10 s, deletes card AND item drops older than 60 s. */
export const cardDropCleanup = realizes(
  SwTraceables.SW_018_GROUND_DROPS_DESPAWN_IN_60S_AND_NEED_80PX_TO_PICK_UP,
  db.reducer({ scheduleRow: cardDropCleanupRow }, (ctx, _args: any) => {
    const maxAgeUs = DROP_DESPAWN_US;
    for (const drop of ctx.db.cardDrop) {
      if (
        ctx.timestamp.microsSinceUnixEpoch -
          drop.createdAt.microsSinceUnixEpoch >=
        maxAgeUs
      ) {
        ctx.db.cardDrop.dropId.delete(drop.dropId);
      }
    }
    for (const drop of ctx.db.itemDrop) {
      if (
        ctx.timestamp.microsSinceUnixEpoch -
          drop.createdAt.microsSinceUnixEpoch >=
        maxAgeUs
      ) {
        ctx.db.itemDrop.itemDropId.delete(drop.itemDropId);
      }
    }
  }),
);

// ─── Chase AI ─────────────────────────────────────────────────────────────────
// Tuning constants and the aggro/chase/telegraph/reset decision logic now live
// in ./rules/enemyAi.ts as pure functions — this reducer module only gathers
// the candidates/target from ctx.db, calls into rules/, and writes the result.

/** Every alive character in a zone, shaped as pure aggro candidates. */
function _aggroCandidates(ctx: any, zoneId: number): AggroCandidate[] {
  return [...ctx.db.character.by_zone.filter(zoneId)]
    .filter((c: any) => c.alive)
    .map((c: any) => ({
      characterId: c.characterId,
      posX: c.posX,
      posY: c.posY,
      alive: c.alive,
    }));
}

/** Fire the telegraphed AoE: damage every alive character still within attackRangePx. */
const _fireCast = realizes(
  SwTraceables.SW_012_TELEGRAPHED_CAST_FIRES_ONCE_AFTER_ITS_DURATION_HITTING_EVERYONE_IN_RANGE,
  function _fireCast(ctx: any, e: any): void {
    for (const c of [...ctx.db.character.by_zone.filter(e.zoneId)]) {
      if (!(c as any).alive) continue;
      if (
        distSq((c as any).posX, (c as any).posY, e.posX, e.posY) >
        e.attackRangePx * e.attackRangePx
      )
        continue;
      // Enemies have no gear/stats yet (flat castDamage), so attackerLevel 0 skips
      // level scaling — the defender's real effectiveStats still mitigate the hit.
      _resolveAndApplyDamage(ctx, c, {
        cardBasePower: e.castDamage,
        cardSchool: 'physical',
        cardBaseShape: e.castShape.tag,
        attackerStats: EMPTY_STAT_BLOCK,
        attackerLevel: 0,
      });
    }
  },
);

/**
 * enemyTick — runs every 500 ms (Interval schedule, row never deleted).
 * Drives a five-state aggro machine per enemy:
 *   idle → chasing → casting → cooldown → (chasing | casting) or resetting → idle
 * Damage fires only after castDurationSeconds, hitting every character in the AoE.
 */
export const enemyTick = realizes(
  ArchTraceables.ARCH_004_ENEMY_TICK_IS_ONE_SCHEDULED_REDUCER_DRIVING_A_FIVE_STATE_MACHINE,
  concerns(
    SysTraceables.SYS_003_ENEMIES_AGGRO_CHASE_AND_ATTACK_UNDER_SERVER_AUTHORITY,
    db.reducer({ scheduleRow: enemyTickRow }, (ctx, _args: any) => {
      for (const e of ctx.db.enemy) {
        if (!e.alive) continue;

        const state = e.aggroState.tag as
          'idle' | 'chasing' | 'casting' | 'cooldown' | 'resetting';

        if (state === 'idle') {
          const target = findClosestInRange(
            _aggroCandidates(ctx, e.zoneId),
            e.posX,
            e.posY,
            CONFIG.enemies,
          );
          if (target) {
            ctx.db.enemy.enemyId.update({
              ...e,
              aggroState: { tag: 'chasing' },
              targetCharacterId: target.characterId,
            });
          }
        } else if (state === 'chasing') {
          const target =
            e.targetCharacterId !== undefined
              ? ctx.db.character.characterId.find(e.targetCharacterId)
              : null;

          const decision = decideChasing(
            e.posX,
            e.posY,
            target ?? null,
            CONFIG.enemies,
          );
          if (decision.kind === 'targetLost') {
            ctx.db.enemy.enemyId.update({
              ...e,
              aggroState: { tag: 'resetting' },
              targetCharacterId: undefined,
            });
          } else if (decision.kind === 'deaggro') {
            ctx.db.enemy.enemyId.update({
              ...e,
              aggroState: { tag: 'resetting' },
              lastSeenTargetAt: ctx.timestamp,
            });
          } else if (decision.kind === 'inAttackRange') {
            ctx.db.enemy.enemyId.update({
              ...e,
              aggroState: { tag: 'casting' },
              castStartedAt: ctx.timestamp,
            });
          } else {
            ctx.db.enemy.enemyId.update({
              ...e,
              posX: decision.posX,
              posY: decision.posY,
            });
          }
        } else if (state === 'casting') {
          // Check whether the cast duration has elapsed
          if (e.castStartedAt === undefined) continue;
          if (
            hasCastElapsed(
              ctx.timestamp.microsSinceUnixEpoch,
              e.castStartedAt.microsSinceUnixEpoch,
              e.castDurationSeconds,
            )
          ) {
            _fireCast(ctx, e);
            ctx.db.enemy.enemyId.update({
              ...e,
              aggroState: { tag: 'cooldown' },
              castStartedAt: undefined,
              lastAttackAt: ctx.timestamp,
            });
          }
        } else if (state === 'cooldown') {
          const target =
            e.targetCharacterId !== undefined
              ? ctx.db.character.characterId.find(e.targetCharacterId)
              : null;

          const decision = decideCooldown(
            e.posX,
            e.posY,
            target ?? null,
            ctx.timestamp.microsSinceUnixEpoch,
            e.lastAttackAt !== undefined
              ? e.lastAttackAt.microsSinceUnixEpoch
              : null,
            e.attackCooldownSeconds,
            CONFIG.enemies,
          );
          if (decision.kind === 'targetLost') {
            ctx.db.enemy.enemyId.update({
              ...e,
              aggroState: { tag: 'resetting' },
              targetCharacterId: undefined,
            });
          } else if (decision.kind === 'reengage') {
            // Target moved out of attack range mid-cooldown — re-engage by chasing.
            ctx.db.enemy.enemyId.update({
              ...e,
              aggroState: { tag: 'chasing' },
            });
          } else if (decision.kind === 'recast') {
            ctx.db.enemy.enemyId.update({
              ...e,
              aggroState: { tag: 'casting' },
              castStartedAt: ctx.timestamp,
            });
          }
          // 'wait' — still in range, cooldown not elapsed yet: no change this tick.
        } else if (state === 'resetting') {
          const decision = decideResetting(
            e.posX,
            e.posY,
            e.spawnX,
            e.spawnY,
            e.currentHp,
            e.maxHp,
            _aggroCandidates(ctx, e.zoneId),
            CONFIG.enemies,
          );
          if (decision.kind === 'reaggro') {
            ctx.db.enemy.enemyId.update({
              ...e,
              posX: decision.posX,
              posY: decision.posY,
              currentHp: decision.currentHp,
              aggroState: { tag: 'chasing' },
              targetCharacterId: decision.target.characterId,
            });
          } else if (decision.kind === 'arrived') {
            ctx.db.enemy.enemyId.update({
              ...e,
              posX: decision.posX,
              posY: decision.posY,
              currentHp: decision.currentHp,
              aggroState: { tag: 'idle' },
              targetCharacterId: undefined,
            });
          } else {
            ctx.db.enemy.enemyId.update({
              ...e,
              posX: decision.posX,
              posY: decision.posY,
              currentHp: decision.currentHp,
            });
          }
        }
      }
    }),
  ),
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
      currentHp: e.maxHp,
      alive: true,
      posX: e.spawnX,
      posY: e.spawnY,
      lastAttackAt: undefined,
      aggroState: { tag: 'idle' },
      targetCharacterId: undefined,
      lastSeenTargetAt: undefined,
      castStartedAt: undefined,
    });
  },
);
