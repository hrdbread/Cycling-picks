#!/usr/bin/env bash
# Deploy Cycling Picks to a DigitalOcean droplet (or any Docker host).
#
# Usage:
#   scripts/deploy.sh <user>@<host>           # first-time deploy
#   scripts/deploy.sh <user>@<host> --update  # incremental sync only
#
# Env overrides:
#   REMOTE_DIR   destination dir on the droplet (default /opt/cycling-picks)
#   SSH_KEY      path to identity file (default ~/.ssh/id_ed25519)
#
# What it does:
#   1. rsyncs the project tree (without node_modules / .next / data) to the host
#   2. ensures /opt/cycling-picks/.env has a SESSION_SECRET (generates if missing)
#   3. (first run) installs Docker if absent
#   4. docker compose up -d --build
#   5. (first run) seeds the DB and pulls all 3 startlists + jersey images
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <user>@<host> [--update]" >&2
  exit 1
fi
SSH_TARGET="$1"
UPDATE_ONLY="${2:-}"
REMOTE_DIR="${REMOTE_DIR:-/opt/cycling-picks}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
SSH_OPTS="-o StrictHostKeyChecking=accept-new"
[[ -f "$SSH_KEY" ]] && SSH_OPTS="$SSH_OPTS -i $SSH_KEY"

ssh_exec() { ssh $SSH_OPTS "$SSH_TARGET" "$@"; }

echo "▶ Syncing source to $SSH_TARGET:$REMOTE_DIR"
ssh_exec "sudo mkdir -p $REMOTE_DIR && sudo chown -R \$(id -u):\$(id -g) $REMOTE_DIR"
rsync -az --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude data \
  --exclude .env \
  --exclude .DS_Store \
  --exclude '*.tsbuildinfo' \
  -e "ssh $SSH_OPTS" \
  ./ "$SSH_TARGET:$REMOTE_DIR/"

if [[ "$UPDATE_ONLY" != "--update" ]]; then
  echo "▶ Bootstrapping host"
  ssh_exec "bash -s" <<'BOOTSTRAP'
set -euo pipefail
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
sudo usermod -aG docker "$USER" || true
BOOTSTRAP
fi

echo "▶ Ensuring .env exists"
ssh_exec "cd $REMOTE_DIR && [ -f .env ] || (echo SESSION_SECRET=\$(openssl rand -base64 32) > .env && echo 'Generated new SESSION_SECRET')"

echo "▶ docker compose up -d --build"
ssh_exec "cd $REMOTE_DIR && sudo docker compose up -d --build"

if [[ "$UPDATE_ONLY" != "--update" ]]; then
  echo "▶ First-run bootstrap: seed + sync startlists + sync shirts"
  ssh_exec "cd $REMOTE_DIR && sudo docker compose exec -T app npm run seed"
  for slug in giro-2026 tour-2026 vuelta-2026; do
    ssh_exec "cd $REMOTE_DIR && sudo docker compose exec -T app npm run sync:startlist -- $slug"
  done
  ssh_exec "cd $REMOTE_DIR && sudo docker compose exec -T app npm run sync:shirts"
fi

echo "✔ Deploy done. App is on http://127.0.0.1:3000 on the host."
echo "  Add nginx/Caddy in front for TLS + a public hostname."
