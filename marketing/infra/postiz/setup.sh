#!/usr/bin/env bash
#
# One-time setup for the self-hosted Postiz instance.
#
#   ./setup.sh            prepare .env and start the stack
#   ./setup.sh --env-only just write .env, do not start anything
#
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$here"

if ! command -v docker >/dev/null 2>&1; then
  cat >&2 <<'MSG'
docker is not installed on this host.

Install Docker Engine (with the compose plugin) first:

  sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2
  sudo systemctl enable --now docker
  sudo usermod -aG docker "$USER"   # then log out and back in

Ubuntu 24.04+ can also use the convenience script:
  curl -fsSL https://get.docker.com | sudo sh
MSG
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "'docker compose' (the v2 plugin) is required." >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Wrote .env from .env.example."

  # Replace the placeholder secrets with real ones.
  jwt="$(openssl rand -base64 48 | tr -d '\n')"
  pgpass="$(openssl rand -hex 24)"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${jwt}|" .env
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${pgpass}|" .env
  echo "Generated JWT_SECRET and POSTGRES_PASSWORD."
  echo
  echo "Now edit .env and set:"
  echo "  - MAIN_URL / FRONTEND_URL / NEXT_PUBLIC_BACKEND_URL (if not localhost)"
  echo "  - STORAGE_PROVIDER=cloudflare with the R2 details, for production"
  echo "  - FACEBOOK_APP_ID / FACEBOOK_APP_SECRET (see README.md)"
  echo
fi

if [ "${1:-}" = "--env-only" ]; then
  echo ".env is ready. Start the stack with: docker compose up -d"
  exit 0
fi

echo "Starting Postiz..."
docker compose up -d

echo "Waiting for the app to answer..."
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://localhost:${POSTIZ_PORT:-4007}/api/public/v1/integrations" 2>/dev/null; then
    break
  fi
  if curl -fsS -o /dev/null "http://localhost:${POSTIZ_PORT:-4007}" 2>/dev/null; then
    break
  fi
  sleep 2
done

docker compose ps

cat <<'MSG'

Postiz should be up.

Next:
  1. Open the instance and create the first admin account.
  2. Settings -> Public API -> create a key. Put it in marketing/.env as
     POSTIZ_API_KEY, and set POSTIZ_API_URL to the instance's /api base.
  3. Connect the Instagram and Facebook accounts under Integrations.
  4. Verify from the marketing repo:  npm run schedule -- --dry-run
MSG
