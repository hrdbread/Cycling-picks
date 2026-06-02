/**
 * Pulls the startlist for one Grand Tour from procyclingstats and stores
 * riders + teams + tour membership.
 *
 *   npm run sync:startlist -- giro-2026
 */
import { db } from '../lib/db';
import { closeBrowser, fetchStartlist } from '../lib/pcs';

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: npm run sync:startlist -- <tour-slug>');
    process.exit(1);
  }
  const handle = db();
  const tour = handle
    .prepare('SELECT * FROM grand_tours WHERE slug = ?')
    .get(slug) as
    | { id: number; pcs_race: string; year: number; name: string }
    | undefined;
  if (!tour) {
    console.error(`Tour not found: ${slug}. Run "npm run seed" first.`);
    process.exit(1);
  }
  console.log(`Fetching startlist for ${tour.name} (${tour.year})…`);
  const { riders, teams } = await fetchStartlist(tour.pcs_race, tour.year);
  console.log(`  ${riders.length} riders, ${teams.length} teams`);

  const insertTeam = handle.prepare(
    `INSERT INTO teams (pcs_slug, name, shirt_url) VALUES (?, ?, ?)
     ON CONFLICT(pcs_slug) DO UPDATE SET
       name = excluded.name,
       shirt_url = COALESCE(excluded.shirt_url, teams.shirt_url)`,
  );
  const insertRider = handle.prepare(
    `INSERT INTO riders (pcs_slug, name, country, team_id) VALUES (?, ?, ?, ?)
     ON CONFLICT(pcs_slug) DO UPDATE SET
       name = excluded.name, country = excluded.country, team_id = excluded.team_id`,
  );
  const insertTourTeam = handle.prepare(
    'INSERT OR IGNORE INTO tour_teams (tour_id, team_id) VALUES (?, ?)',
  );
  const insertTourRider = handle.prepare(
    'INSERT OR IGNORE INTO tour_riders (tour_id, rider_id, bib) VALUES (?, ?, ?)',
  );

  const tx = handle.transaction(() => {
    const teamIdBySlug = new Map<string, number>();
    for (const t of teams) {
      insertTeam.run(t.pcs_slug, t.name, t.shirt_url);
      const row = handle
        .prepare('SELECT id FROM teams WHERE pcs_slug = ?')
        .get(t.pcs_slug) as { id: number };
      teamIdBySlug.set(t.pcs_slug, row.id);
      insertTourTeam.run(tour.id, row.id);
    }
    for (const r of riders) {
      const teamId = r.team_slug ? teamIdBySlug.get(r.team_slug) ?? null : null;
      insertRider.run(r.pcs_slug, r.name, r.country, teamId);
      const row = handle
        .prepare('SELECT id FROM riders WHERE pcs_slug = ?')
        .get(r.pcs_slug) as { id: number };
      insertTourRider.run(tour.id, row.id, r.bib);
    }
  });
  tx();
  console.log('Startlist saved.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeBrowser());
