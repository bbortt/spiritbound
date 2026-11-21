// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { describe, it, expect } from 'vitest';
import { coneHitsCircle } from './hitCone';
import { verifies, ArchTraceables } from '../../src/clew/traceables/clew';

/** GameScene's basic attack: 280 px, 15° half-angle, 24 px enemy bodies. */
const RANGE = 280;
const HALF_ANG = (15 * Math.PI) / 180;
const R = 24;

/** Aiming straight right from the origin, the case every test below uses. */
const hits = (ex: number, ey: number, halfAngle = HALF_ANG) =>
  coneHitsCircle(ex, ey, 0, 0, 1, 0, RANGE, halfAngle, R);

verifies(
  ArchTraceables.ARCH_003_CLIENT_CONFIRMS_HIT_GEOMETRY_SERVER_RESOLVES_DAMAGE,
  () => {
    describe('coneHitsCircle', () => {
      it('hits a target dead ahead and misses one behind', () => {
        expect(hits(100, 0)).toBe(true);
        expect(hits(-100, 0)).toBe(false);
      });

      it('hits a body the cone clips even though its centre is outside', () => {
        // 60 px out the cone's half-width is 60 * tan(15°) ≈ 16 px, so a centre
        // 20 px off-axis is outside it while the 24 px body still overlaps.
        expect(hits(60, 20)).toBe(true);
      });

      it('still misses a body that is genuinely clear of the cone', () => {
        // Same distance, far enough off-axis that 16 px + 24 px cannot reach.
        expect(hits(60, 60)).toBe(false);
      });

      it('hits a target standing on top of the attacker', () => {
        expect(hits(5, 5)).toBe(true);
        expect(hits(0, 0)).toBe(true);
      });

      it('reaches one body-radius past the nominal range, and no further', () => {
        expect(hits(RANGE + R - 1, 0)).toBe(true);
        expect(hits(RANGE + R + 1, 0)).toBe(false);
      });

      it('keeps a full-circle shape full-circle', () => {
        expect(hits(-100, 0, Math.PI)).toBe(true);
      });
    });
  },
);
