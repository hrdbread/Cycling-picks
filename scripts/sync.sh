#!/usr/bin/env bash
# Cron-friendly wrapper around the sync npm scripts.
# Usage: sync.sh standings | startlist | shirts [slug] [extra-args]
#
# - With no slug it runs for all 3 grand tours.
# - Loads .env, sets HOME and PLAYWRIGHT_BROWSERS_PATH so Chromium is found
#   when run as a non-interactive cron user.
# - Uses flock to guarantee at most one Playwright process at a time —
#   stacking them on a 1GB droplet leads to OOM thrashing.
set -u
APPDIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APPDIR"

export HOME="$APPDIR"
export PLAYWRIGHT_BROWSERS_PATH="$APPDIR/.ms-playwright"
set -a
[ -f .env ] && . .env
set +a

LOCK="$APPDIR/.sync.lock"
# Hard ceiling per sync run. PCS pages + Chromium take maybe 30s each on a
# healthy box; 8 minutes is enough headroom for all 3 tours but short enough
# that an OOM-hung run releases the lock before the next cron tick.
SYNC_TIMEOUT="${SYNC_TIMEOUT:-480}"

# Re-exec under flock so only one sync runs at a time across the whole host.
# A previous sync that hangs (Chromium can get wedged under memory pressure)
# would otherwise hold the lock forever and block every future cron run.
# `timeout --kill-after` guarantees the sync tree is killed if it overruns.
if [ "${FLOCK_HELD:-}" != "1" ]; then
  export FLOCK_HELD=1
  /usr/bin/flock --nonblock --conflict-exit-code 75 "$LOCK" \
    /usr/bin/timeout --foreground --kill-after=30s "${SYNC_TIMEOUT}s" \
    "$0" "$@"
  rc=$?
  case $rc in
    0)   exit 0 ;;
    75)  echo "[$(date -Is)] another sync is already running, skipping"; exit 0 ;;
    124) echo "[$(date -Is)] sync hit timeout after ${SYNC_TIMEOUT}s, killed"; exit 0 ;;
    *)   echo "[$(date -Is)] sync exited with code $rc"; exit $rc ;;
  esac
fi

KIND="${1:-standings}"
shift || true

# If next arg is a tour slug, target just that one; otherwise loop all 3.
case "${1:-}" in
  giro-2026|tour-2026|vuelta-2026)
    SLUGS=("$1"); shift;;
  *)
    SLUGS=(giro-2026 tour-2026 vuelta-2026);;
esac
EXTRA=("$@")  # forwarded to the npm script (e.g. --final, --stage 12)

case "$KIND" in
  standings)
    for slug in "${SLUGS[@]}"; do
      echo "▶ sync:standings $slug ${EXTRA[*]:-}"
      npm run --silent sync:standings -- "$slug" "${EXTRA[@]}" || echo "  (failed for $slug — continuing)"
    done
    ;;
  startlist)
    for slug in "${SLUGS[@]}"; do
      echo "▶ sync:startlist $slug"
      npm run --silent sync:startlist -- "$slug" || echo "  (failed for $slug — continuing)"
    done
    ;;
  shirts)
    echo "▶ sync:shirts"
    npm run --silent sync:shirts || echo "  (sync:shirts failed)"
    ;;
  *)
    echo "Usage: $0 standings|startlist|shirts [tour-slug] [-- extra-args]" >&2
    exit 2
    ;;
esac
