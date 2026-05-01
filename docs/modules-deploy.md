# Modules deploy notes (Tier 2 + Tier 3)

## Environment variables

| Name | Required | Default | Purpose |
|---|---|---|---|
| `MODULES_ADMIN_EMAILS` | optional | empty | Comma-separated lowercase emails granted access to `/admin/modules` and `PATCH /api/modules/admin/*`. JWT `role=admin` (or `ADMIN`) is also honoured. |

## Schema (no manual migration)

Four tables, all `CREATE TABLE IF NOT EXISTS`:

- **`ModuleStateOverride(moduleId TEXT PK, status, tier, hint, updatedAt, updatedBy)`** — admin layer that overrides individual fields from the static `projects.ts` + `moduleRuntime.ts`. NULL means "no override".
- **`ModuleStateChange(id, moduleId, actor, oldState JSONB, newState JSONB, at)`** — append-only audit of override edits. Indexed on `at DESC` and `(moduleId, at DESC)`.
- **`ModuleWebhook(id, url, secret, events, label, active, createdAt, createdBy, lastFiredAt, lastError, failureCount)`** — Tier 3 webhook subscriptions. Platform-level (no per-user scope).
- **`ModuleWebhookDelivery(id, webhookId, event, moduleId, succeeded, statusCode, errorMessage, durationMs, createdAt)`** — append-only delivery log. Indexed on `(webhookId, createdAt DESC)`.
- **`ModuleHit(id, moduleId, surface, at)`** — Tier 3 public-surface hit log. Surfaces: `embed`, `badge`, `detail`. Used to compute trending. Indexed on `(moduleId, at DESC)` and `(at DESC)`. Fire-and-forget writes; no IP/UA stored. Prune older than 30 days if growth becomes a concern.

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

# 7b. Per-module changelog scope (Tier 3)
curl -s "$HOST/api/modules/changelog?moduleId=qright&limit=20"

# 8. Per-module detail (Tier 3) — superset of /embed
curl -s "$HOST/api/modules/qright/detail" | jq

# 9. Public RSS feed (Tier 3) — for journalists / partners
curl -s "$HOST/api/modules/changelog.rss" | head -30

# 10. Trending modules by public hit count (Tier 3)
curl -s "$HOST/api/modules/trending?window=24h&limit=10" | jq
curl -s "$HOST/api/modules/trending?window=7d&limit=10" | jq

# 10b. Trending-sorted registry — pin hot modules to the top
curl -s "$HOST/api/modules/registry?sort=trending&window=24h" | jq '.items[].id'

# 11. Tag taxonomy (Tier 3 amplifier) — distinct tags with counts, sorted hot first
curl -s "$HOST/api/modules/tags" | jq '.items[:10]'

# 11b. Tag-filtered registry
curl -s "$HOST/api/modules/registry?tag=ai" | jq '.items[].id'

# 12. Per-module RSS — for partners who only follow one product
curl -s "$HOST/api/modules/qright/changelog.rss" | head -20

# 13. Sitemap (search engines / SEO)
curl -s "$HOST/api/modules/sitemap.xml" | head -30

# 14. OG SVG card — used by /modules/[id] og:image / twitter:image
curl -s "$HOST/api/modules/qright/og.svg" -o /tmp/og.svg
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

## Tier 3 — webhook subscriptions

Module override flips fan out to every active subscriber. Two events:
- `module.override.set` — override applied or modified
- `module.override.cleared` — override row dropped

Verification at the receiver: recompute `HMAC-SHA256(secret, rawRequestBody)` and
compare against `X-AEVION-Signature: sha256=<hex>`. Other headers stamped per
delivery: `X-AEVION-Event`, `X-AEVION-Webhook-Id`, `X-AEVION-Delivery-Id`.

```bash
# Register subscription. Secret is returned ONLY in this response.
curl -i -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"url":"https://your.host/webhook","events":"*","label":"ops slack"}' \
  $HOST/api/modules/admin/webhooks

# events can also be a subset:
#   "events": ["module.override.set"]

# List subscriptions (no secrets — those leave only on creation).
curl -s -H "Authorization: Bearer $TOKEN" $HOST/api/modules/admin/webhooks | jq

# Recent deliveries for one subscription.
curl -s -H "Authorization: Bearer $TOKEN" \
  "$HOST/api/modules/admin/webhooks/<webhookId>/deliveries?limit=20" | jq

# Delete subscription (and its delivery log).
curl -i -X DELETE -H "Authorization: Bearer $TOKEN" \
  "$HOST/api/modules/admin/webhooks/<webhookId>"
```

Receiver verification snippet (Node):

```js
const crypto = require("crypto");
const sig = req.header("X-AEVION-Signature").replace(/^sha256=/, "");
const expected = crypto.createHmac("sha256", SECRET).update(rawBody).digest("hex");
if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) reject();
```

## Frontend pages

- **`/modules`** — public browser (server component, EN/RU). Tier/status/kind filters + free-text search + CSV download button + 4-stat headline cards + Tier 3 trending strip (top 5 modules by 24h hits) + sort toggle (priority / trending) + **Tier 3 amplifier tag-chip strip** (top 14 tags with counts, click toggles `?tag=`). Each card shows tier color chip, status, kind badge, override marker, tags, primary path, API hints, plus "Embed badge" and "Detail" buttons.
- **`/modules/[id]`** — Tier 3 detail page (server component, EN/RU). Identity + live state with base→effective diff, surfaces, inline badge previews (dark/light), outgoing API dependency edges, full per-module changelog with diff view. CTA: open primary path. **Tier 3 amplifier:** clickable tag chips link to `/modules?tag=`, per-module RSS link in History header, JSON-LD (BreadcrumbList + WebPage) for SEO, og:image / twitter:image meta pointing at `/og.svg` so social shares render with live tier/status colors.
- **`/modules/[id]/badge`** — embed configurator. Live SVG preview, dark/light theme toggle, copy-able snippets (Markdown for README badges, HTML `<img>`, direct URL, JS fetch).
- **`/admin/modules`** — registry with per-row "Edit override" modal (status / tier / hint dropdowns, blank = clear that field). Audit log section at the bottom with diff details. Webhook subscriptions managed via API (see above).

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
- [ ] First request to `/api/modules/registry` after deploy creates `ModuleState*` tables (`\dt "ModuleState*"` should list both)
- [ ] First webhook create / fire bootstraps `ModuleWebhook` + `ModuleWebhookDelivery` tables (`\dt "ModuleWebhook*"`)
- [ ] First request to `/api/modules/<id>/embed` (or `/badge.svg`, `/detail`) creates `ModuleHit` (`\dt "ModuleHit"`)
- [ ] Public smoke 1-14 pass (registry, CSV, stats, embed, badge.svg, dependency-graph, changelog, detail, RSS, trending, tags, per-module RSS, sitemap, og.svg)
- [ ] `curl $HOST/api/modules/sitemap.xml | xmllint --noout -` validates as XML
- [ ] `curl $HOST/api/modules/qright/og.svg | head -1` returns `<svg …>` (Discord/Slack/LinkedIn share preview should render with tier-coloured accent bar)
- [ ] Admin probe returns `{ isAdmin: true }` for an allowlisted user
- [ ] Override edit → audit row appears in `/admin/modules` audit log + `/api/modules/changelog` (without actor)
- [ ] Override edit → if a `ModuleWebhook` exists, delivery row lands in `/admin/webhooks/<id>/deliveries`
- [ ] RSS feed validates (`curl -s $HOST/api/modules/changelog.rss | xmllint --noout -`)
