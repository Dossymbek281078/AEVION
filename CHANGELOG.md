# AEVION Changelog

All notable session-level changes to this monorepo are documented here.
Format inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
SHA references — see `git log` for exact commits.

---

## [2026-05-14] — @aevion-io/catalog-client v0.7.0

Extended the SDK with four more typed sub-clients wrapping endpoints
verified live in production via `curl`.

### Added
- **QCoreAI sub-client** (`cat.qcoreai`)
  - `providers()` → `GET /api/qcoreai/providers`
  - `health()` → `GET /api/qcoreai/health`
  - `chat(input)` → `POST /api/qcoreai/chat`
- **Multichat sub-client** (`cat.multichat`)
  - `providerStatus()` → `GET /api/multichat/provider-status`
  - `presets()` → `GET /api/multichat/presets`
  - `launchPreset(id)` → `POST /api/multichat/presets/:id/launch`
- **QMedia sub-client** (`cat.qmedia`)
  - `recommendations({ limit })` → `GET /api/qmedia/recommendations`
  - `trending()` → `GET /api/qmedia/trending`
  - `tracks()` → `GET /api/qmedia/tracks`
- **Coach sub-client** (`cat.coach`)
  - `sessions()` → `GET /api/coach/sessions`
  - `goals({ completed })` → `GET /api/coach/goals`
  - `createGoal({ title, description?, dueDate? })` → `POST /api/coach/goals`
  - `completeGoal(id)` → `POST /api/coach/goals/:id/complete`
- **13 convenience exports** against the default `api.aevion.app` backend:
  `getQCoreAIProviders`, `getQCoreAIHealth`, `qcoreaiChat`,
  `getMultichatPresets`, `getMultichatProviderStatus`,
  `launchMultichatPreset`, `getQMediaRecommendations`,
  `getQMediaTrending`, `getQMediaTracks`, `getMyCoachSessions`,
  `getMyCoachGoals`, `createCoachGoal`, `completeCoachGoal`.
- **New public types**: `QCoreAIProvider`, `QCoreAIProvidersResponse`,
  `QCoreAIHealthResponse`, `QCoreAIChatRequest`, `QCoreAIChatResponse`,
  `QCoreAIChatMessage`, `MultichatProvider`, `MultichatProviderStatus`,
  `MultichatPreset`, `MultichatPresetsResponse`, `MultichatLaunchResponse`,
  `QMediaTrack`, `QMediaTracksResponse`, `QMediaRecommendationsResponse`,
  `QMediaTrendingResponse`, `CoachSession`, `CoachSessionsResponse`,
  `CoachGoal`, `CoachGoalsResponse`, `CoachGoalCreateInput`,
  `CoachGoalCompleteResponse`.

### Tests
- 21 new vitest cases (5 QCoreAI, 4 Multichat, 5 QMedia, 9 Coach, 2 wiring)
  bringing total endpoints wrapped to 12 fresh endpoints with URL building,
  HTTP method, body serialisation, query-param shaping and sync-validation
  coverage.

### Bumped
- `packages/aevion-catalog-client/package.json` `0.6.0` → `0.7.0`

---

## [2026-05-13] — Mega Session (5 blocks, 32 agents)

A coordinated multi-agent session that touched HealthAI, MVP family,
DevHub, AEVION-hub, QStore, QLearn, QEvents, Planet activity, Coach,
QMedia, QAI, Multichat, Ecosystem, Planning, Auth, Provisioning,
ApiKeys, Modules, Pricing GTM, SDK consumers, SEO, and E2E.

### Highlights
- 45+ new HTTP endpoints across backend services
- New SDK release `@aevion-io/catalog-client` **0.5 → 0.6** (5 namespaced
  sub-clients, 16 endpoints, 30 tests)
- 14 planning landings unified under `/eta` countdown + share button
- 5 Playwright E2E spec files added
- 6 layouts now emit JSON-LD for SEO

---

### Block 1 — HealthAI, MVP wave 1, Globus, QShield

**HealthAI**
- Wellness score calculation
- Hydration coach
- Smoke test
- `ScoreCard` / `HydrationCard` widgets

**MVP family wave 1 (6 idea pages)**
- Shared `MvpConceptBoard` component
- Wired into: `qlife`, `psyapp-deps`, `qpersona`, `deepsan`, `shadownet`,
  `lifebox`

**Globus**
- Local polish pass (push blocked on this branch — landed via parent)

**QShield**
- `verify-batch` endpoint scaffolding (local — push blocked)

SHA: see git log around 2026-05-13 block 1.

---

### Block 2 — MVP wave 2, DevHub backend, Planet feed, hub stats

**MVP family wave 2 (closes 10/10)**
- `voice-of-earth`, `mapreality`, `startup-exchange`, `kids-ai-content`

**DevHub backend — snippet shelf**
- New Prisma model: `DevHubSnippet`
- 4 endpoints (list / create / tag-filter / user-filter)

**Planet**
- Activity feed endpoint

**AEVION-hub**
- `/stats` extended payload
- `/module-of-the-day`
- SDK support added

SHA: see git log around 2026-05-13 block 2.

---

### Block 3 — DevHub UI, QStore detail, QLearn engagement, QEvents, Planet UI

**DevHub UI**
- Snippet shelf consumer page
- Smoke test with 9 assertions

**Developers area**
- `module-of-the-day` widget on `/developers`

**QStore**
- Item detail page `/qstore/[id]`
- Featured section
- Sort dropdown

**QLearn**
- 5 endpoints: bookmarks, streak, continue-learning (+ supporting)

**QEvents**
- Upcoming / past filter
- iCal export

**Planet UI**
- `PlanetActivityFeed` component
- `/planet/activity` page

SHA: see git log around 2026-05-13 block 3.

---

### Block 4 — Coach, QMedia, QAI, Multichat, QStore seller, Ecosystem, SDK 0.6, mobile audit

**Coach**
- 7 endpoints + dashboard

**QMedia**
- Recommendations
- Trending
- Sticky audio player

**QAI**
- 6 personas
- SSE streaming
- `AbortController` plumbing
- Token usage exposure

**Multichat**
- Provider health-strip
- 5 mission presets

**QStore**
- Seller profile page `/qstore/seller/[id]`

**Ecosystem**
- `/activity`, `/graph`, health-matrix, dashboard

**`@aevion-io/catalog-client` v0.6.0**
- 5 namespaced sub-clients
- 16 endpoints exposed
- 30 unit tests

**Mobile audit**
- 8 files fixed (responsive / overflow)

SHA: see git log around 2026-05-13 block 4.

---

### Block 5 — Planning ETA, Auth UX, Provisioning, ApiKeys, Modules, Pricing GTM, SDK consumers, SEO, E2E

**Planning**
- `/eta` countdown page
- `EtaCountdown` component
- `ShareButton` component
- Applied to **14 planning landings**

**Auth**
- Email validation
- Password strength meter
- JWT expiry chip
- OAuth flow
- `/auth/success` page

**Provisioning**
- `/history` page
- `/stats` page
- `/healthz` endpoint
- `/pricing/provisioning` UI

**ApiKeys**
- `PATCH` rename endpoint
- `GET` usage endpoint
- UI surface for both

**Modules**
- `/:id/history` endpoint
- `AutoRefreshToggle` component

**Pricing GTM**
- `/faq` page
- `/social-proof` page
- Filtered FAQ
- Live counter

**SDK consumers — wave 1**
- `qstore`, `qlearn`, `devhub` wired to `@aevion-io/catalog-client@0.6`

**SEO / JSON-LD**
- 6 layouts now ship JSON-LD

**E2E**
- 5 Playwright spec files

SHA: see git log around 2026-05-13 block 5.

---

### New endpoints (summary, 45+)

| Area | Endpoint(s) |
|------|-------------|
| HealthAI | wellness-score, hydration-coach |
| DevHub | snippets CRUD + tag-filter + user-filter (4) |
| Planet | activity-feed |
| AEVION-hub | /stats (ext), /module-of-the-day |
| QLearn | bookmarks, streak, continue-learning, +2 (5) |
| QEvents | upcoming/past filter, iCal export |
| Coach | 7 endpoints + dashboard |
| QMedia | recommendations, trending |
| QAI | 6 personas, SSE streaming |
| Ecosystem | /activity, /graph, health-matrix |
| Provisioning | /history, /stats, /healthz |
| ApiKeys | PATCH rename, GET usage |
| Modules | /:id/history |

### New UI features (summary)

- `ScoreCard`, `HydrationCard`, `MvpConceptBoard`
- `PlanetActivityFeed`, `EtaCountdown`, `ShareButton`,
  `AutoRefreshToggle`
- QStore item detail + seller profile + Featured + sort
- QAI multi-persona chat with streaming
- Multichat health-strip and mission presets
- Pricing GTM: faq, social proof, live counter
- Sticky audio player in QMedia
- Auth: password strength meter, JWT expiry chip, /auth/success

### SDK upgrade notes — `@aevion-io/catalog-client` 0.5 → 0.6

- New: 5 namespaced sub-clients
- New: 16 endpoints exposed
- New: 30 unit tests
- **Breaking?** No — adds namespaces alongside existing top-level client.
- Consumers wired: `qstore`, `qlearn`, `devhub` (wave 1).

---

For a per-block detailed view with files touched, see
[`docs/2026-05-14-session-summary.md`](docs/2026-05-14-session-summary.md).
