# QBuild prod smoke

End-to-end smoke against the deployed QBuild surface — recruiting flow from
public health → register client + worker → create project → create vacancy
→ apply → label INTERVIEW → accept → cleanup.

Harness lives at `aevion-globus-backend/scripts/qbuild-prod-smoke.js` and is
wired as `npm run smoke:qbuild-prod`.

## What it walks

≈25 steps across five flows:

**Public** (no auth, just reachability):

1. `GET /api/build/health` — should be 200
2. `GET /api/build/stats` — public counters (open vacancies, candidates, …)
3. `GET /api/build/vacancies?limit=5` — public feed JSON

**Recruiter flow** (registers two test users, cleans up at end):

4. `POST /api/auth/register` — `smoke-client+<ts>@aevion.test`
5. `POST /api/auth/register` — `smoke-worker+<ts>@aevion.test`
6. `POST /api/build/profiles` — worker upserts profile with skills
7. `POST /api/build/projects` — client creates project
8. `POST /api/build/vacancies` — client creates vacancy under that project
9. `GET /api/build/vacancies/:id` — fetch by id
10. `POST /api/build/applications` — worker applies
11. `GET /api/build/applications/by-vacancy/:id` — owner sees the application
12. `PATCH /api/build/applications/:id/label` — owner sets `INTERVIEW` (soft — ships in #124)
13. `PATCH /api/build/applications/:id` — owner moves status to `ACCEPTED`

**Stats + pipeline** (soft-checks — endpoints from the polish layer; tolerated
as INFO if not yet deployed):

14. `GET /api/build/stats/weekly` — recruiter 7-day delta
15. `GET /api/build/applications/mine/pipeline` — kanban data
16. `GET /api/build/applications/mine/interviews` — calendar data
17. `GET /api/build/stats/leaderboard` — public top-rated employers + workers

**Feeds**:

18. `GET /api/build/public/rss/vacancies.xml` — RSS feed (soft)
19. `GET /sitemap.xml` — sitemap reachability (soft)

**Cleanup** (always):

20. `DELETE /api/auth/account` — drop client user
21. `DELETE /api/auth/account` — drop worker user

The created project + vacancy persist after cleanup since they're owned by
the deleted client user (FK cascade depends on schema). Acceptable for
smoke noise — they're recognisably named `Smoke welder <run-ts>`.

## How to run

Default `BASE` is the public Vercel URL plus the `/api-backend` rewrite, so
the smoke validates the full prod path:

```
browser → Vercel rewrite → Railway → Express → /api/build/*
```

```bash
# Default (public path through Vercel rewrite)
npm run smoke:qbuild-prod

# Direct to Railway, skip the Vercel rewrite
BASE=https://aevion-production-a70c.up.railway.app npm run smoke:qbuild-prod

# Capture full transcript as JSON for archival
ARTIFACT=docs/qbuild/SMOKE_PROD_$(date +%s).json npm run smoke:qbuild-prod
```

## Exit codes

- `0` — every step passed (or was tolerated as INFO)
- `1` — at least one hard step failed
- `2` — uncaught crash (network, JSON parse, …)

## Pollution policy

- Two ephemeral users registered with `smoke-{client,worker}+<ts>@aevion.test`
  pattern. Both `DELETE /api/auth/account` at end.
- One test project + one vacancy created. They persist after cleanup; the
  email pattern makes them filterable in the admin Leads / Users views if
  you want to bulk-delete later.
- No emails sent (the recruiter flow doesn't trigger email-on-accept in the
  default path; if it does in the future, the recipient is a smoke address
  on `aevion.test`).

## Soft vs hard checks

The pipeline / interviews / weekly endpoints ship in the polish-layer PR
(#124) but are not yet on `main`. The smoke logs them as `INFO` if the
deploy returns 404, so existing prod runs stay green. Once #124 merges,
those rows flip to `PASS` automatically.
