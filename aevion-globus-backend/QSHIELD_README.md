# AEVION Quantum Shield

Production-grade Shamir Secret Sharing (2-of-3) over a deterministic Ed25519 key with per-shard HMAC-SHA256 authentication, optional distributed-by-default policy, idempotent reconstruction, and a public verification surface.

Mounted at `/api/quantum-shield`. Independent of `/api/qsign/*` and `/api/pipeline/*` but inter-operates with them (pipeline auto-creates Shield records during protect; QSign v2 `/sign` opt-in links a Shield record via `body.shield = true`).

---

## Endpoints

| Method | Path | Auth | What |
|---|---|---|---|
| `GET` | `/health` | — | Liveness, total/active/legacy/distributed counters |
| `GET` | `/openapi.json` | — | OpenAPI 3.0 spec |
| `GET` | `/stats` | — | Aggregate stats |
| `POST` | `/` (or `/create`) | optional bearer | Create record (sets `ownerUserId` if bearer present) |
| `GET` | `/` (or `/records`) | optional bearer | Paginated list (`?mine=1` filters to caller) |
| `GET` | `/:id/public` | — | Shareable JSON (no shards leaked) |
| `GET` | `/:id/witness` | — | Witness shard + CID (only `distributed_v2` records) |
| `GET` | `/:id` | — | Full record (includes server-held shards) |
| `POST` | `/:id/reconstruct` | — | Lagrange + Ed25519 probe-sign verify; honors `Idempotency-Key` |
| `POST` | `/:id/verify` | — | Re-checks per-shard HMACs (does NOT reconstruct the key) |
| `DELETE` | `/:id` | bearer (owner OR admin) | Soft-remove |

Rate limits (per IP): create `20/min`, verify/reconstruct `60-30/min`.

---

## Distribution policies

```
legacy_all_local   → all 3 shards in QuantumShield.shards (server can reconstruct alone)
distributed_v2     → shard 1 returned ONCE in create response (author offline)
                     shard 2 in QuantumShield.shards
                     shard 3 in QuantumShield.shards + QuantumShieldDistribution
                       with content-addressed witnessCid (RFC4648 base32 CID v1)
                     ⇒ server alone holds 2-of-3 (sufficient by threshold) but
                       only after the author or a third party re-supplies their
                       copy in /reconstruct; workflows that demand "no-trust"
                       reconstruction can require the offline shard
```

---

## Curl walkthrough

```bash
# 0 — base
BASE="http://127.0.0.1:4001/api/quantum-shield"
TOKEN="<bearer JWT from /api/auth/login>"

# 1 — health
curl -s $BASE/health | jq

# 2 — create distributed_v2 record
curl -s -X POST $BASE \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "objectTitle": "My masterpiece",
    "payload": {"hello": "AEVION"},
    "distribution": "distributed_v2"
  }' | jq
# → { "id": "qs-...", "shards": [3 items], "witnessCid": "b...", "distribution": "distributed_v2", ... }
# SAVE the response: shard 1 will not be retrievable from server again.

# 3 — public verify card (no shards leaked)
curl -s $BASE/qs-XXXXXX/public | jq

# 4 — public witness shard (only distributed_v2)
curl -s $BASE/qs-XXXXXX/witness | jq

# 5 — reconstruct with 2 of 3 shards (Idempotency-Key prevents counter inflation on retry)
curl -s -X POST $BASE/qs-XXXXXX/reconstruct \
  -H "Idempotency-Key: my-unique-attempt-001" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --argjson s "$(cat shards.json)" '{shards: $s}')" | jq
# → { "valid": true, "reconstructed": true, ... }
# Replay the same Idempotency-Key → identical body, no verifiedCount bump.

# 6 — list "mine" (paginated)
curl -s "$BASE?mine=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## Sequence diagram — create → reconstruct (distributed_v2)

```
Author          AEVION /api/quantum-shield          QuantumShield DB        QuantumShieldDistribution
  │                       │                                 │                          │
  │ POST / {distribution: │                                 │                          │
  │   distributed_v2 }    │                                 │                          │
  ├──────────────────────▶│                                 │                          │
  │                       │ generate Ed25519 keypair        │                          │
  │                       │ split → 3 authenticated shards  │                          │
  │                       │ persist shards [2,3]            │                          │
  │                       ├────────────────────────────────▶│                          │
  │                       │ persist shard 3 + witnessCid    │                          │
  │                       ├────────────────────────────────────────────────────────────▶│
  │                       │                                 │                          │
  │ ◀── 201 + shards[1,2,3] + witnessCid ───┤                          │
  │ (saves shard 1 offline; server forgets) │                          │
  │                       │                                 │                          │
  │                       │                                 │                          │
  │ ── time passes ──     │                                 │                          │
  │                       │                                 │                          │
  │ POST /:id/reconstruct │                                 │                          │
  │  with shards [1,2]    │                                 │                          │
  ├──────────────────────▶│                                 │                          │
  │                       │ Lagrange interpolate            │                          │
  │                       │ probe-sign with reconstructed   │                          │
  │                       │ key, verify against publicKey   │                          │
  │                       │ bump verifiedCount              │                          │
  │                       ├────────────────────────────────▶│                          │
  │ ◀── 200 valid: true ──┤                                 │                          │
  │                       │                                 │                          │

Public verifier
  │                       │                                 │                          │
  │ GET /:id/witness      │                                 │                          │
  ├──────────────────────▶│ ──────────────────────────────────────────────────────────▶│
  │ ◀── shard 3 + CID ────┤                                                            │
  │ (combines with author shard 1 to verify independently of AEVION)                   │
```

---

## Idempotency-Key on `/reconstruct`

Header: `Idempotency-Key: <8-128 chars, [a-zA-Z0-9._:-]>`

Same `(shieldId, key)` pair returns the cached verdict and skips the `verifiedCount` bump. Different payload shapes under the same key are NOT validated — the verdict is whatever the first call decided. Use a fresh key for a logically-different attempt.

Without the header, every call re-runs Lagrange and bumps the counter.

---

## QSign v2 integration

`POST /api/qsign/v2/sign` accepts `body.shield = true`. On success:

```json
{
  "id": "<qsign signature id>",
  "qshield": {
    "id": "qs-...",
    "publicKey": "<hex>",
    "threshold": 2,
    "totalShards": 3,
    "createdAt": "<iso>"
  },
  "shieldError": null
}
```

If shield creation fails, `shieldError` carries the reason and the signature still succeeds (graceful degradation).

---

## Pipeline integration

`POST /api/pipeline/protect` automatically creates a `distributed_v2` Shield record and stores its `shieldId` on the `IPCertificate`. `GET /api/pipeline/verify/:id` surfaces `integrity.shieldId` so consumers can deep-link into `/quantum-shield/[id]`.

---

## Security model

- HMAC versioning — older shards still verify after a key rotation (`getShardHmacSecret(version)`).
- Public projection (`/:id/public`) carries `publicKey` + `signature` + status — never any shard.
- Reconstruction bookkeeping is best-effort and idempotent on retry.
- `Reserved IDs` guard prevents collisions: `health stats records verify reconstruct create witness openapi.json`.
- `RESERVED_IDS` is enforced before every `:id` handler.

---

## Smoke

```
node aevion-globus-backend/scripts/qshield-smoke.js
```

11+ steps: health → register → create → list `?mine=1` → public (no shard leak) → reconstruct 2/3 → reject 1/3 → idempotency replay (no double-bump) → distributed_v2 create + public + witness + persisted-shape check → delete + 404. Exits non-zero on first failure.
