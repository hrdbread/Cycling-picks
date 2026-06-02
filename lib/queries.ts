import { db, GrandTour, League, Player, Rider, Team } from './db';

export function getLeagueBySlug(slug: string): League | undefined {
  return db().prepare('SELECT * FROM leagues WHERE slug = ?').get(slug) as
    | League
    | undefined;
}

export function getLeagues(): League[] {
  return db().prepare('SELECT * FROM leagues ORDER BY id').all() as League[];
}

export function getLeaguesForPlayer(playerId: number): League[] {
  return db()
    .prepare(
      `SELECT l.* FROM leagues l
       JOIN league_members m ON m.league_id = l.id
       WHERE m.player_id = ?
       ORDER BY l.id`,
    )
    .all(playerId) as League[];
}

export function getLeagueMembers(leagueId: number): Player[] {
  return db()
    .prepare(
      `SELECT p.* FROM players p
       JOIN league_members m ON m.player_id = p.id
       WHERE m.league_id = ?
       ORDER BY p.name`,
    )
    .all(leagueId) as Player[];
}

export function getPlayers(): Player[] {
  return db().prepare('SELECT * FROM players ORDER BY name').all() as Player[];
}

export function getPlayer(id: number): Player | undefined {
  return db().prepare('SELECT * FROM players WHERE id = ?').get(id) as
    | Player
    | undefined;
}

export function getTours(): GrandTour[] {
  return db()
    .prepare('SELECT * FROM grand_tours ORDER BY year DESC, ordering ASC')
    .all() as GrandTour[];
}

export function getTourBySlug(slug: string): GrandTour | undefined {
  return db().prepare('SELECT * FROM grand_tours WHERE slug = ?').get(slug) as
    | GrandTour
    | undefined;
}

export function getTourRiderCount(tourId: number): number {
  const row = db()
    .prepare('SELECT COUNT(*) AS n FROM tour_riders WHERE tour_id = ?')
    .get(tourId) as { n: number };
  return row.n;
}

export function getTourRiders(tourId: number): Rider[] {
  return db()
    .prepare(
      `SELECT r.* FROM riders r
       JOIN tour_riders tr ON tr.rider_id = r.id
       WHERE tr.tour_id = ?
       ORDER BY r.pcs_pts DESC, r.name ASC`,
    )
    .all(tourId) as Rider[];
}

export function getTourTeams(tourId: number): Team[] {
  return db()
    .prepare(
      `SELECT t.* FROM teams t
       JOIN tour_teams tt ON tt.team_id = t.id
       WHERE tt.tour_id = ?
       ORDER BY t.name`,
    )
    .all(tourId) as Team[];
}

export type PickWithSelections = {
  id: number;
  league_id: number;
  player_id: number;
  tour_id: number;
  locked_at: string | null;
  riders: number[];
  teams: number[];
};

export function getPick(
  leagueId: number,
  playerId: number,
  tourId: number,
): PickWithSelections | null {
  const row = db()
    .prepare(
      'SELECT * FROM picks WHERE league_id = ? AND player_id = ? AND tour_id = ?',
    )
    .get(leagueId, playerId, tourId) as
    | { id: number; league_id: number; player_id: number; tour_id: number; locked_at: string | null }
    | undefined;
  if (!row) return null;
  const riders = db()
    .prepare('SELECT slot, rider_id FROM pick_riders WHERE pick_id = ? ORDER BY slot')
    .all(row.id) as { slot: number; rider_id: number }[];
  const teams = db()
    .prepare('SELECT slot, team_id FROM pick_teams WHERE pick_id = ? ORDER BY slot')
    .all(row.id) as { slot: number; team_id: number }[];
  return {
    ...row,
    riders: riders.map((r) => r.rider_id),
    teams: teams.map((t) => t.team_id),
  };
}

export function getAllPicksForTour(
  leagueId: number,
  tourId: number,
): PickWithSelections[] {
  const rows = db()
    .prepare('SELECT * FROM picks WHERE league_id = ? AND tour_id = ?')
    .all(leagueId, tourId) as Array<{
    id: number;
    league_id: number;
    player_id: number;
    tour_id: number;
    locked_at: string | null;
  }>;
  return rows.map((row) => {
    const riders = db()
      .prepare('SELECT slot, rider_id FROM pick_riders WHERE pick_id = ? ORDER BY slot')
      .all(row.id) as { slot: number; rider_id: number }[];
    const teams = db()
      .prepare('SELECT slot, team_id FROM pick_teams WHERE pick_id = ? ORDER BY slot')
      .all(row.id) as { slot: number; team_id: number }[];
    return {
      ...row,
      riders: riders.map((r) => r.rider_id),
      teams: teams.map((t) => t.team_id),
    };
  });
}

export type EnrichedPick = {
  player_id: number;
  player_name: string;
  player_avatar: string | null;
  riders: Array<{
    id: number;
    pcs_slug: string;
    name: string;
    country: string | null;
    team_name: string | null;
    team_pcs_slug: string | null;
  }>;
  teams: Array<{ id: number; pcs_slug: string; name: string }>;
};

/** Returns each member's picks for a tour with rider/team names attached. */
export function getEnrichedPicksForTour(
  leagueId: number,
  tourId: number,
): EnrichedPick[] {
  const rows = db()
    .prepare(
      `SELECT p.id AS pick_id, pl.id AS player_id, pl.name AS player_name, pl.avatar AS player_avatar
       FROM league_members lm
       JOIN players pl ON pl.id = lm.player_id
       LEFT JOIN picks p ON p.player_id = pl.id AND p.league_id = lm.league_id AND p.tour_id = ?
       WHERE lm.league_id = ?
       ORDER BY pl.name`,
    )
    .all(tourId, leagueId) as Array<{
    pick_id: number | null;
    player_id: number;
    player_name: string;
    player_avatar: string | null;
  }>;
  return rows.map((row) => {
    if (row.pick_id == null) {
      return {
        player_id: row.player_id,
        player_name: row.player_name,
        player_avatar: row.player_avatar,
        riders: [],
        teams: [],
      };
    }
    const riders = db()
      .prepare(
        `SELECT r.id, r.pcs_slug, r.name, r.country,
                t.name AS team_name, t.pcs_slug AS team_pcs_slug
         FROM pick_riders pr JOIN riders r ON r.id = pr.rider_id
         LEFT JOIN teams t ON t.id = r.team_id
         WHERE pr.pick_id = ? ORDER BY pr.slot`,
      )
      .all(row.pick_id) as Array<{
      id: number;
      pcs_slug: string;
      name: string;
      country: string | null;
      team_name: string | null;
      team_pcs_slug: string | null;
    }>;
    const teams = db()
      .prepare(
        `SELECT t.id, t.pcs_slug, t.name
         FROM pick_teams pt JOIN teams t ON t.id = pt.team_id
         WHERE pt.pick_id = ? ORDER BY pt.slot`,
      )
      .all(row.pick_id) as Array<{ id: number; pcs_slug: string; name: string }>;
    return {
      player_id: row.player_id,
      player_name: row.player_name,
      player_avatar: row.player_avatar,
      riders,
      teams,
    };
  });
}

export function savePick(args: {
  leagueId: number;
  playerId: number;
  tourId: number;
  riderIds: number[];
  teamIds: number[];
}): void {
  const handle = db();
  const tx = handle.transaction(() => {
    handle
      .prepare(
        `INSERT INTO picks (league_id, player_id, tour_id, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(league_id, player_id, tour_id)
         DO UPDATE SET updated_at = CURRENT_TIMESTAMP`,
      )
      .run(args.leagueId, args.playerId, args.tourId);
    const pick = handle
      .prepare(
        'SELECT id FROM picks WHERE league_id = ? AND player_id = ? AND tour_id = ?',
      )
      .get(args.leagueId, args.playerId, args.tourId) as { id: number };
    handle.prepare('DELETE FROM pick_riders WHERE pick_id = ?').run(pick.id);
    handle.prepare('DELETE FROM pick_teams WHERE pick_id = ?').run(pick.id);
    const insRider = handle.prepare(
      'INSERT INTO pick_riders (pick_id, slot, rider_id) VALUES (?, ?, ?)',
    );
    const insTeam = handle.prepare(
      'INSERT INTO pick_teams (pick_id, slot, team_id) VALUES (?, ?, ?)',
    );
    args.riderIds.forEach((rid, i) => insRider.run(pick.id, i + 1, rid));
    args.teamIds.forEach((tid, i) => insTeam.run(pick.id, i + 1, tid));
  });
  tx();
}

export function getFinalGcWinner(tourId: number): number | null {
  const row = db()
    .prepare(
      `SELECT rider_id FROM standings
       WHERE tour_id = ? AND classification = 'gc' AND position = 1
       ORDER BY stage DESC LIMIT 1`,
    )
    .get(tourId) as { rider_id: number | null } | undefined;
  return row?.rider_id ?? null;
}

/**
 * Returns the GC podium (riders finishing 1st, 2nd, 3rd) at the latest stage,
 * as a 3-element array indexed by placing-1. An entry is null if that placing
 * has no row or an unmatched rider. Used by the podium-cascade tour scoring.
 */
export function getFinalGcPodium(tourId: number): (number | null)[] {
  const maxStage = db()
    .prepare(
      `SELECT MAX(stage) AS s FROM standings
       WHERE tour_id = ? AND classification = 'gc'`,
    )
    .get(tourId) as { s: number | null };
  if (maxStage?.s == null) return [];
  const rows = db()
    .prepare(
      `SELECT position, rider_id FROM standings
       WHERE tour_id = ? AND classification = 'gc' AND stage = ?
         AND position IN (1, 2, 3)`,
    )
    .all(tourId, maxStage.s) as { position: number; rider_id: number | null }[];
  const podium: (number | null)[] = [null, null, null];
  for (const r of rows) {
    if (r.position >= 1 && r.position <= 3) podium[r.position - 1] = r.rider_id;
  }
  return podium;
}

export function getFinalTeamWinner(tourId: number): number | null {
  const row = db()
    .prepare(
      `SELECT team_id FROM standings
       WHERE tour_id = ? AND classification = 'teams' AND position = 1
       ORDER BY stage DESC LIMIT 1`,
    )
    .get(tourId) as { team_id: number | null } | undefined;
  return row?.team_id ?? null;
}

export function getCurrentGcStandings(
  tourId: number,
  limit = 10,
): Array<{ position: number; rider: Rider | null; gap_seconds: number | null }> {
  const stage = db()
    .prepare(
      `SELECT MAX(stage) AS s FROM standings
       WHERE tour_id = ? AND classification = 'gc'`,
    )
    .get(tourId) as { s: number | null };
  if (stage?.s == null) return [];
  const rows = db()
    .prepare(
      `SELECT s.position, s.gap_seconds, r.*
       FROM standings s LEFT JOIN riders r ON r.id = s.rider_id
       WHERE s.tour_id = ? AND s.classification = 'gc' AND s.stage = ?
       ORDER BY s.position ASC LIMIT ?`,
    )
    .all(tourId, stage.s, limit) as Array<{
    position: number;
    gap_seconds: number | null;
    id: number | null;
  } & Partial<Rider>>;
  return rows.map((row) => ({
    position: row.position,
    gap_seconds: row.gap_seconds,
    rider: row.id ? (row as unknown as Rider) : null,
  }));
}
