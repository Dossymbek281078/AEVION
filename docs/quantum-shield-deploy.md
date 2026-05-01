# Quantum Shield Tier 2 deploy notes

## Environment variables

| Name | Required | Default | Purpose |
|---|---|---|---|
| `QSHIELD_ADMIN_EMAILS` | optional | empty | Comma-separated lowercase emails granted access to `/api/quantum-shield/admin/*`. JWT `role=admin` is also honoured. |

## Schema (no manual migration)

No new tables. Tier 2 layer reuses the existing `QuantumShieldAudit` table for admin actions (event = `admin.force-revoke`).

## Public surface

```bash
HOST=https://YOUR_HOST

# Public counts only — totals.{shields,active,revoked,distributed,reconstructions}, byPolicy
curl -s $HOST/api/quantum-shield/transparency | jq
```

(Per-shield public view, witness, audit, metrics, OpenAPI spec, and webhooks already exist as part of the original module.)

## Admin endpoints (Bearer + QSHIELD_ADMIN_EMAILS allowlist)

```bash
TOKEN="<bearer-from-localStorage>"

# Probe
curl -i -H "Authorization: Bearer $TOKEN" $HOST/api/quantum-shield/admin/whoami

# List shields (?status, ?policy, ?limit≤200)
curl -s -H "Authorization: Bearer $TOKEN" "$HOST/api/quantum-shield/admin/shields?policy=distributed_v2"

# Force-revoke a shield (reason required, audit logged via QuantumShieldAudit)
curl -i -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"reason":"Compromise reported (incident #2026-04-30-001)"}' \
  $HOST/api/quantum-shield/admin/shields/SHIELD_ID/revoke

# Cross-shield audit reader (?event, ?limit≤200)
curl -s -H "Authorization: Bearer $TOKEN" "$HOST/api/quantum-shield/admin/audit?event=admin.force-revoke"
```

## Backwards compatibility

All existing Quantum Shield endpoints unchanged: `/health`, `/stats`, `/metrics`, `/openapi.json`, `/webhooks*`, `/ records`, `/:id/public`, `/:id/witness`, `/:id/reconstruct`, `/:id/verify`, `/:id/revoke` (owner), `/:id/audit`, etc.

The `RESERVED_IDS` set was extended with `transparency` + `admin` so `/transparency` and `/admin/*` are not interpreted as shield IDs by the catch-all `/:id` route.

## Deploy checklist

1. Set `QSHIELD_ADMIN_EMAILS` in Railway (lowercase, comma-sep).
2. Deploy.
3. Smoke (anon): `GET /api/quantum-shield/transparency` → counts.
4. Smoke (admin Bearer): `whoami` → `isAdmin: true`. List → recent shields. Force-revoke a test shield → `ok: true` + `QuantumShieldAudit` row with `event = 'admin.force-revoke'`.
