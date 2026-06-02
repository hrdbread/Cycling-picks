import {
  getAllPicksForTour,
  getFinalGcPodium,
  getFinalTeamWinner,
  PickWithSelections,
} from './queries';
import { db, GrandTour } from './db';

/**
 * Per-tour scoring rules (podium cascade):
 *  - Each player picks 3 GC riders + 3 teams.
 *  - Same picks among players in the SAME league cancel out (they don't count
 *    for either side). Cancelling is per-slot-agnostic: if two players list
 *    rider X anywhere in their 3, X is removed from both lists. After
 *    cancelling, every surviving rider is held by exactly one player.
 *  - Walk DOWN the GC podium (1st, then 2nd, then 3rd). The first placing whose
 *    finisher is still held by exactly one player wins that player the tour
 *    (1 point). Higher placings win outright over lower ones — e.g. if everyone
 *    picked the GC winner (so 1st cancels) but only one player picked the
 *    runner-up, that player takes the tour.
 *  - If no podium placing is uniquely held, the team pick breaks the tie:
 *    1 point if exactly one player still holds the Best Team classification
 *    winner.
 *  - If still nothing: tour is undecided (counts 0 for everyone that tour).
 *
 * Overall league standings:
 *  - Sum of tour points across all 3 grand tours.
 *  - If tied at the end of the season, the Vuelta result is the final
 *    tiebreaker (most recent tour wins).
 */

export type TourScore = {
  tour: GrandTour;
  points: Record<number, number>;          // playerId -> 0 | 1
  gcHits: Record<number, boolean>;         // playerId -> hit GC winner?
  teamHits: Record<number, boolean>;       // playerId -> hit team winner?
  decidedBy: 'gc' | 'teams' | 'undecided' | 'pending';
  cancelledRiders: number[];
  cancelledTeams: number[];
};

function cancelOverlap(picks: PickWithSelections[]): {
  effectiveRiders: Record<number, Set<number>>;
  effectiveTeams: Record<number, Set<number>>;
  cancelledRiders: Set<number>;
  cancelledTeams: Set<number>;
} {
  const riderCounts = new Map<number, number>();
  const teamCounts = new Map<number, number>();
  for (const p of picks) {
    for (const r of new Set(p.riders)) {
      riderCounts.set(r, (riderCounts.get(r) ?? 0) + 1);
    }
    for (const t of new Set(p.teams)) {
      teamCounts.set(t, (teamCounts.get(t) ?? 0) + 1);
    }
  }
  const cancelledRiders = new Set<number>();
  const cancelledTeams = new Set<number>();
  for (const [id, n] of riderCounts) if (n > 1) cancelledRiders.add(id);
  for (const [id, n] of teamCounts) if (n > 1) cancelledTeams.add(id);

  const effectiveRiders: Record<number, Set<number>> = {};
  const effectiveTeams: Record<number, Set<number>> = {};
  for (const p of picks) {
    effectiveRiders[p.player_id] = new Set(
      p.riders.filter((r) => !cancelledRiders.has(r)),
    );
    effectiveTeams[p.player_id] = new Set(
      p.teams.filter((t) => !cancelledTeams.has(t)),
    );
  }
  return { effectiveRiders, effectiveTeams, cancelledRiders, cancelledTeams };
}

export function scoreTour(leagueId: number, tour: GrandTour): TourScore {
  const picks = getAllPicksForTour(leagueId, tour.id);
  const points: Record<number, number> = {};
  const gcHits: Record<number, boolean> = {};
  const teamHits: Record<number, boolean> = {};
  for (const p of picks) {
    points[p.player_id] = 0;
    gcHits[p.player_id] = false;
    teamHits[p.player_id] = false;
  }

  if (tour.status !== 'finished') {
    return {
      tour,
      points,
      gcHits,
      teamHits,
      decidedBy: 'pending',
      cancelledRiders: [],
      cancelledTeams: [],
    };
  }

  const { effectiveRiders, effectiveTeams, cancelledRiders, cancelledTeams } =
    cancelOverlap(picks);
  const base = {
    tour,
    points,
    gcHits,
    teamHits,
    cancelledRiders: [...cancelledRiders],
    cancelledTeams: [...cancelledTeams],
  };

  // Cascade down the GC podium (1st, 2nd, 3rd). After cancellation a surviving
  // rider is held by exactly one player, so the first podium placing that
  // anyone still holds decides the tour — higher placings win over lower.
  const podium = getFinalGcPodium(tour.id);
  for (const riderId of podium) {
    if (riderId == null) continue;
    const holder = picks.find((p) => effectiveRiders[p.player_id].has(riderId));
    if (holder) {
      points[holder.player_id] = 1;
      gcHits[holder.player_id] = true;
      return { ...base, decidedBy: 'gc' };
    }
  }

  // No podium placing uniquely held -> the Best Team winner breaks the tie.
  const teamWinner = getFinalTeamWinner(tour.id);
  if (teamWinner != null) {
    const holder = picks.find((p) =>
      effectiveTeams[p.player_id].has(teamWinner),
    );
    if (holder) {
      points[holder.player_id] = 1;
      teamHits[holder.player_id] = true;
      return { ...base, decidedBy: 'teams' };
    }
  }
  return { ...base, decidedBy: 'undecided' };
}

export type LeagueStandings = {
  totals: Record<number, number>;
  perTour: TourScore[];
  leader: number | null;       // playerId (after applying season tiebreaker)
  tied: number[];              // players still tied after all tiebreakers
};

export function scoreLeagueSeason(
  leagueId: number,
  year: number,
): LeagueStandings {
  const tours = db()
    .prepare(
      'SELECT * FROM grand_tours WHERE year = ? ORDER BY ordering ASC',
    )
    .all(year) as GrandTour[];

  const perTour = tours.map((t) => scoreTour(leagueId, t));
  const totals: Record<number, number> = {};
  for (const ts of perTour) {
    for (const [pid, pts] of Object.entries(ts.points)) {
      const id = Number(pid);
      totals[id] = (totals[id] ?? 0) + pts;
    }
  }
  const ids = Object.keys(totals).map(Number);
  if (ids.length === 0) return { totals, perTour, leader: null, tied: [] };
  const max = Math.max(...ids.map((i) => totals[i]));
  const top = ids.filter((i) => totals[i] === max);
  if (top.length === 1) return { totals, perTour, leader: top[0], tied: [] };

  // Vuelta tiebreaker (most recent tour with a decision among tied players)
  for (let i = perTour.length - 1; i >= 0; i--) {
    const ts = perTour[i];
    const winners = top.filter((pid) => ts.points[pid] === 1);
    if (winners.length === 1) {
      return { totals, perTour, leader: winners[0], tied: [] };
    }
  }
  return { totals, perTour, leader: null, tied: top };
}
