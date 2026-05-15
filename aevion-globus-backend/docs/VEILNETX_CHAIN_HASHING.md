# VeilNetX chain hashing — invariants for any code that emits entries

> This file documents the **canonical hash payload** for the VeilNetX
> settlement ledger. Any code that writes or recomputes a `prevHash` /
> `entryHash` MUST follow these rules byte-for-byte or chain integrity
> breaks silently.

## TL;DR

```ts
import { canonicalJson } from "../lib/ecosystemEvents";

const metaJson = canonicalJson(input.meta ?? {});
const payload  = [prevHash, module, kind, blindedFrom, blindedTo,
                  amountCents, currency, metaJson, createdAt].join("|");
const entryHash = sha256(payload);
```

The single non-obvious part is **`metaJson`**: it MUST come from
`canonicalJson()` (keys sorted recursively), not `JSON.stringify()`.

## Why canonical JSON

Postgres `JSONB` reorders object keys on storage — typically alphabetical,
but the exact internal order is an implementation detail. The original
write-time order is lost. So if the insert-time hash is computed over
`JSON.stringify({txId, walletId, feeKzt})` but the verify-time hash reads
the same row back through JSONB and gets `{txId, feeKzt, walletId}` →
the two SHA-256 inputs differ → `chain/verify` reports `verified=false`
with `brokenAt=<first multi-key meta row>`.

This was found on prod 2026-05-12 by `scripts/veilnetx-chain-doctor.js`,
which permuted meta keys until it reproduced the stored hash for a
broken row. The order in the stored hash matched the **emit-side input
order**, not the JSONB-read order — confirming the diagnosis.

Using `canonicalJson()` on both sides makes the bytes identical
regardless of which side reads through JSONB.

## Where this applies

Every place that participates in the chain hash:

| File | Role | Must use canonicalJson |
|---|---|---|
| `src/lib/ecosystemEvents.ts` | Library emit (qpaynet, qmaskcard, bureau, qgood, …) | ✅ since `8c93bdc1` |
| `src/routes/veilnetxLedger.ts` | HTTP POST `/entries` insert | **pending** (cross-zone request) |
| `src/routes/veilnetxLedger.ts` | GET `/chain/verify` recompute | **pending** (cross-zone request) |
| `scripts/rebuild-veilnetx-chain.js` | One-shot historical rewrite | ✅ since `6d6e01bc` |
| `scripts/veilnetx-chain-doctor.js` | Per-entry diagnostic | ✅ since `79bc082e` |

Any new module that calls `emitVeilNetXEntry({ meta: ... })` inherits
canonicalization automatically — `lib/ecosystemEvents.ts` handles it
for you. **Do not** roll your own hash computation.

## What does NOT enter the hash payload

- `id` (random per insert)
- `sequenceNumber` (BIGSERIAL — assigned by DB after insert)
- The literal bytes stored in JSONB (only what `canonicalJson()` produces
  goes into the hash; JSONB is a storage detail)

## Recovering from a broken chain

If `/api/veilnetx-ledger/chain/verify` returns `verified=false`:

1. **Diagnose:** `npm run veilnetx:doctor` (lists the first broken row
   and stored vs. expected hash).
2. **Preview:** `npm run veilnetx:rebuild-dry` (shows what the rewrite
   would touch, no UPDATE).
3. **Fix:** `ALLOW_CHAIN_REBUILD=1 npm run veilnetx:rebuild` (in dev),
   or `ALLOW_CHAIN_REBUILD=1 ALLOW_CHAIN_REBUILD_PROD=1 npm run veilnetx:rebuild`
   (on Railway shell).

The rebuild holds the same `pg_advisory_xact_lock` the live emitters use,
so concurrent writes queue behind it instead of racing.

## Why not switch to fully deterministic storage (CBOR, etc.)?

A future option, but the JSONB column has a lot of ergonomic value
(operators can `SELECT meta->>'txId'` in psql). Canonicalizing only the
hash input is the minimal change that preserves both.
