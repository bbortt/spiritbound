/**
 * types.ts — pure TypeScript types shared by rules/ functions.
 * NO SpacetimeDB imports here; this keeps rules/ fully portable and unit-testable.
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

export type Rarity       = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type CardType     = 'active' | 'passive';
export type PassiveKind  = 'ward' | 'triggered' | 'none';
export type DamageSchool = 'physical' | 'magical';
export type ShapeType    = 'cone' | 'line' | 'arc' | 'circle';
export type ArmorWeight  = 'cloth' | 'chain' | 'plate';

// Rarity ordering for slot logic
export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// ─── StatBlock ────────────────────────────────────────────────────────────────
// All stat sources (race base + gear + ward passives) stack additively into this.
// The computed total is called effectiveStats and is NEVER stored — always derived.

export interface StatBlock {
  // Primary attributes (race-seeded)
  power:      number;   // → physical_attack
  knowledge:  number;   // → magic_attack
  health:     number;   // → max_hp, hp_regen
  will:       number;   // → max_mp, mp_regen, magic_resist, healing_boost
  agility:    number;   // → evasion, parry, attack_speed
  precision:  number;   // → accuracy, magic_accuracy, crit

  // Resource maxes (current hp/mp live on Character row)
  maxHp:      number;
  hpRegen:    number;
  maxMp:      number;
  mpRegen:    number;
  moveSpeed:  number;   // multiplier; 1.0 = base

  // Offensive
  weaponDamage:   number;   // weapon-only; base for basic attacks
  physicalAttack: number;   // boosts physical-school card damage
  magicAttack:    number;   // boosts magical-school card damage (and healing)
  attackSpeed:    number;   // multiplier, higher = faster
  castingSpeed:   number;   // multiplier, higher = faster
  physicalCrit:   number;   // 0..1
  magicCrit:      number;   // 0..1
  accuracy:       number;   // counters evasion/parry on defender
  magicAccuracy:  number;   // counters magic_resist on defender
  healingBoost:   number;   // multiplier on healing-card output

  // Defensive
  physicalDef:  number;   // flat mitigation
  magicDef:     number;   // flat mitigation
  evasion:      number;   // glancing blow chance (partial dmg reduction), low cap
  parry:        number;   // reduce a connected physical hit, capped
  block:        number;   // off-hand shield reduction
  magicResist:  number;   // resist connected magic + secondary effects, capped
}

export const EMPTY_STAT_BLOCK: StatBlock = {
  power: 0, knowledge: 0, health: 0, will: 0, agility: 0, precision: 0,
  maxHp: 0, hpRegen: 0, maxMp: 0, mpRegen: 0, moveSpeed: 1.0,
  weaponDamage: 0, physicalAttack: 0, magicAttack: 0,
  attackSpeed: 1.0, castingSpeed: 1.0,
  physicalCrit: 0, magicCrit: 0, accuracy: 0, magicAccuracy: 0, healingBoost: 1.0,
  physicalDef: 0, magicDef: 0, evasion: 0, parry: 0, block: 0, magicResist: 0,
};

/** Add two StatBlocks additively (all sources stack). */
export function addStats(a: StatBlock, b: StatBlock): StatBlock {
  const result = {} as StatBlock;
  for (const key of Object.keys(a) as (keyof StatBlock)[]) {
    (result as any)[key] = a[key] + b[key];
  }
  return result;
}

// ─── Spirit attunement ────────────────────────────────────────────────────────

/** How many cards of each rarity the spirit can hold safe across death. */
export interface AttunementSlots {
  common:    number;
  uncommon:  number;
  rare:      number;
  epic:      number;
  legendary: number;
}

/** How many active/passive hand slots the spirit grants. */
export interface HandSlots {
  active:  number;  // max 10
  passive: number;  // max 5
}
