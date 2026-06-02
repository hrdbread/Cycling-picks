import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getLeaguesForPlayer, getTours, getTourRiderCount } from '@/lib/queries';
import { scoreLeagueSeason } from '@/lib/scoring';
import { tourPhase, formatDate, relativeDays } from '@/lib/dates';

const TROPHY_LABEL: Record<string, string> = {
  haribo: 'HARIBO CUP',
  fika: 'FIKA LEAGUE',
};

export default async function HomePage() {
  const session = await getSession();
  if (!session.playerId) redirect('/login');
  const playerId = session.playerId!;

  const leagues = getLeaguesForPlayer(playerId);
  const tours = getTours();
  const year = tours[0]?.year ?? new Date().getFullYear();

  return (
    <div className="space-y-8">
      <section className="pkm-frame--inverted pkm-frame">
        <div className="font-arcade text-lg sm:text-2xl pkm-arrow">
          CHOOSE YOUR LEAGUE!
        </div>
        <p className="text-[11px] mt-3 leading-relaxed">
          Three Grand Tours. Three riders. Three teams. Best picks bag the trophy.
        </p>
      </section>

      <section className="grid sm:grid-cols-2 gap-5">
        {leagues.map((l) => {
          const standings = scoreLeagueSeason(l.id, year);
          const sorted = Object.entries(standings.totals).sort(
            ([, a], [, b]) => b - a,
          );
          return (
            <Link key={l.id} href={`/league/${l.slug}`} className="pkm-card">
              <div className="font-arcade text-[10px] uppercase mb-2 text-pkm-shadow">
                {TROPHY_LABEL[l.trophy] ?? l.trophy}
              </div>
              <div className="font-arcade text-xl sm:text-2xl mb-3 uppercase">
                {l.name}
              </div>
              <div className="space-y-1 text-[10px] font-arcade">
                {sorted.length === 0 && (
                  <div className="opacity-60">NO PICKS YET — BE THE FIRST!</div>
                )}
                {sorted.map(([pid, pts]) => (
                  <div key={pid} className="flex justify-between">
                    <span>PLAYER #{pid}</span>
                    <span>{pts}</span>
                  </div>
                ))}
              </div>
            </Link>
          );
        })}
      </section>

      <section>
        <h2 className="font-arcade text-[10px] uppercase tracking-widest mb-3">
          GRAND TOURS · {year}
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {tours.map((t) => {
            const phase = tourPhase(t, getTourRiderCount(t.id));
            return (
              <Link key={t.id} href={`/tour/${t.slug}`} className="pkm-card">
                <div className="font-arcade text-sm sm:text-base uppercase">
                  {t.name}
                </div>
                <div className="text-[9px] font-arcade mt-2 opacity-70">
                  {t.start_date} → {t.end_date}
                </div>
                <div className="mt-3 font-arcade text-[10px] uppercase">
                  {phase.state === 'finished' && <span>FINAL</span>}
                  {phase.state === 'locked' && (
                    <span className="animate-flash">LIVE ▶</span>
                  )}
                  {phase.state === 'open' && <span>PICKS OPEN</span>}
                  {phase.state === 'not-open' && (
                    <span className="opacity-70">PICKS SOON</span>
                  )}
                </div>
                <div className="mt-1 text-[9px] font-arcade opacity-70">
                  {phase.state === 'open' && phase.lockAt && (
                    <>LOCK {formatDate(phase.lockAt)} · {relativeDays(phase.daysUntilLock).toUpperCase()}</>
                  )}
                  {phase.state === 'not-open' && (
                    <>CHECK BACK {formatDate(phase.expectedFrom)}</>
                  )}
                  {phase.state === 'locked' && phase.endAt && (
                    <>ENDS {formatDate(phase.endAt)}</>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
