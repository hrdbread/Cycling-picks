/**
 * Seeds the database with:
 *  - The 4 player profiles with their real names and passwords.
 *  - 2 leagues with their members.
 *  - The 3 grand tours of 2026 with placeholder dates.
 *
 * Idempotent: re-running rolls forward the password hash and league
 * membership without losing existing picks. Old placeholder profiles from
 * earlier seeds (You, Mum, Spare) are renamed/deleted.
 *
 * Run with: npm run seed
 */
import bcrypt from 'bcryptjs';
import { db } from '../lib/db';

const PLAYERS: Array<{ name: string; password: string }> = [
  { name: 'Stefan',  password: 'KapustaDupa' },
  { name: 'Alex',    password: 'KapustaDupa' },
  { name: 'Daria',   password: 'Fika' },
  { name: 'Larissa', password: 'Fika' },
];

const LEAGUES: Array<{
  slug: string;
  name: string;
  trophy: 'haribo' | 'fika';
  members: string[];
}> = [
  {
    slug: 'haribo',
    name: 'Haribo Cup',
    trophy: 'haribo',
    members: ['Stefan', 'Alex'],
  },
  {
    slug: 'fika',
    name: 'Fika League',
    trophy: 'fika',
    members: ['Stefan', 'Daria', 'Larissa'],
  },
];

const TOURS_2026 = [
  {
    slug: 'giro-2026',
    name: "Giro d'Italia",
    year: 2026,
    ordering: 1,
    pcs_race: 'giro-d-italia',
    start_date: '2026-05-09',
    end_date: '2026-05-31',
  },
  {
    slug: 'tour-2026',
    name: 'Tour de France',
    year: 2026,
    ordering: 2,
    pcs_race: 'tour-de-france',
    start_date: '2026-07-04',
    end_date: '2026-07-26',
  },
  {
    slug: 'vuelta-2026',
    name: 'La Vuelta',
    year: 2026,
    ordering: 3,
    pcs_race: 'vuelta-a-espana',
    start_date: '2026-08-22',
    end_date: '2026-09-13',
  },
];

function main() {
  const handle = db();

  // Forward-migrate the placeholder names from earlier seeds. Rename rather
  // than delete so any picks they made stay attached to the same player_id.
  handle.prepare("UPDATE players SET name = 'Stefan' WHERE name = 'You'").run();
  handle.prepare("UPDATE players SET name = 'Daria'  WHERE name = 'Mum'").run();
  handle.prepare("DELETE FROM players WHERE name = 'Spare'").run();

  const insertPlayer = handle.prepare(
    `INSERT INTO players (name, pin_hash) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET pin_hash = excluded.pin_hash`,
  );
  for (const p of PLAYERS) {
    insertPlayer.run(p.name, bcrypt.hashSync(p.password, 10));
  }

  const insertLeague = handle.prepare(
    `INSERT INTO leagues (slug, name, trophy) VALUES (?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET name = excluded.name, trophy = excluded.trophy`,
  );
  for (const l of LEAGUES) insertLeague.run(l.slug, l.name, l.trophy);

  const playerIdByName = new Map<string, number>();
  for (const row of handle.prepare('SELECT id, name FROM players').all() as Array<{
    id: number;
    name: string;
  }>) {
    playerIdByName.set(row.name, row.id);
  }
  const leagueIdBySlug = new Map<string, number>();
  for (const row of handle.prepare('SELECT id, slug FROM leagues').all() as Array<{
    id: number;
    slug: string;
  }>) {
    leagueIdBySlug.set(row.slug, row.id);
  }

  const insertMember = handle.prepare(
    'INSERT OR IGNORE INTO league_members (league_id, player_id) VALUES (?, ?)',
  );
  for (const l of LEAGUES) {
    const lid = leagueIdBySlug.get(l.slug)!;
    for (const m of l.members) {
      const pid = playerIdByName.get(m);
      if (pid) insertMember.run(lid, pid);
    }
  }

  const insertTour = handle.prepare(
    `INSERT INTO grand_tours (slug, name, year, ordering, pcs_race, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       name = excluded.name, start_date = excluded.start_date, end_date = excluded.end_date`,
  );
  for (const t of TOURS_2026) {
    insertTour.run(
      t.slug,
      t.name,
      t.year,
      t.ordering,
      t.pcs_race,
      t.start_date,
      t.end_date,
    );
  }

  console.log('Seed complete.');
  console.log(`  Players: ${PLAYERS.map((p) => p.name).join(', ')}`);
  console.log(`  Leagues: ${LEAGUES.map((l) => l.name).join(', ')}`);
  console.log(`  Tours:   ${TOURS_2026.map((t) => t.name).join(', ')}`);
}

main();
