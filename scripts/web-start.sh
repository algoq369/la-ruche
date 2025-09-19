#!/usr/bin/env bash
set -euo pipefail

# Start Next.js dev server bound to 0.0.0.0 so it’s reachable on your LAN.

PORT=${PORT:-3006}
ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)

echo "[web-start] Starting Next.js on 0.0.0.0:${PORT} (CTRL-C to stop)"
cd "$ROOT_DIR/apps/web"
NEXT_TELEMETRY_DISABLED=1 npm run dev -- -H 0.0.0.0 -p "$PORT"

