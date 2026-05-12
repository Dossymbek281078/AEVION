# @aevion/catalog-client

Typed TypeScript client for the AEVION Hub catalog API. Zero dependencies. Node 18+ / modern browsers.

```bash
npm install @aevion/catalog-client
```

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

Four runnable scripts under `examples/`:

```bash
node examples/list-all.mjs          # registry dump grouped by status
node examples/get-module.mjs qsign  # single-module deep lookup
node examples/stats.mjs             # by-status / by-kind / top tags
node examples/urls.mjs              # CSV/MD/badge URLs (no network)
```

See [`examples/README.md`](./examples/README.md).

## Convenience functions

For one-off calls against `https://api.aevion.app`:

```ts
import { listCatalog, getModule, getStats, getHealth } from "@aevion/catalog-client";

const all = await listCatalog();
const x = await getModule("qfusionai");
const s = await getStats();
const h = await getHealth();
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
