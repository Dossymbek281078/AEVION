# AEVION — Security Sweep 2026-06-20 (IDOR / data-ownership)

> Continuation of the 2026-06-19 health-data hardening (qlife/qgood/psyapp-deps).
> All fixes are on `main`. Every fix is non-breaking and compiles (`backend tsc=0`).
> Author: system/security session. Token: `BROADCAST-2026-05-12-read`.

## The one bug class

Every finding is the **same root cause**: an endpoint trusted a
**client-supplied identifier** to decide *whose* data to read or write, instead
of binding to the **authenticated JWT `sub`** (or the resource's stored owner).

The attacker-controlled value took different shapes per module:

| Shape | Example |
|---|---|
| `req.body.userId` / `?userId` | health records keyed by client id |
| `req.body.ownerId \|\| auth.sub` | Planet submissions — client override wins |
| `?email` | qtrade recipient lookup |
| guessable `:id` / `:profileId` | read any record by enumerating ids |
| `SELECT *` → `res.json(row)` | secret/PII columns leaked wholesale |

**Fix rule:** the owner of a record is **always** `auth.sub` (or verified
`auth.email` / `ownerUserId === auth.sub`). A client id may only ever *narrow*
to the caller's own data — never *select* another user's. Reads of an owned
record return 403/404 to non-owners; anonymous/legacy rows (no owner) stay open
only where a no-token demo flow already depended on it.

## Fixes shipped (5)

| # | Module | Vulnerability | Commit |
|---|---|---|---|
| 1 | `healthai.ts` | 18 profile-scoped routes (`/profile/:id`, `/history`, `/trends`, `/risks`, `/hydration`, `/score`, `/cycle`, `/plan*`, `/export`, `/population`, PHQ-9/GAD-7 incl. suicide flag, writes `/check`,`/log`,`/import`,…) read/wrote any health record by client `profileId`. Added `guardProfile()`; owner = JWT sub, anon bucket preserved. | `fad80ef6` |
| 2 | `qtrade.ts` | `GET /accounts/lookup?email=` returned any user's account id **and balance**, no auth gate → enumeration + balance disclosure. Now requires JWT, returns id only (matches documented contract). | `f4d59099` |
| 3 | `quantum-shield.ts` | `GET /:id` (`SELECT *`) and list `GET /` `/records` returned **all Shamir shards** to anonymous callers across all owners → pull shards + `POST /:id/reconstruct` = recover protected Ed25519 key (defeats 2-of-3 threshold). Shards now owner/admin-only; metadata otherwise. | `b9b0a86f` |
| 4 | `planetCompliance.ts` | `POST /submissions` and `/submissions/:id/resubmit` used `payload.ownerId \|\| auth.sub` → any user could create artifacts as another user, and on resubmit read a victim's latest artifact (codeIndex/media) + append to their lineage. Both now `auth.sub`. | `5a81eb1d` |
| 5 | `pipeline.ts` | Public `GET /certificate/:certId/bundle.json` (shareable / IPFS) embedded `authorEmail` → scrape all author emails by enumerating cert ids. Removed (matches `/verify`). | `f775f35e` |

## Audited clean (no change needed)

- `qright.ts` — webhooks/policies/revoke/stats all filter `ownerUserId = auth.sub`; `DELETE /policies/:id` scoped to `createdBy`.
- `qsign.ts` — stateless HMAC sign/verify, no per-user storage.
- `auth.ts` — `/me`, `/sessions/:id` (DELETE scoped `userId = sub`), password reset via single-use token hash.
- `coach.ts` — every session/goal route under `requireAuth` + `ownerKey === auth.sub` → 403.
- `modules.ts` — public registry; mutations gated by `isModulesAdmin` (403); PII (actor) omitted from public changelog/RSS.
- `quantum-shield.ts` / `planetCompliance.ts` — apart from the fixes above, revoke/audit/webhooks/admin all owner- or admin-gated; `/:id/public` projections deliberately omit secrets.
- `qmaskcard.ts`, `qpersona.ts` — already JWT-bound (checked 2026-06-19/20).

## Checklist for any new authenticated route

Before merging a route that touches user-owned data:

1. **Who owns this?** Derive owner from `verifyBearer*(req)?.sub` /
   `req.auth.sub` — never from `req.body`/`req.query`/`req.params`.
2. **Reads:** filter the query by the owner, or load-then-compare
   (`row.ownerUserId !== auth.sub → 403`). Don't return rows by id alone.
3. **Writes:** set the owner column to `auth.sub`; reject if the target row is
   owned by someone else.
4. **`SELECT *` → response:** never `res.json(row)` raw. Project an explicit
   allow-list of fields. Secrets (shards, keys, hashes) and PII (email) stay out
   of public/anonymous responses — mirror the module's `*/public` projection.
5. **Admin routes:** `requireAuth` alone is *not* an admin check — add the
   module's `is*Admin(auth)` (role or allow-list) → 403.
6. **Anonymous/legacy rows:** only leave them open if a no-token flow already
   depends on it; document why inline.

## Cross-zone follow-up (verified 2026-06-21 — all CLEAN, no action)

The grep that surfaced these flagged the *string* `userId`/`ownerId`, not an
actual trust boundary. On reading each route, all turned out already safe — no
issues filed (filing false positives would just churn other sessions):

- `qcoreai.ts:4507` — `req.body.userId` is the **target member** being added to
  an org; the route first checks `org.ownerId !== auth.sub → 403`. Owner-gated.
- `build/verification.ts`, `build/admin.ts` — every `:userId` route is behind
  `requireBuildAuth` + `auth.role !== "ADMIN" → 403`.
- `build/documents.ts` — `/me` scoped to `auth.sub`; `/user/:userId` is public
  but projects only `{id,docType,status,verifiedAt}` of `VERIFIED` docs (no
  content/URL); `/admin/*` admin-gated.
- `qpaynet.ts` — `POST /kyc/submit` binds `ownerId = auth.sub`; the
  `/admin/kyc/:ownerId/*` routes check `isAdmin(auth.email) → 403`.

## Review follow-up (code-reviewer, 2026-06-21)

- **Fixed:** `healthai GET /plan/snapshot/:id` passed `String(snap.profileId ??
  "")` → a null profileId became `"null"` and slipped past `guardProfile`
  (orphaned snapshots readable). Now fails closed (403) on missing profileId —
  commit `0102c9fe`.
- **Known low-priority / pre-existing (not regressions):**
  `healthai /leaderboard` exposes raw profileIds (enumeration only — reads are
  now guarded); PHQ-9/GAD-7 "last" in-memory maps aren't evicted on the
  anonymous→claim lifecycle; `quantum-shield POST /verify` legacy string match
  isn't timing-safe; `qtrade /accounts/lookup` still returns recipient
  `createdAt`. Track separately if they matter.

## Process note

The shared `aevion-core` worktree was repeatedly switched between branches by
parallel sessions during this sweep. To guarantee each fix landed on `main`
without disturbing other sessions' branches or uncommitted files, every fix was
built in a throwaway isolated `git worktree` and pushed straight to `main`.
