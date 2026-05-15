# @aevion/qpaynet-client

TypeScript client for **AEVION QPayNet** — embedded payment infrastructure for the AEVION ecosystem.

- 🇰🇿 KZT-native (tiin precision, daily/transfer caps, soft-KYC)
- 🔐 HMAC-signed webhooks (`X-Aevion-Event-Id` for partner-side dedup)
- 🔁 Idempotency-Key on every money path
- 🤝 Merchant API keys with scopes (charge / read / refund)
- 🛡 Built-in retry on 429/5xx, configurable timeout
- ⚡ Zero dependencies, isomorphic (Web Crypto + global `fetch` — works in Node 18+, Bun, Deno, browsers)

## Install

```bash
npm install @aevion/qpaynet-client
```

Requires Node 18+, Bun, Deno, or any modern browser (uses global `fetch` + Web Crypto SubtleCrypto). No `@types/node` needed.

## Quick start

### End-user wallet management (Bearer JWT)

```ts
import { QPayNetClient } from "@aevion/qpaynet-client";

const client = new QPayNetClient({
  baseUrl: "https://aevion-production-a70c.up.railway.app",
  token: process.env.AEVION_JWT,
});

// Create wallet with partner metadata
const wallet = await client.wallets.create({
  name: "Main",
  metadata: { merchantOrderId: "ORD-2026-001" },
});

// Top up + transfer with idempotency
await client.deposit({ walletId: wallet.id, amount: 5000 });
await client.transfer(
  { fromWalletId: wallet.id, toWalletId: "...", amount: 1000 },
  { idempotencyKey: "transfer-2026-05-06-001" },
);
```

### Merchant flow (X-API-Key)

```ts
const merchant = new QPayNetClient({
  baseUrl: "...",
  merchantKey: "qpn_live_xxx",   // get from POST /merchant/keys
});

await merchant.merchant.charge(
  { customerWalletId: "...", amount: 1500, description: "Order #ORD-123" },
  { idempotencyKey: "charge-ord-123" },
);
```

### Receiving webhooks

```ts
import { verifyWebhook } from "@aevion/qpaynet-client";
import express from "express";

const app = express();
app.post("/webhooks/aevion",
  express.raw({ type: "application/json" }),    // ⚠ raw body for HMAC
  async (req, res) => {
    const ok = await verifyWebhook({
      secret: process.env.AEVION_WEBHOOK_SECRET!,
      timestamp: req.headers["x-aevion-timestamp"] as string,
      signature: req.headers["x-aevion-signature"] as string,
      rawBody: req.body,
    });
    if (!ok) return res.status(401).send("invalid signature");

    // Dedupe — we may retry up to 5 times with the same event-id
    const eventId = req.headers["x-aevion-event-id"] as string;
    if (await alreadyProcessed(eventId)) {
      return res.json({ received: true });
    }
    await markProcessed(eventId);

    const payload = JSON.parse(req.body.toString());
    // ...handle payment_request.paid, refund_issued, etc...
    res.json({ received: true });
  },
);
```

## Error handling

All API errors throw `QPayNetError` with a stable `code` matching the
server's [error code registry](https://aevion-production-a70c.up.railway.app/api/qpaynet/openapi.json) (see `x-error-codes`):

```ts
import { QPayNetError } from "@aevion/qpaynet-client";

try {
  await client.transfer({ fromWalletId, toWalletId, amount: 99999999 });
} catch (err) {
  if (err instanceof QPayNetError) {
    if (err.code === "transfer_amount_exceeds_max") { /* show cap to user */ }
    if (err.code === "kyc_required") { /* redirect to /kyc */ }
    if (err.code === "rate_limit_exceeded") { /* backoff */ }
  }
}
```

Common codes:
- `validation_failed` — see `err.field` and `err.details.reason`
- `wallet_inactive` — frozen or closed
- `insufficient_balance`
- `kyc_required` — monthly outgoing > threshold
- `idempotency_key_body_mismatch` — same key, different body (409)
- `scope_missing` — merchant key lacks the required scope
- `rate_limit_exceeded` — back off (auto-retried up to `maxRetries`)

## Configuration

```ts
new QPayNetClient({
  baseUrl: "https://...",
  token: "...",                   // OR merchantKey, not both
  merchantKey: "qpn_live_...",
  timeoutMs: 10000,               // per-request, default 10s
  maxRetries: 3,                  // 5xx + 429, default 3
  fetch: customFetch,             // override (tests/proxies)
  userAgent: "MyApp/1.0",
});
```

## API reference

All methods that move money accept an optional `{ idempotencyKey }` second arg.

| Method | Path | Notes |
|---|---|---|
| `client.deposit(body, opts?)` | POST `/deposit` | sandbox top-up |
| `client.withdraw(body, opts?)` | POST `/withdraw` | 0.1% fee |
| `client.transfer(body, opts?)` | POST `/transfer` | atomic, KYC-aware |
| `client.listTransactions(walletId?)` | GET `/transactions` | |
| `client.exportTransactionsCsv(walletId?)` | GET `/transactions.csv` | rate-limited 5/min |
| `client.stats()` | GET `/stats` | public |
| `client.health()` | GET `/health` | pool + stuck delivery counts |
| `client.wallets.create(body)` | POST `/wallets` | metadata up to 4KB |
| `client.wallets.list()` | GET `/wallets` | |
| `client.wallets.get(id)` | GET `/wallets/:id` | |
| `client.wallets.lookup(id)` | GET `/wallets/:id/public` | no auth, no balance |
| `client.wallets.update(id, body)` | PATCH `/wallets/:id` | name + metadata |
| `client.wallets.close(id)` | POST `/wallets/:id/close` | terminal, requires zero balance |
| `client.wallets.depositCheckout(body)` | POST `/deposit/checkout` | Stripe Checkout |
| `client.merchant.createKey(body)` | POST `/merchant/keys` | scopes: charge,read,refund |
| `client.merchant.listKeys()` | GET `/merchant/keys` | |
| `client.merchant.revokeKey(id)` | DELETE `/merchant/keys/:id` | |
| `client.merchant.charge(body, opts?)` | POST `/merchant/charge` | requires `charge` scope |
| `client.requests.create(body)` | POST `/requests` | returns `notifySecret` once |
| `client.requests.list()` | GET `/requests` | |
| `client.requests.getPublic(token)` | GET `/requests/:token` | no auth |
| `client.requests.pay(token, body, opts?)` | POST `/requests/:token/pay` | fires HMAC webhook |
| `client.requests.cancel(id)` | DELETE `/requests/:id` | |
| `client.webhooks.subscribe(body)` | POST `/webhook-subs` | |
| `client.webhooks.list()` | GET `/webhook-subs` | |
| `client.webhooks.unsubscribe(id)` | DELETE `/webhook-subs/:id` | |
| `client.webhooks.test(body)` | POST `/webhooks/test` | smoke-test before going live |

## Webhook contract

We POST JSON with the following headers. Verify them in this order:

1. `X-Aevion-Timestamp` — Unix seconds. Reject if drift > 5min (replay protection).
2. `X-Aevion-Signature` — `sha256=<hex(hmac(secret, "${timestamp}.${rawBody}"))>`. Constant-time compare.
3. `X-Aevion-Event-Id` — stable across all retries of a logical event. Use as your dedup key.
4. `X-Aevion-Event` — event type (e.g. `payment_request.paid`).

We retry **5 attempts** with exp-backoff: 30s → 2m → 10m → 30m → 2h. After
exhaustion we dead-letter (your endpoint will be visible in our `/admin/webhook-deliveries`).

The `verifyWebhook()` helper handles 1+2 above. Dedup (3) is on you — partners
typically do `INSERT ON CONFLICT DO NOTHING` keyed on `event-id`.

## License

Apache-2.0
