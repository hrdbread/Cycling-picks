import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import {
  getCurrentGcStandings,
  getEnrichedPicksForTour,
  getLeagueBySlug,
  getLeagueMembers,
  getLeaguesForPlayer,
  getPick,
  getTourBySlug,
  getTourRiderCount,
} from '@/lib/queries';
import { scoreTour } from '@/lib/scoring';
import { tourPhase, formatDate, relativeDays } from '@/lib/dates';
import PixelAvatar from '@/components/PixelAvatar';
import VsReveal from '@/components/VsReveal';
import { hasShirt, shirtUrl } from '@/lib/shirts';

function fmtGap(s: number | null): string {
  if (s == null) return '—';
  if (s === 0) return 's.t.';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `+${m}:${sec.toString().padStart(2, '0')}`;
}

export default async function TourPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ league?: string }>;
}) {
  const session = await getSession();
  if (!session.playerId) redirect('/login');
  const { slug } = await params;
  const sp = await searchParams;
  const tour = getTourBySlug(slug);
  if (!tour) notFound();

  const myLeagues = getLeaguesForPlayer(session.playerId!);
  const league =
    (sp.league && getLeagueBySlug(sp.league)) || myLeagues[0] || null;
  if (!league) {
    return (
      <div className="pkm-frame font-arcade text-[10px]">
        YOU ARE NOT IN ANY LEAGUES YET.
      </div>
    );
  }

  const members = getLeagueMembers(league.id);
  const myPick = getPick(league.id, session.playerId!, tour.id);
  const score = scoreTour(league.id, tour);
  const riderCount = getTourRiderCount(tour.id);
  const phase = tourPhase(tour, riderCount);
  const gc = getCurrentGcStandings(tour.id, 5);

  const reveal = phase.state === 'locked' || phase.state === 'finished';
  // Always fetch the enriched view so we can show the current user's own
  // pick names. Other members' picks are only displayed when reveal=true.
  const enrichedAll = getEnrichedPicksForTour(league.id, tour.id);
  const enriched = reveal ? enrichedAll : [];
  const cancelledRiderIds = new Set(score.cancelledRiders);
  const cancelledTeamIds = new Set(score.cancelledTeams);
  const meEnriched = enrichedAll.find((e) => e.player_id === session.playerId);

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/league/${league.slug}`} className="pkm-btn--ghost">
          ◀ {league.name.toUpperCase()}
        </Link>
        <h1 className="font-arcade text-2xl sm:text-3xl mt-4 uppercase">
          {tour.name}
        </h1>
        <div className="font-arcade text-[10px] mt-2 opacity-70">
          {tour.year} · {tour.start_date} → {tour.end_date}
        </div>
      </div>

      {myLeagues.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {myLeagues.map((l) => (
            <Link
              key={l.id}
              href={`/tour/${tour.slug}?league=${l.slug}`}
              className={`pkm-btn--ghost ${
                l.id === league.id ? 'bg-pkm-stroke text-pkm-paper' : ''
              }`}
            >
              {l.name.toUpperCase()}
            </Link>
          ))}
        </div>
      )}

      <PhaseBanner phase={phase} />

      <section className="grid md:grid-cols-2 gap-6">
        <div className="pkm-frame">
          <div className="font-arcade text-[10px] uppercase mb-3">
            YOUR PICKS
          </div>
          {myPick && myPick.riders.length > 0 ? (
            <div className="space-y-4">
              <div>
                <div className="text-[8px] font-arcade uppercase opacity-60 mb-1">RIDERS</div>
                <ul className="space-y-1">
                  {myPick.riders.map((rid, i) => {
                    const r = meEnriched?.riders[i] ?? null;
                    return (
                      <li key={rid} className="text-[10px] font-arcade truncate">
                        <span className="opacity-50 mr-2">▸</span>
                        {r?.name ?? `#${rid}`}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <div className="text-[8px] font-arcade uppercase opacity-60 mb-1">TEAMS</div>
                <ul className="space-y-1">
                  {myPick.teams.map((tid, i) => {
                    const t = meEnriched?.teams[i] ?? null;
                    return (
                      <li key={tid} className="text-[10px] font-arcade truncate">
                        <span className="opacity-50 mr-2">▸</span>
                        {t?.name ?? `#${tid}`}
                      </li>
                    );
                  })}
                </ul>
              </div>
              {phase.state === 'open' && (
                <div>
                  <Link
                    href={`/tour/${tour.slug}/pick?league=${league.slug}`}
                    className="pkm-btn inline-block"
                  >
                    EDIT PICKS
                  </Link>
                </div>
              )}
            </div>
          ) : phase.state === 'open' ? (
            <div className="space-y-3">
              <p className="text-[11px]">
                YOU HAVEN&apos;T PICKED YET FOR THIS TOUR.
              </p>
              <Link
                href={`/tour/${tour.slug}/pick?league=${league.slug}`}
                className="pkm-btn"
              >
                CHOOSE YOUR RIDERS! ▶
              </Link>
            </div>
          ) : phase.state === 'not-open' ? (
            <div className="text-[10px] font-arcade opacity-70">
              PICKS OPEN ONCE THE STARTLIST IS PUBLISHED.
            </div>
          ) : (
            <div className="text-[10px] font-arcade">
              NO PICKS — LOCKED OUT FOR THIS TOUR.
            </div>
          )}
        </div>

        <div className="pkm-frame">
          <div className="font-arcade text-[10px] uppercase mb-3">
            LEAGUE · {league.name.toUpperCase()}
          </div>
          <ul className="space-y-2">
            {members.map((m) => {
              const submitted = enriched.find((e) => e.player_id === m.id);
              const hasPicks = submitted ? submitted.riders.length > 0 : false;
              const isYou = m.id === session.playerId;
              return (
                <li key={m.id} className="flex justify-between items-center text-[10px] font-arcade">
                  <div className="flex items-center gap-2">
                    <PixelAvatar
                      keyId={`player-${m.name.toLowerCase()}`}
                      size={5}
                      px={5}
                      bordered
                    />
                    <span>{m.name.toUpperCase()}</span>
                    {isYou && (
                      <span className="text-[8px] opacity-70">(YOU)</span>
                    )}
                  </div>
                  <span>
                    {phase.state === 'finished' ? (
                      score.gcHits[m.id] ? (
                        'GC ✓'
                      ) : score.teamHits[m.id] ? (
                        'TEAM ✓'
                      ) : (
                        '—'
                      )
                    ) : reveal ? (
                      hasPicks ? 'LOCKED IN' : 'NO PICKS'
                    ) : phase.state === 'open' ? (
                      isYou ? (myPick ? 'LOCKED IN' : 'PENDING') : '···'
                    ) : (
                      '—'
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {reveal && enriched.length > 0 && (
        <VsReveal
          picks={enriched.map((p) => ({
            ...p,
            riders: p.riders.map((r) => ({
              ...r,
              team_shirt_url: r.team_pcs_slug && hasShirt(r.team_pcs_slug)
                ? shirtUrl(r.team_pcs_slug)
                : null,
            })),
            teams: p.teams.map((t) => ({
              ...t,
              shirt_url: hasShirt(t.pcs_slug) ? shirtUrl(t.pcs_slug) : null,
            })),
          }))}
          cancelledRiderIds={cancelledRiderIds}
          cancelledTeamIds={cancelledTeamIds}
          hits={score.gcHits}
          teamHits={score.teamHits}
          decided={phase.state === 'finished'}
        />
      )}

      <section>
        <h2 className="font-arcade text-[10px] uppercase mb-3">GC STANDINGS</h2>
        {gc.length === 0 ? (
          <div className="pkm-frame text-[10px] font-arcade">
            NO STANDINGS YET.{' '}
            {phase.state === 'open' || phase.state === 'not-open'
              ? `STANDINGS APPEAR ONCE THE RACE STARTS.`
              : `STANDINGS WILL POPULATE AS STAGES FINISH.`}
          </div>
        ) : (
          <div className="pkm-frame">
            <ol className="space-y-1">
              {gc.map((row) => (
                <li
                  key={row.position}
                  className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-1 border-b-2 border-pkm-stroke/20 last:border-0 text-[10px] font-arcade"
                >
                  <span>{row.position}</span>
                  <span>{row.rider?.name?.toUpperCase() ?? '—'}</span>
                  <span className="opacity-70">{fmtGap(row.gap_seconds)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}

function PhaseBanner({
  phase,
}: {
  phase: ReturnType<typeof tourPhase>;
}) {
  if (phase.state === 'finished') {
    return (
      <div className="pkm-frame">
        <div className="font-arcade text-[10px] uppercase">RACE FINISHED</div>
        <p className="text-[11px] mt-2">FINAL RESULTS IN. SCORING LOCKED.</p>
      </div>
    );
  }
  if (phase.state === 'locked') {
    return (
      <div className="pkm-frame">
        <div className="font-arcade text-[10px] uppercase animate-flash">
          ▶ RACE IN PROGRESS · PICKS LOCKED
        </div>
        <p className="text-[11px] mt-2">
          {phase.endAt ? (
            <>
              ENDS {formatDate(phase.endAt).toUpperCase()} ·{' '}
              {relativeDays(phase.daysUntilEnd).toUpperCase()}.
            </>
          ) : (
            <>PICKS ARE LOCKED. RIDERS REVEALED BELOW.</>
          )}
        </p>
      </div>
    );
  }
  if (phase.state === 'not-open') {
    return (
      <div className="pkm-frame">
        <div className="font-arcade text-[10px] uppercase">PICKS NOT YET OPEN</div>
        <p className="text-[11px] mt-2 leading-relaxed">
          THE STARTLIST HASN&apos;T BEEN PUBLISHED YET. CHECK BACK AROUND{' '}
          <span className="border-2 border-current px-1">
            {formatDate(phase.expectedFrom).toUpperCase()}
          </span>
          {phase.daysUntilStart != null && phase.daysUntilStart > 0 && (
            <> — RACE STARTS {relativeDays(phase.daysUntilStart).toUpperCase()}.</>
          )}
        </p>
      </div>
    );
  }
  return (
    <div className="pkm-frame">
      <div className="font-arcade text-[10px] uppercase">PICKS OPEN</div>
      <p className="text-[11px] mt-2 leading-relaxed">
        LOCK IN BY{' '}
        <span className="border-2 border-current px-1">
          {formatDate(phase.lockAt).toUpperCase()}
        </span>
        {phase.daysUntilLock != null && phase.daysUntilLock > 0 && (
          <> · {relativeDays(phase.daysUntilLock).toUpperCase()}</>
        )}
        . OTHER PLAYERS&apos; PICKS REVEAL ONCE THE RACE STARTS.
      </p>
    </div>
  );
}

