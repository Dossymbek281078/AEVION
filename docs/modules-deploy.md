# Modules Tier 2 deploy notes

## Environment variables

| Name | Required | Default | Purpose |
|---|---|---|---|
| `MODULES_ADMIN_EMAILS` | optional | empty | Comma-separated lowercase emails granted access to `/admin/modules` and `PATCH /api/modules/admin/*`. JWT `role=admin` (or `ADMIN`) is also honoured. |

## Schema (no manual migration)

Two new tables (`CREATE TABLE IF NOT EXISTS`):

- **`ModuleStateOverride(moduleId TEXT PK, status, tier, hint, updatedAt, updatedBy)`** — admin layer that overrides individual fields from the static `projects.ts` + `moduleRuntime.ts`. NULL means "no override".
- **`ModuleStateChange(id, moduleId, actor, oldState JSONB, newState JSONB, at)`** — append-only audit of override edits. Indexed on `at DESC` and `(moduleId, at DESC)`.

## Public surfaces (rate-limited 240/min/IP, CORS open)

```bash
HOST=https://YOUR_HOST

# 1. Filtered registry — tier, status, kind, q (≥ 2 chars)
curl -s "$HOST/api/modules/registry?tier=mvp_live&q=ai" | jq '.items[].code'

# 2. CSV export (RFC 4180)
curl -i "$HOST/api/modules/registry.csv?tier=mvp_live"

# 3. Aggregate stats
curl -s $HOST/api/modules/stats | jq

# 4. Per-module embed JSON (sanitized, ETag, CORS *)
curl -i $HOST/api/modules/qright/embed

# 5. Per-module SVG badge (?theme=dark|light)
curl -i $HOST/api/modules/qright/badge.svg | head -1

# 6. Dependency graph — { nodes, edges }
curl -s $HOST/api/modules/dependency-graph | jq '.nodeCount, .edgeCount'

# 7. Public changelog (admin overrides over time, no actor)
curl -s "$HOST/api/modules/changelog?limit=20"
```

## Admin endpoints (Bearer required + admin gate)

```bash
TOKEN="<bearer-from-localStorage>"

# admin probe
curl -i -H "Authorization: Bearer $TOKEN" $HOST/api/modules/admin/whoami

# Set override (any subset of status/tier/hint; null clears that field;
# all-null drops the row).
curl -i -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"tier":"mvp_live","status":"launched","hint":"Live in prod"}' \
  $HOST/api/modules/admin/cyberchess

# Audit reader (with actor)
curl -s -H "Authorization: Bearer $TOKEN" "$HOST/api/modules/admin/audit?limit=20"
```

## Frontend pages

- **`/modules`** — public browser (server component, EN/RU). Tier/status/kind filters + free-text search + CSV download button + 4-stat headline cards. Each card shows tier color chip, status, kind badge, override marker, tags, primary path, API hints, plus "Embed badge" and "Detail" buttons.
- **`/modules/[id]/badge`** — embed configurator. Live SVG preview, dark/light theme toggle, copy-able snippets (Markdown for README badges, HTML `<img>`, direct URL, JS fetch).
- **`/admin/modules`** — registry with per-row "Edit override" modal (status / tier / hint dropdowns, blank = clear that field). Audit log section at the bottom with diff details.

## Effective state semantics

Reads always merge static defaults with overrides:
- `effectiveStatus = override.status ?? projects.ts status`
- `effectiveTier = override.tier ?? moduleRuntime.tier`
- `effectiveHint = override.hint ?? moduleRuntime.hint`

`/registry` and `/registry.csv` filter against EFFECTIVE values, so flipping an override immediately changes which modules show up under e.g. `?tier=mvp_live`.

## Backwards compatibility

The original three endpoints (`GET /status`, `GET /:id/health`, `GET /:id/meta`) keep their contract unchanged — `/status` now returns merged effective state but the response shape is identical. Existing frontend consumers (Globus dashboard, etc.) keep working.

## Deploy checklist

- [ ] Set `MODULES_ADMIN_EMAILS` (Railway env vars)
- [ ] First request to `/api/modules/registry` after deploy creates 2 new tables (`\dt "ModuleState*"` should list both)
- [ ] Public smoke 1-7 pass
- [ ] Admin probe returns `{ isAdmin: true }` for an allowlisted user
- [ ] Override edit → audit row appears in `/admin/modules` audit log + `/api/modules/changelog` (without actor)
