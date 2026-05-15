# `@aevion/catalog-client` — Usage Guide (v0.7+)

> Comprehensive cookbook for the AEVION Hub TypeScript SDK.
>
> **Current version:** `0.7.0` (published) / `0.8.0` (in progress — see Migration
> guide). Zero dependencies. Works on Node 18+ and any modern browser via the
> built-in `fetch`.
>
> **Where things live**
>
> | Where | What |
> |---|---|
> | `packages/aevion-catalog-client/src/index.ts` | Single-file SDK source |
> | `packages/aevion-catalog-client/README.md` | Short reference (per-version cookbook) |
> | `frontend/src/lib/aevionCatalog.ts` | Frontend singleton helper + token plumbing |
> | `frontend/src/lib/auth.ts` | Canonical auth-token storage (block 8 #1) |
> | `docs/SDK-USAGE.md` | This file — the long-form, every-sub-client guide |

---

## 1. Install

```bash
# npm
npm install @aevion/catalog-client

# pnpm
pnpm add @aevion/catalog-client

# yarn
yarn add @aevion/catalog-client
```

Inside the AEVION monorepo, the package is wired as a workspace `file:` dep on
top of a tsconfig `paths` alias, so a plain ESM import resolves to the package's
TypeScript source — no rebuild step needed when editing the SDK.

```ts
// Anywhere in `frontend/`:
import { AevionCatalog } from "@aevion/catalog-client";
```

## 2. Import patterns

The SDK has three import shapes, pick whichever fits the call-site:

```ts
// (a) Class — pass config, create once, reuse across the surface.
import { AevionCatalog } from "@aevion/catalog-client";
const cat = new AevionCatalog();

// (b) Singleton convenience helpers — shortest path for one-off calls
//     against https://api.aevion.app.
import {
  listCatalog,
  getModule,
  getStats,
  getHealth,
  getQStoreFeatured,
  getMyCoachGoals,
  qcoreaiChat,
} from "@aevion/catalog-client";

const live = await listCatalog({ status: "mvp" });

// (c) Default export — `AevionCatalog` itself.
import AevionCatalog from "@aevion/catalog-client";
```

Type imports are available alongside every value:

```ts
import type {
  CatalogItem,
  CatalogResponse,
  CatalogListOptions,
  QStoreProduct,
  QLearnProgress,
  CoachGoal,
  QCoreAIChatRequest,
  PlanetActivityItem,
} from "@aevion/catalog-client";
```

---

## 3. Singleton vs custom client

The frontend ships **`frontend/src/lib/aevionCatalog.ts`** as the canonical
singleton. Use it unless you have a real reason to create another instance.

### 3.1 Use the singleton when…

…you're rendering a public page, a React Server Component, or making a
unauthenticated call:

```tsx
// frontend/src/app/qstore/page.tsx
import { catalog } from "@/lib/aevionCatalog";
import type { QStoreFeaturedResponse } from "@aevion/catalog-client";

export default async function QStorePage() {
  const featured: QStoreFeaturedResponse = await catalog.qstore.featured({ limit: 8 });
  return (
    <main>
      <h2>Popular</h2>
      <ul>{featured.popular.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
    </main>
  );
}
```

### 3.2 Use the per-request client when…

…you need a Bearer token (`/me/*`, `/star`, `/bookmark`, coach goals, etc.):

```tsx
// frontend/src/app/qlearn/me/page.tsx
"use client";
import { useEffect, useState } from "react";
import { catalogWithToken, getAuthToken } from "@/lib/aevionCatalog";
import type { QLearnProgress } from "@aevion/catalog-client";

export default function MyLearningPage() {
  const [progress, setProgress] = useState<QLearnProgress | null>(null);
  useEffect(() => {
    const cat = catalogWithToken(getAuthToken());
    cat.qlearn.progress().then(setProgress);
  }, []);
  if (!progress) return <p>Loading…</p>;
  return <p>{progress.summary.completed} of {progress.summary.total} done</p>;
}
```

### 3.3 Custom client for tests, SSR, or alternative backends

```ts
import { AevionCatalog } from "@aevion/catalog-client";

const staging = new AevionCatalog({
  baseUrl: "https://staging.api.aevion.app",
  headers: { "X-User-Id": "abc-123" },
  fetch: customFetch, // e.g. node-fetch, undici, msw mock
});
```

`headers` are merged into every sub-request; the SDK still sets `Accept` and
`Content-Type` per request, which override on collision.

---

## 4. Core catalog API

Top-level methods on `AevionCatalog` cover the hub registry itself.

```ts
// List + filter + project fields.
const r: CatalogResponse = await catalog.list({
  status: ["mvp", "launched"],
  tag: "ai",
  fields: ["id", "name", "status", "tags"],
});

// Single-module deep lookup (404 throws).
const qpersona: CatalogItem = await catalog.get("qpersona");

// Taxonomy summary.
const stats: RegistryStats = await catalog.stats();

// Aggregate health across every module.
const h = await catalog.health();
// { status: "ok"|"degraded"|"down", healthy: number, total: number,
//   services: Record<id, { ok, status, durationMs }>, timestamp }

// Export URLs (no network — just URL builders).
catalog.csvUrl({ status: "mvp" });
catalog.markdownUrl({ kind: "product" });
catalog.badgeUrl("qsign"); // /api/aevion/badges/qsign.svg
```

### 4.1 Helpers (sugar wrappers)

```ts
await catalog.searchByTag("ai");             // CatalogItem[]
await catalog.byStatus(["mvp", "launched"]); // CatalogItem[]
await catalog.byKind("core");                // CatalogItem[]
await catalog.mvpsAndLaunched();             // CatalogItem[]
await catalog.topTags(10);                   // { tag, count }[]
```

### 4.2 Extended stats + module of the day

```ts
const ext = await catalog.extendedStats({ recent: 20 });
// { total, byStatus, byKind, byPriority, topTags,
//   coverage: { health, openapi }, recentActivity, generatedAt }

const motd = await catalog.moduleOfTheDay();          // today
const motdJan1 = await catalog.moduleOfTheDay({ date: "2026-01-01" });
```

### 4.3 Graph helpers (tag-Jaccard)

```ts
await catalog.relatedModules("qsign");                // RelatedModule[]
await catalog.neighbours("qsign", { topK: 10 });      // NeighbourScore[]
await catalog.graph({ topK: 5, minOverlap: 1 });      // GraphEdge[]
```

### 4.4 Search / diff / fingerprint (client-side compute)

```ts
await catalog.findByText("ai", { limit: 20 });        // TextMatch[]
await catalog.diff("qsign", "qshield");               // ModuleDiff
await catalog.fingerprintModule("qsign");             // ModuleFingerprint
```

### 4.5 Hub aggregates

```ts
await catalog.openapi();   // OpenApiIndex — aggregate API index
await catalog.sitemap();   // SitemapEntry[] — parsed from sitemap.xml
```

---

## 5. Sub-clients

`AevionCatalog` exposes nine typed sub-clients. They share the parent's
`baseUrl`, `fetch`, and `headers` config.

| Sub-client | Since | Surface |
|---|---|---|
| `cat.qstore` | v0.6 | marketplace products + featured |
| `cat.qlearn` | v0.6 | bookmarks, streak, progress |
| `cat.qevents` | v0.6 | events list + ICS export |
| `cat.devhub` | v0.6 | snippets + stars |
| `cat.planet` | v0.6 | cross-module activity feed |
| `cat.qcoreai` | v0.7 | LLM providers + chat |
| `cat.multichat` | v0.7 | multi-provider presets + status |
| `cat.qmedia` | v0.7 | recommendations + trending + tracks |
| `cat.coach` | v0.7 | sessions + goals |

### 5.1 `cat.qstore` — Marketplace

Catalogue browsing for the QStore module: products list with sort, plus a
4-bucket "featured" grid (popular, trending, newest, top-rated).

```ts
class QStoreClient {
  products(opts?: { sort?: "popular"|"newest"|"trending"|"rating" }): Promise<QStoreProductsResponse>;
  featured(opts?: { limit?: number }): Promise<QStoreFeaturedResponse>;
}
```

```tsx
// frontend/src/app/qstore/page.tsx
import { catalog } from "@/lib/aevionCatalog";

export default async function Page() {
  const [hot, grid] = await Promise.all([
    catalog.qstore.products({ sort: "popular" }),
    catalog.qstore.featured({ limit: 8 }),
  ]);
  return (
    <>
      <h2>Hot now</h2>
      <ul>{hot.items.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
      <h2>Trending</h2>
      <ul>{grid.trending.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
    </>
  );
}
```

### 5.2 `cat.qlearn` — Courses, bookmarks, streak, progress

User-scoped — every method here requires a Bearer token.

```ts
class QLearnClient {
  bookmark(courseId: string): Promise<QLearnBookmarkResult>;
  unbookmark(courseId: string): Promise<QLearnBookmarkResult>;
  bookmarks(): Promise<QLearnBookmarksResponse>;
  streak(): Promise<QLearnStreak>;
  progress(): Promise<QLearnProgress>;
}
```

```tsx
"use client";
import { useEffect, useState } from "react";
import { catalogWithToken, getAuthToken } from "@/lib/aevionCatalog";
import type { QLearnStreak } from "@aevion/catalog-client";

export function StreakChip() {
  const [s, setS] = useState<QLearnStreak | null>(null);
  useEffect(() => {
    catalogWithToken(getAuthToken()).qlearn.streak().then(setS);
  }, []);
  if (!s) return null;
  return <span>{s.current}-day streak {s.activeToday ? "🔥" : ""}</span>;
}

async function toggleBookmark(courseId: string, isBookmarked: boolean) {
  const cat = catalogWithToken(getAuthToken());
  return isBookmarked ? cat.qlearn.unbookmark(courseId) : cat.qlearn.bookmark(courseId);
}
```

### 5.3 `cat.qevents` — Event calendar + ICS

```ts
class QEventsClient {
  list(opts?: { when?: "upcoming"|"past"|"all" }): Promise<QEventsListResponse>;
  ics(eventId: string): Promise<string>;       // text/calendar payload
  icsUrl(eventId: string): string;             // direct URL, no fetch
}
```

```tsx
// frontend/src/app/qevents/page.tsx
import { catalog } from "@/lib/aevionCatalog";

export default async function Page() {
  const { events } = await catalog.qevents.list({ when: "upcoming" });
  return (
    <ul>
      {events.map((e) => (
        <li key={e.id}>
          {e.title} — <a href={catalog.qevents.icsUrl(e.id)}>add to calendar</a>
        </li>
      ))}
    </ul>
  );
}
```

### 5.4 `cat.devhub` — Snippets + stars

```ts
class DevHubClient {
  snippets(opts?: { limit?: number; tag?: string; user?: string }): Promise<DevHubSnippetsResponse>;
  createSnippet(input: DevHubCreateSnippetInput): Promise<DevHubSnippet>;
  getSnippet(snippetId: string): Promise<DevHubSnippet>;
  star(snippetId: string): Promise<DevHubStarResult>;
}
```

```tsx
"use client";
import { catalogWithToken, getAuthToken } from "@/lib/aevionCatalog";

export async function publishSnippet() {
  const cat = catalogWithToken(getAuthToken());
  const created = await cat.devhub.createSnippet({
    title: "djb2 hash",
    content: "function h(s){...}",
    language: "ts",
    tags: ["hash", "util"],
  });
  await cat.devhub.star(created.id);
  return created;
}
```

### 5.5 `cat.planet` — Cross-module activity feed

```ts
class PlanetClient {
  activity(opts?: {
    limit?: number;
    kinds?: PlanetActivityKind | PlanetActivityKind[];
  }): Promise<PlanetActivityResponse>;
}
```

Known `PlanetActivityKind` values: `"module_update" | "release" | "post" |
"comment" | "purchase" | "course_complete" | "event"` (plus the open `string`
escape for future kinds).

```tsx
// frontend/src/app/planet/activity/page.tsx
import { catalog } from "@/lib/aevionCatalog";

export default async function Page() {
  const feed = await catalog.planet.activity({
    limit: 50,
    kinds: ["release", "module_update", "post"],
  });
  return (
    <ol>
      {feed.items.map((i) => (
        <li key={i.id}>
          <time>{new Date(i.at).toLocaleString()}</time>
          {" — "}
          <span>{i.kind}</span>{i.title ? `: ${i.title}` : ""}
        </li>
      ))}
    </ol>
  );
}
```

### 5.6 `cat.qcoreai` — LLM providers + chat (v0.7)

```ts
class QCoreAIClient {
  providers(): Promise<QCoreAIProvidersResponse>;
  health(): Promise<QCoreAIHealthResponse>;
  chat(input: QCoreAIChatRequest): Promise<QCoreAIChatResponse>;
}
```

```tsx
"use client";
import { useState } from "react";
import { catalogWithToken, getAuthToken } from "@/lib/aevionCatalog";

export function MiniChat() {
  const [reply, setReply] = useState<string>("");
  async function ask(text: string) {
    const cat = catalogWithToken(getAuthToken());
    const r = await cat.qcoreai.chat({
      provider: "openai",
      model: "gpt-4o",
      messages: [{ role: "user", content: text }],
      temperature: 0.2,
    });
    setReply(r.reply ?? r.message?.content ?? "");
  }
  return (
    <button onClick={() => ask("ping")}>Ask {reply && `→ ${reply}`}</button>
  );
}
```

A health-strip widget over the providers payload:

```tsx
import { catalog } from "@/lib/aevionCatalog";

export async function ProviderStrip() {
  const h = await catalog.qcoreai.health();
  if (!h.providers) return null;
  return (
    <ul>
      {Object.entries(h.providers).map(([id, p]) => (
        <li key={id} data-ok={p.ok}>{id}: {p.status} ({p.durationMs}ms)</li>
      ))}
    </ul>
  );
}
```

### 5.7 `cat.multichat` — Provider presets (v0.7)

```ts
class MultichatClient {
  providerStatus(): Promise<MultichatProviderStatus>;
  presets(): Promise<MultichatPresetsResponse>;
  launchPreset(presetId: string): Promise<MultichatLaunchResponse>;
}
```

```tsx
// frontend/src/app/multichat/page.tsx
import { catalog } from "@/lib/aevionCatalog";

export default async function Page() {
  const [status, { presets }] = await Promise.all([
    catalog.multichat.providerStatus(),
    catalog.multichat.presets(),
  ]);
  return (
    <>
      <ul>
        {status.providers.map((p) => (
          <li key={p.id} data-status={p.status}>
            {p.name} {p.latencyMs ? `(${p.latencyMs}ms)` : ""}
          </li>
        ))}
      </ul>
      <h2>Presets</h2>
      <ul>{presets.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
    </>
  );
}

// Client component for launching:
"use client";
import { catalogWithToken, getAuthToken } from "@/lib/aevionCatalog";
export async function launch(presetId: string) {
  return catalogWithToken(getAuthToken()).multichat.launchPreset(presetId);
}
```

### 5.8 `cat.qmedia` — Recommendations + trending (v0.7)

```ts
class QMediaClient {
  recommendations(opts?: { limit?: number }): Promise<QMediaRecommendationsResponse>;
  trending(): Promise<QMediaTrendingResponse>;
  tracks(): Promise<QMediaTracksResponse>;
}
```

```tsx
// frontend/src/app/qmedia/page.tsx
import { catalog } from "@/lib/aevionCatalog";

export default async function Page() {
  const [hot, recs] = await Promise.all([
    catalog.qmedia.trending(),
    catalog.qmedia.recommendations({ limit: 12 }),
  ]);
  return (
    <>
      <h2>Trending {hot.window ? `(${hot.window})` : ""}</h2>
      <ul>{hot.items.map((t) => <li key={t.id}>{t.title} — {t.artist}</li>)}</ul>
      <h2>For you</h2>
      <ul>{recs.items.map((t) => <li key={t.id}>{t.title}</li>)}</ul>
    </>
  );
}
```

### 5.9 `cat.coach` — Sessions + goals (v0.7)

```ts
class CoachClient {
  sessions(): Promise<CoachSessionsResponse>;
  goals(opts?: { completed?: boolean }): Promise<CoachGoalsResponse>;
  createGoal(input: CoachGoalCreateInput): Promise<CoachGoal>;
  completeGoal(goalId: string): Promise<CoachGoalCompleteResponse>;
}
```

```tsx
"use client";
import { useEffect, useState } from "react";
import { catalogWithToken, getAuthToken } from "@/lib/aevionCatalog";
import type { CoachGoal } from "@aevion/catalog-client";

export function CoachDashboard() {
  const [open, setOpen] = useState<CoachGoal[]>([]);

  useEffect(() => {
    catalogWithToken(getAuthToken())
      .coach.goals({ completed: false })
      .then((r) => setOpen(r.items));
  }, []);

  async function addGoal(title: string) {
    const cat = catalogWithToken(getAuthToken());
    const g = await cat.coach.createGoal({
      title,
      dueDate: "2026-06-01",
    });
    setOpen((prev) => [g, ...prev]);
  }

  async function done(id: string) {
    await catalogWithToken(getAuthToken()).coach.completeGoal(id);
    setOpen((prev) => prev.filter((g) => g.id !== id));
  }

  return (
    <ul>
      {open.map((g) => (
        <li key={g.id}>
          {g.title}{" "}
          <button onClick={() => done(g.id)}>complete</button>
        </li>
      ))}
    </ul>
  );
}
```

---

## 6. Auth & headers

The frontend canonicalises Bearer JWT storage in **`frontend/src/lib/auth.ts`**.
The SDK doesn't read storage itself; it just forwards whatever headers you give
it in the constructor.

### 6.1 The canonical auth helper

```ts
// frontend/src/lib/auth.ts (v1 slot — block 8 #1)
import {
  AUTH_TOKEN_KEY,        // "aevion_auth_token_v1"
  getAuthToken,          // () => string | null  (SSR-safe)
  setAuthToken,          // (token: string) => void
  clearAuthToken,        // () => void
  getAuthHeaders,        // () => { Authorization?: string }
  isAuthenticated,       // () => boolean
  migrateAuthToken,      // legacy "aevion_auth_token" → v1 slot, idempotent
} from "@/lib/auth";
```

`migrateAuthToken()` is a one-shot, SSR-safe helper to copy the legacy
`aevion_auth_token` slot onto the `_v1` key. Call it once at app mount; second
call is a no-op.

### 6.2 Wiring the token into the SDK

The frontend's singleton helper does this for you:

```ts
// frontend/src/lib/aevionCatalog.ts
import { AevionCatalog } from "@aevion/catalog-client";
import { getApiBase } from "@/lib/apiBase";
import { getAuthToken as getAuthTokenCanonical } from "@/lib/auth";

export const catalog = new AevionCatalog({ baseUrl: getApiBase() });

export function catalogWithToken(token: string | null | undefined) {
  if (!token) return catalog;
  return new AevionCatalog({
    baseUrl: getApiBase(),
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getAuthToken(): string | null {
  return getAuthTokenCanonical();
}
```

Two re-exports — `getAuthToken` and `catalogWithToken` — exist for ergonomics;
existing `import { getAuthToken } from "@/lib/aevionCatalog"` call-sites keep
working without churn.

### 6.3 Per-call custom headers

```ts
const cat = new AevionCatalog({
  baseUrl: "https://api.aevion.app",
  headers: {
    Authorization: `Bearer ${token}`,
    "X-User-Id": userId,
    "X-Trace-Id": traceId,
  },
});
```

The SDK still adds `Accept` and `Content-Type` per request; those override on
collision.

---

## 7. Error handling

Every method throws a plain `Error` whose message follows the shape
`AevionCatalog <METHOD> HTTP <status> on <url>`. There's no custom error class —
keep it simple and `try/catch` at the boundary.

```ts
import { catalog } from "@/lib/aevionCatalog";

async function safeGet(id: string) {
  try {
    return await catalog.get(id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("HTTP 404")) return null;
    throw e; // bubble up real errors
  }
}
```

Patterns that show up in practice:

| Symptom | Likely cause | Fix |
|---|---|---|
| `HTTP 401 on /api/qlearn/me/*` | No / expired token | Use `catalogWithToken(getAuthToken())` and re-login if `isAuthenticated() === false` |
| `HTTP 404 on /api/aevion/catalog/<id>` | Wrong slug | `catalog.findByText(query)` to disambiguate |
| `HTTP 429` | Rate limit | Back off, see `docs/RATELIMIT_KNOWN_LIMITATIONS.md` |
| `module not found: 'XYZ'` | `catalog.get()` validation | Use a lowercase `[a-z0-9-]+` slug |
| `global fetch is not available` | Node ≤16 without polyfill | Pass `fetch: (await import("node-fetch")).default` |

For React Query / SWR consumers, the SDK's promise-throw pairs cleanly with
their default error semantics — no extra adapter needed.

---

## 8. TypeScript types

Every public type is exported from the package root. The full set:

**Core registry**

`ModuleStatus`, `ModuleKind`, `CatalogItem`, `CatalogListOptions`,
`CatalogResponse`, `RegistryStats`, `RelatedModule`, `NeighbourScore`,
`GraphEdge`, `TextMatch`, `DiffFieldEntry`, `ModuleDiff`, `ModuleFingerprint`,
`CoverageBucket`, `ExtendedStats`, `ExtendedStatsRecentItem`, `ModuleOfTheDay`,
`AevionCatalogConfig`.

**Hub aggregates** (v0.3)

`OpenApiIndex`, `OpenApiModuleRef`, `OpenApiServiceRef`, `OpenApiSdkManifest`,
`SitemapEntry`.

**v0.6 sub-domains**

`QStoreSort`, `QStoreProduct`, `QStoreProductsResponse`, `QStoreFeaturedResponse`,
`QLearnCourseRef`, `QLearnBookmarkResult`, `QLearnBookmarksResponse`,
`QLearnStreak`, `QLearnProgressItem`, `QLearnProgress`,
`QEventsWhen`, `QEvent`, `QEventsListResponse`,
`DevHubSnippet`, `DevHubSnippetsResponse`, `DevHubCreateSnippetInput`,
`DevHubStarResult`,
`PlanetActivityKind`, `PlanetActivityItem`, `PlanetActivityResponse`.

**v0.7 sub-domains**

`QCoreAIProvider`, `QCoreAIProvidersResponse`, `QCoreAIHealthResponse`,
`QCoreAIChatMessage`, `QCoreAIChatRequest`, `QCoreAIChatResponse`,
`MultichatProvider`, `MultichatProviderStatus`, `MultichatPreset`,
`MultichatPresetsResponse`, `MultichatLaunchResponse`,
`QMediaTrack`, `QMediaTracksResponse`, `QMediaRecommendationsResponse`,
`QMediaTrendingResponse`,
`CoachSession`, `CoachSessionsResponse`, `CoachGoal`, `CoachGoalsResponse`,
`CoachGoalCreateInput`, `CoachGoalCompleteResponse`.

**Classes**

`AevionCatalog` (root + default export), `QStoreClient`, `QLearnClient`,
`QEventsClient`, `DevHubClient`, `PlanetClient`, `QCoreAIClient`,
`MultichatClient`, `QMediaClient`, `CoachClient`.

All response shapes use `[key: string]: unknown` index signatures on
sub-domain payloads so the SDK stays forward-compatible if the backend adds
optional fields ahead of an SDK release.

---

## 9. Migration guide

### 9.1 v0.6 → v0.7

**TL;DR — additive only, no breaking changes.**

Four new sub-clients (`qcoreai`, `multichat`, `qmedia`, `coach`), 12 new
endpoints wrapped, 21 new types, 13 new top-level convenience exports. All
existing v0.6 sub-clients (`qstore`, `qlearn`, `qevents`, `devhub`, `planet`)
keep identical signatures.

| From v0.6 | To v0.7 |
|---|---|
| `cat.qstore`, `cat.qlearn`, … (5 sub-clients) | Same + `cat.qcoreai`, `cat.multichat`, `cat.qmedia`, `cat.coach` |
| 16 endpoints | 28 endpoints |
| 5 namespaced clients | 9 namespaced clients |

No code changes required. Just bump:

```jsonc
// package.json
{
  "dependencies": {
    "@aevion/catalog-client": "^0.7.0"
  }
}
```

### 9.2 v0.7 → v0.8 (in progress)

**Status:** v0.8.0 is the active block — `cat.qmedia` is gaining playback /
queue surface, and `cat.coach` is picking up mutation endpoints beyond
`createGoal` / `completeGoal`. See `CHANGELOG.md` v0.8.0 entry for the
authoritative list as it lands.

**Forward-compat note:** the SDK already declares `[key: string]: unknown` on
every response type and uses an open string union for status-style enums, so
v0.7 consumers continue to type-check after a v0.8 backend rolls out, even on
old SDK versions.

### 9.3 Pre-v0.6 (legacy hub-only client)

If you're still on `0.5.x` (catalog + helpers + graph + search/diff/fingerprint
only), the upgrade path is:

1. Bump to `0.7.0`.
2. Use `cat.qstore.products({ sort: "popular" })` instead of hand-rolled
   `fetch("/api/qstore/products")` calls.
3. Optional: switch authenticated call-sites to `catalogWithToken(getAuthToken())`
   (importing from `@/lib/aevionCatalog` in the frontend).
4. Delete the per-feature ad-hoc fetch wrappers (`frontend/src/lib/qlearn.ts`,
   `frontend/src/lib/coach.ts`, etc. if any remain).

---

## 10. See also

- [`packages/aevion-catalog-client/README.md`](../packages/aevion-catalog-client/README.md)
  — the in-package short reference (versioned with the SDK).
- [`packages/aevion-catalog-client/examples/`](../packages/aevion-catalog-client/examples/)
  — eight runnable `.mjs` scripts.
- [`docs/SDK_USAGE.md`](./SDK_USAGE.md) — the earlier, hub-focused recipes
  cookbook (v0.5-era examples).
- [`docs/api/`](./api/) — backend OpenAPI specs.
- [`CHANGELOG.md`](../CHANGELOG.md) — release notes per SDK version.
