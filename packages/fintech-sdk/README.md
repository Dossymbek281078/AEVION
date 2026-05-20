# @aevion-io/fintech-sdk

TypeScript client for the AEVION fintech ecosystem.

Wraps **six backend modules** with typed methods, shared error handling, a
single auth-aware client, **and standalone webhook signing utilities**
(HMAC-SHA256 + timestamp replay protection + rolling secret rotation).

| Module       | What it does                                                  |
|--------------|---------------------------------------------------------------|
| **QGood**    | Charity campaigns, donations, matching pools                  |
| **QMaskCard**| Privacy-preserving virtual cards (single-use, merchant-locked)|
| **VeilNetX** | Append-only hash-chained settlement ledger                    |
| **Z-Tide**   | Reputation / standing scoring across the ecosystem            |
| **QChainGov**| Governance proposals + votes                                  |
| **QPayNet**  | Wallets, P2P transfers, payment requests, merchant rail       |

> Backend OpenAPI: `GET /api/openapi.json` on your AEVION host.

## Install

```bash
npm install @aevion-io/fintech-sdk
```

Node 18+ required (uses native `fetch`, `AbortSignal.timeout`, and
`globalThis.crypto.subtle`). Also works in modern browsers, Cloudflare
Workers, Deno, and edge runtimes — no native dependencies.

## Quickstart

```ts
import { FintechClient } from "@aevion-io/fintech-sdk";

const client = new FintechClient({
  baseUrl: "https://aevion-production-a70c.up.railway.app",
});

// Anonymous reads
const { campaigns } = await client.qgood.listCampaigns({ status: "active", limit: 10 });
const head = await client.veilnetxLedger.chainHead();
const stats = await client.qpaynet.stats();

// Authed actions
const authed = client.withToken("eyJhbGciOi…");
const wallets = await authed.qpaynet.listWallets();
const tx = await authed.qpaynet.transfer({
  fromWalletId: wallets.wallets[0].id,
  toWalletId: "<recipient-uuid>",
  amountCents: 5000,
  paymentRef: "order_42",   // idempotency key
  description: "Order #42",
});

// Merchant charges use X-Merchant-Key, not Bearer
const charge = await client.qpaynet.merchantCharge(merchantSecret, {
  payerWalletId,
  amountCents: 5000,
  paymentRef: "stripe_evt_abc",
});
// charge.idempotent === true on replay — no double-charge
```

## Authentication

Authenticated endpoints expect a Bearer JWT from `POST /api/auth/login`. Bind
a token by calling `withToken` — it returns a fresh client; the original is
unchanged.

```ts
const authed = client.withToken("eyJhbGciOi…");
```

QPayNet `merchantCharge` is the one exception: it authorizes via
`X-Merchant-Key` header (NOT Bearer). Mint a key with
`mintMerchantKey` and store the full `secret` server-side — it's shown ONCE.

## Webhook signing

AEVION delivers signed webhook events with two headers:

- `X-Aevion-Signature: sha256=<hex hmac-sha256>`
- `X-Aevion-Timestamp: <unix seconds>`

The signed payload is `${timestamp}.${rawBody}`. The SDK ships matching
sender + receiver helpers — use these instead of rolling your own HMAC.

### Verify incoming webhooks

```ts
import { verifyWebhook } from "@aevion-io/fintech-sdk";
import express from "express";

app.post("/webhooks/aevion", express.raw({ type: "*/*" }), async (req, res) => {
  const result = await verifyWebhook({
    signature: req.headers["x-aevion-signature"] as string,
    timestamp: req.headers["x-aevion-timestamp"] as string,
    rawBody: (req.body as Buffer).toString("utf8"),
    secret: process.env.AEVION_WEBHOOK_SECRET!,
    // During a rotation window, accept BOTH new + old secrets:
    previousSecrets: [process.env.AEVION_WEBHOOK_SECRET_OLD ?? ""].filter(Boolean),
  });
  if (!result.ok) return res.status(401).send(result.reason);
  if (result.secretIndex > 0) {
    console.warn("[webhook] verified with rotated secret — finish migration soon");
  }
  // process event…
  res.status(200).end();
});
```

### Sign outgoing webhooks (dev fixtures, partner mocks, bridges)

```ts
import { signWebhookPayload, aevionWebhookHeaders } from "@aevion-io/fintech-sdk";

// Low-level — get signature + timestamp separately
const { signature, timestamp } = await signWebhookPayload({ body, secret });

// High-level — get headers ready for fetch
const headers = await aevionWebhookHeaders({ body, secret });
await fetch(partnerUrl, { method: "POST", headers, body: JSON.stringify(body) });
```

### Replay protection + rotation

- Requests outside a 5-minute window (configurable via `toleranceSec`) are
  rejected. Sync your server's NTP to keep this happy.
- Pass `previousSecrets` during a rotation cutover. The verifier tries the
  current secret first, then each previous one, and reports which matched
  via `secretIndex` (0 = current, 1+ = previous). Log `secretIndex > 0`
  to track when the rotation is safe to finalize.

See the full rotation playbook at `/developers/fintech/troubleshooting`
(Playbook D) on your AEVION host.

## Error handling

Non-2xx responses throw a plain `SDKError` shape (not an `Error` instance):

```ts
import type { SDKError } from "@aevion-io/fintech-sdk";

try {
  await authed.qchaingov.vote(proposalId, { choice: "yes" });
} catch (e) {
  const err = e as SDKError;
  if (err.status === 409 && err.code === "already_voted") {
    // user previously voted on this proposal — surface gracefully
  } else if (err.status === 429 && err.code === "streak_cooldown") {
    // login-streak still in cooldown window
  } else {
    throw e;
  }
}
```

`err.code` mirrors the backend's machine-readable tag (`"auth required"`,
`"invalid_module"`, `"insufficient_balance"`, `"already_voted"`, `"mask_revoked"`,
`"streak_cooldown"`, etc.) — safe to switch on.

## Module method index

### `client.qgood`

- `listCampaigns(opts?)` → `{ campaigns, total }`
- `getCampaign(id)` → `{ campaign, donations }`
- `createCampaign(body)` → `{ id, status: "draft" }`
- `approveCampaign(id)` *(admin)*
- `donate(campaignId, body)` → `{ id, campaignId, amountCents, match }`
- `listMatchingPools()` → `{ pools, total }`
- `createMatchingPool(body)` *(admin)*
- `pauseMatchingPool(id)` / `resumeMatchingPool(id)` *(admin)*
- `stats()` → `QGoodStatsResponse`

### `client.qmaskcard`

- `issueMask(body)` *(auth)*
- `listMasks({ includeRevoked? })` *(auth)*
- `revokeMask(id)` *(auth)*
- `authorize(body)` → idempotent on `(maskId, paymentRef)` *(auth)*
- `listCharges({ maskId? })` *(auth)*
- `stats()`

### `client.veilnetxLedger`

- `appendEntry(body)` *(auth)*
- `listEntries({ module?, fromIdentifier?, limit? })`
- `getEntry(id)` → `{ entry, integrity, recomputedHash }`
- `search(hashPrefix, limit?)` — min 4 hex chars
- `chainHead()` → `{ head, length, tipAt? }`
- `verifyChain()` → `{ verified, brokenAt, length, head }`
- `stats()`

### `client.ztide`

- `emitEvent(body)` *(admin or service-key)*
- `me()` *(auth)*
- `loginStreak()` *(auth, 20h cooldown)*
- `leaderboard(limit?)`
- `rank(userId)`
- `stats()`

### `client.qchaingov`

- `createProposal(body)` *(auth)*
- `listProposals(opts?)` / `getProposal(id)`
- `vote(proposalId, body)` *(auth, 409 on duplicate)*
- `listVotes(proposalId)`
- `openProposal(id)` / `closeProposal(id)` / `execute(id)` *(admin)*
- `stats()`

### `client.qpaynet`

- `health()` / `stats()`
- `listWallets({ status?, currency? })` / `openWallet(body)` *(auth)*
- `getPublicWallet(id)` — no auth, returns label + currency only
- `transfer(body)` — idempotent on `paymentRef` *(auth)*
- `deposit(body)` — sandbox stub *(auth)*
- `listTransactions({ walletId?, kind?, since?, limit? })` *(auth)*
- `createPaymentRequest(body)` / `getPaymentRequest(token)` / `payPaymentRequest(token, body)`
- `mintMerchantKey(body)` — secret returned **ONCE** *(auth, merchant wallet)*
- `listMerchantKeys()` *(auth)*
- `merchantCharge(merchantKeySecret, body)` — X-Merchant-Key header, idempotent on paymentRef

### Webhook signing (standalone)

- `verifyWebhook(opts)` → `{ ok, mode, secretIndex } | { ok: false, reason }`
- `signWebhookPayload(opts)` → `{ signature, timestamp, signedPayload }`
- `aevionWebhookHeaders(opts)` → ready-to-fetch header object

## Configuration

```ts
new FintechClient({
  baseUrl: "https://…",      // required, trailing slash optional
  token: "eyJ…",             // optional Bearer JWT
  fetch: customFetch,        // optional fetch override (tests, Node <18)
  timeoutMs: 10_000,         // optional per-request timeout (default 10000)
});
```

`timeoutMs` uses `AbortSignal.timeout` internally; the request aborts with a
`DOMException` if the server doesn't respond in time.

## License

MIT
