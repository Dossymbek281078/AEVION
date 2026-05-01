# Awards Tier 2 deploy notes

## Environment variables

| Name | Required | Default | Purpose |
|---|---|---|---|
| `AWARDS_ADMIN_EMAILS` | optional | empty | Comma-separated lowercase emails granted access to `/admin/awards` and `/api/awards/admin/*`. JWT `role=admin` (or `ADMIN`) is also honoured. |

## Schema (no manual migration)

Five new tables (`CREATE TABLE IF NOT EXISTS` — no Prisma migration needed):

- **`AwardSeason(id, code UNIQUE, type, title, status, startsAt, endsAt, createdAt, createdBy)`** — one cycle per type (e.g. `aevion-music-2026-q2`). Status flow: `draft → open → voting → closed → finalized`.
- **`AwardEntry(id, seasonId, artifactVersionId, productKey, status, qualifiedAt, qualifiedBy, disqualifyReason, submittedAt, embedFetches, UNIQUE(seasonId, artifactVersionId))`** — links a Planet artifact to a season; admin flips status pending → qualified/disqualified.
- **`AwardMedal(id, seasonId, place, entryId, artifactVersionId, voteCount, voteAverage, score, awardedAt, UNIQUE(seasonId, place))`** — frozen at finalize time. Score = `voteCount + voteAverage / 100` (votes dominate, average breaks ties).
- **`AwardEntryFetchSource(entryId, sourceHost, day, fetches)`** — per-Referer hostname embed/badge counters (no PII).
- **`AwardAuditLog(id, action, seasonId, entryId, actor, payload JSONB, at)`** — append-only admin trail. Indexed on `at DESC` and `(action, at DESC)`.

Award type → Planet productKey prefix is hard-mapped:

```ts
const AWARD_TYPE_TO_PRODUCT_PREFIX = {
  music:   "awards.music",
  film:    "awards.film",
  code:    "awards.code",
  design:  "awards.design",
  science: "awards.science",
};
```

## Public surfaces (rate-limited 240/min/IP, CORS open, ETag where useful)

```bash
HOST=https://YOUR_HOST

# 1. List seasons (?status=open|voting|closed|finalized, ?type=music|film)
curl -s "$HOST/api/awards/seasons?type=music&status=voting" | jq '.items[].code'

# 2. The currently-active season for a type (open|voting|closed wins draft)
curl -s $HOST/api/awards/seasons/current/music | jq '.season.code'

# 3. Live leaderboard for a type (uses currently-active season)
curl -s "$HOST/api/awards/music/leaderboard?limit=10" | jq '.entries[].submissionTitle'

# 4. Frozen medal results for a finalized season
curl -s $HOST/api/awards/seasons/SEASON_ID/results | jq '.medals'

# 5. Per-entry embed JSON (sanitized, ETag, CORS *, increments embedFetches)
curl -i $HOST/api/awards/entries/ENTRY_ID/embed

# 6. Per-entry SVG badge (?theme=dark|light, gold/silver/bronze when medaled)
curl -i "$HOST/api/awards/entries/ENTRY_ID/badge.svg?theme=dark" | head -1

# 7. Public transparency aggregate (counts only, no PII)
curl -s $HOST/api/awards/transparency | jq
```

## Owner endpoints (Bearer required)

```bash
TOKEN="<bearer-from-localStorage>"

# Submit your Planet artifact to an open season.
# Server checks artifact ownership against Planet (productKey + ownerUserId).
curl -i -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"seasonId":"SEASON_ID","artifactVersionId":"ARTIFACT_ID"}' \
  $HOST/api/awards/entries

# List your own entries across all seasons.
curl -s -H "Authorization: Bearer $TOKEN" $HOST/api/awards/me/entries
```

## Admin endpoints (Bearer + AWARDS_ADMIN_EMAILS allowlist)

```bash
# Probe — { isAdmin: true|false, email }
curl -i -H "Authorization: Bearer $TOKEN" $HOST/api/awards/admin/whoami

# Create a season (code is sluggified, must be unique)
curl -i -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"code":"aevion-music-2026-q2","type":"music","title":"AEVION Music Awards 2026 Q2","status":"open"}' \
  $HOST/api/awards/admin/seasons

# Patch season fields (title, status, startsAt, endsAt — any subset)
curl -i -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"voting"}' \
  $HOST/api/awards/admin/seasons/SEASON_ID

# Qualify / disqualify an entry
curl -i -X POST -H "Authorization: Bearer $TOKEN" $HOST/api/awards/admin/entries/ENTRY_ID/qualify
curl -i -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"reason":"Off-topic for music type"}' \
  $HOST/api/awards/admin/entries/ENTRY_ID/disqualify

# Finalize: computes top-3 from QUALIFIED entries (score = voteCount + voteAverage/100),
# inserts AwardMedal rows, sets season.status = finalized. Idempotent — re-finalize replaces.
curl -i -X POST -H "Authorization: Bearer $TOKEN" $HOST/api/awards/admin/seasons/SEASON_ID/finalize

# Audit + entry browser
curl -s -H "Authorization: Bearer $TOKEN" "$HOST/api/awards/admin/audit?limit=50"
curl -s -H "Authorization: Bearer $TOKEN" "$HOST/api/awards/admin/entries?seasonId=SEASON_ID&status=pending"
```

## Frontend pages

- **`/awards/results`** — server component (EN/RU via `pickLang`). Season picker (finalized only) + medal podium for each season with PLACE_COLORS (gold #eab308, silver #94a3b8, bronze #b45309). Each medal links to embed configurator + Planet artifact detail.
- **`/awards/badge/[entryId]`** — embed configurator. Live SVG preview, dark/light theme toggle, copy-able snippets (Markdown for README badges, HTML `<a><img></a>`, direct URL, JS fetch). Verify URL deep-links back to the artifact.
- **`/admin/awards`** — admin panel. Seasons CRUD with per-row status dropdown + Finalize button (visible when `closed|finalized`). Entry browser scoped by active season with status filter. Per-row Qualify / DQ / Badge buttons. Disqualify modal (≤500 char reason). Audit log section at the bottom.

## Score formula at finalize

```
score = voteCount + (voteAverage ?? 0) / 100
ORDER BY score DESC, voteCount DESC, submittedAt ASC
LIMIT 3
```

Total votes dominate; the `/100` term breaks ties so a 4.9-avg post beats a 4.7-avg post when vote counts match.

## Backwards compatibility

This is a brand-new module — no existing endpoints. Awards reads from Planet via `productKey` prefix matching, so no schema changes were made to Planet tables.

## Deploy checklist

1. Set `AWARDS_ADMIN_EMAILS=alice@aevion.com,bob@aevion.com` in Railway (lowercase).
2. Deploy backend — schema bootstraps on first request (`ensureAwardsTables`).
3. Smoke (anon):
   - `curl $HOST/api/awards/seasons` → `{ items: [] }` initially.
   - `curl $HOST/api/awards/transparency` → counts all 0.
4. Smoke (admin Bearer):
   - `POST /api/awards/admin/seasons` — create a music season, status `open`.
   - `POST /api/awards/entries` (as artifact owner) — submit a Planet artifact.
   - `POST /api/awards/admin/entries/:id/qualify` — flip to qualified.
   - `PATCH /api/awards/admin/seasons/:id` `{status:"closed"}` then `POST /admin/seasons/:id/finalize`.
   - `GET /api/awards/seasons/:id/results` should return medals.
5. Frontend smoke:
   - Visit `/awards/results` — finalized season appears.
   - Visit `/awards/badge/<entryId>` — preview renders, snippets copy.
   - Visit `/admin/awards` — gated by allowlist; status changes + finalize work; audit log fills.
