import { describe, it, expect } from 'vitest';
import {
  computeXpReward as clientComputeXpReward,
  XP_CONFIG,
} from './xpReward';
import { computeXpReward as serverComputeXpReward } from '../../spacetimedb/src/rules/leveling';
import { verifies, ArchTraceables } from '../../src/clew/traceables/clew';

verifies(
  ArchTraceables.ARCH_011_THE_CLIENT_DUPLICATES_COMPUTE_XP_REWARD_TO_RENDER_THE_FLOATING_NUMBER,
  () => {
    describe('the client XP duplicate agrees with the server', () => {
      it('matches the server formula across a swept range of level pairs', () => {
        for (let playerLevel = 1; playerLevel <= 50; playerLevel++) {
          for (let monsterLevel = 1; monsterLevel <= 50; monsterLevel++) {
            expect(
              clientComputeXpReward(
                XP_CONFIG.baseMonsterXp,
                monsterLevel,
                playerLevel,
                XP_CONFIG.levelDiff,
              ),
            ).toBe(
              serverComputeXpReward(
                XP_CONFIG.baseMonsterXp,
                monsterLevel,
                playerLevel,
                XP_CONFIG.levelDiff,
              ),
            );
          }
        }
      });
    });
  },
);
