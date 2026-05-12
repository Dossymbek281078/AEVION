# Changelog — @aevion/catalog-client

All notable changes to this package will be documented in this file.

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
