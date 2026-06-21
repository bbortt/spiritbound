/**
 * rules/combat.ts — hit resolution logic.
 * Pure functions: no SpacetimeDB imports, no side effects.
 *
 * Core design rule (from architect):
 *   HITTING is skill (cursor aim, handled client-side).
 *   MITIGATION is stats (handled here, server-side).
 *
 * This function is only called once the server has confirmed a geometric hit.
 */

import type { StatBlock, DamageSchool, ShapeType } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────
// Owned by ability-balancer; live here as named constants (not magic numbers).

/** Level scaling: each character level adds this fraction of base power. */
const LEVEL_SCALING_PER_LEVEL = 0.05;   // 5% — placeholder, tune in BALANCE.md

/** Crit damage multiplier. */
const CRIT_MULTIPLIER = 1.5;

/**
 * Maximum evasion/parry/resist reduction as a fraction of damage.
 * Design decision: evasion is a glancing blow (partial), NOT full negation.
 * Low caps prevent feel-bad permadeath moments.
 */
const MAX_GLANCING_REDUCTION = 0.20;    // 20% max damage reduction

/** Minimum damage after all mitigations (always deal at least 1). */
const MIN_DAMAGE = 1;

// ─── Input / Output types ─────────────────────────────────────────────────────

export interface HitInput {
  // Card properties
  cardBasePower:    number;
  cardMergeLevel:   number;     // merge adds EFFECTS not raw power (handled by caller)
  cardSchool:       DamageSchool;
  cardBaseShape:    ShapeType;

  // Character
  characterLevel:   number;

  // Weapon (the main-hand item bends geometry AND routes stats)
  weaponSchool:     DamageSchool;   // what stat type the weapon carries
  weaponWidth:      number;         // higher = wider AoE, lower per-target damage
  weaponRange:      number;         // bends effective reach of the card

  // Stats
  attackerStats:    StatBlock;
  defenderStats:    StatBlock;

  // Provided by reducer — ctx.random() must be used inside reducers (deterministic)
  randomRoll:       number;         // 0..1 from ctx.random(); passed in to keep fn pure
}

export interface HitResult {
  damage:            number;
  isCrit:            boolean;
  glancingFraction:  number;    // 0 = clean hit; 0..MAX = partial reduction
  effectiveRange:    number;    // final range after weapon modifier
  effectiveWidth:    number;    // final width after weapon modifier
}

// ─── Core functions ───────────────────────────────────────────────────────────

/** Scale a card's base power by character level. */
export function scalePower(basePower: number, characterLevel: number): number {
  return basePower * (1 + characterLevel * LEVEL_SCALING_PER_LEVEL);
}

/**
 * Resolve a confirmed hit into final damage and geometry.
 *
 * Caller (reducer) is responsible for:
 *   1. Verifying geometric connection (aim + weapon shape vs target position).
 *   2. Passing ctx.random() as `randomRoll` (reducers must use deterministic RNG).
 *   3. Writing the resulting damage to the target's currentHp.
 */
export function resolveHit(input: HitInput): HitResult {
  const {
    cardBasePower, cardSchool, cardBaseShape,
    characterLevel,
    weaponSchool, weaponWidth, weaponRange,
    attackerStats, defenderStats,
    randomRoll,
  } = input;

  // ── 1. Scale base power by character level ───────────────────────────────
  const scaledPower = scalePower(cardBasePower, characterLevel);

  // ── 2. Apply attack bonus (only if weapon school matches card school) ─────
  // A mage swinging a sword still fires the card, but gains no weapon bonus.
  // This is the soft-lock that makes synergy feel rewarding without hard locks.
  const schoolMatches = cardSchool === weaponSchool;
  const attackBonus   = schoolMatches
    ? (cardSchool === 'physical' ? attackerStats.physicalAttack : attackerStats.magicAttack)
    : 0;

  let rawDamage = scaledPower + attackBonus;

  // ── 3. Flat defense mitigation ────────────────────────────────────────────
  const defense = cardSchool === 'physical'
    ? defenderStats.physicalDef
    : defenderStats.magicDef;
  rawDamage = Math.max(MIN_DAMAGE, rawDamage - defense);

  // ── 4. Avoidance (glancing blow — partial reduction, never full negation) ─
  // Accuracy counters evasion/parry (physical) or magic_resist (magical).
  const rawAvoidance = cardSchool === 'physical'
    ? (defenderStats.evasion + defenderStats.parry) / 2
    : defenderStats.magicResist;
  const accuracyStat = cardSchool === 'physical'
    ? attackerStats.accuracy
    : attackerStats.magicAccuracy;

  // Higher accuracy shrinks effective avoidance
  const effectiveAvoidance = Math.max(0, rawAvoidance - accuracyStat * 0.002);
  const glancingFraction   = Math.min(MAX_GLANCING_REDUCTION, effectiveAvoidance);
  const damageAfterAvoid   = rawDamage * (1 - glancingFraction);

  // ── 5. Crit ───────────────────────────────────────────────────────────────
  const critChance = cardSchool === 'physical'
    ? attackerStats.physicalCrit
    : attackerStats.magicCrit;
  const isCrit     = randomRoll < critChance;
  const finalDamage = Math.max(MIN_DAMAGE, Math.round(
    isCrit ? damageAfterAvoid * CRIT_MULTIPLIER : damageAfterAvoid
  ));

  // ── 6. Weapon geometry bends range and width ──────────────────────────────
  // Balance rule: wide weapons are weaker (lower attackBonus), so a wide+strong
  // weapon is impossible by item-balancer constraints — the geometry is the tradeoff.
  return {
    damage:           finalDamage,
    isCrit,
    glancingFraction,
    effectiveRange:   weaponRange,
    effectiveWidth:   weaponWidth,
  };
}

// ─── Healing (parallel to resolveHit) ────────────────────────────────────────

export interface HealInput {
  cardBasePower:  number;
  characterLevel: number;
  healerStats:    StatBlock;
}

/**
 * Compute final healing output.
 * Healing reads magicAttack × healingBoost (Aion-style).
 */
export function resolveHeal(input: HealInput): number {
  const { cardBasePower, characterLevel, healerStats } = input;
  const scaledPower = scalePower(cardBasePower, characterLevel);
  const healed = (scaledPower + healerStats.magicAttack) * healerStats.healingBoost;
  return Math.round(Math.max(1, healed));
}
