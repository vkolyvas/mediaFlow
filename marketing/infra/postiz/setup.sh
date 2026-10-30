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

  sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
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

# shellcheck disable=SC1091
set -a; . ./.env; set +a
port="${POSTIZ_PORT:-4007}"

if [ "${1:-}" = "--env-only" ]; then
  echo ".env is ready. Start the stack with: docker compose up -d"
  exit 0
fi

echo "Starting Postiz..."
docker compose up -d

# The Temporal auto-setup registers the legacy CustomStringField and
# CustomTextField as Text, which uses up the Text slots Temporal preallocates.
# Postiz's backend adds its own two attributes as Text on boot and the server
# refuses them ("cannot have more than 3 search attribute of type Text"), so
# the backend exits and never listens on port 3000.
#
# Registering the two attributes as Keyword first means Postiz finds them
# already there and skips the add. Keyword is the right type for an id.
echo "Waiting for Temporal..."
for _ in $(seq 1 60); do
  if [ "$(docker inspect -f '{{.State.Health.Status}}' temporal 2>/dev/null)" = "healthy" ]; then
    break
  fi
  sleep 2
done

temporal_ip="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' temporal)"
echo "Registering the search attributes Postiz needs (as Keyword)..."
docker exec temporal temporal operator search-attribute create \
  --namespace default --address "${temporal_ip}:7233" \
  --name organizationId --type Keyword \
  --name postId --type Keyword || true

echo "Restarting Postiz so the backend finds them..."
docker compose restart postiz

echo "Waiting for the app to answer..."
for _ in $(seq 1 60); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${port}/api/public/v1/integrations" 2>/dev/null || echo 000)"
  # 401 means the API is up and asking for a key - that is the answer we want.
  if [ "$code" = "401" ] || [ "$code" = "200" ]; then
    break
  fi
  sleep 2
done

docker compose ps

cat <<'MSG'

Postiz should be up.

Next:
  1. Open http://localhost:4007/register and create the first admin account.
     Then set DISABLE_REGISTRATION=true in .env and restart, so nobody else
     can register.
  2. Settings -> Public API -> create a key. Put it in marketing/.env as
     POSTIZ_API_KEY, and set POSTIZ_API_URL to the instance's /api base.
  3. Connect the Instagram and Facebook accounts under Integrations.
  4. Verify from the marketing repo:  npm run schedule -- --dry-run
MSG
