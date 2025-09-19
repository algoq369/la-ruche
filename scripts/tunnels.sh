#!/usr/bin/env bash
set -euo pipefail

# Start two Cloudflare tunnels (requires `cloudflared` installed and logged in):
# - UI (Next.js dev) at http://127.0.0.1:${WEB_PORT}
# - API/WS (Arena server) at http://127.0.0.1:${API_PORT}
# Prints the public URLs and how to point the UI at the API.

WEB_PORT=${WEB_PORT:-3006}
API_PORT=${API_PORT:-8083}

command -v cloudflared >/dev/null 2>&1 || {
  echo "cloudflared not found. Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" >&2
  exit 1
}

echo "[tunnels] Launching UI tunnel for http://127.0.0.1:${WEB_PORT} …"
UI_URL=$(cloudflared tunnel --url "http://127.0.0.1:${WEB_PORT}" 2>/dev/null | sed -n 's#.*trycloudflare.com#https://& #p' | awk '{print $1}' | head -n1 || true)
echo "[tunnels] UI: ${UI_URL:-starting…}"

echo "[tunnels] Launching API tunnel for http://127.0.0.1:${API_PORT} …"
API_URL=$(cloudflared tunnel --url "http://127.0.0.1:${API_PORT}" 2>/dev/null | sed -n 's#.*trycloudflare.com#https://& #p' | awk '{print $1}' | head -n1 || true)
echo "[tunnels] API: ${API_URL:-starting…}"

if [[ -n "${API_URL:-}" ]]; then
  echo "\n[hint] Point the UI to the API:"
  echo "      export NEXT_PUBLIC_ARENA_API_URL=${API_URL}"
  echo "      (or echo NEXT_PUBLIC_ARENA_API_URL=${API_URL} >> la-ruche/apps/web/.env.local)"
fi

echo "[tunnels] Note: keep these processes running while users connect."

