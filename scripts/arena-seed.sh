#!/usr/bin/env bash
set -euo pipefail

# Seed two hosted agents, create a match, and enable autopilot against the Arena API.
# Requirements: curl, jq, and the Arena server running on $BASE (default http://127.0.0.1:8083).

BASE=${BASE:-http://127.0.0.1:8083}

echo "[arena-seed] Using BASE=${BASE}"

has_jq() {
  command -v jq >/dev/null 2>&1
}

echo "[arena-seed] Registering agents..."
curl -sS -X POST "$BASE/api/arena/agent" \
  -H 'Content-Type: application/json' \
  --data '{"name":"Alpha (hosted)","notes":"local","url":"http://127.0.0.1:9090/duel"}' >/dev/null

curl -sS -X POST "$BASE/api/arena/agent" \
  -H 'Content-Type: application/json' \
  --data '{"name":"Gamma (hosted)","notes":"local","url":"http://127.0.0.1:9091/duel"}' >/dev/null

STATE=$(curl -sS "$BASE/api/arena/state")

if has_jq; then
  ALPHA_ID=$(printf '%s' "$STATE" | jq -r '.agents[]|select(.name=="Alpha (hosted)")|.id' | tail -n1)
  GAMMA_ID=$(printf '%s' "$STATE" | jq -r '.agents[]|select(.name=="Gamma (hosted)")|.id' | tail -n1)
else
  # Fallback very rough extraction if jq missing (best effort)
  ALPHA_ID=$(printf '%s' "$STATE" | sed -n 's/.*"name":"Alpha (hosted)"[^}]*"id":"\([^"]*\)".*/\1/p' | tail -n1)
  GAMMA_ID=$(printf '%s' "$STATE" | sed -n 's/.*"name":"Gamma (hosted)"[^}]*"id":"\([^"]*\)".*/\1/p' | tail -n1)
fi

if [[ -z "${ALPHA_ID:-}" || -z "${GAMMA_ID:-}" ]]; then
  echo "[arena-seed] Could not resolve agent IDs from state. Raw state follows:" >&2
  echo "$STATE" >&2
  exit 1
fi

echo "[arena-seed] Alpha=$ALPHA_ID  Gamma=$GAMMA_ID"

echo "[arena-seed] Creating match..."
curl -sS -X POST "$BASE/api/arena/match" \
  -H 'Content-Type: application/json' \
  --data "{\"a\":\"$ALPHA_ID\",\"b\":\"$GAMMA_ID\",\"bestOf\":3}" >/dev/null

echo "[arena-seed] Enabling autopilot..."
curl -sS -X POST "$BASE/api/arena/autopilot" \
  -H 'Content-Type: application/json' \
  --data '{"enabled":true,"timePerRoundSec":120,"pauseSec":30}' >/dev/null

echo "[arena-seed] Final state:"
curl -sS "$BASE/api/arena/state"

