import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import {
  getLeagueBySlug,
  getLeagueMembers,
  getTours,
  getTourRiderCount,
} from '@/lib/queries';
import { scoreLeagueSeason } from '@/lib/scoring';
import { tourPhase, formatDate, relativeDays } from '@/lib/dates';
import PixelAvatar from '@/components/PixelAvatar';

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  if (!session.playerId) redirect('/login');
  const { slug } = await params;
  const league = getLeagueBySlug(slug);
  if (!league) notFound();
  const members = getLeagueMembers(league.id);
  const memberIds = new Set(members.map((m) => m.id));
  if (!memberIds.has(session.playerId!)) {
    return (
      <div className="pkm-frame text-center font-arcade text-[10px]">
        NOT IN THIS LEAGUE.
      </div>
    );
  }
  const tours = getTours();
  const year = tours[0]?.year ?? new Date().getFullYear();
  const standings = scoreLeagueSeason(league.id, year);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="pkm-btn--ghost">
          ◀ BACK
        </Link>
        <h1 className="font-arcade text-2xl sm:text-3xl mt-4 uppercase">
          {league.name}
        </h1>
        <div className="font-arcade text-[10px] mt-2 uppercase opacity-70">
          {league.trophy === 'haribo' ? 'GUMMY BEAR TROPHY' : 'FIKA TROPHY'}
        </div>
      </div>

      <section>
        <h2 className="font-arcade text-[10px] uppercase mb-3">
          SEASON {year} · OVERALL
        </h2>
        <div className="pkm-frame">
          <table className="w-full text-[10px] font-arcade">
            <thead>
              <tr className="text-left border-b-4 border-pkm-stroke">
                <th className="py-2">PLAYER</th>
                {standings.perTour.map((t) => (
                  <th key={t.tour.id} className="py-2 text-center">
                    {t.tour.name.split(' ')[0].toUpperCase()}
                  </th>
                ))}
                <th className="py-2 text-right">TOT</th>
              </tr>
            </thead>
            <tbody>
              {members
                .map((m) => ({
                  member: m,
                  total: standings.totals[m.id] ?? 0,
                }))
                .sort((a, b) => b.total - a.total)
                .map(({ member, total }) => {
                  const isLeader = standings.leader === member.id;
                  return (
                    <tr key={member.id} className="border-b-2 border-pkm-stroke/20">
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <PixelAvatar
                            keyId={`player-${member.name.toLowerCase()}`}
                            size={5}
                            px={5}
                            bordered
                          />
                          <span>{member.name.toUpperCase()}</span>
                          {isLeader && (
                            <span className="ml-1 text-[8px] border-2 border-current px-1">
                              ★ LEAD
                            </span>
                          )}
                        </div>
                      </td>
                      {standings.perTour.map((t) => (
                        <td key={t.tour.id} className="py-2 text-center">
                          {t.points[member.id] === 1 ? (
                            <span>●</span>
                          ) : t.decidedBy === 'pending' ? (
                            <span className="opacity-30">—</span>
                          ) : (
                            <span className="opacity-30">○</span>
                          )}
                        </td>
                      ))}
                      <td className="py-2 text-right">{total}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-arcade text-[10px] uppercase mb-3">TOURS</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {tours.map((t) => {
            const phase = tourPhase(t, getTourRiderCount(t.id));
            return (
              <Link
                key={t.id}
                href={`/tour/${t.slug}?league=${league.slug}`}
                className="pkm-card"
              >
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
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
