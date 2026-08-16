/**
 * Duplicates spacetimedb/src/rules/death.ts#computeCharacterLevel byte-for-byte.
 * There is no RPC-style query in SpacetimeDB — only table subscriptions and
 * reducer calls — so the client can't ask the server "what level is this XP,"
 * and the architecture rule is that derived values are never stored on a row.
 * Keep this in sync by hand if rules/death.ts changes; see the matching note
 * in that file and in ARCHITECTURE.md.
 */
export function computeCharacterLevel(xp: bigint): number {
  const x = Number(xp);
  return Math.max(1, Math.min(50, Math.floor(Math.pow(x / 80, 0.55))));
}

/**
 * Smallest xp such that computeCharacterLevel(xp) >= level. Derived by binary
 * search over the function above (rather than a separately-inverted formula)
 * so it can never disagree with computeCharacterLevel itself, even if the
 * curve's shape changes later.
 */
export function xpForLevel(level: number): bigint {
  if (level <= 1) return 0n;
  if (level > 50) return xpForLevel(50);

  let lo = 0n;
  let hi = 100_000_000n; // comfortably above any xp computeCharacterLevel(50) needs
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    if (computeCharacterLevel(mid) >= level) hi = mid; else lo = mid + 1n;
  }
  return lo;
}

/** Current level's XP band: [levelStart, levelEnd) — levelEnd is where the next level begins. */
export function xpProgress(xp: bigint): { level: number; levelStart: bigint; levelEnd: bigint } {
  const level = computeCharacterLevel(xp);
  const levelStart = xpForLevel(level);
  const levelEnd   = level >= 50 ? levelStart : xpForLevel(level + 1);
  return { level, levelStart, levelEnd };
}
