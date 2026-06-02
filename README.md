# Cycling Picks

A friendly fantasy game for the three Grand Tours of cycling.

Two parallel leagues:

- **Haribo Cup** — Alex vs You. Winner bags a bag of Haribo. 🐻
- **Fika League** — Mum, Larissa, You. Winner is treated to fika. ☕

Each tour, every player picks **3 GC riders** and **3 teams**. Same picks within
a league cancel out. Most winners picked = 1 point. Across the 3 tours, most
points wins the trophy; if tied, the Vuelta is the season-ending tiebreaker.

## Stack

- Next.js 15 (App Router) + React 19, TypeScript, Tailwind
- SQLite via `better-sqlite3` (single file, lives at `./data/cycling.db`)
- `iron-session` cookies for the PIN login
- `cheerio` + `undici` to scrape procyclingstats.com and the race sites

## Local development

```bash
cp .env.example .env
# edit .env and put a real SESSION_SECRET (openssl rand -base64 32)

npm install
npm run seed                         # creates 5 players, 2 leagues, 2026 tours
npm run sync:startlist -- giro-2026  # pull riders + teams when the startlist is up
npm run dev                          # http://localhost:3000
```

Default PIN for every seeded profile is `0000` (override with `SEED_DEFAULT_PIN`).

## Syncing live data

```bash
npm run sync:startlist -- tour-2026          # one-off when startlist appears
npm run sync:standings -- tour-2026          # daily during the race
npm run sync:standings -- tour-2026 --final  # the day after the race ends
```

`--final` marks the tour as `finished`, locks picks, and triggers scoring.

PCS has no public API. The scraper identifies itself via a polite User-Agent
and only fetches a handful of pages per tour per day. Selectors live in
`lib/pcs.ts`.

## Deploying to DigitalOcean

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
git clone <your-repo-url> /opt/cycling-picks
cd /opt/cycling-picks
echo "SESSION_SECRET=$(openssl rand -base64 32)" > .env
docker compose up -d --build
docker compose exec app npm run seed
```

Put nginx (or Caddy) in front for TLS and reverse proxy to `127.0.0.1:3000`.

## Scoring

`lib/scoring.ts` is the single source of truth. Per tour:

1. Cancel any rider/team picked by more than one player **in the same league**.
2. If exactly one player has the GC winner in their remaining list → 1 point.
3. Otherwise tiebreak on the Best Team classification with the same logic.
4. Otherwise the tour is undecided (zero points to all).

Season tiebreaker: most recent tour with a single winner among tied players.
