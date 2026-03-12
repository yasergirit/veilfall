import type { HexCoord } from '../types/map.js';

/** Create a hex coordinate (cube coords where q + r + s = 0) */
export function hex(q: number, r: number): HexCoord {
  return { q, r, s: -q - r };
}

/** Get all 6 neighbors of a hex tile */
export function hexNeighbors(coord: HexCoord): HexCoord[] {
  const directions: HexCoord[] = [
    { q: 1, r: 0, s: -1 },
    { q: 1, r: -1, s: 0 },
    { q: 0, r: -1, s: 1 },
    { q: -1, r: 0, s: 1 },
    { q: -1, r: 1, s: 0 },
    { q: 0, r: 1, s: -1 },
  ];
  return directions.map((d) => ({
    q: coord.q + d.q,
    r: coord.r + d.r,
    s: coord.s + d.s,
  }));
}

/** Manhattan distance between two hex tiles (cube coords) */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(a.s - b.s),
  );
}

/** Get all hexes within a given radius */
export function hexesInRange(center: HexCoord, radius: number): HexCoord[] {
  const results: HexCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      const s = -q - r;
      results.push({
        q: center.q + q,
        r: center.r + r,
        s: center.s + s,
      });
    }
  }
  return results;
}

/** Convert cube coords to pixel position (for flat-top hexes) */
export function hexToPixel(coord: HexCoord, size: number): { x: number; y: number } {
  const x = size * (3 / 2 * coord.q);
  const y = size * (Math.sqrt(3) / 2 * coord.q + Math.sqrt(3) * coord.r);
  return { x, y };
}

/** Convert pixel position to nearest hex (flat-top) */
export function pixelToHex(x: number, y: number, size: number): HexCoord {
  const q = (2 / 3 * x) / size;
  const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / size;
  return hexRound({ q, r, s: -q - r });
}

/** Round fractional hex coords to nearest integer hex */
export function hexRound(coord: { q: number; r: number; s: number }): HexCoord {
  let rq = Math.round(coord.q);
  let rr = Math.round(coord.r);
  let rs = Math.round(coord.s);

  const dq = Math.abs(rq - coord.q);
  const dr = Math.abs(rr - coord.r);
  const ds = Math.abs(rs - coord.s);

  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  } else {
    rs = -rq - rr;
  }

  return { q: rq, r: rr, s: rs };
}

/** Generate a unique string key for a hex coord */
export function hexKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

/** Determine which map zone a hex belongs to based on distance from center */
export function getZoneForDistance(distance: number, mapRadius: number): string {
  const ratio = distance / mapRadius;
  if (ratio > 0.8) return 'hearthlands';
  if (ratio > 0.6) return 'contested_reaches';
  if (ratio > 0.35) return 'fractured_provinces';
  if (ratio > 0.15) return 'wound_zones';
  return 'sovereign_ring';
}
