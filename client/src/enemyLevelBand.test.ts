// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { describe, it, expect } from 'vitest';
import {
  classifyEnemyLevel,
  enemyLevelColor,
  LEVEL_BAND_COLOR,
} from './enemyLevelBand';
import { verifies, SwTraceables } from '../../src/clew/traceables/clew';

verifies(
  SwTraceables.SW_038_ENEMY_LEVEL_RENDERS_COLOURED_BY_RELATIVE_DIFFICULTY_AND_ZERO_READS_NO_XP,
  () => {
    describe('classifyEnemyLevel', () => {
      it('is trivial when the enemy is three or more levels below', () => {
        expect(classifyEnemyLevel(7, 10)).toBe('trivial');
        expect(classifyEnemyLevel(2, 10)).toBe('trivial');
      });

      it('is even within two levels either way', () => {
        expect(classifyEnemyLevel(8, 10)).toBe('even');
        expect(classifyEnemyLevel(9, 10)).toBe('even');
        expect(classifyEnemyLevel(10, 10)).toBe('even');
      });

      it('is tough from one to three levels above', () => {
        expect(classifyEnemyLevel(11, 10)).toBe('tough');
        expect(classifyEnemyLevel(13, 10)).toBe('tough');
      });

      it('is dangerous from four levels above', () => {
        expect(classifyEnemyLevel(14, 10)).toBe('dangerous');
        expect(classifyEnemyLevel(50, 10)).toBe('dangerous');
      });

      it('reads a level-2 enemy as even for a level-1 player and trivial at 10', () => {
        // The two manual QA cases the story calls out.
        expect(classifyEnemyLevel(2, 1)).toBe('tough');
        expect(classifyEnemyLevel(2, 10)).toBe('trivial');
      });
    });

    describe('enemyLevelColor', () => {
      it('maps each band to its documented colour', () => {
        expect(enemyLevelColor(2, 10)).toBe(LEVEL_BAND_COLOR.trivial);
        expect(enemyLevelColor(10, 10)).toBe(LEVEL_BAND_COLOR.even);
        expect(enemyLevelColor(12, 10)).toBe(LEVEL_BAND_COLOR.tough);
        expect(enemyLevelColor(20, 10)).toBe(LEVEL_BAND_COLOR.dangerous);
      });
    });
  },
);
