# @aevion/qcoreai-client

TypeScript client for [AEVION QCoreAI](https://aevion.io/qcoreai) — a multi-agent LLM pipeline with sequential / parallel / debate strategies, mid-run human guidance, hard cost caps, run tagging and signed webhooks.

Single-file SDK (~300 LOC). No runtime deps. Works in Node 18+ and modern browsers / Edge.

```bash
npm install @aevion/qcoreai-client
```

## Quick start

```ts
import { QCoreClient } from "@aevion/qcoreai-client";

const client = new QCoreClient({
  baseUrl: "https://api.aevion.io",
  token: process.env.AEVION_TOKEN, // optional, required for owner endpoints
});

// 1. Sync — collect the whole stream into a final answer.
const result = await client.runSync({
  input: "Compare Postgres vs DynamoDB for an event-sourced ledger.",
  strategy: "sequential", // | "parallel" | "debate"
  maxCostUsd: 0.10,
});

console.log(result.finalContent);
console.log("Cost:", result.totalCostUsd, "Run:", result.runId);
```

## Streaming

```ts
for await (const evt of client.runStream({
  input: "Plan a 30-day onboarding for a B2B SaaS",
  strategy: "debate",
})) {
  if (evt.type === "agent_chunk") process.stdout.write(evt.delta);
  if (evt.type === "run_complete") {
    console.log("\n[done]", evt.totalCostUsd, evt.totalDurationMs + "ms");
  }
}
```

Every event matches the server's `OrchestratorEvent` union — see `src/index.ts` for the exhaustive type. Common types include:

- `session` `{ sessionId, runId }` — emitted first; capture for downstream API calls
- `agent_start` `{ role, stage, instance?, provider, model }`
- `agent_chunk` `{ role, stage, delta }` — token deltas
- `agent_end` `{ role, stage, tokensIn, tokensOut, durationMs, costUsd, content }`
- `verdict` `{ approved, feedback }` — sequential strategy critic verdict
- `guidance_applied` `{ nextRole, nextStage, text }` — mid-run user steer landed
- `cost_cap_hit` `{ spentUsd, capUsd }` — hard cap crossed, run finalised early
- `run_complete` `{ finalContent, status, totalCostUsd, totalDurationMs }`
- `error` `{ message }`

## Refining a run

```ts
// Apply a one-pass surgical edit on top of an already-finished run.
await client.refine(runId, "Add a TL;DR section at the top.");
```

## Tags + search

```ts
await client.setTags(runId, ["investor-deck", "ledger-research"]);

// Substring search across input/finalContent/session.title/tags.
const hits = await client.search("ledger");
hits.forEach((h) => console.log(h.matched, h.preview));

// Top tags ranked by count — drives the sidebar chip strip.
const top = await client.topTags(15);
```

## Daily timeseries (cost forecasting)

```ts
const series = await client.timeseries(30);
// series: [{ date: "2026-04-22", runs: 4, costUsd: 0.123 }, ...]
```

## Per-user webhooks

Configure a personal webhook that receives `run.completed` events with HMAC signatures.

```ts
await client.setUserWebhook(
  "https://your-receiver.example.com/qcore",
  "any-strong-shared-secret"
);
```

The server POSTs a JSON payload to that URL with two headers:
- `X-QCore-Signature: <hex HMAC-SHA256 of body using your secret>`
- `X-QCore-Origin: env | user`

Verify it on your receiver:

```ts
import { verifyWebhookHmac } from "@aevion/qcoreai-client";
import express from "express";

const app = express();

app.post("/qcore-webhook", express.raw({ type: "*/*" }), async (req, res) => {
  const ok = await verifyWebhookHmac(
    req.body,
    req.headers["x-qcore-signature"],
    process.env.QCORE_WEBHOOK_SECRET!
  );
  if (!ok) return res.status(401).end();
  const evt = JSON.parse(req.body.toString("utf8"));
  console.log("run.completed", evt.runId, evt.status, evt.totalCostUsd);
  res.json({ ok: true });
});
```

`verifyWebhookHmac` uses Web Crypto SubtleCrypto + constant-time comparison. Works in Node 18+, Cloudflare Workers, Vercel Edge.

## API reference

| Method | HTTP | Notes |
|---|---|---|
| `runSync(opts)` | `POST /api/qcoreai/multi-agent` | Buffers stream into `RunSyncResult` |
| `runStream(opts)` | `POST /api/qcoreai/multi-agent` | Async generator of `OrchestratorEvent` |
| `refine(runId, instruction, opts?)` | `POST /api/qcoreai/runs/:id/refine` | One-pass surgical edit |
| `setTags(runId, tags)` | `PATCH /api/qcoreai/runs/:id/tags` | Owner-only, normalized 16x32 |
| `search(query, limit?)` | `GET /api/qcoreai/search?q=` | Substring + tag match |
| `topTags(limit?)` | `GET /api/qcoreai/tags?limit=` | Ranked by usage |
| `timeseries(days?)` | `GET /api/qcoreai/analytics/timeseries?days=` | Daily buckets |
| `setUserWebhook(url, secret?)` | `PUT /api/qcoreai/me/webhook` | Auth required |
| `deleteUserWebhook()` | `DELETE /api/qcoreai/me/webhook` | Auth required |
| `verifyWebhookHmac(body, sig, secret)` | — | Receiver-side utility |

## Browser usage

The client uses standard `fetch` and `ReadableStream` — works in browsers without polyfills. For SSE you can either let the SDK buffer (use `runSync`) or iterate (`runStream`) — same code in Node and browsers.

## Auth

Owner-scoped endpoints (sessions list, run rename/delete, tags, webhook config, search results scoped to your user) require a JWT in `Authorization: Bearer <token>`. Pass the token at construction time or rotate via `setToken`.

The `runSync` / `runStream` and public `search` (anonymous-only results) work without auth — useful for embedding QCoreAI in unauthenticated public landing pages.

## License

Apache-2.0 © AEVION
