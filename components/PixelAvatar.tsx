import { pixelGrid } from '@/lib/style';

/**
 * Renders a deterministic, horizontally-mirrored pixel avatar from a hash key.
 * Pure black-and-white SVG with crisp edges so it feels like a Game Boy sprite.
 */
export default function PixelAvatar({
  keyId,
  size = 5,
  px = 8,
  density = 0.55,
  className = '',
  bordered = false,
}: {
  keyId: string;
  size?: number;
  px?: number;
  density?: number;
  className?: string;
  bordered?: boolean;
}) {
  const grid = pixelGrid(keyId, size, density);
  const W = size * px;
  const stroke = 'var(--pkm-stroke)';
  const paper = 'var(--pkm-paper)';
  return (
    <svg
      width={W}
      height={W}
      viewBox={`0 0 ${W} ${W}`}
      shapeRendering="crispEdges"
      className={`block ${className}`}
      style={
        bordered
          ? { background: paper, boxShadow: `0 0 0 2px ${stroke}` }
          : { background: paper }
      }
      aria-hidden="true"
    >
      {grid.map((row, y) =>
        row.map((on, x) =>
          on ? (
            <rect
              key={`${x}-${y}`}
              x={x * px}
              y={y * px}
              width={px}
              height={px}
              fill={stroke}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
