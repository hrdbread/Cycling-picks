# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A two-league fantasy game for the three Grand Tours of cycling, deployed at https://cycling.twerdochlib.com. Players pick 3 GC riders + 3 teams per tour. Same picks within a league cancel out. Scoring walks the GC podium (1st → 2nd → 3rd): the first placing still held by exactly one player after cancellation wins that tour (1 point). The Best Team pick breaks per-tour ties; the Vuelta breaks season ties. Visual style is 4-shade GameBoy monochrome with procedural pixel-sprite avatars and PCS jerseys downscaled to 32×32 4-tone PNGs.

## Common commands

```bash
# Local development
cp .env.example .env                              # then set SESSION_SECRET (openssl rand -base64 32)
npm install
npm run seed                                      # 4 players, 2 leagues, 3 2026 tours; idempotent
npm run dev                                       # http://localhost:3000

# Pulling live data from procyclingstats (uses Playwright + Chromium)
npm run sync:startlist -- giro-2026               # riders + teams for one tour
npm run sync:standings -- giro-2026               # auto-detects latest completed stage
npm run sync:standings -- giro-2026 --stage 12    # explicit stage
npm run sync:standings -- giro-2026 --final       # locks picks, marks tour finished, triggers scoring
npm run sync:shirts                               # downloads + pixelates all team jerseys

# Cron wrapper (used in production; flock-serialized)
scripts/sync.sh standings                         # all 3 tours
scripts/sync.sh standings giro-2026 --stage 3     # extra args forwarded to the npm script
scripts/sync.sh startlist                         # weekly refresh

# Build / typecheck
npm run build                                     # SESSION_SECRET must be set
npx tsc --noEmit
```

`npm run seed` migrates the old placeholder names (`You` → `Stefan`, `Mum` → `Daria`) and re-hashes passwords. Default passwords: Stefan/Alex use `KapustaDupa`, Daria/Larissa use `Fika`.

## Architecture

**Stack:** Next.js 15 (App Router, server components) + React 19 + Tailwind + iron-session + `better-sqlite3` + Playwright/cheerio for scraping. Single Node process, single SQLite file at `data/cycling.db`. No build-time DB calls — all queries run server-side at request time, so the DB is always fresh.

### Data flow

1. **Seed** (`scripts/seed.ts`) creates players, leagues, league memberships, and the three 2026 tours.
2. **Sync startlist** (`scripts/sync-startlist.ts` → `lib/pcs.ts`) renders the PCS startlist page in headless Chromium, extracts riders + teams + jersey image URLs, and writes them to the DB. Always run this before users can pick.
3. **Users pick** through `/tour/[slug]/pick` (3 riders + 3 teams; locks at tour start_date via `isPicksLocked` in `lib/dates.ts`).
4. **Sync standings** (`scripts/sync-standings.ts`) pulls GC + Best Team after each stage and writes one row per (`tour_id`, `stage`, `classification`, `position`).
5. **Scoring** (`lib/scoring.ts`) runs at render time on the tour/league pages. After `--final`, `tour.status = 'finished'` and `scoreTour` returns real points.

### Key boundaries

- **`lib/pcs.ts`** is the only file that knows PCS markup. If selectors break (they will, see `memory/reference_pcs_scraping.md`), only this file needs editing. The scraper handles three non-obvious PCS quirks: Cloudflare bot protection (real browser required), multi-table stage pages where one `.results` class spans 14 different tables (use `pickResTab`), and doubled gap cells with `,,` ditto markers (use `extractGapText`'s preference for `span.hide`).
- **`lib/queries.ts`** is the single funnel for DB reads. Adding a new view = add a function here, not raw SQL in pages.
- **`lib/scoring.ts`** owns the cancel-overlap rule + tiebreaker chain. The two leagues are scored independently (members never see each other's totals across leagues), and cancelation is per-league.
- **`lib/dates.ts`** has `tourPhase` (returns `not-open` / `open` / `locked` / `finished`) and `isPicksLocked`. Auth API + page route both call `isPicksLocked` so a forgotten cron run can't accidentally let someone change picks during a race.
- **`lib/shirts.ts`** lists files in `public/shirts/` once at boot — call `refreshShirts()` after running `sync:shirts` if a long-running dev server should pick up new files.
- **`components/PixelAvatar.tsx`** generates deterministic mirrored pixel grids from a hash key. Used for player avatars and rider/team fallback art when no PCS image is available.

### Auth

Iron-session cookies. The DB column is named `pin_hash` but it now stores a bcrypt-hashed password (kept the name to avoid migration). Session TTL is 90 days. `cookieOptions.secure` is true in production only — keep this in mind when testing prod-mode builds over HTTP.

### Schema notes

`db/schema.sql` is the schema of record. `lib/db.ts` runs it on every boot (it's idempotent) and applies ad-hoc `ALTER TABLE` migrations for columns added after initial deploy (currently just `teams.shirt_url`). Add new columns the same way — `ALTER` in the migrations array, then update the schema file so fresh installs match.

## Production deployment

Deployed via systemd + nginx + Let's Encrypt at `https://cycling.twerdochlib.com` on `root@142.93.109.129`. **Not Docker** — the Dockerfile/docker-compose.yml in the repo are unused on prod. See `memory/project_deployment.md` for the operational details that matter:

- App lives at `/var/www/twerdochlib.com/cycling-picks`, runs as `www-data`, listens on `127.0.0.1:3002`.
- The droplet has only **1 GB RAM** — never run `next build` on the server, always build locally and ship `.next/`. Never stack `sync-standings` runs (Playwright Chromium is heavy); `scripts/sync.sh` enforces this with `flock --nonblock`.
- Deploy by tarring locally (exclude `node_modules`, `data`, `.env`, `.next/cache`), `scp` to `/tmp`, extract over `/var/www/twerdochlib.com/cycling-picks` with `--no-xattrs`, scrub Apple metadata (`find ... -name '._*' -delete`), `systemctl restart cycling-picks`.
- Cron at `/etc/cron.d/cycling-picks`: standings 22:10 UTC daily, startlist 02:00 UTC Sunday. Logs via `journalctl -t cycling-picks`.

## Style conventions

- Pure black-and-white. No colored accents. Press Start 2P font everywhere. `image-rendering: pixelated` on every raster image.
- Cards use the `.pkm-frame` class (chunky black border + drop shadow). Selected state inverts to `.pkm-frame--inverted` (white-on-black) — don't introduce new accent colors.
- Use `hashColor` from `lib/style.ts` only inside the procedural pattern fallback paths; the primary art is the team jersey image (`team.shirt_url`).
