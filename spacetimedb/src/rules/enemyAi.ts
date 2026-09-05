/**
 * rules/enemyAi.ts — enemy aggro/chase/telegraph/reset state-machine decisions.
 * Pure functions: no SpacetimeDB imports, no side effects, no wall-clock reads —
 * "now" and every position/timing value are passed in by the caller (enemyTick
 * in index.ts), which is the only place that reads ctx.timestamp/ctx.db and
 * writes the resulting state back to the Enemy row.
 */

import {
  realizes,
  concerns,
  SwTraceables,
  ConTraceables,
  ArchTraceables,
  SysTraceables,
} from '../../../src/clew/traceables/clew';

// ─── Chase AI tuning constants ────────────────────────────────────────────────
// Player move speed lives in rules/stats.ts's computeRaceBase().moveSpeed (1.0,
// a multiplier) combined with the client's base px/s; CHASE_SPEED here must
// always stay under whatever that resolves to (currently 180px/s).
export const AGGRO_RANGE = 300; // px — enemy notices a player and starts chasing
export const ATTACK_RANGE = 180; // px — enemy stops and starts casting
export const DEAGGRO_RANGE = 500; // px — player has escaped, enemy resets
export const CHASE_SPEED = realizes(
  ConTraceables.CON_003_CHASE_SPEED_IS_ALWAYS_SLOWER_THAN_PLAYER_MOVE_SPEED,
  110, // px/s — always slower than the player's 180 px/s move speed
);
export const RESET_SPEED = 80; // px/s — walking back to spawn
export const RESET_HP_PER_TICK = 10; // HP restored per tick while resetting
export const TICK_SECONDS = 0.5; // enemyTick fires every 500 ms

export function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Step at most `maxStep` px from (fromX,fromY) toward (toX,toY); snaps if closer than that. */
export function moveToward(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  maxStep: number,
) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= maxStep) return { x: toX, y: toY };
  return { x: fromX + (dx / dist) * maxStep, y: fromY + (dy / dist) * maxStep };
}

export interface AggroCandidate {
  characterId: bigint;
  posX: number;
  posY: number;
  alive: boolean;
}

/** Closest alive candidate within AGGRO_RANGE, or null. */
export const findClosestInRange = realizes(
  SwTraceables.SW_010_IDLE_ENEMY_AGGROES_ONTO_CLOSEST_CHARACTER_IN_RANGE,
  function findClosestInRange(
    candidates: readonly AggroCandidate[],
    posX: number,
    posY: number,
  ): AggroCandidate | null {
    let closest: AggroCandidate | null = null;
    let closestD2 = AGGRO_RANGE * AGGRO_RANGE;
    for (const c of candidates) {
      if (!c.alive) continue;
      const d2 = distSq(posX, posY, c.posX, c.posY);
      if (d2 <= closestD2) {
        closest = c;
        closestD2 = d2;
      }
    }
    return closest;
  },
);

export type ChasingDecision =
  | { kind: 'targetLost' }
  | { kind: 'deaggro' }
  | { kind: 'inAttackRange' }
  | { kind: 'moveToward'; posX: number; posY: number };

/** Decide what a chasing enemy does this tick, given its live target (or null if it died/vanished). */
export const decideChasing = realizes(
  SwTraceables.SW_011_CHASING_ENEMY_ATTACKS_RESETS_OR_CLOSES_DISTANCE,
  function decideChasing(
    enemyX: number,
    enemyY: number,
    target: { posX: number; posY: number; alive: boolean } | null,
  ): ChasingDecision {
    if (!target || !target.alive) return { kind: 'targetLost' };

    const d2 = distSq(enemyX, enemyY, target.posX, target.posY);
    if (d2 > DEAGGRO_RANGE * DEAGGRO_RANGE) return { kind: 'deaggro' };
    if (d2 <= ATTACK_RANGE * ATTACK_RANGE) return { kind: 'inAttackRange' };

    const step = CHASE_SPEED * TICK_SECONDS;
    const { x, y } = moveToward(enemyX, enemyY, target.posX, target.posY, step);
    return { kind: 'moveToward', posX: x, posY: y };
  },
);

/** Has castDurationSeconds elapsed since castStartedAt (both in whole microseconds)? */
export const hasCastElapsed = realizes(
  SwTraceables.SW_012_TELEGRAPHED_CAST_FIRES_ONCE_AFTER_ITS_DURATION_HITTING_EVERYONE_IN_RANGE,
  function hasCastElapsed(
    nowUs: bigint,
    castStartedAtUs: bigint,
    castDurationSeconds: number,
  ): boolean {
    const elapsedUs = nowUs - castStartedAtUs;
    const durationUs = BigInt(Math.round(castDurationSeconds * 1_000_000));
    return elapsedUs >= durationUs;
  },
);

export type CooldownDecision =
  | { kind: 'targetLost' }
  | { kind: 'reengage' }
  | { kind: 'recast' }
  | { kind: 'wait' };

/** Decide what a cooling-down enemy does this tick. */
export const decideCooldown = realizes(
  SwTraceables.SW_013_COOLDOWN_RECASTS_ON_TIMER_OR_RE_ENGAGES_IF_TARGET_MOVED_OUT_OF_RANGE,
  function decideCooldown(
    enemyX: number,
    enemyY: number,
    target: { posX: number; posY: number; alive: boolean } | null,
    nowUs: bigint,
    lastAttackAtUs: bigint | null,
    attackCooldownSeconds: number,
  ): CooldownDecision {
    if (!target || !target.alive) return { kind: 'targetLost' };
    if (
      distSq(enemyX, enemyY, target.posX, target.posY) >
      ATTACK_RANGE * ATTACK_RANGE
    ) {
      return { kind: 'reengage' };
    }
    if (lastAttackAtUs === null) return { kind: 'wait' };
    const elapsedUs = nowUs - lastAttackAtUs;
    const cooldownUs = BigInt(Math.round(attackCooldownSeconds * 1_000_000));
    return elapsedUs >= cooldownUs ? { kind: 'recast' } : { kind: 'wait' };
  },
);

export type ResettingDecision =
  | {
      kind: 'reaggro';
      posX: number;
      posY: number;
      currentHp: number;
      target: AggroCandidate;
    }
  | { kind: 'arrived'; posX: number; posY: number; currentHp: number }
  | { kind: 'stepping'; posX: number; posY: number; currentHp: number };

/** Decide what a resetting enemy does this tick: walk to spawn, heal, maybe re-aggro. */
export const decideResetting = realizes(
  SwTraceables.SW_014_RESETTING_ENEMY_WALKS_TO_SPAWN_HEALING_AND_CAN_RE_AGGRO,
  function decideResetting(
    enemyX: number,
    enemyY: number,
    spawnX: number,
    spawnY: number,
    currentHp: number,
    maxHp: number,
    candidates: readonly AggroCandidate[],
  ): ResettingDecision {
    const step = RESET_SPEED * TICK_SECONDS;
    const { x, y } = moveToward(enemyX, enemyY, spawnX, spawnY, step);
    const healedHp = Math.min(maxHp, currentHp + RESET_HP_PER_TICK);

    const reAggro = findClosestInRange(candidates, x, y);
    if (reAggro)
      return {
        kind: 'reaggro',
        posX: x,
        posY: y,
        currentHp: healedHp,
        target: reAggro,
      };
    if (x === spawnX && y === spawnY)
      return { kind: 'arrived', posX: x, posY: y, currentHp: maxHp };
    return { kind: 'stepping', posX: x, posY: y, currentHp: healedHp };
  },
);

// Structural/architecture anchors with no single realizing function of their own.
export const ENEMY_AI_ARCHITECTURE_NOTE = concerns(
  [
    ArchTraceables.ARCH_004_ENEMY_TICK_IS_ONE_SCHEDULED_REDUCER_DRIVING_A_FIVE_STATE_MACHINE,
    SysTraceables.SYS_003_ENEMIES_AGGRO_CHASE_AND_ATTACK_UNDER_SERVER_AUTHORITY,
  ] as const,
  true,
);
