# QSign v2 — Unique Digital Signature Platform

Flagship AEVION signature module: RFC 8785 canonical JSON, HMAC-SHA256 +
Ed25519 hybrid, persisted signatures, public shareable verification, key
rotation with overlap window, revocation ledger, and geo-anchoring.

Independent of v1 (`/api/qsign/*`), `pipeline.ts`, and `planetCompliance.ts`.

---

## 1. Endpoints

Mounted at `/api/qsign/v2` (see `src/index.ts`). Legacy v1 stays at
`/api/qsign/*`.

| Method | Path                              | Auth    | Rate limit | Purpose                                       |
|--------|-----------------------------------|---------|------------|-----------------------------------------------|
| GET    | `/health`                         | —       | —          | Liveness + active kids                        |
| GET    | `/stats`                          | —       | —          | Public aggregate metrics (totals, last 24h, countries, keys) |
| GET    | `/recent?limit=N`                 | —       | —          | Sanitized recent signatures feed (1..20 items) |
| POST   | `/sign`                           | Bearer  | 60/min/IP  | Create + persist a signature (HMAC + Ed25519 + Dilithium preview slot) |
| POST   | `/sign/batch`                     | Bearer  | 60/min/IP  | Bulk sign up to 50 payloads in one call       |
| POST   | `/verify`                         | —       | —          | Stateless verify of `{payload, sig, ...}` (optional `signatureDilithium` round-trip) |
| GET    | `/verify/:id`                     | —       | —          | DB-backed verify by signature id              |
| GET    | `/:id/public`                     | —       | —          | Public JSON for shareable verify page         |
| GET    | `/:id/pdf`                        | —       | —          | Self-contained PDF stamp with QR (`?accent`, `?title`, `?subtitle`, `?download=1`) |
| POST   | `/revoke/:id`                     | Bearer  | 10/min/IP  | Revoke (issuer or admin); optional causal link |
| GET    | `/keys`                           | —       | —          | JWKS-like key list (no secrets)               |
| GET    | `/keys/:kid`                      | —       | —          | Single key detail                             |
| POST   | `/keys/rotate`                    | Admin   | 5/min/IP   | Rotate active key; old → retired              |
| GET    | `/audit?event&limit&offset`       | Bearer  | —          | Per-user paginated event log (sign + revoke unioned) |
| GET    | `/webhooks`                       | Bearer  | —          | List my webhooks                              |
| POST   | `/webhooks`                       | Bearer  | —          | Create webhook (returns one-time secret)      |
| DELETE | `/webhooks/:id`                   | Bearer  | —          | Delete one of my webhooks                     |

Admin role: set `role='admin'` on the `AEVIONUser` row; the JWT carries
`role` after next login.

---

## 2. Canonicalization

RFC 8785 (JCS). Implemented in-house at `src/lib/qsignV2/canonicalize.ts`
(npm `canonicalize@3` is ESM-only, incompatible with this CJS backend).

- Object keys sorted lexicographically by UTF-16 code units.
- No whitespace.
- Nested values normalized recursively.
- `undefined`, `NaN`, `Infinity`, functions, symbols, BigInt → hard error.
- Numbers formatted per ECMA-262 `Number.prototype.toString` (matches
  native `JSON.stringify`).

The frontend mirrors this algorithm exactly
(`frontend/src/app/qsign/page.tsx` + the verify page) so the live preview
matches the server's signed canonical form bit-for-bit.

---

## 3. Environment variables

| Var                            | Required  | Purpose                                                   |
|--------------------------------|-----------|-----------------------------------------------------------|
| `DATABASE_URL`                 | yes       | Postgres; tables bootstrapped via `ensureQSignV2Tables`.  |
| `AUTH_JWT_SECRET`              | yes       | JWT signing secret for auth routes.                       |
| `QSIGN_HMAC_V1_SECRET`         | prod      | Raw HMAC secret for default key `qsign-hmac-v1`.          |
| `QSIGN_ED25519_V1_PRIVATE`     | prod      | 64-hex Ed25519 seed for default key `qsign-ed25519-v1`.   |
| `QSIGN_ED25519_V1_PUBLIC`      | optional  | 64-hex Ed25519 public key (derived from seed if absent).  |

When a rotated key `kid = qsign-hmac-vN` is created, its `secretRef` defaults
to `QSIGN_HMAC_QSIGN_HMAC_VN_SECRET` (upper-cased kid). Override via
`body.secretRef` at rotation time to point to a different env name.

In dev, missing HMAC/Ed25519 env vars → ephemeral in-process keys with a
console warning. In `NODE_ENV=production` the backend refuses to start
signing without explicit secrets.

Generate a fresh Ed25519 seed:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. Quick curl walkthrough

```bash
BASE=http://127.0.0.1:4001

# — health —
curl -s $BASE/api/qsign/v2/health | jq

# — register + login —
curl -s -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@aevion.com","password":"secret123","name":"Alice"}'
TOKEN=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@aevion.com","password":"secret123"}' | jq -r .token)

# — sign a payload —
SIG=$(curl -s -X POST $BASE/api/qsign/v2/sign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"hello":"AEVION","ts":1714000000}}')
echo "$SIG" | jq
ID=$(echo "$SIG" | jq -r .id)

# — stateless verify (recomputes canonical + HMAC + Ed25519) —
curl -s -X POST $BASE/api/qsign/v2/verify \
  -H "Content-Type: application/json" \
  -d "{
    \"payload\": {\"hello\":\"AEVION\",\"ts\":1714000000},
    \"hmacKid\": $(echo "$SIG" | jq .hmac.kid),
    \"signatureHmac\": $(echo "$SIG" | jq .hmac.signature),
    \"ed25519Kid\": $(echo "$SIG" | jq .ed25519.kid),
    \"signatureEd25519\": $(echo "$SIG" | jq .ed25519.signature)
  }" | jq

# — DB-backed verify by id (includes revocation status) —
curl -s $BASE/api/qsign/v2/verify/$ID | jq

# — public shareable view (feeds SSR /qsign/verify/[id] page) —
curl -s $BASE/api/qsign/v2/$ID/public | jq

# — revoke (issuer only, unless admin) —
curl -s -X POST $BASE/api/qsign/v2/revoke/$ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"superseded by v2 payload"}' | jq

# — key registry (no secret material exposed) —
curl -s $BASE/api/qsign/v2/keys | jq
```

With GPS anchor (client-provided coords take priority over IP lookup):

```bash
curl -s -X POST $BASE/api/qsign/v2/sign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {"claim":"signed from field"},
    "gps": {"lat": 43.238949, "lng": 76.889709}
  }' | jq
```

---

## 5. Key rotation

Rotation demotes the currently-active key for the algorithm to `retired`
(still valid for verifying historical signatures forever) and creates a
new `active` row.

```bash
# — HMAC rotation; secret is read from env[secretRef] at sign time —
export QSIGN_HMAC_QSIGN_HMAC_V2_SECRET="$(openssl rand -hex 32)"
curl -s -X POST $BASE/api/qsign/v2/keys/rotate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"algo":"HMAC-SHA256","notes":"quarterly rotation"}' | jq

# — Ed25519 rotation; supply publicKey OR set env seed —
SEED=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
PUB=$(node -e "const c=require('crypto');const k=c.createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(process.argv[1],'hex')]),format:'der',type:'pkcs8'});const der=c.createPublicKey(k).export({format:'der',type:'spki'});console.log(der.slice(-32).toString('hex'))" $SEED)
export QSIGN_ED25519_QSIGN_ED25519_V2_PRIVATE="$SEED"
curl -s -X POST $BASE/api/qsign/v2/keys/rotate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"algo\":\"Ed25519\",\"publicKey\":\"$PUB\",\"notes\":\"quarterly rotation\"}" | jq
```

Overlap-window guarantee: once a signature is created, the kid it
references stays usable for verification regardless of subsequent
rotations. Retired keys are never deleted.

---

## 6. Revocation semantics

- Only the original issuer (or an admin) may revoke.
- Revocation is immutable — re-revoking returns `409 Conflict` with the
  existing record.
- The revoked signature stays cryptographically valid (its hash and
  signatures never change), but `valid=true` flips to `false` on every
  verify endpoint and the public page shows a revocation banner.
- Optional `causalSignatureId` links a revocation to the superseding
  signature (must exist and differ from the revoked id).

---

## 6a. Public metrics — `/stats` and `/recent`

Two unauthenticated endpoints power the Studio's live metrics bar and the
public recent-signatures feed:

```bash
curl -s $BASE/api/qsign/v2/stats | jq
# {
#   "signatures": { "total": 1423, "active": 1401, "revoked": 22, "last24h": 37 },
#   "issuers":    { "unique": 183 },
#   "geo":        { "uniqueCountries": 24, "topCountries": [...] },
#   "keys":       { "HMAC-SHA256": {"active":1,"retired":2}, "Ed25519": {...} },
#   "asOf":       "2026-04-23T17:20:11.452Z"
# }

curl -s "$BASE/api/qsign/v2/recent?limit=5" | jq
# {
#   "items": [
#     { "id": "...", "algoVersion": "qsign-v2.0", "hmacKid": "qsign-hmac-v1",
#       "ed25519Kid": "qsign-ed25519-v1", "createdAt": "...", "revoked": false,
#       "country": "KZ", "publicUrl": "/qsign/verify/..." }
#   ], "total": 5, "limit": 5
# }
```

Privacy contract: `/recent` never returns payloads, signatures, canonical
forms, hashes, issuer emails, or user ids — only coarse `country`, creation
time, and the id needed to open the public verify page.

---

## 6b. Dilithium preview slot (post-quantum reservation)

Every signature ships with a `dilithium` block in the response that
reserves the API surface for ML-DSA-65 post-quantum signatures. **It is
NOT a real PQ signature in v2.0** — the `digest` field is a deterministic
SHA-512 fingerprint of `canonical || kid`, which clients can use to
round-trip-verify the slot was emitted at sign time. v2.1 will replace
`digest` with `signature` + add `publicKey`, leaving the same JSON shape.

```json
{
  "dilithium": {
    "algo": "ML-DSA-65",
    "kid": "qsign-dilithium-mldsa65-preview-v1",
    "mode": "preview",
    "digest": "<128 hex chars — sha512(canonical||kid)>",
    "valid": true,
    "note": "Preview slot reserved for ML-DSA-65 (Dilithium-3) post-quantum signatures..."
  }
}
```

Pass `signatureDilithium` to `POST /verify` to assert the digest
round-trips bit-for-bit (the response will include `dilithium.valid`).

---

## 6c. Bulk signing — `/sign/batch`

Sign up to 50 payloads in one auth round trip. Same active kids for every
item. Returns 207 Multi-Status when some fail; 201 when all succeed.

```bash
curl -s -X POST $BASE/api/qsign/v2/sign/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "hello": "AEVION 1" },
      { "payload": { "hello": "AEVION 2" }, "gps": { "lat": 43.2, "lng": 76.9 } },
      { "hello": "AEVION 3" }
    ]
  }' | jq
# {
#   "total": 3, "succeeded": 3, "failed": 0,
#   "hmacKid": "qsign-hmac-v1", "ed25519Kid": "qsign-ed25519-v1",
#   "results": [{"ok":true,"id":"…"}, …]
# }
```

Items can be raw payloads OR `{ payload, gps? }` envelopes (mixable in
the same array).

---

## 6d. Audit log — `/audit`

Per-user paginated event log. Returns sign + revoke events touching the
caller, ordered by event time DESC. Use for compliance export and
customer-facing activity views.

```bash
curl -s "$BASE/api/qsign/v2/audit?limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN" | jq

# Filter to revokes only:
curl -s "$BASE/api/qsign/v2/audit?event=revoke&limit=50" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Event shape:

```json
{
  "event": "sign" | "revoke",
  "signatureId": "…",
  "revocationId": null | "…",
  "at": "2026-04-28T12:00:00.000Z",
  "hmacKid": "qsign-hmac-v1",
  "ed25519Kid": "qsign-ed25519-v1",
  "payloadHash": "…",
  "country": "KZ",
  "reason": null | "…",
  "causalSignatureId": null | "…",
  "revokerUserId": null | "…",
  "publicUrl": "/qsign/verify/…"
}
```

---

## 6e. Webhooks — `/webhooks`

Per-user HTTP callbacks fired on `sign` + `revoke` events. Quota: 10
webhooks per user. Body of every delivery is HMAC-SHA256 signed with the
per-webhook secret; receivers verify the `X-QSign-Signature` header.

```bash
# Create — secret is shown ONCE
curl -s -X POST $BASE/api/qsign/v2/webhooks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-app.example.com/qsign","events":["sign","revoke"]}' | jq
# { "id": "…", "url": "…", "events": ["sign","revoke"], "active": true,
#   "secret": "<save this>", "notice": "Save the secret — shown ONCE." }

# List
curl -s $BASE/api/qsign/v2/webhooks -H "Authorization: Bearer $TOKEN" | jq

# Delete
curl -s -X DELETE $BASE/api/qsign/v2/webhooks/<id> \
  -H "Authorization: Bearer $TOKEN" | jq
```

Receiver-side verification (Node):

```js
const expected = crypto
  .createHmac("sha256", WEBHOOK_SECRET)
  .update(rawBody, "utf8")
  .digest("hex");
const ok = crypto.timingSafeEqual(
  Buffer.from(expected, "hex"),
  Buffer.from(req.headers["x-qsign-signature"], "hex"),
);
```

---

## 6f. Rate-limit response headers

`/sign`, `/sign/batch`, `/revoke`, and `/keys/rotate` are guarded by
`express-rate-limit` with `standardHeaders: true`. Every response
includes:

```
RateLimit-Limit:     60
RateLimit-Remaining: 59
RateLimit-Reset:     53
```

(`Reset` is seconds until the window resets, not a Unix timestamp.) The
Studio reads these on every sign and surfaces a "X/60 left · resets in
Ns" chip — see `frontend/src/app/qsign/page.tsx`.

---

## 7. Frontend surfaces

- `/qsign` — Studio: sign + stateless verify, live canonical preview,
  SHA-256 hash, GPS opt-in, dual signatures + Ed25519 public key,
  Dilithium preview row, sign rate-limit chip, "Hash a file" drag-in,
  webhook management card.
- `/qsign/verify/[id]` — SSR public page: status banner, QR, OG metadata,
  payload, per-algo validity, issuer, geo.
- `/qsign/keys` — Key registry browser: timeline per algorithm, active
  highlighted, Ed25519 public keys copyable, rotation docs, admin
  rotation form.
- `/qsign/embed` — embeddable verify badge + sign-button widgets for
  partner sites; postMessage handshake for cross-origin sign flows.

---

## 8. Smoke tests

Run the backend first (`npm run dev`), then in another shell:

```bash
cd aevion-globus-backend
node scripts/qsign-v2-smoke.js
# optional:
BASE=http://127.0.0.1:4001 \
EMAIL=smoke@aevion.com PASSWORD=secret123 \
node scripts/qsign-v2-smoke.js
```

The script walks health → register/login → sign → stateless verify →
DB verify → public view → revoke, and prints PASS/FAIL per step.

---

## 9. Mandatory untouched zones (concurrent feat/qright-v2 session)

- `src/routes/pipeline.ts` — qright-v2 owns it.
- `src/routes/planetCompliance.ts` — uses `QSIGN_SECRET` for snapshots,
  unrelated contour.
- `src/routes/qsign.ts` — legacy v1, still mounted.
- `prisma/migrations/*` — deploy uses `prisma db push`, migration folder
  is historical.
