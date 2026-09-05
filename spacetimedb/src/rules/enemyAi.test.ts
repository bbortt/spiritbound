import { describe, it, expect } from 'vitest';
import {
  distSq,
  moveToward,
  findClosestInRange,
  decideChasing,
  hasCastElapsed,
  decideCooldown,
  decideResetting,
  RESET_HP_PER_TICK,
  type AggroCandidate,
  type EnemyAiTuning,
} from './enemyAi';
import { loadConfig } from '../../../content/configLoader';
import {
  verifies,
  SwTraceables,
  ConTraceables,
} from '../../../src/clew/traceables/clew';

/**
 * The AI ranges and speeds are server-operator dials now, so the
 * tests read the shipped config rather than constants that no longer exist.
 */
const TUNING: EnemyAiTuning = loadConfig().enemies;
const AGGRO_RANGE = TUNING.aggroRangePx;
const ATTACK_RANGE = TUNING.attackRangePx;
const DEAGGRO_RANGE = TUNING.deaggroRangePx;
const RESET_SPEED = TUNING.resetSpeedPxPerSec;

function candidate(
  id: bigint,
  x: number,
  y: number,
  alive = true,
): AggroCandidate {
  return { characterId: id, posX: x, posY: y, alive };
}

verifies(
  SwTraceables.SW_010_IDLE_ENEMY_AGGROES_ONTO_CLOSEST_CHARACTER_IN_RANGE,
  () => {
    describe('findClosestInRange', () => {
      it('picks the nearest alive candidate strictly within AGGRO_RANGE', () => {
        const near = candidate(1n, 50, 0);
        const far = candidate(2n, 200, 0);
        const result = findClosestInRange([far, near], 0, 0, TUNING);
        expect(result?.characterId).toBe(1n);
      });

      it('ignores a candidate beyond AGGRO_RANGE', () => {
        const outOfRange = candidate(1n, AGGRO_RANGE + 50, 0);
        expect(findClosestInRange([outOfRange], 0, 0, TUNING)).toBeNull();
      });

      it('ignores dead candidates', () => {
        const dead = candidate(1n, 10, 0, false);
        expect(findClosestInRange([dead], 0, 0, TUNING)).toBeNull();
      });

      it('returns null when no candidates are given', () => {
        expect(findClosestInRange([], 0, 0, TUNING)).toBeNull();
      });

      it('accepts a candidate exactly at the AGGRO_RANGE boundary', () => {
        const atBoundary = candidate(1n, AGGRO_RANGE, 0);
        expect(
          findClosestInRange([atBoundary], 0, 0, TUNING)?.characterId,
        ).toBe(1n);
      });
    });
  },
);

verifies(
  SwTraceables.SW_011_CHASING_ENEMY_ATTACKS_RESETS_OR_CLOSES_DISTANCE,
  () => {
    describe('decideChasing', () => {
      it('reports targetLost when the target is null', () => {
        expect(decideChasing(0, 0, null, TUNING).kind).toBe('targetLost');
      });

      it('reports targetLost when the target is dead', () => {
        expect(
          decideChasing(0, 0, { posX: 10, posY: 0, alive: false }, TUNING).kind,
        ).toBe('targetLost');
      });

      it('reports deaggro when the target is beyond DEAGGRO_RANGE', () => {
        const decision = decideChasing(
          0,
          0,
          {
            posX: DEAGGRO_RANGE + 1,
            posY: 0,
            alive: true,
          },
          TUNING,
        );
        expect(decision.kind).toBe('deaggro');
      });

      it('reports inAttackRange when within ATTACK_RANGE', () => {
        const decision = decideChasing(
          0,
          0,
          {
            posX: ATTACK_RANGE - 1,
            posY: 0,
            alive: true,
          },
          TUNING,
        );
        expect(decision.kind).toBe('inAttackRange');
      });

      it('moves toward the target when between ATTACK_RANGE and DEAGGRO_RANGE', () => {
        const decision = decideChasing(
          0,
          0,
          {
            posX: ATTACK_RANGE + 100,
            posY: 0,
            alive: true,
          },
          TUNING,
        );
        expect(decision.kind).toBe('moveToward');
        if (decision.kind === 'moveToward') {
          expect(decision.posX).toBeGreaterThan(0);
          expect(decision.posX).toBeLessThan(ATTACK_RANGE + 100);
        }
      });
    });
  },
);

verifies(
  SwTraceables.SW_012_TELEGRAPHED_CAST_FIRES_ONCE_AFTER_ITS_DURATION_HITTING_EVERYONE_IN_RANGE,
  () => {
    describe('hasCastElapsed', () => {
      it('is false before the cast duration has elapsed', () => {
        expect(hasCastElapsed(1_000_000n, 0n, 2.0)).toBe(false);
      });

      it('is true once the cast duration has elapsed', () => {
        expect(hasCastElapsed(2_000_000n, 0n, 2.0)).toBe(true);
      });
    });
  },
);

verifies(
  SwTraceables.SW_013_COOLDOWN_RECASTS_ON_TIMER_OR_RE_ENGAGES_IF_TARGET_MOVED_OUT_OF_RANGE,
  () => {
    describe('decideCooldown', () => {
      it('reports targetLost when the target is null or dead', () => {
        expect(decideCooldown(0, 0, null, 0n, null, 1, TUNING).kind).toBe(
          'targetLost',
        );
        expect(
          decideCooldown(
            0,
            0,
            { posX: 0, posY: 0, alive: false },
            0n,
            null,
            1,
            TUNING,
          ).kind,
        ).toBe('targetLost');
      });

      it('reports reengage when the target moved beyond ATTACK_RANGE', () => {
        const decision = decideCooldown(
          0,
          0,
          { posX: ATTACK_RANGE + 1, posY: 0, alive: true },
          0n,
          null,
          1,
          TUNING,
        );
        expect(decision.kind).toBe('reengage');
      });

      it('reports wait while still in range and the cooldown has not elapsed', () => {
        const decision = decideCooldown(
          0,
          0,
          { posX: 10, posY: 0, alive: true },
          1_000_000n,
          0n,
          3.0,
          TUNING,
        );
        expect(decision.kind).toBe('wait');
      });

      it('reports recast once the attack cooldown has elapsed', () => {
        const decision = decideCooldown(
          0,
          0,
          { posX: 10, posY: 0, alive: true },
          3_000_000n,
          0n,
          3.0,
          TUNING,
        );
        expect(decision.kind).toBe('recast');
      });
    });
  },
);

verifies(
  SwTraceables.SW_014_RESETTING_ENEMY_WALKS_TO_SPAWN_HEALING_AND_CAN_RE_AGGRO,
  () => {
    describe('decideResetting', () => {
      it('steps toward spawn and heals when nothing re-aggroes', () => {
        const decision = decideResetting(100, 0, 0, 0, 50, 100, [], TUNING);
        expect(decision.kind).toBe('stepping');
        if (decision.kind !== 'reaggro') {
          expect(decision.currentHp).toBeGreaterThan(50);
          expect(decision.currentHp).toBeLessThanOrEqual(
            50 + RESET_HP_PER_TICK,
          );
        }
      });

      it('reports arrived at full HP once it reaches its exact spawn position', () => {
        const step = RESET_SPEED * 0.5; // TICK_SECONDS
        const decision = decideResetting(step, 0, 0, 0, 90, 100, [], TUNING);
        expect(decision.kind).toBe('arrived');
        if (decision.kind === 'arrived') expect(decision.currentHp).toBe(100);
      });

      it('re-aggroes mid-reset if a candidate comes into range', () => {
        const target = candidate(9n, 100, 0);
        const decision = decideResetting(
          100,
          0,
          0,
          0,
          50,
          100,
          [target],
          TUNING,
        );
        expect(decision.kind).toBe('reaggro');
        if (decision.kind === 'reaggro')
          expect(decision.target.characterId).toBe(9n);
      });

      it('never heals past maxHp', () => {
        const decision = decideResetting(100, 0, 0, 0, 100, 100, [], TUNING);
        expect(decision.currentHp).toBeLessThanOrEqual(100);
      });
    });
  },
);

describe('distSq / moveToward (pure geometry helpers, no dedicated spec)', () => {
  it('distSq computes squared euclidean distance', () => {
    expect(distSq(0, 0, 3, 4)).toBe(25);
  });

  it('moveToward snaps to the target when closer than maxStep', () => {
    expect(moveToward(0, 0, 1, 0, 10)).toEqual({ x: 1, y: 0 });
  });

  it('moveToward steps exactly maxStep px toward a distant target', () => {
    const { x, y } = moveToward(0, 0, 100, 0, 10);
    expect(x).toBeCloseTo(10);
    expect(y).toBeCloseTo(0);
  });
});

verifies(
  ConTraceables.CON_003_CHASE_SPEED_IS_ALWAYS_SLOWER_THAN_PLAYER_MOVE_SPEED,
  () => {
    describe('the configured chase speed stays below the player base move speed', () => {
      it('chaseSpeedPxPerSec is strictly less than the player base move speed (180px/s, see docs/BALANCE.md)', () => {
        // No shared exported constant for the player's base move speed exists across
        // the client/server boundary (docs/BALANCE.md documents it as 180px/s) — this
        // hardcodes that documented value as a regression guard, per this spec's own
        // "no automated cross-file test exists today" verification note.
        //
        // The speed is an operator dial in content/config.json now, so
        // this guards the value this repository ships; a modified deployment can
        // still break the invariant; docs/ARCHITECTURE.md records that gap.
        const PLAYER_BASE_MOVE_SPEED_PX_S = 180;
        expect(TUNING.chaseSpeedPxPerSec).toBeLessThan(
          PLAYER_BASE_MOVE_SPEED_PX_S,
        );
      });
    });
  },
);
