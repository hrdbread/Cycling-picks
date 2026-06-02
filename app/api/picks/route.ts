import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  getLeagueBySlug,
  getLeagueMembers,
  getTourBySlug,
  getTourRiders,
  getTourTeams,
  savePick,
} from '@/lib/queries';
import { isPicksLocked } from '@/lib/dates';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.playerId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | {
        leagueSlug?: string;
        tourSlug?: string;
        riderIds?: number[];
        teamIds?: number[];
      }
    | null;
  if (!body || !body.leagueSlug || !body.tourSlug) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const league = getLeagueBySlug(body.leagueSlug);
  const tour = getTourBySlug(body.tourSlug);
  if (!league || !tour) {
    return NextResponse.json({ error: 'Unknown league or tour' }, { status: 404 });
  }
  if (isPicksLocked(tour)) {
    return NextResponse.json({ error: 'Picks locked for this tour' }, { status: 400 });
  }
  const memberIds = new Set(getLeagueMembers(league.id).map((m) => m.id));
  if (!memberIds.has(session.playerId)) {
    return NextResponse.json({ error: 'Not a member of this league' }, { status: 403 });
  }
  const riderIds = Array.from(new Set(body.riderIds ?? []));
  const teamIds = Array.from(new Set(body.teamIds ?? []));
  if (riderIds.length !== 3 || teamIds.length !== 3) {
    return NextResponse.json(
      { error: 'Need exactly 3 riders and 3 teams' },
      { status: 400 },
    );
  }
  const validRiders = new Set(getTourRiders(tour.id).map((r) => r.id));
  const validTeams = new Set(getTourTeams(tour.id).map((t) => t.id));
  if (riderIds.some((r) => !validRiders.has(r))) {
    return NextResponse.json({ error: 'Invalid rider in startlist' }, { status: 400 });
  }
  if (teamIds.some((t) => !validTeams.has(t))) {
    return NextResponse.json({ error: 'Invalid team in startlist' }, { status: 400 });
  }
  savePick({
    leagueId: league.id,
    playerId: session.playerId,
    tourId: tour.id,
    riderIds,
    teamIds,
  });
  return NextResponse.json({ ok: true });
}
