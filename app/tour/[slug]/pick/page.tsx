import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import {
  getLeagueBySlug,
  getLeaguesForPlayer,
  getPick,
  getTourBySlug,
  getTourRiders,
  getTourTeams,
} from '@/lib/queries';
import { isPicksLocked } from '@/lib/dates';
import { hasShirt, shirtUrl } from '@/lib/shirts';
import PickArena from '@/components/PickArena';

export default async function PickPage({
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
  if (isPicksLocked(tour)) {
    redirect(`/tour/${tour.slug}?league=${sp.league ?? ''}`);
  }
  const myLeagues = getLeaguesForPlayer(session.playerId!);
  const league =
    (sp.league && getLeagueBySlug(sp.league)) || myLeagues[0] || null;
  if (!league) return <div className="text-white/60">No league found.</div>;

  const riders = getTourRiders(tour.id);
  const teams = getTourTeams(tour.id);
  const existing = getPick(league.id, session.playerId!, tour.id);
  const teamShirtById = new Map(
    teams.map((t) => [t.id, hasShirt(t.pcs_slug) ? shirtUrl(t.pcs_slug) : null] as const),
  );

  return (
    <PickArena
      tourSlug={tour.slug}
      tourName={tour.name}
      leagueSlug={league.slug}
      leagueName={league.name}
      riders={riders.map((r) => ({
        id: r.id,
        pcs_slug: r.pcs_slug,
        name: r.name,
        country: r.country,
        team_id: r.team_id,
        photo_url: r.photo_url,
        team_shirt_url: r.team_id ? teamShirtById.get(r.team_id) ?? null : null,
      }))}
      teams={teams.map((t) => ({
        id: t.id,
        name: t.name,
        pcs_slug: t.pcs_slug,
        shirt_url: hasShirt(t.pcs_slug) ? shirtUrl(t.pcs_slug) : null,
      }))}
      initialRiders={existing?.riders ?? []}
      initialTeams={existing?.teams ?? []}
    />
  );
}
