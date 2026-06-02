import RiderCard from './RiderCard';
import TeamCard from './TeamCard';
import PixelAvatar from './PixelAvatar';

export type RevealPick = {
  player_id: number;
  player_name: string;
  player_avatar: string | null;
  riders: Array<{
    id: number;
    pcs_slug: string;
    name: string;
    country: string | null;
    team_name: string | null;
    team_shirt_url: string | null;
  }>;
  teams: Array<{
    id: number;
    pcs_slug: string;
    name: string;
    shirt_url: string | null;
  }>;
};

export default function VsReveal({
  picks,
  cancelledRiderIds,
  cancelledTeamIds,
  hits,
  teamHits,
  decided,
}: {
  picks: RevealPick[];
  cancelledRiderIds: Set<number>;
  cancelledTeamIds: Set<number>;
  hits: Record<number, boolean>;
  teamHits: Record<number, boolean>;
  decided: boolean;
}) {
  if (picks.length === 0) return null;
  const isHeadToHead = picks.length === 2;

  return (
    <section className="space-y-6">
      <div className="relative flex items-center justify-center py-4">
        <div className="font-arcade text-pkm-stroke text-3xl sm:text-5xl tracking-widest animate-vs-zoom">
          {isHeadToHead ? 'VS' : 'BATTLE!'}
        </div>
      </div>

      <div
        className={`grid gap-4 ${
          isHeadToHead ? 'md:grid-cols-2' : 'md:grid-cols-3'
        }`}
      >
        {picks.map((p, idx) => {
          const slideClass =
            idx === 0 ? 'animate-slide-in-left' : 'animate-slide-in-right';
          const verdict = decided
            ? hits[p.player_id]
              ? 'GC HIT'
              : teamHits[p.player_id]
                ? 'TEAM HIT'
                : 'NO HIT'
            : null;
          return (
            <div key={p.player_id} className={`${slideClass} space-y-3`}>
              <div className="pkm-frame--inverted pkm-frame flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <PixelAvatar
                    keyId={`player-${p.player_name.toLowerCase()}`}
                    size={6}
                    px={6}
                    bordered
                  />
                  <span className="font-arcade text-base sm:text-lg">
                    {p.player_name.toUpperCase()}
                  </span>
                </div>
                {verdict && (
                  <span
                    className={`font-arcade text-[10px] px-2 py-1 border-2 border-current ${
                      verdict === 'NO HIT' ? '' : 'pkm-hatch'
                    }`}
                  >
                    {verdict}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {p.riders.length === 0 ? (
                  <div className="col-span-3 pkm-frame text-center font-arcade text-[10px] py-6">
                    NO PICKS
                  </div>
                ) : (
                  p.riders.map((r) => (
                    <RiderCard
                      key={r.id}
                      rider={{
                        id: r.id,
                        pcs_slug: r.pcs_slug,
                        name: r.name,
                        country: r.country,
                        team_name: r.team_name,
                        team_shirt_url: r.team_shirt_url,
                      }}
                      cancelled={cancelledRiderIds.has(r.id)}
                      size="sm"
                    />
                  ))
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {p.teams.map((t) => (
                  <TeamCard
                    key={t.id}
                    team={{
                      id: t.id,
                      name: t.name,
                      pcs_slug: t.pcs_slug,
                      shirt_url: t.shirt_url,
                    }}
                    cancelled={cancelledTeamIds.has(t.id)}
                    size="sm"
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
