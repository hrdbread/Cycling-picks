import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  const path = process.env.DATABASE_PATH || './data/cycling.db';
  const abs = resolve(path);
  mkdirSync(dirname(abs), { recursive: true });
  const handle = new Database(abs);
  handle.pragma('journal_mode = WAL');
  handle.pragma('foreign_keys = ON');
  const schema = readFileSync(resolve('db/schema.sql'), 'utf8');
  handle.exec(schema);
  // Idempotent column migrations for existing databases. Each ALTER throws
  // if the column already exists, so we swallow that specific error.
  for (const sql of [
    'ALTER TABLE teams ADD COLUMN shirt_url TEXT',
  ]) {
    try {
      handle.exec(sql);
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (!/duplicate column name/i.test(msg)) throw err;
    }
  }
  _db = handle;
  return handle;
}

export type Player = {
  id: number;
  name: string;
  pin_hash: string;
  avatar: string | null;
  created_at: string;
};

export type League = {
  id: number;
  slug: string;
  name: string;
  trophy: 'haribo' | 'fika';
};

export type GrandTour = {
  id: number;
  slug: string;
  name: string;
  year: number;
  ordering: number;
  pcs_race: string;
  start_date: string | null;
  end_date: string | null;
  locked: 0 | 1;
  status: 'upcoming' | 'active' | 'finished';
};

export type Team = {
  id: number;
  pcs_slug: string;
  name: string;
  jersey: string | null;
  shirt_url: string | null;
};

export type Rider = {
  id: number;
  pcs_slug: string;
  name: string;
  country: string | null;
  birth_year: number | null;
  team_id: number | null;
  photo_url: string | null;
  pcs_pts: number;
};
