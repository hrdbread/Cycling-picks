import PixelAvatar from './PixelAvatar';
import { countryCode } from '@/lib/style';

export type RiderCardData = {
  id: number;
  pcs_slug?: string;
  name: string;
  country: string | null;
  team_id?: number | null;
  team_name?: string | null;
  team_slug?: string | null;
  /** Local URL of the team's pixelated jersey, if synced. */
  team_shirt_url?: string | null;
};

type Size = 'sm' | 'md' | 'lg';

const sizeMap: Record<
  Size,
  { card: string; px: number; gridSize: number; name: string; team: string }
> = {
  sm: { card: 'w-full',         px: 8,  gridSize: 6, name: 'text-[10px]', team: 'text-[8px]' },
  md: { card: 'w-full',         px: 10, gridSize: 7, name: 'text-xs',     team: 'text-[9px]' },
  lg: { card: 'w-full',         px: 12, gridSize: 8, name: 'text-sm',     team: 'text-[10px]' },
};

export default function RiderCard({
  rider,
  selected = false,
  disabled = false,
  size = 'md',
  cancelled = false,
  onClick,
}: {
  rider: RiderCardData;
  selected?: boolean;
  disabled?: boolean;
  size?: Size;
  cancelled?: boolean;
  onClick?: () => void;
}) {
  const s = sizeMap[size];
  const isButton = typeof onClick === 'function';
  const Tag = isButton ? 'button' : 'div';
  const tokens = rider.name.replace(/[*]/g, '').trim().split(/\s+/);
  const surname = tokens[0] ?? rider.name;
  const firstname = tokens.slice(1).join(' ');

  return (
    <Tag
      type={isButton ? 'button' : undefined}
      onClick={onClick}
      disabled={isButton ? disabled : undefined}
      aria-pressed={isButton ? selected : undefined}
      className={`pkm-frame ${s.card} text-left relative ${
        selected ? 'translate-x-[-2px] translate-y-[-2px] pkm-frame--inverted' : ''
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${
        isButton ? 'cursor-pointer' : ''
      }`}
    >
      <div className={`flex items-center justify-between gap-1 mb-1 ${s.name}`}>
        <span className="font-arcade truncate">{firstname || surname}</span>
        <span className="font-arcade text-[8px] border-2 border-current px-1 py-px">
          {countryCode(rider.country)}
        </span>
      </div>

      {/* Sprite frame: team jersey if synced, otherwise procedural pixel avatar. */}
      <div className="aspect-square border-4 border-current flex items-center justify-center relative overflow-hidden bg-pkm-chrome">
        {rider.team_shirt_url ? (
          <img
            src={rider.team_shirt_url}
            alt=""
            className="w-full h-full object-contain p-1"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <PixelAvatar
            keyId={rider.pcs_slug ?? rider.name}
            size={s.gridSize}
            px={s.px}
            density={0.55}
          />
        )}
        {cancelled && (
          <div className="absolute inset-0 flex items-center justify-center pkm-hatch">
            <span className="font-arcade text-[10px] bg-pkm-paper text-pkm-stroke px-2 py-1 border-2 border-pkm-stroke">
              CANCELLED
            </span>
          </div>
        )}
      </div>

      <div className="font-arcade text-xs sm:text-sm uppercase tracking-wider mt-1 truncate">
        {surname}
      </div>
      <div className={`font-arcade ${s.team} truncate uppercase opacity-80`}>
        {rider.team_name ?? '—'}
      </div>
    </Tag>
  );
}
