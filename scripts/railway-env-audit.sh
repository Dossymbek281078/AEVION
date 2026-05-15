#!/usr/bin/env bash
# Railway env audit — checks that every secret expected by the prod
# baseline (per SECURITY.md) is actually set on Railway.
#
# Uses the Railway GraphQL API:
#   https://backboard.railway.com/graphql/v2
#
# Auth: Railway account-token export RAILWAY_TOKEN=...
# Or override service IDs via env: PROJECT_ID, ENV_ID, SERVICE_ID
#
# Output: one line per env, status [OK]/[MISSING]/[WEAK].
# Exit: 0 if all OK, 1 if any MISSING/WEAK.

set -u

RAILWAY_GRAPHQL="https://backboard.railway.com/graphql/v2"
PROJECT_ID="${PROJECT_ID:-9d891410-4379-40e3-97ee-619f868ac5d4}"
ENV_ID="${ENV_ID:-8d3be6fb-d202-4ffc-bd5a-97eb7e1bd816}"
SERVICE_ID="${SERVICE_ID:-13b81e5a-67ac-474c-b86d-05f3704d0896}"

if [ -z "${RAILWAY_TOKEN:-}" ]; then
  echo "ERROR: RAILWAY_TOKEN env not set."
  echo "       Get it from Railway → Account Settings → Tokens."
  exit 2
fi

# Required prod env vars per SECURITY.md baseline.
# Format: NAME|MIN_LENGTH|RATIONALE (rationale shown when MISSING).
REQUIRED=(
  "AUTH_JWT_SECRET|32|JWT signing — without it auth fails closed in prod"
  "QSIGN_SECRET|32|HMAC for /api/qsign/v1 + Planet snapshot signing"
  "QRIGHT_WEBHOOK_SECRET|32|Inbound rights webhook HMAC"
  "CYBERCHESS_WEBHOOK_SECRET|32|Inbound chess prize webhook HMAC"
  "PLANET_WEBHOOK_SECRET|32|Inbound planet payout webhook HMAC"
  "BUILD_PAYMENT_WEBHOOK_SECRET|32|Inbound build payment webhook HMAC"
  "STRIPE_SECRET_KEY|32|Stripe API auth — Bureau cert payment"
  "STRIPE_WEBHOOK_SECRET|32|Stripe webhook signature verification"
  "BUREAU_PAYMENT_PROVIDER|6|Routes Bureau /payment to stripe vs stub"
  "QPAYNET_ADMIN_EMAILS|5|Admin allowlist for QPayNet ops endpoints"
  "DASHBOARD_SECRET|32|Affiliate/partners dashboard token mint"
  "ADMIN_TOKEN|32|Pricing/events admin endpoints gate"
  "DATABASE_URL|10|Postgres connection — backend won't boot without it"
)

# Optional but recommended — warn but don't fail.
RECOMMENDED=(
  "SENTRY_DSN|10|Sentry alerts won't reach Slack until set"
  "QPAYNET_ENCRYPTION_KEY|32|At-rest encryption for QPayNet secrets (AES-GCM)"
  "BUREAU_VERIFIED_AEC_REWARD|1|Reward sizing for Verified-tier cert claim"
  "BUREAU_NOTARIZED_AEC_REWARD|1|Reward sizing for Notarized-tier cert claim"
)

# Query: variables(projectId, environmentId, serviceId) returns a JSON object
# of name → value. We don't read values — only check presence + length.
QUERY='query Vars($projectId: String!, $environmentId: String!, $serviceId: String!) { variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId) }'

PAYLOAD=$(cat <<EOF
{"query":"$QUERY","variables":{"projectId":"$PROJECT_ID","environmentId":"$ENV_ID","serviceId":"$SERVICE_ID"}}
EOF
)

RESP=$(curl -sS -X POST "$RAILWAY_GRAPHQL" \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

if echo "$RESP" | python -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("data",{}).get("variables") is not None else 1)' 2>/dev/null; then
  : # ok
else
  echo "ERROR: Railway GraphQL did not return variables map. Response:"
  echo "$RESP" | head -c 500
  exit 2
fi

ENV_JSON=$(echo "$RESP" | python -c 'import json,sys; print(json.dumps(json.load(sys.stdin)["data"]["variables"]))')

check_one() {
  local name="$1" min_len="$2" rationale="$3" tier="$4"
  local len
  len=$(echo "$ENV_JSON" | python -c "import json,sys; v=json.load(sys.stdin).get('$name',''); print(len(v) if v else 0)" 2>/dev/null)
  if [ "$len" = "0" ]; then
    if [ "$tier" = "REQUIRED" ]; then
      printf "  ❌ [MISSING] %-32s  %s\n" "$name" "$rationale"
      return 1
    else
      printf "  ⚠  [missing] %-32s  %s\n" "$name" "$rationale"
      return 0
    fi
  elif [ "$len" -lt "$min_len" ]; then
    printf "  ⚠  [WEAK]    %-32s  len=$len < $min_len ($rationale)\n" "$name"
    [ "$tier" = "REQUIRED" ] && return 1 || return 0
  else
    printf "  ✅ [OK]      %-32s  len=$len\n" "$name"
    return 0
  fi
}

echo "=== Railway env audit ($(date -u +%Y-%m-%dT%H:%M:%SZ)) ==="
echo "    project=$PROJECT_ID"
echo "    service=$SERVICE_ID"
echo "    env=$ENV_ID"
echo

fail=0

echo "[Required — production fails closed without these]"
for entry in "${REQUIRED[@]}"; do
  IFS='|' read -r name min_len rationale <<< "$entry"
  check_one "$name" "$min_len" "$rationale" "REQUIRED" || fail=1
done

echo
echo "[Recommended — observability + opt-in features]"
for entry in "${RECOMMENDED[@]}"; do
  IFS='|' read -r name min_len rationale <<< "$entry"
  check_one "$name" "$min_len" "$rationale" "RECOMMENDED"
done

echo
if [ "$fail" = "0" ]; then
  echo "✅ all required env vars set"
  exit 0
else
  echo "❌ at least one required env var missing or weak"
  exit 1
fi
