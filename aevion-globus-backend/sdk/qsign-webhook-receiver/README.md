# @aevion/qsign-webhook-receiver

Drop-in HMAC verifier for AEVION QSign v2 webhook deliveries.

QSign signs every webhook body with `HMAC-SHA256(secret, raw-bytes)` and delivers it via the `X-QSign-Signature` header. **You MUST verify before trusting the body** — otherwise an attacker could forge `sign` / `revoke` events and confuse your consumer.

This package gives you:
- A pure verification function: `verifyQSignWebhookSignature(raw, header, secret) → boolean`
- An Express middleware that rejects bad signatures with 401

Zero dependencies. Pure Node `crypto`.

## Install

```bash
npm install @aevion/qsign-webhook-receiver
```

## Express middleware (recommended)

```ts
import express from "express";
import { qsignWebhookMiddleware, QSignWebhookBody } from "@aevion/qsign-webhook-receiver";

const app = express();

app.post(
  "/qsign-webhook",
  // Capture raw bytes — Express's default JSON parser discards them.
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
  qsignWebhookMiddleware({ secret: process.env.QSIGN_WEBHOOK_SECRET! }),
  (req, res) => {
    const evt = (req as any).qsignEvent as QSignWebhookBody;
    if (evt.event === "sign") {
      console.log("new signature", evt.data.id, "by", evt.data.issuerEmail);
    } else if (evt.event === "revoke") {
      console.log("revoked", evt.data.id, evt.data.reason);
    }
    res.status(200).end();
  },
);

app.listen(3000);
```

If the signature header is missing or invalid, the middleware responds with `401 { error: "qsign_webhook_invalid_signature" }` and never calls `next()`. Custom error response via `onInvalid: (req, res) => …`.

## Pure function

If you're not on Express — Next.js API route, Hono, Bun.serve, raw http:

```ts
import { verifyQSignWebhookSignature } from "@aevion/qsign-webhook-receiver";

// Next.js example (app router):
export async function POST(req: Request) {
  const raw = await req.text();
  const ok = verifyQSignWebhookSignature(
    raw,
    req.headers.get("x-qsign-signature"),
    process.env.QSIGN_WEBHOOK_SECRET!,
  );
  if (!ok) return new Response("invalid signature", { status: 401 });

  const evt = JSON.parse(raw);
  // ... process evt.event / evt.data
  return new Response("ok");
}
```

**Important:** pass the *raw* body bytes (Buffer or UTF-8 string), NOT the parsed JSON. Re-stringifying the parsed body will not byte-match what the server signed.

## Event shape

```ts
type QSignWebhookBody = {
  event: "sign" | "revoke";
  timestamp: string;       // ISO-8601
  data: Record<string, unknown>;  // event-specific fields
};
```

`sign` events carry `{ id, payloadHash, hmacKid, ed25519Kid, issuerEmail }` plus `batchIndex` when fired from `/sign/batch`.

`revoke` events carry `{ id, reason, causalSignatureId, revokerUserId, revokedAt }`.

## Headers QSign sends

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `User-Agent` | `AEVION-QSign-v2-webhook` |
| `X-QSign-Event` | `sign` or `revoke` |
| `X-QSign-Signature` | 64-char hex HMAC-SHA256 |
| `X-QSign-Webhook-Id` | UUID of the webhook record |
| `X-QSign-Attempt` | `1` (first try), `2` or `3` (retries on 5xx/timeout) |

Treat retries (attempt > 1) as duplicates: dedupe by `data.id` if your consumer is non-idempotent.
