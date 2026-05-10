# Auth Tier 2 deploy notes

## Environment variables

| Name | Required | Default | Purpose |
|---|---|---|---|
| `AUTH_JWT_SECRET` | yes (prod) | `dev-auth-secret` | JWT signing key. Set to a strong random string. |
| `AUTH_JWT_EXPIRES_IN` | optional | `7d` | jsonwebtoken expiresIn format. |
| `NODE_ENV` | optional | `development` | When `production`, password reset / email verify endpoints stop echoing tokens in the response — they must be emailed out-of-band. |

## Schema additions (no manual migration)

`AEVIONUser` columns (`ALTER TABLE ADD COLUMN IF NOT EXISTS`):
- `emailVerifiedAt TIMESTAMPTZ` — null until owner runs `/email/verify/complete`.
- `deletedAt TIMESTAMPTZ` — soft-delete tombstone. Anonymized email + cleared name + invalidated passwordHash on `DELETE /account`.

New tables (`CREATE TABLE IF NOT EXISTS`):
- **`AuthSession(id, userId, createdAt, lastActiveAt, ip, userAgent, revokedAt)`** — one row per login. New JWT carries a `sid` claim that maps here.
- **`AuthAuditLog(id, userId, action, ip, userAgent, metadata, at)`** — append-only.
- **`PasswordResetToken(id, userId, tokenHash, expiresAt, usedAt, createdAt)`** — single-use, 1h expiry, bcrypt-hashed.
- **`EmailVerifyToken(id, userId, tokenHash, expiresAt, usedAt, createdAt)`** — single-use, 24h expiry, bcrypt-hashed.

## Backwards compatibility

Existing `/register` `/login` `/me` keep their contract:
- Same request body, same `{ token, user }` response (now also `sessionId`).
- Existing legacy JWT tokens (no `sid` claim) keep working across every consumer (QRight, Planet, QSign, etc.) — `requireAuth` is unchanged.
- `sid`-based revocation is **opt-in** via `/whoami-strict` and the `/sessions` family.

## Endpoints

### Profile
- `GET /api/auth/me` — user info (now includes `emailVerifiedAt`)
- `PATCH /api/auth/me` `{ name }` — update display name
- `DELETE /api/auth/account` — soft delete + revoke all sessions

### Sessions
- `GET /api/auth/sessions` — list mine, with `currentSessionId` marker
- `DELETE /api/auth/sessions/:id` — revoke one
- `POST /api/auth/logout` — revoke current sid (no-op for legacy tokens)
- `POST /api/auth/logout-all` — revoke everything except current

### Password
- `POST /api/auth/password/change` `{ currentPassword, newPassword }` — bcrypt-verifies current, revokes other sessions on success
- `POST /api/auth/password/reset/request` `{ email }` — always 200 (no enumeration). In `NODE_ENV !== production` returns `devToken` for testing.
- `POST /api/auth/password/reset/complete` `{ email, token, newPassword }` — revokes ALL sessions on success

### Email verification
- `POST /api/auth/email/verify/request` — sends single-use 24h token (dev: returns `devToken`)
- `POST /api/auth/email/verify/complete` `{ token }` — sets `emailVerifiedAt`

### Audit
- `GET /api/auth/me/audit?limit=50` — own audit history
- `GET /api/auth/whoami-strict` — server-confirmed session validity (verifies sid against `AuthSession.revokedAt`)

## Smoke test after deploy

```bash
HOST=https://YOUR_HOST

# 1. register (returns sessionId in addition to token)
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"email":"smoke@aevion.local","password":"secret123","name":"Smoke"}' \
  $HOST/api/auth/register
# expect 201 + { token, sessionId, user }

TOKEN="<paste-token>"

# 2. me — now includes emailVerifiedAt: null
curl -s -H "Authorization: Bearer $TOKEN" $HOST/api/auth/me

# 3. sessions — should show current session as isCurrent: true
curl -s -H "Authorization: Bearer $TOKEN" $HOST/api/auth/sessions

# 4. email verify (dev path: token returned in response)
curl -s -X POST -H "Authorization: Bearer $TOKEN" $HOST/api/auth/email/verify/request
# expect { ok: true, devToken: "..." }

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"token":"<devToken-from-prev>"}' \
  $HOST/api/auth/email/verify/complete
# expect { verified: true }

# 5. password change (revokes other sessions but not current)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"currentPassword":"secret123","newPassword":"newSecret456"}' \
  $HOST/api/auth/password/change
# expect { changed: true }

# 6. logout-all
curl -s -X POST -H "Authorization: Bearer $TOKEN" $HOST/api/auth/logout-all
# expect { ok: true, revokedCount: 0 } (no other sessions yet)

# 7. password reset request (no auth)
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"email":"smoke@aevion.local"}' \
  $HOST/api/auth/password/reset/request
# expect { ok: true, devToken: "..." } (dev only)

# 8. audit history
curl -s -H "Authorization: Bearer $TOKEN" $HOST/api/auth/me/audit
# expect items array with register, login, password.change, etc.

# 9. account delete (acts on the smoke test user; reuse in dev only)
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" $HOST/api/auth/account
# expect { deleted: true }
```

## Frontend

New page `/account`:
- Profile card: email + verified badge + editable name + role + member since
- Email verify card (hidden when verified): "Send verify link" → paste token → "Verify"
- Change password card
- Active sessions: list with current marker + IP + UA + per-session revoke + "Sign out all others"
- Audit log: last 50 events with action chip + IP + timestamp
- Sign out
- Danger zone: confirm-then-delete account

`/auth` adds a "Account settings" link in the signed-in header (no other changes — register/login flow unchanged).

## Hardening

- Rate limits: 20/min/IP on `/login`, 5/min/IP on `/password/reset` and `/email/verify`.
- Reset/verify tokens stored as bcrypt(plaintext) — DB leak can't replay.
- No user-enumeration on `/password/reset/request`: always returns 200.
- Audit log captures IP + User-Agent + structured metadata for every privileged action.
- Soft-delete rotates email to a tombstone form so it can be re-registered later.
