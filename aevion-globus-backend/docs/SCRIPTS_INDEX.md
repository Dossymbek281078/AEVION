# Scripts index — aevion-globus-backend/scripts

> Single discoverable index of every `npm run …` command this window owns.
> Sessions opened in `aevion-core/main` can scan this once before deciding
> what's worth running locally vs against prod.

## Quick decision matrix

| Need | Read-only? | Mutates prod? | Run it |
|---|---|---|---|
| Verify deploy alive | ✅ | ❌ | `wait-for-deploy` |
| Sanity check after push | ✅ | ❌ | `smoke:read-only` |
| Full daily smoke | ❌ | ✅ ephemeral | `smoke:all` |
| Diagnose chain `verified=false` | ✅ | ❌ | `veilnetx:doctor` |
| Inspect mvp-concepts modules | ✅ | ❌ | `veilnetx:stats`, manual curl |
| Prometheus metrics handoff | ✅ | ❌ | `veilnetx:prometheus`, `mvp-concepts-prometheus` |
| Compliance / audit data | ✅ | ❌ | `veilnetx:export-csv`, `mvp-concepts-export-csv` |
| Refresh coord-doc WIP | ✅ (writes coord doc only) | ❌ | `coord:update`, `coord:update-commit` |

## VeilNetX chain tools

| Command | What | Read-only? | Notes |
|---|---|---|---|
| `npm run veilnetx:doctor` | Walk entries, recompute each `entryHash` from public fields with canonicalJson, print the first row whose stored hash diverges. | ✅ | Use when `/chain/verify` returns `verified=false`. |
| `npm run veilnetx:rebuild` | Rewrite every row's `prevHash` + `entryHash` from genesis, holding `pg_advisory_xact_lock`. Refuses without `ALLOW_CHAIN_REBUILD=1`. | ❌ destructive | After the route-side canonicalJson fix lands. |
| `npm run veilnetx:rebuild-dry` | Same as above but with `--dry-run`: prints per-row diff and ends in ROLLBACK. No env gate. | ✅ | Safe preview before the real rewrite. |
| `npm run veilnetx:stats` | Ops snapshot: chain head + integrity + module/kind breakdown + total volume per currency + time window. | ✅ | Investor / ops one-pager. |
| `npm run veilnetx:export-csv` | CSV of all ledger entries with public columns only (no meta). | ✅ | Compliance handoff. |
| `npm run veilnetx:prometheus` | Prometheus text-format gauges for `/chain/verify` (verified/length/brokenAt/check_success). | ✅ | Wire into `node_exporter --collector.textfile`. |

## Z-Tide reputation tools

| Command | What | Read-only? | Notes |
|---|---|---|---|
| `npm run ztide:audit` | Walk leaderboard, assert every row's stored rank matches the band its score lands in per `ZTIDE_RANK_THRESHOLDS`. Print rank distribution on success. | ✅ | |
| `npm run ztide:integrity` | 5 invariants between `/ztide/stats` and `/ztide/leaderboard`: SUM(score) == total_weight, SUM(eventCount) == total_events, rowCount == active_users, MAX(score) == top_score, per-user rank within band. | ✅ | Catches write-path drift. |

## MVP concept routers (10 ownerless modules)

The 10 modules `startup-exchange`, `mapreality`, `kids-ai-content`, `qlife`,
`psyapp-deps`, `qpersona`, `voice-of-earth`, `deepsan`, `shadownet`,
`lifebox` share one router family backed by `module_concept_items`.

| Command | What | Read-only? |
|---|---|---|
| `npm run smoke:mvp-concepts` | 50 assertions (5 per module): list / create / fetch / stats / missing-field 400. | ❌ ephemeral writes 1 item/module |
| `npm run mvp-concepts:prometheus` | Per-module `mvp_concept_total` + `mvp_concept_last7days` + reachability gauges. | ✅ |
| `npm run mvp-concepts:export-csv` | One CSV per module with id / module / createdAt / owner / title / summary / tags / payload_json. | ✅ |

Module-specific extension endpoints (live on prod):
- `GET /api/mapreality/claims/nearby?lat=&lng=&radiusKm=`
- `GET /api/startup-exchange/listings/by-stage/:stage`
- `GET /api/voice-of-earth/feeds/by-location?location=`

## Daily smoke orchestrator

| Command | What | Read-only? |
|---|---|---|
| `npm run smoke:all` | Sequential runner over every smoke registered in `scripts/all-smokes.js`. Honors `ONLY=`, `SKIP=`, `READ_ONLY=1`. | ❌ ephemeral |
| `npm run smoke:read-only` | `READ_ONLY=1 npm run smoke:all` — only smokes flagged `readOnly: true`. | ✅ |
| `npm run smoke:ecosystem-events` | Event-bus assertions: deposit→VeilNetX, withdraw→Z-Tide payout, settlement→VeilNetX, login-streak→Z-Tide. | ❌ |

## Deployment + coord

| Command | What | Notes |
|---|---|---|
| `npm run wait-for-deploy` | Polls a probe path until JSON key matches expected value. Use after `git push` before a smoke. | Configurable: `--probe-path`, `--probe-key`, `--probe-value`, `--timeout`. |
| `npm run coord:update` | Regenerate `<!-- WIP-AUTO -->` block in `AEVION_COORDINATION.md` from `git log --since=10min`. | Configurable via `WIP_WINDOW_MIN`. |
| `npm run coord:update-commit` | Same as `coord:update` plus `git commit --only -- AEVION_COORDINATION.md`. Push stays manual. | Wire into a 5-min Windows Scheduled Task. |

## What's NOT here

- Routes / lib code — see `src/routes/` and `src/lib/` directly.
- Frontend MVPs for the 10 modules — those live in `frontend/src/app/<id>/page.tsx`.
- Cross-module spec — `docs/MVP_CONCEPTS.md` (single source for the
  10-module surface) and `docs/VEILNETX_CHAIN_HASHING.md` (chain hashing
  invariants).

## Updating this file

Whenever a new `npm run` script lands in `aevion-globus-backend/package.json`,
add it here in the matching section. Aim for ≤1 line per command in the
table; if you need more context, link a `docs/<topic>.md` file.
