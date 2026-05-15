# MVP concept routers — single-source spec for the 10 ownerless modules

> Shipped 2026-05-12 in commits `122c9d1d`, `bdd7b41b`, `a6e0605f`. Verified
> live on prod (50/50 assertions PASS via `npm run smoke:mvp-concepts`).

## What this is

The 10 AEVION modules with `idea` or `planning` status that didn't have a
dedicated route file before:

| Module | Noun (path) | Required create fields |
|---|---|---|
| `startup-exchange` | `listings` | `company`, `stage` |
| `mapreality` | `claims` | `claim`, `lat`, `lng` |
| `kids-ai-content` | `items` | `topic`, `ageRange` |
| `qlife` | `prompts` | `prompt` |
| `psyapp-deps` | `assessments` | `title`, `category` |
| `qpersona` | `personas` | `name`, `traits` |
| `voice-of-earth` | `feeds` | `location`, `metric` |
| `deepsan` | `runs` | `facility`, `method` |
| `shadownet` | `posts` | `title`, `body` |
| `lifebox` | `capsules` | `label`, `year` |

All 10 share a single backend implementation (`routes/mvpConcepts.ts`
+ `lib/moduleMvpStore.ts`) and a single Postgres table
(`module_concept_items`). Each module's noun is the route-level
discriminator; everything else is uniform.

## API surface (identical across all 10)

`<id>` and `<noun>` come from the table above.

### GET `/api/<id>/<noun>`

Paginated list. Query params: `limit` (1-100, default 20), `offset`
(default 0), `tag` (filter by tag).

```json
{
  "items": [/* MvpItem[] */],
  "total": 0,
  "moduleId": "startup-exchange",
  "noun": "listings"
}
```

### GET `/api/<id>/<noun>/:itemId`

Single item lookup. `:itemId` is the UUID returned by create. Returns
404 if not found.

### POST `/api/<id>/<noun>`

Create a new item. Body must include every required field for that
module (see table). The `<titleField>` becomes the canonical title
(truncated at 200 chars). The full body is stored on the item's
`payload` JSONB column.

Optional body fields:
- `tags: string[]` — overrides the module's default tag set
- `ownerId: string` — caller-provided owner reference (no auth yet)
- any module-specific keys — preserved verbatim in `payload`

Validation errors:

```json
{ "error": "missing_field", "field": "company" }
```

Rate limit: 20 req / 60s / IP.

### GET `/api/<id>/concept-stats`

Aggregate counters.

```json
{
  "moduleId": "startup-exchange",
  "noun": "listings",
  "total": 0,
  "last7days": 0,
  "topTags": [{ "tag": "fintech", "count": 3 }]
}
```

## MvpItem shape

```ts
{
  id: string;            // UUID
  moduleId: string;      // e.g. "startup-exchange"
  ownerId: string | null;
  title: string;         // truncated to 200 chars
  summary: string | null;// truncated to 800 chars
  payload: object;       // full create body (JSONB)
  tags: string[];        // ≤10 tags, ≤40 chars each
  createdAt: string;     // ISO timestamp
}
```

## Storage

Single shared Postgres table:

```sql
CREATE TABLE IF NOT EXISTS module_concept_items (
  "id"          TEXT PRIMARY KEY,
  "moduleId"    TEXT NOT NULL,
  "ownerId"     TEXT,
  "title"       TEXT NOT NULL,
  "summary"     TEXT,
  "payload"     JSONB NOT NULL DEFAULT '{}'::jsonb,
  "tags"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_module_concept_items_module_created
  ON module_concept_items ("moduleId", "createdAt" DESC);
```

Memory fallback is used when the pool is unreachable (CI tests, fresh
boots before DB connection settles). Memory store is process-local and
non-persistent — it exists only to keep tests deterministic.

## Mount order

Concept routers MUST mount BEFORE the generic planning stubs in
`src/index.ts` so concept paths take precedence and unknown paths still
fall through to `/health`, `/waitlist` on the planning stub:

```ts
mountMvpConcepts(app);                                     // first
for (const cfg of PLANNING_MODULES) {                      // then
  app.use(`/api/${cfg.id}`, createPlanningStubRouter(cfg));
}
```

## Adding a new concept

Append a row to `CONCEPTS` in `routes/mvpConcepts.ts`:

```ts
{ id: "qfoo", noun: "things",
  titleField: "name", summaryField: "blurb",
  requiredFields: ["name", "kind"],
  defaultTags: ["foo"] }
```

That's it. No new file, no new mount call, no migration — the shared
table handles any number of modules. Add an entry to the `MODULES`
array in `scripts/mvp-concepts-smoke.js` to extend coverage.

## Curl examples

```bash
BASE=https://aevion-production-a70c.up.railway.app

# Create a startup listing
curl -X POST "$BASE/api/startup-exchange/listings" \
  -H "Content-Type: application/json" \
  -d '{"company":"Acme Robotics","stage":"seed","pitch":"AI for warehouses"}'

# List recent
curl "$BASE/api/startup-exchange/listings?limit=5"

# Stats
curl "$BASE/api/startup-exchange/concept-stats"

# Validation failure (missing required field)
curl -X POST "$BASE/api/startup-exchange/listings" \
  -H "Content-Type: application/json" -d '{}'
# → 400 { "error": "missing_field", "field": "company" }
```

## What this does NOT do (yet)

- No auth on create — anyone can POST, only rate limit guards. Add a
  per-module write secret or JWT scope if abuse surfaces.
- No update or delete — append-only by design. A delete endpoint
  becomes more useful when ownership is real.
- No moderation queue — anonymous (`shadownet`) posts are visible
  immediately. Filter at the read layer if needed.
- No webhooks — VeilNetX/Z-Tide emit hooks aren't wired in. Add via
  `lib/ecosystemEvents.ts` if a concept gains monetary or reputation
  weight.

## Related files

- `aevion-globus-backend/src/lib/moduleMvpStore.ts` — store primitives
- `aevion-globus-backend/src/routes/mvpConcepts.ts` — router factory + CONCEPTS table
- `aevion-globus-backend/src/index.ts` — `mountMvpConcepts(app)` call
- `aevion-globus-backend/scripts/mvp-concepts-smoke.js` — 50-assertion smoke
- `aevion-globus-backend/scripts/all-smokes.js` — daily orchestrator registration
