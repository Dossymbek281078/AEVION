# Examples — @aevion/catalog-client

Four runnable snippets covering the SDK surface. All point at the live
`https://api.aevion.app` backend by default; override with
`AEVION_BASE_URL`.

## Setup

```bash
cd packages/aevion-catalog-client
npm install
npm run build
```

## Run

```bash
node examples/list-all.mjs          # registry dump grouped by status
node examples/get-module.mjs        # single-module deep lookup (qpersona)
node examples/get-module.mjs qsign  # any module id
node examples/stats.mjs             # by-status / by-kind / top tags
node examples/urls.mjs              # URL builders (csv, markdown, badges)
```

## Against a local backend

```bash
AEVION_BASE_URL=http://localhost:3001 node examples/list-all.mjs
```

## What each shows

| File | Calls | Why |
|---|---|---|
| `list-all.mjs` | `cat.list()` | Iteration + grouping pattern |
| `get-module.mjs` | `cat.get(id)` | Deep lookup, `relatedModules` shape |
| `stats.mjs` | `cat.stats()` | Histogram-style output, README-ready |
| `urls.mjs` | `cat.csvUrl/markdownUrl/badgeUrl` | Pure URL generation, no fetch |
