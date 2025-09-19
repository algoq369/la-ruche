#!/usr/bin/env bash
set -euo pipefail

# Start the Arena backend (Fastify server) from the monorepo.
# Kills anything on $PORT, sets env, and launches with nohup.

PORT=${PORT:-8083}
ARENA_FILE=${ARENA_FILE:-"$PWD/arena.state.json"}
PEAQ_OPTIONAL=${PEAQ_OPTIONAL:-1}

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)

echo "[arena-start] Using PORT=$PORT  ARENA_FILE=$ARENA_FILE  PEAQ_OPTIONAL=$PEAQ_OPTIONAL"

echo "[arena-start] Killing existing listeners on $PORT (if any)..."
lsof -nP -iTCP:"$PORT" -sTCP:LISTEN | awk 'NR>1{print $2}' | xargs -r kill -9 || true

echo "[arena-start] Building server..."
(
  cd "$ROOT_DIR" && npm run build -w @la-ruche/server
) >/dev/null

echo "[arena-start] Launching server..."
cd "$ROOT_DIR/apps/server"
export PORT PEAQ_OPTIONAL ARENA_FILE
nohup npm run start >/tmp/arena.log 2>&1 &
echo $! > /tmp/arena.pid
sleep 1

echo "[arena-start] Tail /tmp/arena.log (last 40 lines):"
tail -n 40 /tmp/arena.log || true

echo "[arena-start] Health:"
curl -sS "http://127.0.0.1:$PORT/api/health" || curl -sS "http://127.0.0.1:$PORT/health" || true
