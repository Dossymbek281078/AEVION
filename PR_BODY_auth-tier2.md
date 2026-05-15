## Summary

Auth Tier 2 — turns the previous bare `register / login / me` MVP into a full identity surface: per-login sessions with revocation, password change, password reset (no-enumeration with bcrypt-hashed tokens), email verification, append-only audit log, soft-delete (GDPR-style), and the matching `/account` page.

Backwards compat is the headline constraint: every existing consumer (QRight, Planet, QSign, AEV, Bank, etc.) keeps working unchanged. JWT shape is additive (`sid` claim is new but optional), `requireAuth` still verifies tokens statelessly, and the `/login`/`/register` response gains fields without breaking ones it had.

## Schema additions (no manual migration)

`AEVIONUser` columns:
- `emailVerifiedAt TIMESTAMPTZ`
- `deletedAt TIMESTAMPTZ`

New tables (`CREATE TABLE IF NOT EXISTS`):
- **`AuthSession(id, userId, createdAt, lastActiveAt, ip, userAgent, revokedAt)`** — per-login row. New JWT carries `sid` mapping here.
- **`AuthAuditLog(id, userId, action, ip, userAgent, metadata, at)`** — append-only.
- **`PasswordResetToken(id, userId, tokenHash, expiresAt, usedAt, createdAt)`** — single-use, 1h expiry, **bcrypt-hashed** plaintext.
- **`EmailVerifyToken(...)`** — single-use, 24h expiry, bcrypt-hashed.

## Backend endpoints

### Profile
- `PATCH /api/auth/me` — update name (≤ 200 chars)
- `DELETE /api/auth/account` — soft-delete: anonymize email + name, invalidate password, revoke all sessions

### Sessions
- `GET /sessions` — list mine with `currentSessionId` marker + IP + UA
- `DELETE /sessions/:id` — revoke one
- `POST /logout` — revoke current sid
- `POST /logout-all` — revoke everything except current

### Password
- `POST /password/change` — `{ currentPassword, newPassword }`. Revokes other sessions on success.
- `POST /password/reset/request` — `{ email }`. **Always 200** (no user enumeration). In dev returns `devToken` for testing; prod must email out-of-band.
- `POST /password/reset/complete` — `{ email, token, newPassword }`. Revokes ALL sessions on success (paranoid).

### Email verification
- `POST /email/verify/request` — auth required, mints 24h token (dev: returns `devToken`)
- `POST /email/verify/complete` — `{ token }`, sets `emailVerifiedAt`

### Audit
- `GET /me/audit?limit=50` — own audit history
- `GET /whoami-strict` — verifies `sid` against `AuthSession.revokedAt` (legacy tokens without sid bypass)

## Hardening

- **Rate limits**: 20/min/IP on `/login`, 5/min/IP on `/password/reset` and `/email/verify`
- **bcrypt-hashed reset/verify tokens** — DB leak can't replay
- **No user enumeration** on `/password/reset/request`: response identical for known + unknown emails, only audit log differs
- **Audit log captures IP + UA + structured metadata** for register, login, login.failed, logout, password.change, password.reset.*, email.verify.*, profile.update, session.revoke, account.delete
- **Soft delete** rotates email to `deleted-{prefix}-{ts}@deleted.aevion.local` so it can be re-registered later

## Frontend

New page **`/account`**:
- Profile card with editable name + verified badge
- Email verification flow (with dev-token paste box)
- Change password form
- Active sessions list with current marker + per-row revoke + "Sign out all others"
- Audit log (last 50 events, colored failed actions)
- Sign out
- Danger zone: confirm-then-delete account

`/auth` adds an "Account settings" link in the signed-in header. Register/login flow unchanged.

## Backwards compatibility

- `/register` `/login` keep their existing request/response shape; `sessionId` is added but old clients can ignore it.
- JWT verification is unchanged across the entire codebase. Legacy tokens (no `sid` claim) keep validating against every `verifyBearerOptional` consumer.
- `sid`-based revocation is **opt-in** — only `/whoami-strict` and the `/sessions` family honor `AuthSession.revokedAt`.

## Build

`npm run verify` (backend tsc + next build) green. Vitest **153/153 PASS** unchanged. New backend routes: 13. New frontend route: 1 (`/account`).

## Test plan

- [ ] `POST /api/auth/register` returns `{ token, sessionId, user }` (sessionId is new)
- [ ] `GET /api/auth/me` returns user with `emailVerifiedAt: null`
- [ ] `GET /api/auth/sessions` shows the just-created session as `isCurrent: true`
- [ ] `POST /api/auth/email/verify/request` returns `devToken` (dev) → `complete` with that token sets `emailVerifiedAt`
- [ ] `/account` page: edit name → saves; toggle Sign out all others → toast + audit row appears
- [ ] `POST /api/auth/password/change` with wrong currentPassword → 401 + `password.change.failed` audit row
- [ ] `POST /api/auth/password/change` with correct currentPassword → 200 + other sessions revoked + token still valid
- [ ] `POST /api/auth/password/reset/request` with unknown email → 200 (no enumeration), audit row `password.reset.request.unknown`
- [ ] `POST /api/auth/password/reset/request` with known email → 200 + devToken (dev) → `complete` with token+newPassword → 200 + ALL sessions revoked
- [ ] Hit `/login` 25× from same IP → 21st request returns 429 (rate limit)
- [ ] `DELETE /api/auth/account` → 200 + subsequent `/me` returns 404 + email rotated to tombstone form
- [ ] All 153 vitest cases still pass

## Commits (2)

| SHA | What |
|-----|------|
| `d38024a` | feat(auth): Tier 2 backend — sessions, password mgmt, email verify, audit, account delete |
| `aee7d33` | feat(auth): Tier 2 frontend — /account page + docs |

🤖 Generated with [Claude Code](https://claude.com/claude-code)
