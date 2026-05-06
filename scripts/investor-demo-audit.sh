#!/usr/bin/env bash
# Investor demo link audit — run before any pitch.
# Verifies all UI routes + critical backend endpoints from AEVION_ONEPAGER.md.
# Exit code: 0 = all green, 1 = at least one red.
#
# Usage: bash scripts/investor-demo-audit.sh

set -u

UI="https://aevion.app"
API="https://aevion.app/api-backend"

fail=0

check() {
  local label="$1"
  local url="$2"
  local expect="${3:-200}"
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" -L --max-time 10 "$url" 2>/dev/null || echo "000")
  if [ "$code" = "$expect" ]; then
    printf "  ✅ %-3s  %-40s  %s\n" "$code" "$label" "$url"
  else
    printf "  ❌ %-3s  %-40s  %s  (expected %s)\n" "$code" "$label" "$url" "$expect"
    fail=1
  fi
}

echo "=== AEVION investor demo link audit ($(date -u +%Y-%m-%dT%H:%M:%SZ)) ==="

echo
echo "[UI routes — Vercel]"
check "Home"            "$UI/"
check "QRight"          "$UI/qright"
check "QSign"           "$UI/qsign"
check "Bureau"          "$UI/bureau"
check "Awards"          "$UI/awards"
check "Planet"          "$UI/planet"
check "Bank"            "$UI/bank"
check "QPayNet"         "$UI/qpaynet"
check "QCoreAI"         "$UI/qcoreai"
check "Cyberchess"      "$UI/cyberchess"

echo
echo "[Backend health — Railway via aevion.app proxy]"
check "Deep health"        "$API/api/health/deep"
check "AEV stats"          "$API/api/aev/stats"
check "Bureau health"      "$API/api/bureau/health"
check "Bureau notaries"    "$API/api/bureau/notaries"
check "QCoreAI providers"  "$API/api/qcoreai/providers"
check "Bureau dashboard (auth required)"  "$API/api/bureau/dashboard"  401

echo
echo "[Direct Railway origin]"
check "Railway health"   "https://aevion-production-a70c.up.railway.app/api/health/deep"

echo
echo "[External]"
check "GitHub repo"      "https://github.com/Dossymbek281078/AEVION"

echo
if [ "$fail" = "0" ]; then
  echo "✅ all green — demo flow ready"
  exit 0
else
  echo "❌ at least one check failed — fix before demo"
  exit 1
fi
