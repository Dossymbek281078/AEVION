# @aevion/pipeline-client

Zero-dependency TypeScript client for the AEVION IP Pipeline — protect / verify / reconstruct an intellectual-property record using Shamir 2-of-3 + Ed25519 + HMAC + OpenTimestamps.

## Install

```bash
npm install @aevion/pipeline-client
```

## Quick start

```ts
import { PipelineClient } from "@aevion/pipeline-client";

const p = new PipelineClient({
  baseUrl: "https://aevion-production-a70c.up.railway.app/api/pipeline",
  token: process.env.AEVION_TOKEN,
});

// Protect a work — auto-creates QShield distributed_v2 record under the hood.
const protect = await p.protect({
  title: "My masterpiece",
  kind: "music",
  authorName: "Alice",
  country: "KZ",
  city: "Almaty",
  payload: { fileSha256: "abcd…" },
});
// SAVE protect.shield.shards[0] offline — server keeps only 2 of 3.

// Public verify (no auth needed)
const verdict = await p.verify(protect.certificate.id);
console.log(verdict.integrity.contentHashValid);
console.log(verdict.bitcoinAnchor?.status);
```

## Surface

| Method | Endpoint | Auth |
|---|---|---|
| `health()` | `GET /health` | — |
| `protect(input)` | `POST /protect` | bearer |
| `verify(certId)` | `GET /verify/:id` | — |
| `certificates()` | `GET /certificates` | — |
| `reconstruct(shieldId, shards)` | `POST /reconstruct` | — |
| `witness(shieldId)` | `GET /shield/:id/witness` | — |
| `bundle(certId)` | `GET /certificate/:id/bundle.json` | — |
| `pdf(certId)` | `GET /certificate/:id/pdf` | — |
| `otsProof(certId)` | `GET /ots/:id/proof` | — |
| `otsUpgrade(certId)` | `POST /ots/:id/upgrade` | — |
| `hmacVersions()` | `GET /hmac-versions` | — |

`bundle()` / `pdf()` / `otsProof()` return raw binary as `ArrayBuffer`.

## Errors

All non-2xx responses throw `PipelineError` with `status`, `body`, `message`.

## License

UNLICENSED — proprietary to AEVION.
