#!/usr/bin/env bash
# QCoreAI multi-agent — production smoke test.
#
# Usage:
#   QCORE_BASE=http://127.0.0.1:4101 ./scripts/qcore-smoke.sh
#   QCORE_BASE=https://api.aevion.io  ./scripts/qcore-smoke.sh
#
# Optional auth (Bearer JWT) for /search isolation tests:
#   QCORE_BEARER="eyJhbGciOi..." ./scripts/qcore-smoke.sh
#
# Exits non-zero on any failed assertion. Designed for post-deploy gates.

set -uo pipefail

BASE="${QCORE_BASE:-http://127.0.0.1:4101}"
BEARER="${QCORE_BEARER:-}"
PASS=0
FAIL=0
FAIL_DETAIL=()

green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }
gray()  { printf '\033[90m%s\033[0m' "$1"; }

check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    printf "  %s %s %s\n" "$(green '✓')" "$name" "$(gray "($actual)")"
    PASS=$((PASS + 1))
  else
    printf "  %s %s %s\n" "$(red '✗')" "$name" "$(red "got=$actual expected=$expected")"
    FAIL=$((FAIL + 1))
    FAIL_DETAIL+=("$name: expected $expected, got $actual")
  fi
}

curl_status() {
  local method="$1" path="$2" body="${3:-}"
  local headers=("-H" "Content-Type: application/json")
  if [ -n "$BEARER" ]; then
    headers+=("-H" "Authorization: Bearer $BEARER")
  fi
  if [ -n "$body" ]; then
    curl -s -o /dev/null -w "%{http_code}" -X "$method" "${headers[@]}" \
      --data "$body" "${BASE}$path" 2>/dev/null
  else
    curl -s -o /dev/null -w "%{http_code}" -X "$method" "${headers[@]}" \
      "${BASE}$path" 2>/dev/null
  fi
}

curl_body() {
  local method="$1" path="$2" body="${3:-}"
  local headers=("-H" "Content-Type: application/json")
  if [ -n "$BEARER" ]; then
    headers+=("-H" "Authorization: Bearer $BEARER")
  fi
  if [ -n "$body" ]; then
    curl -s -X "$method" "${headers[@]}" --data "$body" "${BASE}$path" 2>/dev/null
  else
    curl -s -X "$method" "${headers[@]}" "${BASE}$path" 2>/dev/null
  fi
}

echo "QCoreAI smoke against ${BASE}"
echo

echo "[1/6] meta endpoints"
check "GET /health 200"   "200" "$(curl_status GET /api/qcoreai/health)"
check "GET /providers"    "200" "$(curl_status GET /api/qcoreai/providers)"
check "GET /pricing"      "200" "$(curl_status GET /api/qcoreai/pricing)"
check "GET /agents"       "200" "$(curl_status GET /api/qcoreai/agents)"
check "GET /sessions"     "200" "$(curl_status GET /api/qcoreai/sessions)"
check "GET /analytics"    "200" "$(curl_status GET /api/qcoreai/analytics)"

echo
echo "[2/6] /health surfaces required fields"
HEALTH=$(curl_body GET /api/qcoreai/health)
check "service=qcoreai"          "qcoreai"  "$(printf '%s' "$HEALTH" | grep -o '"service":"[^"]*"' | head -1 | sed 's/"service":"\([^"]*\)"/\1/')"
HAS_WEBHOOK=$(printf '%s' "$HEALTH" | grep -c '"webhookConfigured"')
HAS_CAP=$(printf '%s' "$HEALTH" | grep -c '"costCapDefaultUsd"')
check "has webhookConfigured"    "1" "$HAS_WEBHOOK"
check "has costCapDefaultUsd"    "1" "$HAS_CAP"

echo
echo "[3/6] input validation"
check "POST /chat empty → 400"           "400" "$(curl_status POST /api/qcoreai/chat '{}')"
check "POST /multi-agent empty → 400"    "400" "$(curl_status POST /api/qcoreai/multi-agent '{}')"
check "POST /refine on bogus run → 404"  "404" "$(curl_status POST /api/qcoreai/runs/bogus/refine '{"instruction":"x"}')"
check "GET /runs/:id bogus → 404"        "404" "$(curl_status GET /api/qcoreai/runs/bogus)"
check "GET /shared/:token bogus → 404"   "404" "$(curl_status GET /api/qcoreai/shared/bogus)"

echo
echo "[4/6] search endpoint"
check "GET /search empty → 200"          "200" "$(curl_status GET '/api/qcoreai/search?q=')"
check "GET /search no match → 200"       "200" "$(curl_status GET '/api/qcoreai/search?q=zxcvbnm-no-match')"

echo
echo "[5/6] CORS / OPTIONS"
check "OPTIONS /multi-agent → 2xx/204"   "204" "$(curl_status OPTIONS /api/qcoreai/multi-agent)"

echo
echo "[6/6] rate-limit headers present on /multi-agent (single hit)"
RL_HEADERS=$(curl -s -D - -o /dev/null -X POST -H "Content-Type: application/json" \
  --data '{}' "${BASE}/api/qcoreai/multi-agent" 2>/dev/null)
HAS_RL=$(printf '%s' "$RL_HEADERS" | grep -ic '^x-ratelimit-' || true)
if [ "$HAS_RL" -ge 1 ]; then
  printf "  %s rate-limit headers (%d found)\n" "$(green '✓')" "$HAS_RL"
  PASS=$((PASS + 1))
else
  printf "  %s rate-limit headers MISSING\n" "$(red '✗')"
  FAIL=$((FAIL + 1))
  FAIL_DETAIL+=("rate-limit headers missing on /multi-agent")
fi

echo
echo "── summary ──────────────────────────────────"
printf "passed: %s\n" "$(green "$PASS")"
if [ "$FAIL" -gt 0 ]; then
  printf "failed: %s\n" "$(red "$FAIL")"
  for d in "${FAIL_DETAIL[@]}"; do
    printf "  - %s\n" "$d"
  done
  exit 1
fi
printf "%s\n" "$(green 'all checks green')"
