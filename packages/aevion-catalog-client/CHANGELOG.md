# Changelog — @aevion-io/catalog-client

All notable changes to this package will be documented in this file.

## [0.8.0] — 2026-05-14

### Added — QMedia

- `qmedia.videos({ limit?, offset? })` → `GET /api/qmedia/videos` — public
  videos listing. `limit` clamped 1..50 client-side to mirror the server.
- `qmedia.recordPlay(trackId)` → `POST /api/qmedia/tracks/:id/play` — record a
  play for a track. SDK normalises the server response (`{ playCount }`) into
  `{ ok: true, plays, playCount }` so callers get a stable shape going
  forward.

### Added — Coach (full mutation API)

Coach sub-client now mirrors the post-Bearer-migration backend at
`aevion-globus-backend/src/routes/coach.ts`:

- `coach.startSession({ topic, fen? })` → `POST /api/coach/sessions/start`.
  Returns the bare `CoachSession` (server returns `{ session }`, SDK unwraps
  it).
- `coach.endSession(id, { notes?, messageCount? })` → `POST
  /api/coach/sessions/:id/end`. Returns the bare `CoachSession`.
- `coach.getSession(id)` → `GET /api/coach/sessions/:id` → `{ session }`.
- `coach.deleteGoal(id)` → `DELETE /api/coach/goals/:id`. Normalises the 204
  response to `{ ok: true }`.

### Added — convenience exports

`getQMediaVideos`, `recordQMediaPlay`, `getCoachSession`,
`startCoachSession`, `endCoachSession`, `deleteCoachGoal`.

### Added — types

`QMediaVideo`, `QMediaVideosResponse`, `QMediaPlayResult`, `CoachGoalInput`,
`CoachSessionStartInput`, `CoachSessionEndInput`. Extended `CoachSession` and
`CoachGoal` with backend-shipping fields: `topic`, `startingFen`,
`messageCount`, `goalsLinked`, `targetDate`, `sessionId`.

### Changed — Coach (breaking)

- **`coach.createGoal(input)`** — input shape changed: field `dueDate` is
  renamed `targetDate`, with new optional `sessionId`. Legacy `dueDate` is
  still accepted on input for one version and forwarded to the backend as
  `targetDate`; this fallback will be removed in v0.9.
- **`coach.createGoal(input)`** — return type changed: `Promise<CoachGoal>` →
  `Promise<{ goal: CoachGoal }>` (matches backend post-Bearer-migration).
- **`coach.completeGoal(id)`** — return type changed:
  `Promise<{ ok, goalId, completed, completedAt }>` →
  `Promise<{ goal: CoachGoal }>`.
- `CoachGoal.dueDate` — still typed for back-compat (read legacy data), but
  new code should read `targetDate`.

### Migration

```ts
// v0.7
const goal = await cat.coach.createGoal({ title: "x", dueDate: "2026-06-01" });
console.log(goal.id);

// v0.8
const { goal } = await cat.coach.createGoal({
  title: "x",
  targetDate: "2026-06-01",
});
console.log(goal.id);

// v0.7
const r = await cat.coach.completeGoal("g1");
if (r.completed) { /* ... */ }

// v0.8
const { goal } = await cat.coach.completeGoal("g1");
if (goal.completed) { /* ... */ }
```

## [0.7.0] — 2026-05-14

### Added — four more typed sub-clients

All four share the parent `AevionCatalog` `baseUrl`, `fetch`, and `headers` config:

- **QCoreAI** (`cat.qcoreai`)
  - `providers()` — GET `/api/qcoreai/providers`
  - `health()`    — GET `/api/qcoreai/health`
  - `chat({ provider, model, messages })` — POST `/api/qcoreai/chat`
- **Multichat** (`cat.multichat`)
  - `providerStatus()` — GET `/api/multichat/provider-status`
  - `presets()`        — GET `/api/multichat/presets`
  - `launchPreset(id)` — POST `/api/multichat/presets/:id/launch`
- **QMedia** (`cat.qmedia`)
  - `recommendations({ limit? })` — GET `/api/qmedia/recommendations`
  - `trending()`                  — GET `/api/qmedia/trending`
  - `tracks()`                    — GET `/api/qmedia/tracks`
- **Coach** (`cat.coach`)
  - `sessions()` — GET `/api/coach/sessions`
  - `goals({ completed? })` — GET `/api/coach/goals`
  - `createGoal({ title, description?, dueDate? })` — POST `/api/coach/goals`
  - `completeGoal(id)` — POST `/api/coach/goals/:id/complete`

### Added — convenience exports

`getQCoreAIProviders`, `getQCoreAIHealth`, `qcoreaiChat`,
`getMultichatPresets`, `getMultichatProviderStatus`, `launchMultichatPreset`,
`getQMediaRecommendations`, `getQMediaTrending`, `getQMediaTracks`,
`getMyCoachSessions`, `getMyCoachGoals`, `createCoachGoal`,
`completeCoachGoal`.

### Packaging

- `package.json` now declares `module`, `exports` (dual CJS/ESM-style resolver
  entrypoints pointing at the same CJS build), `sideEffects: false`,
  `publishConfig.access = "public"`, `homepage`, `bugs`.
- `files` whitelist extended to include `CHANGELOG.md` and `LICENSE`.
- `prepublishOnly` now runs **build + test** (was build only).
- `.npmignore` expanded with `coverage/`, `.vitest/`, `*.tgz`, editor dirs.
- New `PUBLISH-CHECKLIST.md` — single-page operator checklist.

## [0.6.0] — 2026-05-14

### Added — module sub-clients

Namespaced sub-clients on the root `AevionCatalog`, sharing baseUrl/fetch/headers:

- **QStore** (`cat.qstore`)
  - `products({ sort?: 'popular'|'newest'|'trending'|'rating' })`
  - `featured({ limit? })` — 4 buckets (popular/trending/newest/topRated)
- **QLearn** (`cat.qlearn`)
  - `bookmark(courseId)` / `unbookmark(courseId)` — POST/DELETE
  - `bookmarks()` — user's saved courses
  - `streak()` — { current, longest, totalDays, activeToday, lastActiveAt }
  - `progress()` — { summary, continueLearning, notStarted, completed }
- **QEvents** (`cat.qevents`)
  - `list({ when?: 'upcoming'|'past'|'all' })`
  - `ics(eventId)` — returns text/calendar payload
  - `icsUrl(eventId)` — URL only (no fetch)
- **DevHub** (`cat.devhub`)
  - `snippets({ limit?, tag?, user? })`
  - `createSnippet({ title, content, language, tags? })`
  - `getSnippet(id)`
  - `star(id)`
- **Planet** (`cat.planet`)
  - `activity({ limit?, kinds? })` — cross-module activity feed

### Added — config & infra

- `AevionCatalogConfig.headers` — default headers (e.g. `Authorization`)
  forwarded to every request, including all sub-client calls.
- Shared internal `_request()` helper centralises URL/query/body/headers
  assembly across new sub-clients.

### Added — convenience exports

`getQStoreProducts`, `getQStoreFeatured`, `bookmarkCourse`,
`unbookmarkCourse`, `getMyBookmarks`, `getMyStreak`, `getMyProgress`,
`getEvents`, `getEventIcs`, `getSnippets`, `createSnippet`, `getSnippet`,
`starSnippet`, `getPlanetActivity`.

### Added — types

`QStoreSort`, `QStoreProduct`, `QStoreProductsResponse`,
`QStoreFeaturedResponse`, `QLearnCourseRef`, `QLearnBookmarkResult`,
`QLearnBookmarksResponse`, `QLearnStreak`, `QLearnProgressItem`,
`QLearnProgress`, `QEventsWhen`, `QEvent`, `QEventsListResponse`,
`DevHubSnippet`, `DevHubSnippetsResponse`, `DevHubCreateSnippetInput`,
`DevHubStarResult`, `PlanetActivityKind`, `PlanetActivityItem`,
`PlanetActivityResponse`.

## [0.5.0] — 2026-05-12

### Added

- `findByText(query, opts?)` — substring search across name/code/description/tags
  with simple relevance scoring (name > code > tags > description)
- `diff(idA, idB)` — pairwise comparison: field equality + tag-set Jaccard with
  shared/onlyA/onlyB breakdown
- `fingerprintModule(id)` — stable djb2 content hash of identity-defining
  fields (id/code/status/kind/priority/sorted-tags) for cache invalidation
- Types `TextMatch`, `DiffFieldEntry`, `ModuleDiff`, `ModuleFingerprint`
- Convenience exports `findByText`, `diff`, `fingerprintModule`
- New example `examples/search-diff.mjs`

## [0.4.0] — 2026-05-12

### Added

- `relatedModules(id)` — extracts server-computed relatedModules array
- `graph(opts)` — full tag-overlap graph across registry, returns GraphEdge[]
  (Jaccard-scored, top-K per node). Single round-trip via fields projection.
- `neighbours(id, opts)` — single-source neighbours of a module, scored by
  Jaccard with sharedTags list. Useful for "you might also like" widgets.
- Types `GraphEdge`, `NeighbourScore`
- Convenience exports `getRelatedModules`, `getGraph`, `getNeighbours`
- New example `examples/graph.mjs`

## [0.3.0] — 2026-05-12

### Added

- `openapi()` — returns the AEVION aggregate API index (modules, services, SDK manifest)
- `sitemap()` — fetches and parses /api/aevion/sitemap.xml, returns SitemapEntry[] (zero-dep regex parser)
- `getOpenApi`, `getSitemap` — convenience function exports
- Types `OpenApiIndex`, `OpenApiModuleRef`, `OpenApiServiceRef`, `OpenApiSdkManifest`, `SitemapEntry`
- New example `examples/openapi-sitemap.mjs`

## [0.2.0] — 2026-05-12

### Added

- `searchByTag(tag)` — modules matching one or more tags
- `byStatus(status)` — modules in given status(es)
- `byKind(kind)` — modules of given kind(s)
- `mvpsAndLaunched()` — sugar for everything that's live
- `topTags(n)` — top-N tags from registry stats
- Convenience function exports for all five helpers
- New example `examples/helpers.mjs` demonstrating each helper

## [0.1.0] — 2026-05-12

### Initial release

- `AevionCatalog` class with `list`, `get`, `stats`, `health` methods
- URL builders: `csvUrl`, `markdownUrl`, `badgeUrl`
- Field projection via `fields` option on `list`
- Filter combinators: `status`, `tag`, `kind` (string or string[])
- Convenience function exports: `listCatalog`, `getModule`, `getStats`, `getHealth`
- Strict TypeScript types for `CatalogItem`, `RegistryStats`, `RelatedModule`
- Zero runtime dependencies — uses global `fetch` (Node 18+)
- Optional `fetch` injection for tests
- Four runnable examples under `examples/`
