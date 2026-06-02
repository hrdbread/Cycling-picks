import PixelAvatar from './PixelAvatar';
import { teamMonogram } from '@/lib/style';

export type TeamCardData = {
  id: number;
  name: string;
  pcs_slug?: string | null;
  shirt_url?: string | null;     // local path under /shirts/, e.g. "/shirts/<slug>.png"
};

type Size = 'sm' | 'md';

const sizeMap: Record<
  Size,
  { name: string; px: number; gridSize: number; mono: string }
> = {
  sm: { name: 'text-[10px]', px: 7, gridSize: 6, mono: 'text-3xl' },
  md: { name: 'text-xs', px: 9, gridSize: 7, mono: 'text-5xl' },
};

export default function TeamCard({
  team,
  selected = false,
  disabled = false,
  cancelled = false,
  size = 'md',
  onClick,
}: {
  team: TeamCardData;
  selected?: boolean;
  disabled?: boolean;
  cancelled?: boolean;
  size?: Size;
  onClick?: () => void;
}) {
  const s = sizeMap[size];
  const isButton = typeof onClick === 'function';
  const Tag = isButton ? 'button' : 'div';
  const monogram = teamMonogram(team.name);
  const hasShirt = Boolean(team.shirt_url);
  return (
    <Tag
      type={isButton ? 'button' : undefined}
      onClick={onClick}
      disabled={isButton ? disabled : undefined}
      aria-pressed={isButton ? selected : undefined}
      className={`pkm-frame text-left relative ${
        selected ? 'translate-x-[-2px] translate-y-[-2px] pkm-frame--inverted' : ''
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${
        isButton ? 'cursor-pointer' : ''
      }`}
    >
      <div className={`font-arcade ${s.name} truncate uppercase mb-1`}>
        {team.name}
      </div>
      <div className="aspect-[5/3] border-4 border-current flex items-center justify-center relative overflow-hidden bg-pkm-chrome">
        {hasShirt ? (
          // Real PCS jersey, server-side downscaled + posterised to 4 greys.
          // Browser nearest-neighbours it up to fill the frame, giving the
          // chunky 8-bit team-logo look.
          <img
            src={team.shirt_url!}
            alt=""
            className="w-full h-full object-contain p-1"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          // Fallback: procedural pattern + monogram for teams whose jersey
          // hasn't been synced yet.
          <div className="flex items-center justify-center gap-3 px-2 w-full h-full">
            <PixelAvatar
              keyId={team.pcs_slug ?? team.name}
              size={s.gridSize}
              px={s.px}
              density={0.45}
            />
            <span className={`font-arcade ${s.mono} text-pkm-stroke`}>
              {monogram}
            </span>
          </div>
        )}
        {cancelled && (
          <div className="absolute inset-0 flex items-center justify-center pkm-hatch">
            <span className="font-arcade text-[10px] bg-pkm-paper text-pkm-stroke px-2 py-1 border-2 border-pkm-stroke">
              CANCELLED
            </span>
          </div>
        )}
      </div>
      <div className="font-arcade text-[8px] mt-1 opacity-70 uppercase">
        BEST-TEAM TIEBREAKER
      </div>
    </Tag>
  );
}
