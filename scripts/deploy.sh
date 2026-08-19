#!/usr/bin/env bash
#
# Deploy SIMULYN to the university server.
# Prerequisites: git, Docker and the Docker Compose plugin on the host.
#
#   ./scripts/deploy.sh              pull, build, migrate, restart
#   ./scripts/deploy.sh --seed       also seed (safe: only fills an empty database)
#   ./scripts/deploy.sh --no-pull    deploy the working tree as-is
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"
SEED=false
PULL=true

for arg in "$@"; do
  case "$arg" in
    --seed)    SEED=true ;;
    --no-pull) PULL=false ;;
    *) echo "unknown option: $arg" >&2; exit 1 ;;
  esac
done

if [ ! -f .env ]; then
  echo "✖ .env is missing. Copy .env.example and fill in the secrets:" >&2
  echo "    cp .env.example .env && \${EDITOR:-nano} .env" >&2
  exit 1
fi

# Fail before building rather than halfway through.
missing=()
for key in POSTGRES_USER POSTGRES_PASSWORD JWT_SECRET JWT_REFRESH_SECRET CORS_ORIGIN NEXT_PUBLIC_API_URL; do
  if ! grep -qE "^${key}=.+" .env; then missing+=("$key"); fi
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "✖ .env is missing values for: ${missing[*]}" >&2
  exit 1
fi

if [ "$PULL" = true ]; then
  echo "▸ Pulling latest code…"
  git pull --ff-only origin main
fi

echo "▸ Building images…"
$COMPOSE build

echo "▸ Starting the database…"
$COMPOSE up -d db

echo "▸ Applying migrations…"
# Runs in a throwaway container so a failure never leaves a half-started API.
$COMPOSE run --rm api pnpm --filter @simulyn/shared db:postgres:deploy

if [ "$SEED" = true ]; then
  echo "▸ Seeding…"
  echo "  (the seed wipes and repopulates — only do this on a fresh install)"
  $COMPOSE run --rm api pnpm --filter @simulyn/shared db:seed
fi

echo "▸ Starting services…"
$COMPOSE up -d --remove-orphans

echo "▸ Waiting for health checks…"
for _ in $(seq 1 30); do
  if $COMPOSE ps --format json | grep -q '"Health":"healthy"'; then break; fi
  sleep 2
done

echo
echo "✔ Deployed."
$COMPOSE ps
echo
echo "  Web  → ${NEXT_PUBLIC_API_URL:-see .env}"
echo "  Logs → $COMPOSE logs -f api"
