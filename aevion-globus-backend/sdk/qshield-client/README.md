# @aevion/qshield-client

Zero-dependency TypeScript client for the AEVION Quantum Shield API.

## Install

```bash
npm install @aevion/qshield-client
```

## Quick start

```ts
import { QShieldClient } from "@aevion/qshield-client";

const qs = new QShieldClient({
  baseUrl: "https://aevion-production-a70c.up.railway.app/api/quantum-shield",
  token: process.env.AEVION_TOKEN,
});

// Create with no-trust distribution (server alone cannot reconstruct)
const created = await qs.create({
  objectTitle: "My masterpiece",
  payload: { hello: "world" },
  distribution: "distributed_v2",
});
// SAVE created.shards[0] to disk — server forgets it after this response.

// Reconstruct with 2 of 3 (idempotent retries)
const verdict = await qs.reconstruct(created.id, [created.shards[0], created.shards[1]], {
  idempotencyKey: "verify-attempt-001",
});
console.log(verdict.valid); // true
```

## Surface

| Method | Endpoint | Auth |
|---|---|---|
| `health()` | `GET /health` | — |
| `openapi()` | `GET /openapi.json` | — |
| `create(opts)` | `POST /` | optional bearer |
| `list({ limit?, offset?, mine? })` | `GET /` | optional |
| `get(id)` | `GET /:id` | — |
| `getPublic(id)` | `GET /:id/public` | — |
| `getWitness(id)` | `GET /:id/witness` | — |
| `reconstruct(id, shards, { idempotencyKey })` | `POST /:id/reconstruct` | — |
| `revoke(id, { reason })` | `POST /:id/revoke` | bearer |
| `audit(id, { limit?, offset? })` | `GET /:id/audit` | bearer |
| `delete(id)` | `DELETE /:id` | bearer |

All methods reject with `QShieldError` (status, body, message) on non-2xx responses.

## CLI

```bash
# Health check
npx @aevion/qshield-client health

# Public projection
npx @aevion/qshield-client public qs-XXXXXX

# Public witness shard (distributed_v2 only)
npx @aevion/qshield-client witness qs-XXXXXX

# Reconstruct from local shard JSON files (any mix of single shards or bundles)
AEVION_TOKEN=eyJ... npx @aevion/qshield-client reconstruct qs-XXXXXX shard1.json bundle.json
# Exits 0 if valid, 1 otherwise.
```

Env:
- `AEVION_QSHIELD_BASE` — base URL (default: prod)
- `AEVION_TOKEN` — JWT bearer for authenticated routes
- `AEVION_IDEMPOTENCY_KEY` — override the auto-generated CLI idempotency key

## Distribution policies

- `legacy_all_local` — all 3 shards in server DB. Convenient, but server alone can reconstruct.
- `distributed_v2` — shard 1 returned ONCE in create response (author keeps it offline), shard 3 mirrored with public RFC4648 base32 CID v1. Server alone holds 2 of 3 — but reconstruction still requires 2, and the no-trust workflow is to require the offline shard.

## Idempotency

`reconstruct(id, shards, { idempotencyKey })` honors the standard `Idempotency-Key` header. The first call records the verdict; replays return the same body and skip the `verifiedCount` bump. Use a fresh key per logically-distinct attempt; use the same key to make retries safe.

## Types

All response shapes are exported as types: `ShieldRecord`, `PublicProjection`, `WitnessShard`, `ReconstructResult`, `AuditEntry`, `HealthResponse`, `AuthenticatedShard`, `DistributionPolicy`.

## License

UNLICENSED — proprietary to AEVION.
