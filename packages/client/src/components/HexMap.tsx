import { useRef, useEffect, useCallback, useState } from 'react';
import { hexToPixel, hexesInRange, hex, getZoneForDistance, hexDistance, pixelToHex, hexKey } from '@veilfall/shared';
import { useGameStore } from '../stores/game-store.js';
import { api } from '../lib/api.js';

const HEX_SIZE = 42;
const MAP_RADIUS = 15;
const MARCH_SPEED_SECONDS_PER_HEX = 30;

// Tile images are 256x384 (isometric flat-top hex with depth)
// For pointy-top rendering, we rotate and clip them
const TILE_W = 256;
const TILE_H = 384;
// Hex face center: where in the tile image the hex face sits (0.47 = 47% from top)
// This aligns the hex face in the image with the hex grid position
const FACE_CENTER_Y = 0.5;

const TERRAIN_COLORS: Record<string, string> = {
  plains: '#4a6b2a', hills: '#3d5a28', forest: '#1a3a1a', woodlands: '#2d5a2d',
  scrublands: '#5a6a3a', dirt: '#6a5a3a', mountain: '#5a5a5a', mountain_snow: '#8a9aaa',
  desert: '#8a7a4a', mesa: '#7a4a3a', oasis: '#6a7a4a', sand_palms: '#7a7a4a',
  jungle: '#1a4a1a', swamp: '#2a4a3a', bog: '#2a3a2a',
  snow: '#aab8ca', water: '#1a3a6a', ocean_calm: '#2a4a7a',
  ruins: '#4a4a5a', sovereign_ring: '#3a4a5a',
  wound_zone: '#5a2a1a', ash_plains: '#4a3a3a', burned_forest: '#3a2a1a', volcano: '#6a2a1a',
  farm: '#5a7a3a', mine: '#4a4a3a', forester: '#2a4a2a', port: '#5a5a4a',
  settlement: '#6a5a3a',
};

const TERRAIN_TILES: Record<string, string> = {
  plains: '/assets/hex/plains.png',
  hills: '/assets/hex/hills.png',
  forest: '/assets/hex/forest.png',
  woodlands: '/assets/hex/woodlands.png',
  scrublands: '/assets/hex/scrublands.png',
  dirt: '/assets/hex/dirt.png',
  mountain: '/assets/hex/mountain.png',
  mountain_snow: '/assets/hex/mountain_snow.png',
  desert: '/assets/hex/desert.png',
  mesa: '/assets/hex/mesa.png',
  oasis: '/assets/hex/oasis.png',
  sand_palms: '/assets/hex/sand_palms.png',
  jungle: '/assets/hex/jungle.png',
  swamp: '/assets/hex/swamp.png',
  bog: '/assets/hex/bog.png',
  snow: '/assets/hex/snow.png',
  water: '/assets/hex/water.png',
  ocean_calm: '/assets/hex/ocean_calm.png',
  ruins: '/assets/hex/ruins.png',
  sovereign_ring: '/assets/hex/sovereign_ring.png',
  wound_zone: '/assets/hex/wound_zone.png',
  ash_plains: '/assets/hex/ash_plains.png',
  burned_forest: '/assets/hex/burned_forest.png',
  volcano: '/assets/hex/volcano.png',
  farm: '/assets/hex/farm.png',
  mine: '/assets/hex/mine.png',
  forester: '/assets/hex/forester.png',
  port: '/assets/hex/port.png',
  settlement: '/assets/hex/settlement.png',
};

const TERRAIN_LABELS: Record<string, string> = {
  plains: 'Plains', hills: 'Hills', forest: 'Forest', woodlands: 'Woodlands',
  scrublands: 'Scrublands', dirt: 'Barren Ground', mountain: 'Mountain', mountain_snow: 'Frozen Peak',
  desert: 'Desert', mesa: 'Mesa', oasis: 'Oasis', sand_palms: 'Palm Shore',
  jungle: 'Jungle', swamp: 'Swamp', bog: 'Bog',
  snow: 'Snowfield', water: 'Deep Sea', ocean_calm: 'Calm Waters',
  ruins: 'Ancient Ruins', sovereign_ring: 'Sovereign Ring',
  wound_zone: 'Wound Zone', ash_plains: 'Ash Plains', burned_forest: 'Scorched Woods', volcano: 'Volcano',
  farm: 'Farmland', mine: 'Mine', forester: 'Lumber Camp', port: 'Harbor',
  settlement: 'Settlement',
};

const ZONE_LABELS: Record<string, string> = {
  hearthlands: 'The Hearthlands', contested_reaches: 'Contested Reaches',
  fractured_provinces: 'Fractured Provinces', wound_zones: 'The Wound Zones',
  sovereign_ring: 'Sovereign Ring',
};

const UNIT_ICONS: Record<string, string> = {
  militia: '\u2694\uFE0F',
  archer: '\u{1F3F9}',
  shieldbearer: '\u{1F6E1}\uFE0F',
  scout: '\u{1F441}\uFE0F',
  siege_ram: '\u{1F3D7}\uFE0F',
};

const UNIT_SPEEDS: Record<string, number> = {
  militia: 3,
  archer: 3,
  shieldbearer: 2,
  scout: 8,
  siege_ram: 1,
};

interface MapEvent {
  id: string;
  q: number;
  r: number;
  type: 'ruin' | 'resource_node' | 'npc_camp' | 'aether_surge';
  name: string;
  description?: string;
  rewards?: Record<string, number>;
  guardians?: Array<{ type: string; count: number }>;
}

interface HexTile {
  q: number; r: number; s: number;
  terrain: string; zone: string;
  resourceDeposit?: { type: string; richness: number } | null;
}

interface March {
  id: string;
  fromQ: number; fromR: number;
  toQ: number; toR: number;
  type: string;
  units: Record<string, number>;
  departedAt: number;
  arrivesAt: number;
}

// ── Image preloader ──
const imageCache: Record<string, HTMLImageElement> = {};
let imagesLoaded = false;
let imageLoadCallbacks: Array<() => void> = [];

function preloadTileImages(onAllLoaded: () => void) {
  if (imagesLoaded) {
    onAllLoaded();
    return;
  }

  imageLoadCallbacks.push(onAllLoaded);

  // Only kick off loading once (when cache is empty)
  if (Object.keys(imageCache).length > 0) return;

  let remaining = Object.keys(TERRAIN_TILES).length;

  const onLoad = () => {
    remaining--;
    if (remaining <= 0) {
      imagesLoaded = true;
      for (const cb of imageLoadCallbacks) cb();
      imageLoadCallbacks = [];
    }
  };

  for (const [key, src] of Object.entries(TERRAIN_TILES)) {
    const img = new Image();
    img.src = src;
    img.onload = onLoad;
    img.onerror = onLoad;
    imageCache[key] = img;
  }
}

function getTileImage(terrain: string): HTMLImageElement | null {
  const img = imageCache[terrain];
  if (img && img.complete && img.naturalWidth > 0) return img;
  return null;
}

// ── Coherent world map generation ──

/** Deterministic hash noise: returns 0..1 for any (x, y, seed) */
function hashNoise(x: number, y: number, seed: number): number {
  let h = (seed | 0) + (x | 0) * 374761393 + (y | 0) * 668265263;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return ((h & 0x7fffffff) / 0x7fffffff);
}

/** Smooth value noise via bilinear interpolation of hash grid */
function smoothNoise(x: number, y: number, seed: number, scale: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const fx = sx - ix;
  const fy = sy - iy;
  // Smoothstep
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const n00 = hashNoise(ix, iy, seed);
  const n10 = hashNoise(ix + 1, iy, seed);
  const n01 = hashNoise(ix, iy + 1, seed);
  const n11 = hashNoise(ix + 1, iy + 1, seed);

  const a = n00 + (n10 - n00) * ux;
  const b = n01 + (n11 - n01) * ux;
  return a + (b - a) * uy;
}

/** Multi-octave noise for richer terrain variation */
function fbmNoise(x: number, y: number, seed: number): number {
  return smoothNoise(x, y, seed, 6) * 0.5
       + smoothNoise(x, y, seed + 100, 3) * 0.3
       + smoothNoise(x, y, seed + 200, 1.5) * 0.2;
}

function generateDemoMap(radius: number, settlementQ: number, settlementR: number): HexTile[] {
  const tiles: HexTile[] = [];
  const center = hex(settlementQ, settlementR);
  const allHexes = hexesInRange(center, radius);
  const SEED = 42;

  for (const h of allHexes) {
    const dist = hexDistance(hex(0, 0), h);
    const zone = getZoneForDistance(dist, 400);

    // Pixel position for angle calculation (pointy-top hex layout)
    const px = Math.sqrt(3) * h.q + Math.sqrt(3) / 2 * h.r;
    const py = 1.5 * h.r;
    const angle = ((Math.atan2(py, px) * 180 / Math.PI) + 360) % 360; // 0-360°

    // Noise layers for terrain variety
    const elevation = fbmNoise(h.q, h.r, SEED);
    const moisture = fbmNoise(h.q, h.r, SEED + 500);
    const temperature = fbmNoise(h.q, h.r, SEED + 1000);
    const special = hashNoise(h.q, h.r, SEED + 2000);

    let terrain = 'plains';
    const normDist = dist / (radius || 1); // 0 at center, 1 at edge

    // ─── Settlement tile ───
    if (h.q === settlementQ && h.r === settlementR) {
      terrain = 'settlement';
    }
    // ─── Sovereign Ring (center 0-2) ───
    else if (dist <= 2) {
      if (dist === 0) terrain = 'sovereign_ring';
      else if (special < 0.3) terrain = 'ruins';
      else terrain = 'sovereign_ring';
    }
    // ─── Water bodies: ocean ring at map edge + lakes ───
    else if (normDist > 0.92) {
      // Outer ocean border
      terrain = elevation > 0.5 ? 'water' : 'ocean_calm';
    }
    else if (normDist > 0.85 && moisture > 0.7 && elevation < 0.4) {
      terrain = 'ocean_calm';
    }
    // ─── Interior lakes (connected blobs) ───
    else if (elevation < 0.15 && moisture > 0.55 && normDist > 0.3) {
      terrain = moisture > 0.75 ? 'water' : 'ocean_calm';
    }
    // ─── Wound Zones: SW sector (angle 180-250°), outer ring ───
    else if (angle > 180 && angle < 250 && normDist > 0.6) {
      const woundNoise = smoothNoise(h.q, h.r, SEED + 3000, 4);
      if (woundNoise > 0.7) terrain = 'volcano';
      else if (woundNoise > 0.5) terrain = 'wound_zone';
      else if (woundNoise > 0.3) terrain = 'ash_plains';
      else terrain = 'burned_forest';
    }
    // ─── Volcanic transition ───
    else if (angle > 170 && angle < 260 && normDist > 0.55 && temperature > 0.65) {
      terrain = special < 0.3 ? 'ash_plains' : 'burned_forest';
    }
    // ─── Snow/Cold: N sector (angle 250-310°), outer areas ───
    else if (angle > 250 && angle < 320 && normDist > 0.45) {
      if (elevation > 0.7) terrain = 'mountain_snow';
      else if (elevation > 0.5) terrain = 'snow';
      else if (moisture > 0.5) terrain = 'snow';
      else terrain = normDist > 0.7 ? 'mountain_snow' : 'snow';
    }
    // ─── Cold transition ───
    else if (angle > 240 && angle < 330 && normDist > 0.4 && temperature < 0.3) {
      terrain = elevation > 0.6 ? 'mountain_snow' : 'snow';
    }
    // ─── Desert/Arid: S-SE sector (angle 100-180°) ───
    else if (angle > 100 && angle < 185 && normDist > 0.35) {
      const dryNoise = smoothNoise(h.q, h.r, SEED + 4000, 5);
      if (dryNoise > 0.7) terrain = 'mesa';
      else if (dryNoise > 0.45) terrain = 'desert';
      else if (moisture > 0.6) terrain = 'oasis';
      else terrain = 'scrublands';
    }
    // ─── Desert transition: sandy edges ───
    else if (angle > 85 && angle < 195 && normDist > 0.3 && moisture < 0.3) {
      terrain = special < 0.4 ? 'sand_palms' : 'scrublands';
    }
    // ─── Tropical: SE sector (angle 50-110°), mid range ───
    else if (angle > 45 && angle < 115 && normDist > 0.3 && moisture > 0.45) {
      if (moisture > 0.7) terrain = 'jungle';
      else if (elevation < 0.3) terrain = 'bog';
      else if (moisture > 0.55) terrain = 'swamp';
      else terrain = 'jungle';
    }
    // ─── Mountain ranges: NE-SW diagonal chain ───
    else if (elevation > 0.72 && normDist > 0.25) {
      terrain = temperature < 0.35 ? 'mountain_snow' : 'mountain';
    }
    // ─── Temperate interior based on elevation + moisture ───
    else {
      if (elevation > 0.6) {
        terrain = 'hills';
      } else if (moisture > 0.65 && elevation > 0.35) {
        terrain = 'forest';
      } else if (moisture > 0.5) {
        terrain = special < 0.2 ? 'woodlands' : 'forest';
      } else if (elevation < 0.25 && moisture > 0.4) {
        terrain = 'swamp';
      } else if (moisture < 0.25) {
        terrain = 'scrublands';
      } else if (elevation > 0.4) {
        terrain = special < 0.3 ? 'hills' : 'woodlands';
      } else {
        terrain = 'plains';
      }

      // ─── Special location placement in hearthlands ───
      if (normDist > 0.15 && normDist < 0.5) {
        if (special < 0.04 && terrain === 'plains') terrain = 'farm';
        else if (special > 0.96 && terrain === 'hills') terrain = 'mine';
        else if (special > 0.93 && terrain === 'forest') terrain = 'forester';
        else if (special > 0.90 && special < 0.92) terrain = 'ruins';
      }

      // ─── Ruins scattered in mid/outer ring ───
      if (normDist > 0.4 && normDist < 0.8 && special > 0.92 && terrain !== 'water') {
        terrain = 'ruins';
      }

      // ─── Port near water ───
      if (terrain === 'plains' && normDist > 0.82 && normDist < 0.92 && special < 0.08) {
        terrain = 'port';
      }
    }

    const isRuins = terrain === 'ruins';
    tiles.push({
      ...h, terrain, zone,
      resourceDeposit: isRuins ? { type: 'aether_stone', richness: Math.floor(Math.abs(h.q * 3 + h.r * 5) % 5) + 1 } : null,
    });
  }
  return tiles;
}

function drawHexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i + 30);
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawHex(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, fillColor: string, state: 'normal' | 'hovered' | 'selected') {
  drawHexPath(ctx, cx, cy, size);

  if (state === 'selected') {
    ctx.fillStyle = lighten(fillColor, 50);
    ctx.fill();
    ctx.strokeStyle = '#D4A843';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (state === 'hovered') {
    ctx.fillStyle = lighten(fillColor, 25);
    ctx.fill();
    ctx.strokeStyle = 'rgba(123, 79, 191, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(107, 110, 115, 0.25)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

function drawHexOutline(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, state: 'hovered' | 'selected') {
  drawHexPath(ctx, cx, cy, size);
  if (state === 'selected') {
    ctx.strokeStyle = '#D4A843';
    ctx.lineWidth = 2;
  } else {
    ctx.strokeStyle = 'rgba(123, 79, 191, 0.6)';
    ctx.lineWidth = 1.5;
  }
  ctx.stroke();
}

function lighten(hexColor: string, amount: number): string {
  const num = parseInt(hexColor.slice(1), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0x00ff) + amount);
  const b = Math.min(255, (num & 0x0000ff) + amount);
  return `rgb(${r},${g},${b})`;
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return 'Arrived';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function HexMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });
  const [hoveredHex, setHoveredHex] = useState<string | null>(null);
  const [selectedTile, setSelectedTile] = useState<HexTile | null>(null);
  const [imagesReady, setImagesReady] = useState(false);

  // March state
  const [marchType, setMarchType] = useState<'attack' | 'scout' | 'reinforce'>('attack');
  const [marchUnits, setMarchUnits] = useState<Record<string, number>>({});
  const [marchEnabled, setMarchEnabled] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const [marchMessage, setMarchMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activeMarches, setActiveMarches] = useState<March[]>([]);
  const [mapEvents, setMapEvents] = useState<MapEvent[]>([]);
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);
  const [heroes, setHeroes] = useState<any[]>([]);
  const [visibleTiles, setVisibleTiles] = useState<Set<string>>(new Set());

  const settlements = useGameStore((s) => s.settlements);
  const activeSettlement = settlements[0];
  const sq = activeSettlement?.coordinates?.q ?? 0;
  const sr = activeSettlement?.coordinates?.r ?? 0;
  const units: Record<string, number> = (activeSettlement as any)?.units ?? {};
  const hasUnits = Object.values(units).some((v) => v > 0);

  const tilesRef = useRef<HexTile[]>(generateDemoMap(MAP_RADIUS, sq, sr));

  // Preload tile images
  useEffect(() => {
    preloadTileImages(() => setImagesReady(true));
  }, []);

  // Regenerate tiles if settlement changes
  useEffect(() => {
    tilesRef.current = generateDemoMap(MAP_RADIUS, sq, sr);
  }, [sq, sr]);

  // Fetch active marches
  useEffect(() => {
    if (!activeSettlement?.id) return;
    api.getMarches(activeSettlement.id)
      .then((data) => setActiveMarches(data.marches ?? []))
      .catch(() => {});
  }, [activeSettlement?.id]);

  // Fetch heroes when march form is visible
  useEffect(() => {
    const ownSettlement = selectedTile?.q === sq && selectedTile?.r === sr;
    if (!selectedTile || ownSettlement || !hasUnits) return;
    api.getHeroes().then(data => setHeroes(data.heroes)).catch(() => {});
  }, [selectedTile, sq, sr, hasUnits]);

  // Fetch map events
  useEffect(() => {
    api.getMapEvents(sq, sr, MAP_RADIUS)
      .then((data) => setMapEvents(data.events ?? []))
      .catch(() => setMapEvents([]));
  }, [sq, sr]);

  // Fetch fog of war visibility
  useEffect(() => {
    api.getVisibility()
      .then((data) => {
        const set = new Set<string>();
        for (const t of data.visibleTiles) {
          set.add(`${t.q},${t.r}`);
        }
        setVisibleTiles(set);
      })
      .catch(() => setVisibleTiles(new Set()));
  }, [sq, sr, activeMarches.length]);

  // Animate marches
  useEffect(() => {
    if (activeMarches.length === 0) return;
    const id = setInterval(() => {
      // Trigger redraw for march animation
      setActiveMarches((prev) => [...prev]);
    }, 500);
    return () => clearInterval(id);
  }, [activeMarches.length]);

  const getCanvasCenter = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    return { x: canvas.clientWidth / 2 + offset.x, y: canvas.clientHeight / 2 + offset.y };
  }, [offset]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const { x: centerX, y: centerY } = getCanvasCenter();

    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    const hexSize = HEX_SIZE * zoom;
    // Scale so asset width matches pointy-top hex width (sqrt(3) * hexSize)
    const hexWidth = Math.sqrt(3) * hexSize;
    const scale = hexWidth / TILE_W;
    const imgW = TILE_W * scale; // = hexWidth
    const imgH = TILE_H * scale;
    const faceOffY = imgH * FACE_CENTER_Y;

    // Sort tiles ascending by r: low r (top of screen) drawn first,
    // high r (bottom of screen) drawn last = rendered on top (isometric front)
    const sortedTiles = [...tilesRef.current].sort((a, b) => {
      if (a.r !== b.r) return a.r - b.r;
      return a.q - b.q;
    });

    // Helper: check if tile is on screen
    const isOnScreen = (px: number, py: number) =>
      px > -hexSize * 3 && px < canvas.clientWidth + hexSize * 3 &&
      py > -hexSize * 3 && py < canvas.clientHeight + hexSize * 3;

    // ═══════════════════════════════════════════════════
    // LAYER 1: Tile asset images (back-to-front by row)
    // ═══════════════════════════════════════════════════
    for (const tile of sortedTiles) {
      const { x, y } = hexToPixel(tile, hexSize);
      const px = centerX + x;
      const py = centerY + y;
      if (!isOnScreen(px, py)) continue;

      const isOwnSettlement = tile.q === sq && tile.r === sr;
      const tileTerrain = isOwnSettlement ? 'settlement' : tile.terrain;
      const tileImg = getTileImage(tileTerrain);

      if (tileImg) {
        // Draw tile image without clipping — overflow for immersion
        ctx.drawImage(tileImg, px - imgW / 2, py - faceOffY, imgW, imgH);
      } else {
        // Fallback: flat colored hex
        const color = TERRAIN_COLORS[tile.terrain] || '#2a2a2a';
        drawHex(ctx, px, py, hexSize - 1, color, 'normal');
      }
    }

    // ═══════════════════════════════════════════════════
    // LAYER 2: Hex grid overlay (pointy-top outlines)
    // ═══════════════════════════════════════════════════
    ctx.strokeStyle = 'rgba(232, 220, 200, 0.12)';
    ctx.lineWidth = 1;
    for (const tile of sortedTiles) {
      const { x, y } = hexToPixel(tile, hexSize);
      const px = centerX + x;
      const py = centerY + y;
      if (!isOnScreen(px, py)) continue;

      drawHexPath(ctx, px, py, hexSize);
      ctx.stroke();
    }

    // ═══════════════════════════════════════════════════
    // LAYER 3: Selection/hover highlights
    // ═══════════════════════════════════════════════════
    for (const tile of sortedTiles) {
      const key = hexKey(tile);
      const isSelected = selectedTile && hexKey(selectedTile) === key;
      const isHovered = hoveredHex === key;
      if (!isSelected && !isHovered) continue;

      const { x, y } = hexToPixel(tile, hexSize);
      const px = centerX + x;
      const py = centerY + y;
      if (!isOnScreen(px, py)) continue;

      const state: 'hovered' | 'selected' = isSelected ? 'selected' : 'hovered';
      drawHexOutline(ctx, px, py, hexSize - 1, state);
    }

    // ═══════════════════════════════════════════════════
    // LAYER 4: Markers, events, settlement labels
    // ═══════════════════════════════════════════════════
    for (const tile of sortedTiles) {
      const { x, y } = hexToPixel(tile, hexSize);
      const px = centerX + x;
      const py = centerY + y;
      if (!isOnScreen(px, py)) continue;

      const isOwnSettlement = tile.q === sq && tile.r === sr;
      const tileVisible = visibleTiles.size === 0 || visibleTiles.has(`${tile.q},${tile.r}`);

      // Settlement marker
      if (isOwnSettlement) {
        const tileImg = getTileImage('settlement');
        if (!tileImg) {
          ctx.fillStyle = '#D4A843';
          ctx.beginPath();
          ctx.arc(px, py, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0a0e1a';
          ctx.font = 'bold 8px Inter';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('\u{1F3F0}', px, py);
        }

        ctx.fillStyle = '#E8DCC8';
        ctx.font = 'bold 10px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(activeSettlement?.name ?? 'Home', px, py + hexSize * 0.55);
      }

      if (tileVisible) {
        if (tile.terrain === 'ruins' && !getTileImage('ruins')) {
          ctx.fillStyle = 'rgba(123, 79, 191, 0.5)';
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(123, 79, 191, 0.15)';
          ctx.beginPath();
          ctx.arc(px, py, 10, 0, Math.PI * 2);
          ctx.fill();
        }

        const tileEvent = mapEvents.find((e) => e.q === tile.q && e.r === tile.r);
        if (tileEvent) {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          if (tileEvent.type === 'ruin') {
            ctx.font = '12px Inter';
            ctx.fillText('\u{1F3DB}\u{FE0F}', px, py);
          } else if (tileEvent.type === 'resource_node') {
            ctx.font = '12px Inter';
            ctx.fillText('\u{1F4B0}', px, py);
          } else if (tileEvent.type === 'npc_camp') {
            ctx.fillStyle = 'rgba(224, 85, 85, 0.2)';
            ctx.beginPath();
            ctx.arc(px, py, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = '12px Inter';
            ctx.fillText('\u{2694}\u{FE0F}', px, py);
          } else if (tileEvent.type === 'aether_surge') {
            ctx.fillStyle = 'rgba(123, 79, 191, 0.25)';
            ctx.beginPath();
            ctx.arc(px, py, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(123, 79, 191, 0.1)';
            ctx.beginPath();
            ctx.arc(px, py, 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = '12px Inter';
            ctx.fillText('\u{1F48E}', px, py);
          }
        }
      }
    }

    // Draw active marches
    for (const march of activeMarches) {
      const fromPixel = hexToPixel(hex(march.fromQ, march.fromR), hexSize);
      const toPixel = hexToPixel(hex(march.toQ, march.toR), hexSize);
      const fromPx = centerX + fromPixel.x;
      const fromPy = centerY + fromPixel.y;
      const toPx = centerX + toPixel.x;
      const toPy = centerY + toPixel.y;

      const now = Date.now();
      const totalDuration = march.arrivesAt - march.departedAt;
      const elapsed = now - march.departedAt;
      const progress = totalDuration > 0 ? Math.min(1, Math.max(0, elapsed / totalDuration)) : 1;

      // Draw dashed line from settlement to target
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = march.type === 'attack' ? 'rgba(212, 168, 67, 0.4)'
        : march.type === 'scout' ? 'rgba(123, 79, 191, 0.4)'
        : 'rgba(100, 180, 100, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(fromPx, fromPy);
      ctx.lineTo(toPx, toPy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw moving dot
      const dotX = fromPx + (toPx - fromPx) * progress;
      const dotY = fromPy + (toPy - fromPy) * progress;
      const dotColor = march.type === 'attack' ? '#D4A843'
        : march.type === 'scout' ? '#7B4FBF'
        : '#64B464';

      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Glow effect
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ── Fog of War overlay pass ──
    if (visibleTiles.size > 0) {
      for (const tile of sortedTiles) {
        const tileKey = `${tile.q},${tile.r}`;
        if (visibleTiles.has(tileKey)) continue;

        const { x, y } = hexToPixel(tile, hexSize);
        const px = centerX + x;
        const py = centerY + y;

        if (px < -hexSize * 2 || px > canvas.clientWidth + hexSize * 2) continue;
        if (py < -hexSize * 2 || py > canvas.clientHeight + hexSize * 2) continue;

        // Check if this fogged tile borders a visible tile (for gradient edge)
        let isBoundary = false;
        const neighbors = [
          [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
        ];
        for (const [dq, dr] of neighbors) {
          if (visibleTiles.has(`${tile.q + dq},${tile.r + dr}`)) {
            isBoundary = true;
            break;
          }
        }

        // Draw fog hex clipped to flat-top hex shape
        ctx.save();
        drawHexPath(ctx, px, py, hexSize);
        ctx.clip();

        if (isBoundary) {
          const grad = ctx.createRadialGradient(px, py, 0, px, py, hexSize);
          grad.addColorStop(0, 'rgba(10, 15, 30, 0.35)');
          grad.addColorStop(1, 'rgba(10, 15, 30, 0.65)');
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = 'rgba(10, 15, 30, 0.75)';
        }
        ctx.fillRect(px - hexSize, py - hexSize, hexSize * 2, hexSize * 2);
        ctx.restore();
      }
    }
  }, [offset, zoom, hoveredHex, selectedTile, getCanvasCenter, sq, sr, activeSettlement?.name, activeMarches, mapEvents, visibleTiles, imagesReady]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  const screenToHex = (clientX: number, clientY: number): HexTile | undefined => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { x: centerX, y: centerY } = getCanvasCenter();
    const mx = clientX - rect.left - centerX;
    const my = clientY - rect.top - centerY;
    const coord = pixelToHex(mx, my, HEX_SIZE * zoom);
    return tilesRef.current.find((t) => t.q === coord.q && t.r === coord.r);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    setMouseDownPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    } else {
      const tile = screenToHex(e.clientX, e.clientY);
      setHoveredHex(tile ? hexKey(tile) : null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const dx = Math.abs(e.clientX - mouseDownPos.x);
    const dy = Math.abs(e.clientY - mouseDownPos.y);
    // Click (not drag)
    if (dx < 5 && dy < 5) {
      const tile = screenToHex(e.clientX, e.clientY);
      setSelectedTile(tile ?? null);
      setMarchMessage(null);
      // Default to attack if tile has guarded event
      if (tile) {
        const tileEvent = mapEvents.find((ev) => ev.q === tile.q && ev.r === tile.r);
        if (tileEvent?.guardians && tileEvent.guardians.length > 0) {
          setMarchType('attack');
        }
      }
    }
    setDragging(false);
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.min(3, Math.max(0.3, prev + delta)));
  }, []);

  const handleSendMarch = async () => {
    if (!activeSettlement || !selectedTile || sending) return;
    const selectedUnits: Record<string, number> = {};
    for (const [type, enabled] of Object.entries(marchEnabled)) {
      if (enabled && (marchUnits[type] ?? 0) > 0) {
        selectedUnits[type] = marchUnits[type];
      }
    }
    if (Object.keys(selectedUnits).length === 0) return;

    setSending(true);
    setMarchMessage(null);
    try {
      await api.sendMarch(activeSettlement.id, selectedUnits, selectedTile.q, selectedTile.r, marchType, selectedHeroId ?? undefined);
      setMarchMessage({ text: 'March sent!', type: 'success' });
      // Refresh marches and settlements
      const [marchData, settlementData] = await Promise.all([
        api.getMarches(activeSettlement.id),
        api.getSettlements(),
      ]);
      setActiveMarches(marchData.marches ?? []);
      useGameStore.getState().setSettlements(settlementData.settlements);
      // Reset unit selection and hero
      setMarchUnits({});
      setMarchEnabled({});
      setSelectedHeroId(null);
    } catch (err) {
      setMarchMessage({ text: err instanceof Error ? err.message : 'Failed to send march', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  // Calculate estimated travel time based on slowest selected unit
  const getEstimatedTravelTime = (): number | null => {
    if (!selectedTile) return null;
    const dist = hexDistance(hex(sq, sr), selectedTile);
    if (dist === 0) return null;

    let slowestSpeed = Infinity;
    let hasSelected = false;
    for (const [type, enabled] of Object.entries(marchEnabled)) {
      if (enabled && (marchUnits[type] ?? 0) > 0) {
        hasSelected = true;
        const speed = UNIT_SPEEDS[type] ?? 3;
        if (speed < slowestSpeed) slowestSpeed = speed;
      }
    }
    if (!hasSelected) return null;
    return dist * MARCH_SPEED_SECONDS_PER_HEX / slowestSpeed;
  };

  const isOwnSettlement = selectedTile?.q === sq && selectedTile?.r === sr;
  const selectedTileVisible = selectedTile
    ? (visibleTiles.size === 0 || visibleTiles.has(`${selectedTile.q},${selectedTile.r}`))
    : false;
  const travelTime = getEstimatedTravelTime();


  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setDragging(false); setHoveredHex(null); }}
        onWheel={handleWheel}
      />

      {/* Tile Info Panel */}
      {selectedTile && (
        <div className="absolute top-4 right-4 w-72 max-h-[calc(100%-2rem)] overflow-y-auto p-4 rounded-lg border border-[var(--ruin-grey)]/30 bg-[var(--veil-blue)]/95 backdrop-blur-sm">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-sm font-semibold" style={{ fontFamily: 'Cinzel, serif', color: 'var(--ember-gold)' }}>
              {selectedTileVisible ? (TERRAIN_LABELS[selectedTile.terrain] || selectedTile.terrain) : 'Shrouded Land'}
            </h3>
            <button
              onClick={() => setSelectedTile(null)}
              className="text-[var(--ruin-grey)] hover:text-[var(--parchment)] text-lg leading-none"
            >
              x
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--parchment-dim)]">Zone</span>
              <span className="text-[var(--parchment)]">{ZONE_LABELS[selectedTile.zone] || selectedTile.zone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--parchment-dim)]">Coordinates</span>
              <span className="text-[var(--parchment)] font-mono">{selectedTile.q}, {selectedTile.r}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--parchment-dim)]">Distance</span>
              <span className="text-[var(--parchment)]">{hexDistance(hex(sq, sr), selectedTile)} tiles</span>
            </div>

            {!selectedTileVisible && (
              <div className="mt-2 p-2 rounded bg-[rgba(10,15,30,0.5)] border border-[var(--ruin-grey)]/20">
                <p className="text-[var(--ruin-grey)] italic text-center">
                  "The fog obscures this land. Expand your vision to reveal its secrets."
                </p>
              </div>
            )}

            {selectedTileVisible && selectedTile.resourceDeposit && (
              <div className="mt-2 p-2 rounded bg-[var(--aether-violet)]/10 border border-[var(--aether-violet)]/20">
                <span className="text-[var(--aether-violet)] font-semibold">Aether Deposit</span>
                <div className="flex justify-between mt-1">
                  <span className="text-[var(--parchment-dim)]">Richness</span>
                  <span className="text-[var(--aether-violet)]">
                    {'*'.repeat(selectedTile.resourceDeposit.richness)}
                  </span>
                </div>
              </div>
            )}

            {isOwnSettlement && (
              <div className="mt-2 p-2 rounded bg-[var(--ember-gold)]/10 border border-[var(--ember-gold)]/20">
                <span className="text-[var(--ember-gold)] font-semibold">Your Settlement</span>
                <p className="text-[var(--parchment-dim)] mt-1">{activeSettlement?.name}</p>
              </div>
            )}

            {selectedTileVisible && selectedTile.terrain === 'ruins' && !isOwnSettlement && (
              <p className="text-[var(--ruin-grey)] italic mt-2">
                "Ancient structures rise from the earth. Something glows faintly within..."
              </p>
            )}

            {selectedTileVisible && (selectedTile.terrain === 'mountain' || selectedTile.terrain === 'mountain_snow') && (
              <p className="text-[var(--ruin-grey)] italic mt-2">
                {selectedTile.terrain === 'mountain_snow'
                  ? '"Frozen peaks claw at the sky. Even the wind dares not climb higher."'
                  : '"Impassable peaks. The old world\'s bones jut skyward."'}
              </p>
            )}

            {selectedTileVisible && selectedTile.terrain === 'volcano' && (
              <p className="text-[var(--ruin-grey)] italic mt-2">
                "The mountain bleeds fire. The Veil's wound festers here, deep and old."
              </p>
            )}

            {selectedTileVisible && (selectedTile.terrain === 'wound_zone' || selectedTile.terrain === 'ash_plains') && (
              <p className="text-[var(--ruin-grey)] italic mt-2">
                "Scorched earth. Nothing grows where the Veil has ruptured."
              </p>
            )}

            {/* Map Event Info — only shown for visible tiles */}
            {selectedTileVisible && (() => {
              const tileEvent = mapEvents.find((e) => e.q === selectedTile.q && e.r === selectedTile.r);
              if (!tileEvent) return null;

              const eventTypeLabels: Record<string, { label: string; icon: string; color: string }> = {
                ruin: { label: 'Ancient Ruin', icon: '\u{1F3DB}\u{FE0F}', color: 'var(--aether-violet)' },
                resource_node: { label: 'Resource Node', icon: '\u{1F4B0}', color: 'var(--ember-gold)' },
                npc_camp: { label: 'NPC Camp', icon: '\u{2694}\u{FE0F}', color: '#e05555' },
                aether_surge: { label: 'Aether Surge', icon: '\u{1F48E}', color: 'var(--aether-violet)' },
              };
              const typeInfo = eventTypeLabels[tileEvent.type] ?? eventTypeLabels.ruin;

              return (
                <div className="mt-2 p-2 rounded border" style={{ borderColor: `${typeInfo.color}30`, background: `${typeInfo.color}10` }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">{typeInfo.icon}</span>
                    <span className="text-xs font-semibold" style={{ color: typeInfo.color }}>
                      {tileEvent.name || typeInfo.label}
                    </span>
                  </div>
                  {tileEvent.description && (
                    <p className="text-xs text-[var(--parchment-dim)] leading-relaxed mb-1">
                      {tileEvent.description}
                    </p>
                  )}
                  {tileEvent.rewards && Object.keys(tileEvent.rewards).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-1">
                      <span className="text-[10px] text-[var(--parchment-dim)]">Rewards:</span>
                      {Object.entries(tileEvent.rewards).map(([res, amount]) => (
                        <span key={res} className="text-[10px] text-[var(--ember-gold)]">
                          {res.replace('_', ' ')} +{amount}
                        </span>
                      ))}
                    </div>
                  )}
                  {tileEvent.guardians && tileEvent.guardians.length > 0 && (
                    <div className="text-[10px] text-red-400">
                      Guarded by: {tileEvent.guardians.map((g) => `${g.count} ${g.type.replace('_', ' ')}`).join(', ')}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Send March Section */}
          {hasUnits && !isOwnSettlement && (
            <div className="mt-4 pt-3 border-t border-[var(--ruin-grey)]/20">
              <h4 className="text-xs font-semibold text-[var(--ember-gold)] mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
                Send March
              </h4>

              {marchMessage && (
                <div className={`mb-2 p-2 rounded text-xs ${
                  marchMessage.type === 'success'
                    ? 'bg-green-900/30 border border-green-700/50 text-green-300'
                    : 'bg-red-900/30 border border-red-700/50 text-red-300'
                }`}>
                  {marchMessage.text}
                </div>
              )}

              {/* March type selector */}
              <div className="flex gap-1 mb-3">
                {(['attack', 'scout', 'reinforce'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setMarchType(type)}
                    className={`flex-1 px-2 py-1 rounded text-xs capitalize transition-colors ${
                      marchType === type
                        ? 'bg-[var(--ember-gold)]/20 border border-[var(--ember-gold)]/40 text-[var(--ember-gold)]'
                        : 'bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/20 text-[var(--parchment-dim)] hover:text-[var(--parchment)]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Unit selection */}
              <div className="space-y-2 mb-3">
                {Object.entries(units).filter(([, count]) => count > 0).map(([type, available]) => (
                  <div key={type} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={marchEnabled[type] ?? false}
                      onChange={(e) => {
                        setMarchEnabled((prev) => ({ ...prev, [type]: e.target.checked }));
                        if (!e.target.checked) setMarchUnits((prev) => ({ ...prev, [type]: 0 }));
                      }}
                      className="w-3 h-3 accent-[var(--ember-gold)]"
                    />
                    <span className="text-xs">{UNIT_ICONS[type] ?? '?'}</span>
                    <span className="text-xs text-[var(--parchment)] flex-1 capitalize">{type.replace('_', ' ')}</span>
                    <input
                      type="number"
                      min={0}
                      max={available}
                      value={marchUnits[type] ?? 0}
                      disabled={!marchEnabled[type]}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(available, parseInt(e.target.value) || 0));
                        setMarchUnits((prev) => ({ ...prev, [type]: val }));
                      }}
                      className="w-14 px-1 py-0.5 text-xs rounded bg-[var(--veil-blue-deep)] border border-[var(--ruin-grey)]/30 text-[var(--parchment)] text-center disabled:opacity-40"
                    />
                    <span className="text-xs text-[var(--ruin-grey)]">/{available}</span>
                  </div>
                ))}
              </div>

              {/* Estimated travel time */}
              {travelTime != null && (
                <div className="flex justify-between text-xs mb-3">
                  <span className="text-[var(--parchment-dim)]">Travel time</span>
                  <span className="text-[var(--parchment)]">{formatTime(travelTime)}</span>
                </div>
              )}

              {/* Hero Assignment */}
              <div className="mb-3">
                <label className="text-xs text-[var(--parchment-dim)]">Assign Hero</label>
                <select
                  value={selectedHeroId ?? ''}
                  onChange={(e) => setSelectedHeroId(e.target.value || null)}
                  className="w-full mt-1 px-2 py-1 rounded text-xs bg-[var(--veil-blue)] border border-[var(--ruin-grey)]/30 text-[var(--parchment)]"
                >
                  <option value="">No Hero</option>
                  {heroes.filter(h => h.status === 'idle').map((hero: any) => (
                    <option key={hero.id} value={hero.id}>
                      {hero.name} (Lv{hero.level} {hero.heroClass})
                    </option>
                  ))}
                </select>
              </div>

              {/* Send button */}
              <button
                disabled={sending || !Object.entries(marchEnabled).some(([type, on]) => on && (marchUnits[type] ?? 0) > 0)}
                onClick={handleSendMarch}
                className={`w-full px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  !sending && Object.entries(marchEnabled).some(([type, on]) => on && (marchUnits[type] ?? 0) > 0)
                    ? 'bg-[var(--ember-gold)]/20 border border-[var(--ember-gold)]/40 text-[var(--ember-gold)] hover:bg-[var(--ember-gold)]/30'
                    : 'bg-[var(--ruin-grey)]/20 border border-[var(--ruin-grey)]/20 text-[var(--ruin-grey)] cursor-not-allowed'
                }`}
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 p-3 rounded-lg bg-[var(--veil-blue)]/90 border border-[var(--ruin-grey)]/20 text-xs max-h-[280px] overflow-y-auto">
        <p className="text-[var(--ember-gold)] font-semibold mb-2" style={{ fontFamily: 'Cinzel, serif' }}>World Map</p>
        <div className="space-y-1">
          {[
            ['#4a6b2a', 'Plains'],  ['#1a3a1a', 'Forest'],   ['#3d5a28', 'Hills'],
            ['#5a5a5a', 'Mountain'],['#8a7a4a', 'Desert'],   ['#2a4a3a', 'Swamp'],
            ['#aab8ca', 'Snow'],    ['#1a4a1a', 'Jungle'],   ['#5a2a1a', 'Wound Zone'],
            ['#1a3a6a', 'Deep Sea'],['#3a4a5a', 'Sovereign Ring'],
          ].map(([color, label]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
              <span className="text-[var(--parchment-dim)]">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-1 pt-1 border-t border-[var(--ruin-grey)]/15">
            <span className="w-3 h-3 rounded-full" style={{ background: '#D4A843' }} />
            <span className="text-[var(--parchment-dim)]">Your Settlement</span>
          </div>
          {mapEvents.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-1 pt-1 border-t border-[var(--ruin-grey)]/15">
                <span className="text-[10px]">{'\u{1F3DB}\u{FE0F}'}</span>
                <span className="text-[var(--parchment-dim)]">Ruin</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px]">{'\u{1F4B0}'}</span>
                <span className="text-[var(--parchment-dim)]">Resource Node</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px]">{'\u{2694}\u{FE0F}'}</span>
                <span className="text-[var(--parchment-dim)]">NPC Camp</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px]">{'\u{1F48E}'}</span>
                <span className="text-[var(--parchment-dim)]">Aether Surge</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Coordinates display */}
      {hoveredHex && (
        <div className="absolute top-4 left-4 px-3 py-1.5 rounded bg-[var(--veil-blue)]/90 border border-[var(--ruin-grey)]/20 text-xs font-mono text-[var(--parchment-dim)]">
          {hoveredHex}
        </div>
      )}

    </div>
  );
}
