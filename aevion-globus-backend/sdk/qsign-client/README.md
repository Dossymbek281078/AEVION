# @aevion/qsign-client

TypeScript client for [AEVION QSign v2](https://aevion.com/qsign) — tamper-evident JSON signature platform with HMAC-SHA256 + Ed25519 hybrid signing, RFC 8785 canonicalization, and post-quantum-ready Dilithium preview slot.

**Zero runtime dependencies.** Uses global `fetch` (Node ≥18, browsers, Bun, Deno).

## Install

```bash
npm install @aevion/qsign-client
```

Or copy `index.ts` directly — the file is self-contained.

## Quick start

```ts
import { QSignClient } from "@aevion/qsign-client";

const qsign = new QSignClient({
  baseUrl: "https://aevion-production-a70c.up.railway.app/api/qsign/v2",
  token: process.env.AEVION_TOKEN,
});

// Sign
const sig = await qsign.sign(
  { artifact: "invoice-2026-04-28", amount: 1500.0, currency: "USD" },
  { idempotencyKey: "invoice-2026-04-28-v1" },
);
console.log(sig.id, sig.publicUrl);
// Output:
//   "a1b2c3d4-…" "/qsign/verify/a1b2c3d4-…"

// Verify
const r = await qsign.verify({
  payload: { artifact: "invoice-2026-04-28", amount: 1500.0, currency: "USD" },
  hmacKid: sig.hmac.kid,
  signatureHmac: sig.hmac.signature,
  ed25519Kid: sig.ed25519?.kid,
  signatureEd25519: sig.ed25519?.signature,
  signatureDilithium: sig.dilithium?.digest,
});
console.log(r.valid); // true
```

## Idempotency

Pass `idempotencyKey` (8-128 char alphanumeric + `._-:`) to make `sign()` safe under retry:

```ts
const sig1 = await qsign.sign(payload, { idempotencyKey: "order-42" });
const sig2 = await qsign.sign(payload, { idempotencyKey: "order-42" });
sig1.id === sig2.id; // true — second call returned the cached signature
sig2.idempotent;    // "replayed"
```

If you reuse the same key with a **different** payload, the server returns `409 idempotency_key_payload_mismatch` — protecting against accidental signature collisions.

## Bulk sign

```ts
const r = await qsign.signBatch([
  { artifact: "row-1", value: "alpha" },
  { artifact: "row-2", value: "beta" },
  { payload: { artifact: "row-3" }, gps: { lat: 43.24, lng: 76.89 } },
]);
console.log(r.succeeded, "/", r.total);
```

Up to 50 items per call. Returns 207 Multi-Status on partial failure.

## Audit log

```ts
const audit = await qsign.listAudit({ event: "sign", limit: 20 });
audit.items.forEach((e) => console.log(e.at, e.signatureId));
```

## Webhooks

```ts
// Create — secret is shown ONCE
const wh = await qsign.createWebhook("https://example.com/qsign-events", ["sign", "revoke"]);
console.log("save this:", wh.secret);

// Audit deliveries
const deliveries = await qsign.listDeliveries(wh.id, { limit: 50 });
deliveries.deliveries.forEach((d) =>
  console.log(d.attempt, d.httpStatus, d.error, d.durationMs + "ms"),
);

// Cleanup
await qsign.deleteWebhook(wh.id);
```

Receiver-side, verify the `X-QSign-Signature` header. See `@aevion/qsign-webhook-receiver` (sibling package) or:

```ts
import crypto from "crypto";
const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
const ok = crypto.timingSafeEqual(
  Buffer.from(expected, "hex"),
  Buffer.from(req.headers["x-qsign-signature"], "hex"),
);
```

## Errors

All HTTP errors are wrapped in `QSignError`:

```ts
try {
  await qsign.sign(payload);
} catch (e) {
  if (e instanceof QSignError) {
    console.error("status", e.status, "details", e.details, "requestId", e.requestId);
  }
}
```

Use `requestId` when reporting issues — server logs are correlated by it.

## API

| Method | Returns |
|--------|---------|
| `health()` | full /health response with db.ok, counts, memory |
| `sign(payload, opts?)` | signature row + `idempotent: "fresh" \| "replayed"` |
| `signBatch(items)` | `{total,succeeded,failed,results}` (≤50 items) |
| `verify(input)` | stateless verify result |
| `verifyById(id)` | DB-backed verify (incl. revocation) |
| `getPublic(id)` | shareable JSON |
| `pdfUrl(id, params?)` | absolute URL to PDF stamp (no fetch) |
| `revoke(id, reason, causalSignatureId?)` | revocation row |
| `listAudit({event, limit, offset})` | paginated event log |
| `listKeys()` / `getKey(kid)` / `rotateKey(input)` | key registry |
| `listWebhooks()` / `createWebhook(url, events)` / `deleteWebhook(id)` | webhook CRUD |
| `listDeliveries(webhookId, {limit})` | per-attempt audit trail |

Full schema in `index.ts` types or at the live OpenAPI 3.0 spec: `<baseUrl>/openapi.json`.

## Versioning

The client major version tracks the QSign v2 contract. Server-side adds new fields — old clients keep working (extra fields are ignored). Breaking changes warrant a v3.
