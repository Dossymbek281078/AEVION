# @aevion/catalog-client

Typed TypeScript client for the AEVION Hub catalog API. Zero dependencies. Node 18+ / modern browsers.

## Install

```bash
npm install @aevion/catalog-client
# or
pnpm add @aevion/catalog-client
# or
yarn add @aevion/catalog-client
```

Requirements: Node.js `>=18` (native `fetch`) or a modern browser. TypeScript types are bundled — no `@types/...` needed.

## Quick start

```ts
import { AevionCatalog } from "@aevion/catalog-client";

const cat = new AevionCatalog();

// List all modules with status=mvp
const { items } = await cat.list({ status: "mvp" });
items.forEach(m => console.log(m.code, m.name, m.frontend));

// Single-module lookup
const qpersona = await cat.get("qpersona");
console.log(qpersona.relatedModules); // top-5 by tag overlap

// Taxonomy stats
const { byStatus, byTag, total } = await cat.stats();
console.log(`Total: ${total}, MVPs: ${byStatus.mvp}, top tag: ${byTag[0].tag}`);

// Export URLs (no fetch — just URLs)
const csvUrl = cat.csvUrl({ status: "mvp", tag: "ai" });
const mdUrl = cat.markdownUrl({ kind: "product" });
const badgeUrl = cat.badgeUrl("qpersona"); // shields.io-style SVG

// Aggregate health
const { status, healthy, total: t } = await cat.health();
console.log(`${status}: ${healthy}/${t} services up`);
```

## Examples

Eight runnable scripts under `examples/`:

```bash
node examples/list-all.mjs              # registry dump grouped by status
node examples/get-module.mjs qsign      # single-module deep lookup
node examples/stats.mjs                 # by-status / by-kind / top tags
node examples/urls.mjs                  # CSV/MD/badge URLs (no network)
node examples/helpers.mjs               # v0.2 helpers: searchByTag/byStatus/...
node examples/openapi-sitemap.mjs       # v0.3 Hub aggregates: openapi() + sitemap()
node examples/graph.mjs                 # v0.4 graph helpers: graph() + neighbours()
node examples/search-diff.mjs           # v0.5 search + diff + fingerprint
```

See [`examples/README.md`](./examples/README.md).

## Helpers (v0.2)

Each helper returns `CatalogItem[]` directly (skips the `{ items } =` destructure):

```ts
const tagged = await cat.searchByTag("ai");                    // any tag match
const inMvp  = await cat.byStatus(["mvp", "launched"]);        // status filter
const cores  = await cat.byKind("core");                       // kind filter
const live   = await cat.mvpsAndLaunched();                    // sugar
const top    = await cat.topTags(5);                           // [{tag,count}]
```

Same names are exported as standalone functions against the default backend.

## Hub aggregates (v0.3)

Two endpoints that aggregate across all AEVION modules:

```ts
const idx = await cat.openapi();   // AEVION aggregate API index
console.log(idx.modules, idx.services, idx.sdk);

const urls = await cat.sitemap();  // sitemap.xml parsed to SitemapEntry[]
console.log(urls[0].loc, urls[0].priority);
```

## Graph helpers (v0.4)

Module similarity via tag-Jaccard overlap, for "you might also like" widgets and
ecosystem visualisations:

```ts
// Server-computed related modules for a single id (cheap, deep lookup)
const rel = await cat.relatedModules("qsign");

// Single-source neighbours, scored by Jaccard, with shared-tag breakdown
const near = await cat.neighbours("qsign", { topK: 10 });
near.forEach(n => console.log(n.score, n.id, n.sharedTags));

// Full registry tag-overlap graph — top-K edges per node
const edges = await cat.graph({ topK: 5, minOverlap: 1 });
// edges: { from, to, overlap, score }[]
```

`graph()` is a single round-trip (uses `fields=id,name,tags` projection) and
runs the K-NN locally — no extra backend endpoints required.

## Search + diff + fingerprint (v0.5)

Client-side compute on top of the catalog — no extra endpoints:

```ts
// Substring search across name + code + description + tags, with
// simple relevance scoring (name > code > tags > description).
const hits = await cat.findByText("ai", { limit: 10 });
hits.forEach(m => console.log(m.score, m.id, m.name));

// Pairwise compare two modules: field equality + tag-set Jaccard.
const d = await cat.diff("qsign", "qshield");
console.log(d.tags.jaccard, d.tags.shared, d.tags.onlyA, d.tags.onlyB);
d.fields.forEach(f => console.log(f.key, f.equal, f.a, "vs", f.b));

// Stable djb2 hash of identity-defining fields (id/code/status/kind/
// priority/sorted-tags) — for cache-busting / change detection.
const fp = await cat.fingerprintModule("qsign");
console.log(fp.hash); // 8-char hex
```

All three are single-round-trip (`findByText` + `fingerprintModule`) or two-round-trip
(`diff`) calls. Zero crypto dependencies — djb2 is implemented inline.

## New sub-clients in v0.7

`v0.7.0` adds four more typed sub-clients on top of the v0.6 set. All four
share the parent `AevionCatalog` `baseUrl`, `fetch` and `headers` config.

```ts
const cat = new AevionCatalog();

// QCoreAI — LLM providers + chat
const provs = await cat.qcoreai.providers();        // GET  /api/qcoreai/providers
const ai    = await cat.qcoreai.health();           // GET  /api/qcoreai/health
const reply = await cat.qcoreai.chat({              // POST /api/qcoreai/chat
  provider: "openai",
  model: "gpt-4o",
  messages: [{ role: "user", content: "hello" }],
});

// Multichat — multi-provider presets
const status  = await cat.multichat.providerStatus(); // GET  /api/multichat/provider-status
const presets = await cat.multichat.presets();        // GET  /api/multichat/presets
const session = await cat.multichat.launchPreset("brainstorm");
//                                                    // POST /api/multichat/presets/:id/launch

// QMedia — recommendations + library
const rec   = await cat.qmedia.recommendations({ limit: 10 }); // GET /api/qmedia/recommendations
const hot   = await cat.qmedia.trending();                     // GET /api/qmedia/trending
const all   = await cat.qmedia.tracks();                       // GET /api/qmedia/tracks

// Coach — sessions + goals
const sess  = await cat.coach.sessions();                      // GET  /api/coach/sessions
const open  = await cat.coach.goals({ completed: false });     // GET  /api/coach/goals
const done  = await cat.coach.goals({ completed: true });
const goal  = await cat.coach.createGoal({                     // POST /api/coach/goals
  title: "Ship SDK v0.7",
  description: "Wire 4 new sub-clients",
  dueDate: "2026-06-01",
});
await cat.coach.completeGoal(goal.id);                         // POST /api/coach/goals/:id/complete
```

All methods are also exported as standalone convenience functions against
the default `https://api.aevion.app` backend: `getQCoreAIProviders`,
`getQCoreAIHealth`, `qcoreaiChat`, `getMultichatPresets`,
`getMultichatProviderStatus`, `launchMultichatPreset`,
`getQMediaRecommendations`, `getQMediaTrending`, `getQMediaTracks`,
`getMyCoachSessions`, `getMyCoachGoals`, `createCoachGoal`,
`completeCoachGoal`.

## Module sub-clients (v0.6)

`AevionCatalog` exposes typed sub-clients for individual module APIs.
They share the parent's `baseUrl`, `fetch`, and `headers` config —
construct the root client once and reuse every sub-client off it.

```ts
const cat = new AevionCatalog({
  headers: { Authorization: `Bearer ${token}` }, // forwarded to every sub-call
});

// QStore — marketplace
const top = await cat.qstore.products({ sort: "popular" });
const grid = await cat.qstore.featured({ limit: 8 });
//        { popular, trending, newest, topRated }

// QLearn — courses, bookmarks, streak, progress
await cat.qlearn.bookmark("smeta-101");
await cat.qlearn.unbookmark("smeta-101");
const marks = await cat.qlearn.bookmarks();
const streak = await cat.qlearn.streak();
//             { current, longest, totalDays, activeToday, lastActiveAt }
const prog = await cat.qlearn.progress();
//           { summary, continueLearning, notStarted, completed }

// QEvents — event calendar + ICS export
const evts = await cat.qevents.list({ when: "upcoming" });
const ics  = await cat.qevents.ics("aevion-summit-2026"); // text/calendar
const url  = cat.qevents.icsUrl("aevion-summit-2026");    // direct URL (no fetch)

// DevHub — snippets + stars
const snips = await cat.devhub.snippets({ limit: 20, tag: "ts" });
const s = await cat.devhub.createSnippet({
  title: "djb2 hash",
  content: "function h(s){...}",
  language: "ts",
  tags: ["hash", "util"],
});
const one = await cat.devhub.getSnippet(s.id);
await cat.devhub.star(s.id);

// Planet — cross-module activity feed
const feed = await cat.planet.activity({
  limit: 50,
  kinds: ["release", "post", "module_update"],
});
```

All sub-client methods are also exported as standalone convenience
functions against the default `https://api.aevion.app` backend:
`getQStoreProducts`, `getQStoreFeatured`, `bookmarkCourse`,
`unbookmarkCourse`, `getMyBookmarks`, `getMyStreak`, `getMyProgress`,
`getEvents`, `getEventIcs`, `getSnippets`, `createSnippet`, `getSnippet`,
`starSnippet`, `getPlanetActivity`.

## Convenience functions

For one-off calls against `https://api.aevion.app`:

```ts
import {
  listCatalog, getModule, getStats, getHealth,
  searchByTag, byStatus, byKind, mvpsAndLaunched, topTags,
  getRelatedModules, getGraph, getNeighbours,
  findByText, diff, fingerprintModule,
  // v0.6:
  getQStoreProducts, getQStoreFeatured,
  bookmarkCourse, unbookmarkCourse,
  getMyBookmarks, getMyStreak, getMyProgress,
  getEvents, getEventIcs,
  getSnippets, createSnippet, getSnippet, starSnippet,
  getPlanetActivity,
  // v0.7:
  getQCoreAIProviders, getQCoreAIHealth, qcoreaiChat,
  getMultichatPresets, getMultichatProviderStatus, launchMultichatPreset,
  getQMediaRecommendations, getQMediaTrending, getQMediaTracks,
  getMyCoachSessions, getMyCoachGoals, createCoachGoal, completeCoachGoal,
} from "@aevion/catalog-client";

const all   = await listCatalog();
const x     = await getModule("qfusionai");
const s     = await getStats();
const h     = await getHealth();
const ai    = await searchByTag("ai");
const live  = await mvpsAndLaunched();
const top5  = await topTags(5);
```

## Custom base URL

```ts
const cat = new AevionCatalog({
  baseUrl: "https://api.aevion.app",  // default
  fetch: customFetch,                  // optional injection (e.g. for tests)
});
```

## API

### `class AevionCatalog`

| Method | Returns | Description |
|---|---|---|
| `list(opts?)` | `CatalogResponse` | List modules with optional filters/projection |
| `get(id)` | `CatalogItem` | Single-module deep lookup; throws on 404 |
| `stats()` | `RegistryStats` | Taxonomy summary (byStatus, byKind, top-20 byTag) |
| `health()` | `{ status, healthy, total, services, timestamp }` | Aggregate health |
| `csvUrl(opts?)` | `string` | URL for `?format=csv` |
| `markdownUrl(opts?)` | `string` | URL for `?format=md` |
| `badgeUrl(id)` | `string` | URL for `/badges/<id>.svg` |

### `CatalogListOptions`

```ts
{
  status?: string | string[];   // filter, comma-joined
  tag?: string | string[];      // filter, matches any
  kind?: string | string[];     // filter
  fields?: string[];            // projection — return only these keys
}
```

### `CatalogItem`

```ts
{
  id: string;
  code: string;
  name: string;
  description: string;
  kind: ModuleKind;
  status: ModuleStatus;
  priority: number;
  tags: string[];
  frontend: string;            // e.g. "https://aevion.app/qpersona"
  ogImage: string;             // OpenGraph image URL
  health: string | null;       // /api/<module>/health URL or null
  openapi: string | null;      // OpenAPI 3.1 spec URL or null
  waitlist: string | null;     // /api/<module>/waitlist URL or null
  status_url: string | null;   // /api/<module>/status URL or null
  relatedModules: { id: string; name: string; overlap: number }[];
}
```

## Module statuses

`launched` · `mvp` · `working` · `in_progress` · `research` · `planning` · `idea`

Status determines badge color: green (mvp/launched/working), amber (in_progress), violet (research), blue (planning), gray (idea).

## Badges in README

Drop into any `README.md` to track AEVION module status:

```markdown
![AEVION QPersona](https://api.aevion.app/api/aevion/badges/qpersona.svg)
![AEVION QLife](https://api.aevion.app/api/aevion/badges/qlife.svg)
```

## License

MIT
