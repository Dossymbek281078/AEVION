## Summary

Seven commits on `feat/qcore-extras-2026-04-29`, on top of `main` after PRs #3 / #7 / #8 / #12 / #13 / #14 / #17. Closes the entire V4 backlog (B+C+D+E+W) plus the original refine/search/tag polish in a single PR.

Open PR at: https://github.com/Dossymbek281078/AEVION/pull/new/feat/qcore-extras-2026-04-29

## What's in this PR

### 1. Refine — `POST /api/qcoreai/runs/:id/refine`
- One-pass surgical edit on top of any finished run. Body `{ instruction, provider?, model?, temperature? }`.
- Appends `final/refinement` message + accumulates cost+duration. Rate-limit 30/min.
- UI: ✎ Refine button on FinalCard → inline textarea, ⌘/Ctrl+Enter.

### 2. Search — `GET /api/qcoreai/search?q=...&limit=30`
- Substring + tag match across the caller's runs (input/finalContent/title/tags). Postgres ILIKE + in-memory fallback.
- UI: sidebar input with debounced 300ms fetch + AbortController.

### 3. Tags + tag-filter chip strip
- DDL: `QCoreRun.tags TEXT[]` + GIN. `PATCH /runs/:id/tags` (16x32 normalize) + `GET /tags?limit=20`.
- UI: + Tag inline input, × on each chip, sidebar chip strip click → fills search.

### 4. V4-D Analytics — `/qcoreai/analytics`
- New `GET /api/qcoreai/analytics/timeseries?days=30` — daily { date, runs, costUsd } buckets.
- "Cost over time" SVG line chart 700×180 with dashed purple 7-day forecast region.
- Linear regression on trailing 14 days → next-7d projection + monthly run-rate + trend ↑↓.
- "Top tags" horizontal bar chart, reusing /tags.

### 5. V4-C Embed iframe widget — `/qcoreai/embed/[token]`
- Slim ~330-line page that reuses the public `/api/qcoreai/shared/:token`.
- URL params `?theme=light|dark&compact=1&trace=0|1`.
- postMessage API: `qcore-embed-ready`, `qcore-embed-error`, `qcore-embed-resize` (ResizeObserver).
- `next.config.ts` headers for `/qcoreai/embed/:path*`: COOP/COEP unsafe-none, X-Frame-Options ALLOWALL, CSP frame-ancestors *.
- `</> Embed` button on shared run footer copies a paste-ready `<iframe>` snippet to clipboard.

### 6. V4-B TS SDK — `@aevion/qcoreai-client v0.1.0`
- New monorepo workspace `packages/qcoreai-client/`. Single-file TS, no runtime deps.
- `QCoreClient` class:
  - `runSync` / `runStream` (SSE AsyncGenerator)
  - **`runWS(opts)`** — duplex over WebSocket: `{ events, interject, stop, close }`
  - `refine`, `setTags`, `search`, `topTags`, `timeseries`
  - `setUserWebhook` / `deleteUserWebhook`
  - `sharePreset` / `browsePresets` / `importPreset` / `deletePreset` (marketplace)
- `verifyWebhookHmac(rawBody, signature, secret)` — constant-time HMAC-SHA256 via Web Crypto SubtleCrypto. Works in Node 18+ AND Edge (Cloudflare Workers, Vercel Edge).
- README ships with quick-start, streaming, WebSocket section, refine, tags+search, marketplace, webhook receiver example, browser/Edge usage notes.
- Build: ES2020 + DOM, declarations + sourcemaps. Apache-2.0.

### 7. V4-E Agent marketplace
- DDL: `QCoreSharedPreset (id, ownerUserId, name, description, strategy, overrides JSONB, isPublic, importCount, createdAt, updatedAt)` + 2 indexes.
- 5 endpoints:
  - `POST /presets/share` (auth) — publish
  - `GET /presets/public?q=&limit=` — browse, ILIKE filter
  - `GET /presets/:id` — fetch one (private requires owner JWT)
  - `POST /presets/:id/import` — bumps importCount
  - `DELETE /presets/:id` (auth) — owner-only
- 4 store helpers + 6 vitest cases (ranking, q filter, import bump, owner-only delete, isolation).
- UI on `/qcoreai/multi`: 🌐 button on every saved preset opens an inline "Share to community" panel with optional 400-char description. New "🌐 Browse community" toggle next to "+ Save current" — opens scrollable panel with debounced 250ms search + ↓ Import buttons.

### 8. V4-W WebSocket duplex transport — `WS /api/qcoreai/ws`
- `npm i ws @types/ws` (single new backend dep, ~20kb gzipped).
- New `services/qcoreai/wsServer.ts` (~280 LOC). Same orchestrator pipeline as POST /multi-agent — runs sequential/parallel/debate, persists agent_end messages, finishRun on completion.
- JSON-over-WS protocol: client `start | interject | stop | ping`; server `ack | session | <OrchestratorEvent…> | pong | ws_end | error`.
- Mid-run guidance queue per connection (cap 8 × 4 KB). 30 upgrades/min/IP. 64 KB max payload.
- Auth via `?token=<JWT>` query (browsers can't set Authorization on WS upgrade) — new `verifyBearerToken()` in `lib/authJwt.ts`.
- `index.ts`: `httpServer = app.listen(...)` + `attachQCoreWebSocket(httpServer, "/api/qcoreai/ws")` after webhook worker starts. Frontend stays on SSE — WS is exposed for SDK consumers (mobile, real-time integrations).

### 9. Chore — baseline-browser-mapping bump
- Silences the verbose "data over two months old" warning printed once per worker on every Next build.

## Why these are separate from PRs #7-#14

These features were originally on `qcore-multi-agent` alongside the now-merged V1 (PR #3). After PR #3 was merged, parallel PRs (#7 mid-run guidance, #8 attachments, #12 per-user webhooks, #13 trace persistence, #14 spend cap, #17 QSign v2) shipped overlapping or unrelated work. This PR cherry-picks only the orthogonal additions and ports them cleanly onto current `main` — no conflicts.

## Test plan

- [x] Backend `npm run build` (tsc) — clean
- [x] Backend `npm test` — **116/116 green** in 14 test files (+6 marketplace cases)
- [x] Frontend `next build` — clean, **31 routes** (incl. new `/qcoreai/embed/[token]`)
- [x] SDK `npm run build` — clean (`dist/index.{js,cjs,d.ts}`)
- [x] `npm run verify` from worktree root — green end-to-end
- [ ] Manual: `/qcoreai/multi` — refine ✎, +Tag, sidebar search, chip strip click, "🌐 Browse community" panel + import, 🌐 share-to-marketplace.
- [ ] Manual: `/qcoreai/analytics` — Cost-over-time chart + forecast + top tags bars.
- [ ] Manual: share any run, click `</> Embed` → paste iframe in sandbox HTML, see read-only widget.
- [ ] Manual: WS smoke from browser console:
      ```js
      const ws = new WebSocket("wss://api.aevion.io/api/qcoreai/ws");
      ws.onmessage = e => console.log(e.data);
      ws.onopen = () => ws.send(JSON.stringify({type:"start", input:"hi", strategy:"sequential"}));
      ```
- [ ] Smoke: `QCORE_BASE=https://api.aevion.io ./aevion-globus-backend/scripts/qcore-smoke.sh` (post-deploy)

## Commits

1. `f07a67c` chore(frontend): bump baseline-browser-mapping
2. `b87b22d` feat(qcore): refine + search + tag chips
3. `2823312` feat(qcore): V4-D analytics — cost timeseries + 7d forecast + top-tags
4. `8e684a2` feat(qcore): V4-C embed iframe widget + snippet generator
5. `f4bdabb` feat(qcore): V4-B SDK package — @aevion/qcoreai-client v0.1.0
6. `04a9b1e` feat(qcore): V4-E agent marketplace — share/browse/import community presets
7. `d625a01` feat(qcore): V4-W WebSocket duplex transport + SDK runWS

## Files changed

### Backend
- `aevion-globus-backend/package.json`, `package-lock.json` — `+ws ^8.20.0` + `@types/ws`
- `aevion-globus-backend/src/lib/ensureQCoreTables.ts` — `+tags TEXT[]` + GIN, `+QCoreSharedPreset` + 2 indexes
- `aevion-globus-backend/src/lib/authJwt.ts` — `+verifyBearerToken(rawToken)` helper
- `aevion-globus-backend/src/services/qcoreai/store.ts` — +10 helpers (`getMaxOrdering`, `applyRefinement`, `setRunTags`, `searchRuns`, `getTopUserTags`, `getCostTimeseries`, `createSharedPreset`, `listPublicSharedPresets`, `getSharedPreset`, `importSharedPreset`, `deleteSharedPreset`) + types
- `aevion-globus-backend/src/services/qcoreai/wsServer.ts` — **new** (~280 LOC)
- `aevion-globus-backend/src/index.ts` — `httpServer = app.listen(...)` + `attachQCoreWebSocket`
- `aevion-globus-backend/src/routes/qcoreai.ts` — +10 endpoints (refine/search/tags/timeseries + 5 marketplace)
- `aevion-globus-backend/tests/qcoreSharedPresets.test.ts` — **new**, 6 vitest cases

### Frontend
- `frontend/src/app/qcoreai/multi/page.tsx` — search/chip-strip, Refine, +Tag, embed snippet button, marketplace UI (Share modal + Browse panel)
- `frontend/src/app/qcoreai/analytics/page.tsx` — Cost timeseries + forecast SVG + Top tags bars
- `frontend/src/app/qcoreai/embed/[token]/page.tsx` — **new** embed widget
- `frontend/next.config.ts` — `/qcoreai/embed/:path*` framing headers
- `frontend/package.json`, `package-lock.json` — `baseline-browser-mapping@latest`

### SDK
- `packages/qcoreai-client/` — **new** monorepo workspace (`package.json`, `tsconfig.json`, `src/index.ts`, `README.md`, `.gitignore`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
