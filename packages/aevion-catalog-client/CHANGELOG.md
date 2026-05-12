# Changelog — @aevion/catalog-client

All notable changes to this package will be documented in this file.

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
