import { useRef, useEffect, useCallback, memo } from 'react';

interface MinimapProps {
  playerSettlements: Array<{ q: number; r: number }>;
  mapCenter: { q: number; r: number };
  mapEvents: Array<{ q: number; r: number; type: string }>;
  activeMarches?: Array<{
    fromQ: number; fromR: number;
    toQ: number; toR: number;
    departedAt: number; arrivesAt: number;
  }>;
  viewportHexRadius?: number;
  onNavigate: (q: number, r: number) => void;
}

// Minimap covers q from -20 to 20, r from -20 to 20
const MAP_RANGE = 20;
const MINIMAP_SIZE = 240;
const PADDING = 4;
const CANVAS_AREA = MINIMAP_SIZE - PADDING * 2;
const LABEL_HEIGHT = 12;

const EVENT_COLORS: Record<string, string> = {
  ruin: '#9F7AEA',
  resource_node: '#48BB78',
  npc_camp: '#F56565',
  aether_surge: '#63B3ED',
};

/**
 * Convert hex (q, r) to minimap pixel coordinates.
 * Uses pointy-top hex layout (honeycomb):
 *   px_x = size * (sqrt(3) * q + sqrt(3)/2 * r)
 *   px_y = size * (3/2 * r)
 * We normalize so that the coordinate range [-20..20] maps to [0..CANVAS_AREA].
 */
function hexToMinimap(q: number, r: number): { x: number; y: number } {
  const rawX = Math.sqrt(3) * q + Math.sqrt(3) / 2 * r;
  const rawY = 1.5 * r;

  const maxExtent = Math.sqrt(3) * MAP_RANGE; // ~34.64
  const scale = CANVAS_AREA / (maxExtent * 2);

  const x = PADDING + CANVAS_AREA / 2 + rawX * scale;
  const y = PADDING + LABEL_HEIGHT + (CANVAS_AREA - LABEL_HEIGHT) / 2 + rawY * scale;

  return { x, y };
}

function minimapToHex(px: number, py: number): { q: number; r: number } {
  const maxExtent = Math.sqrt(3) * MAP_RANGE;
  const scale = CANVAS_AREA / (maxExtent * 2);

  const rawX = (px - PADDING - CANVAS_AREA / 2) / scale;
  const rawY = (py - PADDING - LABEL_HEIGHT - (CANVAS_AREA - LABEL_HEIGHT) / 2) / scale;

  // Reverse the pointy-top hex-to-pixel formula:
  // rawX = sqrt(3) * q + sqrt(3)/2 * r
  // rawY = 1.5 * r  =>  r = rawY / 1.5
  const r = rawY / 1.5;
  const q = (rawX - Math.sqrt(3) / 2 * r) / Math.sqrt(3);

  return { q: Math.round(q), r: Math.round(r) };
}

const Minimap = memo<MinimapProps>(function Minimap({
  playerSettlements,
  mapCenter,
  mapEvents,
  activeMarches = [],
  viewportHexRadius = 8,
  onNavigate,
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_SIZE * dpr;
    canvas.height = MINIMAP_SIZE * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // Background
    ctx.fillStyle = 'rgba(26, 39, 68, 0.9)';
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // Draw subtle background grid
    ctx.strokeStyle = 'rgba(107, 110, 115, 0.1)';
    ctx.lineWidth = 0.5;
    const gridSpacing = CANVAS_AREA / 8;
    for (let i = 0; i <= 8; i++) {
      const gx = PADDING + i * gridSpacing;
      const gy = PADDING + LABEL_HEIGHT + i * ((CANVAS_AREA - LABEL_HEIGHT) / 8);
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(gx, PADDING + LABEL_HEIGHT);
      ctx.lineTo(gx, MINIMAP_SIZE - PADDING);
      ctx.stroke();
      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(PADDING, gy);
      ctx.lineTo(MINIMAP_SIZE - PADDING, gy);
      ctx.stroke();
    }

    // "MINIMAP" label
    ctx.fillStyle = 'rgba(232, 220, 200, 0.4)';
    ctx.font = '8px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('MINIMAP', MINIMAP_SIZE / 2, PADDING + 1);

    // Draw map events (colored dots by type)
    for (const event of mapEvents) {
      if (Math.abs(event.q) > MAP_RANGE || Math.abs(event.r) > MAP_RANGE) continue;
      const { x, y } = hexToMinimap(event.q, event.r);
      const color = EVENT_COLORS[event.type] || '#6B6E73';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw other settlements as grey dots (placeholder for future multiplayer visibility)
    // Currently we only have player settlements, so skip grey dots

    // Draw player settlements (gold dots)
    for (const settlement of playerSettlements) {
      if (Math.abs(settlement.q) > MAP_RANGE || Math.abs(settlement.r) > MAP_RANGE) continue;
      const { x, y } = hexToMinimap(settlement.q, settlement.r);
      ctx.fillStyle = '#D4A843';
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw active marches (moving red dots)
    const now = Date.now();
    for (const march of activeMarches) {
      const totalDuration = march.arrivesAt - march.departedAt;
      const elapsed = now - march.departedAt;
      const progress = totalDuration > 0 ? Math.min(1, Math.max(0, elapsed / totalDuration)) : 1;

      const from = hexToMinimap(march.fromQ, march.fromR);
      const to = hexToMinimap(march.toQ, march.toR);

      const dotX = from.x + (to.x - from.x) * progress;
      const dotY = from.y + (to.y - from.y) * progress;

      // Draw march path as a thin line
      ctx.strokeStyle = 'rgba(245, 101, 101, 0.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();

      // Moving red dot
      ctx.fillStyle = '#F56565';
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw current viewport rectangle
    const center = hexToMinimap(mapCenter.q, mapCenter.r);
    // Approximate viewport size: the viewport shows viewportHexRadius hexes in each direction
    // We compute the pixel extent of that radius on the minimap
    const topLeft = hexToMinimap(
      mapCenter.q - viewportHexRadius,
      mapCenter.r - viewportHexRadius,
    );
    const bottomRight = hexToMinimap(
      mapCenter.q + viewportHexRadius,
      mapCenter.r + viewportHexRadius,
    );

    const rectW = Math.abs(bottomRight.x - topLeft.x);
    const rectH = Math.abs(bottomRight.y - topLeft.y);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      center.x - rectW / 2,
      center.y - rectH / 2,
      rectW,
      rectH,
    );
  }, [playerSettlements, mapCenter, mapEvents, activeMarches, viewportHexRadius]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const { q, r } = minimapToHex(px, py);
    onNavigate(q, r);
  }, [onNavigate]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        width: MINIMAP_SIZE + 32,
        height: MINIMAP_SIZE + 32,
        background: `url(/assets/gui/minimap/mm_full_frame.png) center/contain no-repeat`,
        padding: 16,
        zIndex: 10,
        pointerEvents: 'auto',
      }}
    >
      <canvas
        ref={canvasRef}
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        style={{
          width: MINIMAP_SIZE,
          height: MINIMAP_SIZE,
          cursor: 'pointer',
          display: 'block',
        }}
        onClick={handleClick}
      />
    </div>
  );
});

export default Minimap;
