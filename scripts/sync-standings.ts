/**
 * Pulls the latest GC and Best Team standings for one Grand Tour.
 *
 *   npm run sync:standings -- giro-2026            # latest stage auto-detected
 *   npm run sync:standings -- giro-2026 --stage 12 # explicit stage
 *   npm run sync:standings -- giro-2026 --final    # final overall (sets status=finished)
 */
import { db } from '../lib/db';
import {
  closeBrowser,
  fetchGcStandings,
  fetchTeamStandings,
  fetchLatestCompletedStage,
} from '../lib/pcs';

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: npm run sync:standings -- <tour-slug> [--stage N|--final]');
    process.exit(1);
  }
  const isFinal = process.argv.includes('--final');
  const stageIdx = process.argv.indexOf('--stage');
  const explicitStage =
    stageIdx >= 0 ? parseInt(process.argv[stageIdx + 1], 10) : null;

  const handle = db();
  const tour = handle
    .prepare('SELECT * FROM grand_tours WHERE slug = ?')
    .get(slug) as
    | { id: number; pcs_race: string; year: number; name: string }
    | undefined;
  if (!tour) {
    console.error(`Tour not found: ${slug}.`);
    process.exit(1);
  }

  const stage = isFinal
    ? 0
    : explicitStage ?? (await fetchLatestCompletedStage(tour.pcs_race, tour.year));
  if (!isFinal && stage === 0) {
    console.log('No completed stages yet — nothing to sync.');
    return;
  }

  console.log(`Syncing ${tour.name} stage=${stage} (${isFinal ? 'final' : 'live'})`);
  const [gc, teams] = await Promise.all([
    fetchGcStandings(tour.pcs_race, tour.year, stage),
    fetchTeamStandings(tour.pcs_race, tour.year, stage),
  ]);

  const findRider = handle.prepare('SELECT id FROM riders WHERE pcs_slug = ?');
  const findTeam = handle.prepare('SELECT id FROM teams WHERE pcs_slug = ?');
  const upsert = handle.prepare(
    `INSERT INTO standings
       (tour_id, stage, classification, position, rider_id, team_id, gap_seconds, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(tour_id, stage, classification, position)
     DO UPDATE SET rider_id = excluded.rider_id,
                   team_id  = excluded.team_id,
                   gap_seconds = excluded.gap_seconds,
                   fetched_at  = CURRENT_TIMESTAMP`,
  );

  const tx = handle.transaction(() => {
    for (const row of gc) {
      const r = row.rider_slug
        ? (findRider.get(row.rider_slug) as { id: number } | undefined)
        : undefined;
      upsert.run(tour.id, stage, 'gc', row.position, r?.id ?? null, null, row.gap_seconds);
    }
    for (const row of teams) {
      const t = row.team_slug
        ? (findTeam.get(row.team_slug) as { id: number } | undefined)
        : undefined;
      upsert.run(tour.id, stage, 'teams', row.position, null, t?.id ?? null, row.gap_seconds);
    }
    if (isFinal) {
      handle
        .prepare("UPDATE grand_tours SET status = 'finished', locked = 1 WHERE id = ?")
        .run(tour.id);
    } else {
      handle
        .prepare(
          "UPDATE grand_tours SET status = 'active', locked = 1 WHERE id = ? AND status != 'finished'",
        )
        .run(tour.id);
    }
  });
  tx();
  console.log(`  GC rows: ${gc.length}, Team rows: ${teams.length}. Saved.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeBrowser());
