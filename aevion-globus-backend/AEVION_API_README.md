# AEVION Planet — API & SDK Reference

Single-page index of every public-facing API on the AEVION backend, with links to per-product OpenAPI specs and the official zero-dependency TypeScript clients.

## Composite Hub

| Endpoint | Purpose |
|---|---|
| `GET /api/aevion/health` | Single-call planetary monitor — cascades health probes to all modules in parallel (3 s timeout each), returns aggregate `ok / degraded / down` |
| `GET /api/aevion/openapi.json` | Index of all per-module OpenAPI specs + npm SDK list |
| `GET /api/aevion/version` | Build info: node version, uptime, env, release/commit if set |

## Modules

### Pipeline (central protect → certify → verify)

`/api/pipeline/*` — Shamir 2-of-3 + Ed25519 + HMAC + OpenTimestamps. Auto-creates a Quantum Shield record under the hood.

| Endpoint | Auth |
|---|---|
| `POST /protect` | bearer |
| `GET /verify/:certId` | — |
| `GET /certificates` | — |
| `POST /reconstruct` | — |
| `GET /shield/:shieldId/witness` | — |
| `GET /certificate/:certId/bundle.json` | — |
| `GET /certificate/:certId/pdf` | — |
| `GET /ots/:certId/proof` | — |
| `POST /ots/:certId/upgrade` | — |
| `GET /hmac-versions` | — |
| `GET /health` | — |

**SDK:** [`@aevion/pipeline-client`](./sdk/pipeline-client/README.md)

### Quantum Shield (key-distribution platform)

`/api/quantum-shield/*` — Shamir 2-of-3 + Ed25519 with optional `distributed_v2` policy (no-trust mode), idempotent reconstruction, audit log, revoke flow, webhooks, Prometheus metrics. See [QSHIELD_README.md](./QSHIELD_README.md) for full surface.

**SDK:** [`@aevion/qshield-client`](./sdk/qshield-client/README.md) — includes CLI tool `qshield reconstruct`.

### QSign v2 (signature platform)

`/api/qsign/v2/*` — RFC 8785 canonicalization, HMAC-SHA256 + Ed25519 hybrid + ML-DSA-65 (FIPS 204) post-quantum slot, key rotation with overlap, revocation ledger, geo-anchoring, audit log, webhooks, PDF stamps.

**SDK:** [`@aevion/qsign-client`](./sdk/qsign-client/README.md)

### QRight (public author/work registry)

`/api/qright/*` — public registry with embed widgets, SVG badges, transparency feed, admin tools, and webhooks.

**SDK:** [`@aevion/qright-client`](./sdk/qright-client/README.md)

### Planet (compliance / awards)

`/api/planet/*` — code/web/music/film validators, evidence root, signed certificates, votes, music & film awards.

### Bureau (verified-author KYC)

`/api/bureau/*` — verified-author tier upgrade with KYC partner.

### Auth

`/api/auth/*` — JWT issuance + register/login.

## TypeScript SDK monorepo

All clients live under `aevion-globus-backend/sdk/`. Zero runtime dependencies, ESM/CJS dual build, share a common error class pattern (`<Module>Error` with `status`, `body`, `message`).

```bash
npm install @aevion/pipeline-client
npm install @aevion/qshield-client
npm install @aevion/qsign-client
npm install @aevion/qright-client
npm install @aevion/planet-client
npm install @aevion/bureau-client
```

**Full ecosystem coverage**: 6 zero-dep TypeScript clients, one per major product.

Common usage:

```ts
import { PipelineClient } from "@aevion/pipeline-client";
import { QShieldClient } from "@aevion/qshield-client";

const baseHost = "https://aevion-production-a70c.up.railway.app";
const token = process.env.AEVION_TOKEN;

const pipeline = new PipelineClient({ baseUrl: `${baseHost}/api/pipeline`, token });
const shield = new QShieldClient({ baseUrl: `${baseHost}/api/quantum-shield`, token });

// 1. Protect a work via the central pipeline
const protect = await pipeline.protect({
  title: "My masterpiece",
  kind: "music",
  authorName: "Alice",
  payload: { fileSha256: "abcd..." },
});
// protect.shield.id is the QShield record id (auto-created by pipeline)

// 2. Later, deep-link to QShield directly
const view = await shield.getPublic(protect.shield.id);
console.log(view.witnessCid); // public CID for distributed_v2 records
```

## Health monitoring

A typical Grafana / Datadog scrape config:

```yaml
- job_name: aevion-hub
  scrape_interval: 30s
  metrics_path: /api/quantum-shield/metrics
  static_configs:
    - targets: ['aevion-production-a70c.up.railway.app']

- job_name: aevion-qsign
  scrape_interval: 30s
  metrics_path: /api/qsign/v2/metrics
  static_configs:
    - targets: ['aevion-production-a70c.up.railway.app']
```

For a single dashboard tile that turns green / yellow / red, point the probe at `/api/aevion/health`.

## Contributing

The SDKs are generated from the OpenAPI specs at `/api/<module>/openapi.json`. When you change an endpoint shape, update the spec first; the SDK and smoke tests follow from that contract.

## License

UNLICENSED — proprietary to AEVION.
