# AEVION Catalog SDK — Usage Cookbook

## TL;DR

`@aevion-io/catalog-client` is a zero-dependency TypeScript client for the AEVION Hub catalog API at `api.aevion.app`. Install with `npm i @aevion-io/catalog-client`, then list, lookup, filter, score, badge, and aggregate every AEVION module from one tiny surface. Full reference: [packages/aevion-catalog-client/README.md](../packages/aevion-catalog-client/README.md).

## Installation

```bash
npm install @aevion-io/catalog-client
```

Requirements:

- Node 18+ (uses global `fetch`) or any modern browser
- TypeScript 4.7+ recommended for full type inference; plain JS also works
- No transitive dependencies, no native modules

If you must run on Node 16 or below, inject `node-fetch` via the `fetch` config option (see Custom base URL / fetch injection below).

## Quick start

```ts
import { AevionCatalog } from "@aevion-io/catalog-client";

const cat = new AevionCatalog();
const { items } = await cat.list({ status: "mvp" });
const qsign = await cat.get("qsign");
const csv = cat.csvUrl({ status: "mvp" });
console.log(items.length, qsign.relatedModules.length, csv);
```

That single block covers 80% of integrations: list + single lookup + an export URL with no network round-trip.

## Recipes

Eight self-contained snippets. Drop into a `.ts` file, `npx tsx file.ts`, done. For live experimentation use the [API Explorer](https://aevion.app/api-explorer/sdk).

### List all live (MVP + launched) modules

`mvpsAndLaunched()` is sugar for `byStatus(["mvp", "launched"])` and returns the items array directly.

```ts
import { AevionCatalog } from "@aevion-io/catalog-client";

const cat = new AevionCatalog();
const live = await cat.mvpsAndLaunched();

for (const m of live) {
  console.log(`${m.status.padEnd(10)} ${m.code.padEnd(16)} ${m.frontend}`);
}
console.log(`Total live: ${live.length}`);
```

Note: results are server-filtered, so payload stays small even for large registries.

### Find modules by tag intersection (e.g. AI + security)

The API filters by *any* tag match, so for an *all* match (AND), filter client-side after a single fetch.

```ts
import { AevionCatalog } from "@aevion-io/catalog-client";

const cat = new AevionCatalog();
const want = new Set(["ai", "security"]);
const candidates = await cat.searchByTag([...want]);
const hits = candidates.filter((m) =>
  [...want].every((t) => m.tags.includes(t)),
);

console.log(hits.map((m) => `${m.code} [${m.tags.join(",")}]`).join("\n"));
```

Gotcha: `searchByTag` returns *union*, not intersection — the client-side filter is what makes it AND.

### Embed AEVION status badges in a README

`badgeUrl()` returns a `shields.io`-shaped SVG URL. No fetch — just a string.

```ts
import { AevionCatalog } from "@aevion-io/catalog-client";

const cat = new AevionCatalog();
const ids = ["qsign", "qright", "planet", "qpersona"];
const md = ids
  .map((id) => `![${id}](${cat.badgeUrl(id)})`)
  .join(" ");

console.log(md);
// ![qsign](https://api.aevion.app/api/aevion/badges/qsign.svg) ...
```

Drop the output straight into any Markdown file. Badge colour reflects status (green for live, amber for in-progress, etc.).

### Generate a markdown table of the registry

`markdownUrl()` returns a URL to the server-rendered Markdown export. Filter via the same options as `list()`.

```ts
import { AevionCatalog } from "@aevion-io/catalog-client";

const cat = new AevionCatalog();
const url = cat.markdownUrl({ status: ["mvp", "launched"], kind: "product" });
const md = await fetch(url).then((r) => r.text());

await Bun.write("REGISTRY.md", md); // or fs.writeFile in Node
console.log(`Wrote ${md.length} bytes of Markdown.`);
```

The server-rendered format is stable and includes a header, badge column, and tag column — no need to template by hand.

### Build a similarity graph for visualisation

`graph()` is a single-round-trip K-NN over tag-Jaccard similarity — useful for D3 force layouts or recommendation prototypes.

```ts
import { AevionCatalog } from "@aevion-io/catalog-client";

const cat = new AevionCatalog();
const edges = await cat.graph({ topK: 4, minOverlap: 1 });

// emit graph.json for D3 / Sigma / Cytoscape
const nodes = [...new Set(edges.flatMap((e) => [e.from, e.to]))];
const json = { nodes: nodes.map((id) => ({ id })), edges };
console.log(`${nodes.length} nodes / ${edges.length} edges`);
```

Each edge carries `overlap` (raw shared-tag count) and `score` (Jaccard 0..1). Set `topK` low to keep graphs readable.

### Get module health from one call

`health()` aggregates `/health` from every wired module into a single object — fast, cached server-side.

```ts
import { AevionCatalog } from "@aevion-io/catalog-client";

const cat = new AevionCatalog();
const h = await cat.health();

console.log(`Cluster: ${h.status}  ${h.healthy}/${h.total} services healthy`);
const down = Object.entries(h.services).filter(([, s]) => !s.ok);
for (const [name, s] of down) console.log(`  DOWN ${name} (${s.status})`);
```

Gotcha: `status: "degraded"` means at least one but not all services responded — fine for soft launches, page on `"down"`.

### Discover all published TypeScript clients

The Hub OpenAPI aggregate index lists every npm-published SDK package.

```ts
import { AevionCatalog } from "@aevion-io/catalog-client";

const cat = new AevionCatalog();
const idx = await cat.openapi();

console.log(`${idx.name} v${idx.version}`);
for (const pkg of idx.sdk?.npm ?? []) console.log(`  npm i ${pkg}`);
for (const m of idx.modules) console.log(`  spec → ${m.spec}`);
```

The `sdk.npm` array is the source of truth for "what can I `npm i` today" — bookmark this for onboarding new dev teammates.

### Self-host a sitemap reader (no XML lib)

`sitemap()` parses `/api/aevion/sitemap.xml` with a zero-dep regex parser into a flat `SitemapEntry[]`.

```ts
import { AevionCatalog } from "@aevion-io/catalog-client";

const cat = new AevionCatalog();
const urls = await cat.sitemap();
const high = urls
  .filter((u) => (u.priority ?? 0) >= 0.8)
  .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

for (const u of high) console.log(`${u.priority}  ${u.loc}`);
```

Useful for crawl prioritisation, link checkers, or static-site index pages. No `xml2js` needed.

## API reference (compact)

### Read methods

| Method | Returns | Description |
|---|---|---|
| `list(opts?)` | `CatalogResponse` | List modules with filters and field projection |
| `get(id)` | `CatalogItem` | Single-module deep lookup; throws on 404 |
| `stats()` | `RegistryStats` | Taxonomy summary (byStatus, byKind, top-20 byTag) |
| `health()` | `HealthAggregate` | Aggregate health across all wired modules |

### Helpers (v0.2)

| Method | Returns | Description |
|---|---|---|
| `searchByTag(tag)` | `CatalogItem[]` | Modules matching any of the given tags |
| `byStatus(status)` | `CatalogItem[]` | Modules in the given status(es) |
| `byKind(kind)` | `CatalogItem[]` | Modules of the given kind(s) |
| `mvpsAndLaunched()` | `CatalogItem[]` | Sugar — everything live |
| `topTags(n?)` | `{tag,count}[]` | Top-N tags from registry stats |

### Hub aggregates (v0.3)

| Method | Returns | Description |
|---|---|---|
| `openapi()` | `OpenApiIndex` | AEVION aggregate API index (modules + services + sdk) |
| `sitemap()` | `SitemapEntry[]` | Parsed sitemap.xml entries |

### Graph helpers (v0.4)

| Method | Returns | Description |
|---|---|---|
| `relatedModules(id)` | `RelatedModule[]` | Server-computed top-5 related modules |
| `graph(opts?)` | `GraphEdge[]` | K-NN tag-Jaccard graph across the registry |
| `neighbours(id, opts?)` | `NeighbourScore[]` | Single-source neighbours scored by Jaccard |

### URL builders

| Method | Returns | Description |
|---|---|---|
| `csvUrl(opts?)` | `string` | URL for `?format=csv` |
| `markdownUrl(opts?)` | `string` | URL for `?format=md` |
| `badgeUrl(id)` | `string` | URL for `/badges/<id>.svg` |

### Convenience function exports

Standalone wrappers around a default `AevionCatalog()` pointed at `https://api.aevion.app`:
`listCatalog`, `getModule`, `getStats`, `getHealth`, `searchByTag`, `byStatus`, `byKind`, `mvpsAndLaunched`, `topTags`, `getOpenApi`, `getSitemap`, `getRelatedModules`, `getGraph`, `getNeighbours`.

## Error handling

All methods throw native `Error` instances on non-2xx HTTP or input-validation failures. The message includes the HTTP status and full URL for easy debugging.

```ts
import { AevionCatalog } from "@aevion-io/catalog-client";

const cat = new AevionCatalog();
try {
  const m = await cat.get("does-not-exist");
  console.log(m);
} catch (err) {
  // "AevionCatalog.get module not found: 'does-not-exist'"
  // "AevionCatalog.list HTTP 503 on https://api.aevion.app/api/aevion/catalog"
  console.error("catalog call failed:", (err as Error).message);
}
```

Validation errors thrown synchronously (before any fetch): `get("BAD ID")`, `badgeUrl("BAD ID")` — both require `[a-z0-9-]+`. Wrap call sites in a single try/catch; do not branch on error subclass.

## Custom base URL / fetch injection

Two config knobs, both optional:

```ts
import { AevionCatalog } from "@aevion-io/catalog-client";

const staging = new AevionCatalog({
  baseUrl: "https://staging-api.aevion.app",
});

// Inject fetch for tests, retries, or Node 16
const mockFetch: typeof fetch = async (input) => {
  return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
};
const test = new AevionCatalog({ fetch: mockFetch });
```

Use cases:

- Unit tests — inject a `fetch` that returns canned JSON
- Staging / preview deploys — point `baseUrl` at a branch URL
- Retry / circuit-breaker wrappers — wrap the real `fetch` and pass it in
- Auth proxies — wrap `fetch` to inject custom headers (the SDK itself sends none)

## Versioning

| Version | Highlights |
|---|---|
| v0.1.0 | First cut — `list`, `get`, `stats`, URL builders |
| v0.2.0 | Convenience helpers — `searchByTag`, `byStatus`, `byKind`, `mvpsAndLaunched`, `topTags` |
| v0.3.0 | Hub aggregates — `health()`, `openapi()`, `sitemap()` with zero-dep XML parser |
| v0.4.0 | Graph helpers — `relatedModules`, `graph`, `neighbours` (tag-Jaccard K-NN) |

Full changelog: [packages/aevion-catalog-client/CHANGELOG.md](../packages/aevion-catalog-client/CHANGELOG.md).

## Limitations

What the SDK explicitly does *not* do (yet):

- No authentication — the catalog is public; private endpoints need a different client
- No streaming or pagination — `list()` returns the full filtered array in one response
- No offline cache — every call hits the network; bring your own memoisation if needed
- No retries / backoff — wrap the injected `fetch` if you need them
- No webhook delivery / subscription — see roadmap below
- No write methods — read-only against the public catalog
- No SSE / WebSocket — health and stats are pull-only
- Browser CORS — works against `api.aevion.app` (configured allowlist); custom backends must enable CORS themselves

## Roadmap

- **v0.5** — webhook subscription helpers (`subscribe()`, signed payloads, HMAC verification)
- **v0.6** — TypeScript decorators for Express auto-routes (`@CatalogRoute("/")` reflecting OpenAPI shape)
- **v0.7** — optional in-memory LRU cache with TTL config, opt-in per method
- **v0.8** — first-class browser bundle (`@aevion-io/catalog-client/browser`) with tree-shaken types

Watch the [package source](../packages/aevion-catalog-client/) for milestones; issues and PRs welcome.

## Links

- Package source — [packages/aevion-catalog-client/](../packages/aevion-catalog-client/)
- Runnable examples — [packages/aevion-catalog-client/examples/](../packages/aevion-catalog-client/examples/)
- CHANGELOG — [packages/aevion-catalog-client/CHANGELOG.md](../packages/aevion-catalog-client/CHANGELOG.md)
- README — [packages/aevion-catalog-client/README.md](../packages/aevion-catalog-client/README.md)
- AEVION Overview — [docs/AEVION_OVERVIEW.md](./AEVION_OVERVIEW.md)
- Live catalog explorer — [/api-explorer/catalog](https://aevion.app/api-explorer/catalog)
- Live SDK playground — [/api-explorer/sdk](https://aevion.app/api-explorer/sdk)
- Aggregate OpenAPI index — [/api/aevion/openapi.json](https://api.aevion.app/api/aevion/openapi.json)
