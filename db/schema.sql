-- Cycling Picks schema
-- Two leagues run independently. Picks cancel only within the same league.

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS players (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  pin_hash    TEXT NOT NULL,
  avatar      TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leagues (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  trophy      TEXT NOT NULL,                    -- 'haribo' | 'fika'
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS league_members (
  league_id   INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (league_id, player_id)
);

CREATE TABLE IF NOT EXISTS grand_tours (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,             -- 'giro-2026' etc.
  name        TEXT NOT NULL,                    -- 'Giro d''Italia'
  year        INTEGER NOT NULL,
  ordering    INTEGER NOT NULL,                 -- 1=Giro, 2=Tour, 3=Vuelta
  pcs_race    TEXT NOT NULL,                    -- 'giro-d-italia'
  start_date  TEXT,
  end_date    TEXT,
  locked      INTEGER NOT NULL DEFAULT 0,       -- picks locked once 1
  status      TEXT NOT NULL DEFAULT 'upcoming', -- upcoming|active|finished
  UNIQUE (year, ordering)
);

CREATE TABLE IF NOT EXISTS teams (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pcs_slug    TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  jersey      TEXT,                             -- hex colour for kit accent
  shirt_url   TEXT                              -- relative URL to PCS jersey image
);

CREATE TABLE IF NOT EXISTS riders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pcs_slug    TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  country     TEXT,                             -- ISO 3166-1 alpha-2 lowercased
  birth_year  INTEGER,
  team_id     INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  photo_url   TEXT,
  pcs_pts     INTEGER DEFAULT 0
);

-- Startlist for a given Grand Tour
CREATE TABLE IF NOT EXISTS tour_riders (
  tour_id     INTEGER NOT NULL REFERENCES grand_tours(id) ON DELETE CASCADE,
  rider_id    INTEGER NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  bib         INTEGER,
  PRIMARY KEY (tour_id, rider_id)
);

CREATE TABLE IF NOT EXISTS tour_teams (
  tour_id     INTEGER NOT NULL REFERENCES grand_tours(id) ON DELETE CASCADE,
  team_id     INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  PRIMARY KEY (tour_id, team_id)
);

-- Each player has one set of picks per (league, tour). 3 riders + 3 teams.
CREATE TABLE IF NOT EXISTS picks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id   INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  tour_id     INTEGER NOT NULL REFERENCES grand_tours(id) ON DELETE CASCADE,
  locked_at   TEXT,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (league_id, player_id, tour_id)
);

CREATE TABLE IF NOT EXISTS pick_riders (
  pick_id     INTEGER NOT NULL REFERENCES picks(id) ON DELETE CASCADE,
  slot        INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 3),
  rider_id    INTEGER NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  PRIMARY KEY (pick_id, slot)
);

CREATE TABLE IF NOT EXISTS pick_teams (
  pick_id     INTEGER NOT NULL REFERENCES picks(id) ON DELETE CASCADE,
  slot        INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 3),
  team_id     INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  PRIMARY KEY (pick_id, slot)
);

-- Daily snapshot of GC and team standings after each stage.
CREATE TABLE IF NOT EXISTS standings (
  tour_id     INTEGER NOT NULL REFERENCES grand_tours(id) ON DELETE CASCADE,
  stage       INTEGER NOT NULL,                 -- 0 = final, 1..21 = stage
  classification TEXT NOT NULL,                 -- 'gc' | 'teams'
  position    INTEGER NOT NULL,
  rider_id    INTEGER REFERENCES riders(id) ON DELETE SET NULL,
  team_id     INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  gap_seconds INTEGER,
  fetched_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tour_id, stage, classification, position)
);

CREATE INDEX IF NOT EXISTS idx_standings_lookup
  ON standings (tour_id, classification, stage, position);
