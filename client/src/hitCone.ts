// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Timon Borter. See LICENSE at the repository root.

import { realizes, ArchTraceables } from '../../src/clew/traceables/clew';

/**
 * hitCone.ts — the client's half of the hit: does a cursor-aimed attack cone
 * geometrically connect with a target? The server decides what that connection
 * costs; this only decides whether there was one.
 *
 * Extracted from GameScene as plain TypeScript so the geometry can be unit
 * tested; the Scene only decides who to aim at and what to tell the server
 * (005-testing-contract §2, "pure calculation with no Phaser dependency").
 */

/**
 * Does the cone from (ox, oy) along the unit vector (nx, ny) overlap a target
 * circle of radius `targetRadius` centred on (ex, ey)?
 *
 * The target's body counts, not just its centre point: at 60 px a 15°
 * half-angle cone is only ~16 px wide, narrower than a 24 px enemy, so a
 * centre-point test misses targets the player is visibly standing inside of.
 * The body widens the cone by the angle it subtends — asin(r / d) — and
 * extends its reach by one radius.
 */
export const coneHitsCircle = realizes(
  ArchTraceables.ARCH_003_CLIENT_CONFIRMS_HIT_GEOMETRY_SERVER_RESOLVES_DAMAGE,
  function coneHitsCircle(
    ex: number,
    ey: number,
    ox: number,
    oy: number,
    nx: number,
    ny: number,
    range: number,
    halfAngle: number,
    targetRadius: number,
  ): boolean {
    const dx = ex - ox;
    const dy = ey - oy;
    const dist = Math.hypot(dx, dy);
    if (dist > range + targetRadius) return false;
    if (dist <= targetRadius) return true; // origin is inside the body

    const slack = Math.asin(targetRadius / dist);
    // Clamped because cos stops shrinking past π: an already-full-circle shape
    // must not get *narrower* once the body's slack is added to it.
    const widened = Math.min(Math.PI, halfAngle + slack);
    return (dx / dist) * nx + (dy / dist) * ny >= Math.cos(widened);
  },
);
