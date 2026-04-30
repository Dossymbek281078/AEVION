---
name: AEVION Bureau — local dev setup
description: How to run aevion-bureau worktree locally (ports, env vars, in-memory fallback, Postgres gotcha)
type: reference
originSessionId: fdbac471-39fc-4918-95f4-a9f6e17ac079
---
Local dev for the AEVION Bureau worktree (`C:/Users/user/aevion-bureau`).

**Backend (aevion-globus-backend):**
- `npm run build` → `tsc` to `dist/`
- Start: `PORT=4001 node dist/index.js`
- Dev: `npm run dev` (ts-node-dev with reload)
- In-memory fallback activates automatically when `DATABASE_URL` is unset (see `src/lib/pipelineMemoryStore.ts::memoryEnabled`). Force it with `AEVION_FORCE_MEMORY_PIPELINE=1`.
- Seeds 8 certs at boot with new random IDs each restart, so old `cert-XXX` IDs 404 after restart — always re-fetch current IDs via `/api/pipeline/certificates`.

**Frontend (frontend):**
- Port conflicts: `next dev` does NOT honor `PORT=` env on this setup — must pass `--port 3002` (or any other port) explicitly.
- Run: `BACKEND_PROXY_TARGET=http://127.0.0.1:4001 API_INTERNAL_BASE_URL=http://127.0.0.1:4001 npx next dev --port 3002 --turbopack`
- Proxy: browser hits `/api-backend/*` → rewrites to `BACKEND_PROXY_TARGET/*` (no CORS). RSC/SSR reads `API_INTERNAL_BASE_URL` directly.
- Build: `npm run build` — 23 routes prerender clean.

**Pipeline/bureau endpoints verified working end-to-end:**
`/api/pipeline/{health,protect,verify/:id,certificates,certificates.csv,bureau/stats,bureau/anchor,bureau/proof/:id,bureau/snapshot.json,lookup/:hash,badge/:id,certificate/:id/pdf}`

**Gotcha:** ghost node.exe processes on Windows — if weird routing/auth errors appear, `taskkill //IM node.exe //F` and restart. Multiple orphaned Next/Express instances can share port 4001 or proxy to stale servers.
