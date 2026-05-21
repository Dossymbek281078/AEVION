## Summary

Polish + production-readiness + SDK + tests layer on top of QSign v2 (Tier 1 already in main as PR #2). **23 commits**, build-green, **110 vitest specs green**, 25-step smoke, full deploy runbook.

This PR takes QSign v2 from "Tier 1 working" to **production v1.0 GA**.

## Highlights

### Reliability (added 2026-04-29)
- **DB-backed webhook retry queue** (`054dee3`) — replaces the in-process `setTimeout` retry chain with a `QSignWebhookQueue` table + periodic worker tick (5s). Retries now survive a process restart. Pure `planNextStep(attempt, outcome)` state machine covered by 8 vitest specs (success → done / 4xx → failed / 5xx → retry +5s/+30s / network error → retry / exhausted → failed). `/health.counts` now exposes `webhookQueuePending` + `webhookQueueFailed`. Audit contract on `GET /webhooks/:id/deliveries` unchanged.

### Core (Tier 1 polish)
- **Dilithium ML-DSA-65 preview slot** (`6014189`, `c52fc02`) — reserves the API surface for real post-quantum signatures (lands in v2.1) by emitting a deterministic SHA-512 fingerprint of `canonical||kid` on every sign. Explicit `mode='preview'` so consumers don't mistake it for a real PQ signature.
- **PDF brand customization** (`925f066`) — `?accent=#hex&title=…&subtitle=…` query params with mandatory "Powered by AEVION QSign v2" footer when `title` is overridden.
- **Embed widgets** (`5c685dc`) — iframe-mountable verify badge + sign button with `postMessage` handshake.
- **Dynamic OG image** (`1f422fc`) for `/qsign/verify/[id]`.

### Compliance / Operator surface
- **GET `/audit`** (`6014189`) — per-user paginated audit log unioning sign + revoke events.
- **POST `/sign/batch`** (`5353ff4`) — bulk-sign up to 50 payloads in one auth round trip.
- **Per-user webhooks** (`5e3ec75`) — CRUD + HMAC-SHA256 signed deliveries with `X-QSign-Signature` header.

### Production hardening
- **Robust `/health`** (`8e2c945`) — DB ping with latency, table presence, both active kids, row counts (signatures, revoked, keys, active webhooks, delivery attempts), process memory snapshot, uptime. 503 with `status="degraded"` and per-component breakdown when anything fails. Stable shape so monitors can hard-code paths.
- **Request ID middleware + errResp helper** (`8e2c945`) — honors inbound `X-Request-Id` or mints one. Echoes via response header. All 17 5xx error paths swept to attach `requestId` to JSON bodies and prefix server logs with `[qsign v2] [req=<id>]`.
- **Webhook delivery log + retry** (`63b5b30`) — `QSignWebhookDelivery` table captures every attempt. 3 attempts with backoff `[0s, 5s, 30s]` on 5xx + network errors + timeout; 4xx is permanent. Per-webhook `GET /webhooks/:id/deliveries` audit endpoint. `DELETE /webhooks/:id` cascades.
- **Webhook secret rotation** (`7f23047`) — `POST /webhooks/:id/rotate-secret` for compromise response.
- **Idempotency-Key on `/sign`** (`d4c838f`) — RFC-style header, 24h cache. Same key + same payload returns cached signature with `idempotent: replayed` (200 OK). Same key + different payload → 409 with both hashes.
- **Prometheus `/metrics`** (`d4c838f`) — text/plain v0.0.4 exposition with `qsign_signatures_total`, `qsign_signatures_revoked`, `qsign_keys_total`, `qsign_webhook_deliveries_total{succeeded}`, `qsign_db_latency_seconds`, `qsign_uptime_seconds`, `qsign_memory_*`.
- **OpenAPI 3.0 spec** (`8e2c945`) — `GET /openapi.json` (5-min cache) covers all 20 endpoints with full schemas.

### SDK packages
- **`@aevion/qsign-client`** (`f28ed36`) — TypeScript class with zero deps (Node ≥18 / browsers / Bun / Deno). Mirrors the OpenAPI contract: health, sign (with idempotency + GPS), signBatch, verify, verifyById, getPublic, pdfUrl, revoke, listAudit, key registry, webhook CRUD + rotate + deliveries.
- **`@aevion/qsign-webhook-receiver`** (`f28ed36`) — pure HMAC verifier + Express middleware, drop-in for partner sites. Constant-time, length-checked, hex-only.

### Studio UX
- **"Use the API" tab** (`0310e23`) — live curl / TypeScript / Python snippets on `/qsign`. Latest signature id auto-injected.
- **Hash a file** (`8619e68`) — drag-drop / file picker → SHA-256 client-side → `{ type:'file', name, size, mime, sha256, signedAt }` envelope. File never leaves the browser. 50MB cap.
- **Webhooks management card** (`8619e68`) — list, create (one-time secret banner), delete; quota indicator.
- **Sign rate-limit chip** (`c52fc02`) — reads `RateLimit-*` headers, "X/60 left · resets in Ns" with red-state at ≤5 remaining.
- **Studio actions** (`246c1a9`) — Copy link / Download PDF / Copy JSON.
- **Admin rotation form** (`bee7e76`) — `/qsign/keys` UI for admins.
- **Dilithium preview row** (`c52fc02`) — PQ-slot card with truncated digest.

### Tests
- **102 vitest specs green** (`e9d1eb3` adds 36 new): canonicalize (RFC 8785 conformance, byte-identity, type rejection, path tracking), geo (XFF priority, GPS validation, private-IP filtering), webhook receiver (round-trip, tamper, hex case-insensitive, Express middleware 401/400 paths).
- **25-step smoke** covers health prod-shape (db.ok + counts + X-Request-Id), openapi, metrics, idempotency triple (fresh/replayed/409), webhook lifecycle (create/list/deliveries/delete), audit revoke event.

### Documentation
- **`QSIGN_V2.md`** (`2733752`) updated for all new endpoints with curl examples.
- **`QSIGN_V2_DEPLOY.md`** (`3443d8d`) — 10-section production runbook: first-deploy checklist, env vars, /health probe contract, webhook receiver template + retry semantics + triage, quarterly key rotation runbook, DR table, prod smoke command, SLO targets (p99 latencies + alert thresholds), observability hooks, rollback plan.

## Build & test

`npm run verify` from worktree root — backend `tsc` + frontend `next build` exit 0.
`npm test` from `aevion-globus-backend/` — 102/102 pass.

## Untouched zones (per session contract)

- `pipeline.ts`, `planetCompliance.ts` — sibling sessions own them
- `qsign.ts` (legacy v1) — still mounted, untouched
- Prisma migrations — schema additions handled by `ensureTables.ts` idempotent CREATE IF NOT EXISTS

## Test plan
- [ ] Merge → Railway redeploy
- [ ] `BASE=https://aevion-production-a70c.up.railway.app NO_REVOKE=1 npm run smoke:qsign-v2` — 25 steps PASS
- [ ] `curl <base>/api/qsign/v2/openapi.json | jq .info.version` → `"2.0.0"`
- [ ] `curl <base>/api/qsign/v2/health | jq .status` → `"ok"`, `db.latencyMs < 500`
- [ ] `curl <base>/api/qsign/v2/metrics` returns text/plain with `qsign_signatures_total`
- [ ] Visual: `/qsign` — hash a file → sign → verify rate-limit chip + dilithium row + webhook card render; "Use the API" tab cycles through 3 langs

## Sample artifact

`qsign-v2-sample.pdf` (committed in this PR) is a real signed PDF stamp for visual inspection — open it to see the brand stripe + status banner + QR-coded verify URL.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
