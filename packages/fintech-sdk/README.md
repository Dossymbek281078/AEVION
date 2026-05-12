# @aevion/fintech-sdk

TypeScript client for the AEVION fintech ecosystem.

Wraps five backend modules with typed methods, shared error handling, and a
single auth-aware client:

| Module       | What it does                                                  |
|--------------|---------------------------------------------------------------|
| **QGood**    | Charity campaigns, donations, matching pools                  |
| **QMaskCard**| Privacy-preserving virtual cards (single-use, merchant-locked)|
| **VeilNetX** | Append-only privacy-preserving settlement ledger              |
| **Z-Tide**   | Reputation / standing scoring across the ecosystem            |
| **QChainGov**| Governance proposals + votes                                  |

> Backend OpenAPI: `GET /api/openapi.json` on your AEVION host.

## Install

```bash
npm install @aevion/fintech-sdk
```

Node 18+ required (uses native `fetch` + `AbortSignal.timeout`).

## Quickstart

```ts
import { FintechClient } from "@aevion/fintech-sdk";

const client = new FintechClient({
  baseUrl: "https://aevion-production-a70c.up.railway.app",
});

const { campaigns } = await client.qgood.listCampaigns({
  status: "active",
  limit: 10,
});

const head = await client.veilnetxLedger.chainHead();
// → { head: "0000...", length: 1234, tipAt: "2026-05-10T..." }

const verified = await client.veilnetxLedger.verifyChain();
// → { verified: true, brokenAt: null, length: 1234, head: "..." }
```

## Authentication

Authenticated endpoints (anything that mutates user state, plus `/me` reads)
expect a Bearer JWT obtained from `/api/auth/login`. Bind a token by calling
`withToken` — it returns a fresh client; the original is unchanged.

```ts
const authed = client.withToken("eyJhbGciOi…");
const me = await authed.ztide.me();
const masks = await authed.qmaskcard.listMasks();
```

## Error handling

Non-2xx responses throw a plain `SDKError` shape (not an `Error` instance):

```ts
import type { SDKError } from "@aevion/fintech-sdk";

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

- `issueMask(body)` → `IssueMaskResponse` *(auth)*
- `listMasks({ includeRevoked? })` *(auth)*
- `revokeMask(id)` *(auth)*
- `authorize(body)` → `AuthorizedChargeResponse` *(auth)*
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
