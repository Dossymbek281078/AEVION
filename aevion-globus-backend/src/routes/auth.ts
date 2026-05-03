import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../lib/authJwt";
import { ensureUsersTable } from "../lib/ensureUsersTable";
import { getPool } from "../lib/dbPool";
import { rateLimit } from "../lib/rateLimit";
import { sendVerificationEmail, sendPasswordResetEmail } from "../lib/build/email";

export const authRouter = Router();

const pool = getPool();

// ─────────────────────────────────────────────────────────────────────────
// Tier 2 — schema bootstrap
// ─────────────────────────────────────────────────────────────────────────

let ensuredAuthTier2 = false;
async function ensureAuthTier2Tables(): Promise<void> {
  if (ensuredAuthTier2) return;
  // User table comes from shared bootstrap; we only ALTER it here.
  await ensureUsersTable(pool);

  // Per-login session row. JWT still carries the auth state statelessly
  // (so legacy consumers keep working), but new tokens include a `sid`
  // claim that maps here. /sessions endpoints + /logout flip "revokedAt"
  // on this row, and /whoami-strict treats a revoked sid as logged out.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "AuthSession" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "lastActiveAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "ip" TEXT,
      "userAgent" TEXT,
      "revokedAt" TIMESTAMPTZ
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "AuthSession_user_idx" ON "AuthSession" ("userId", "createdAt" DESC);`
  );

  // Append-only audit log. Replaces the absent observability around
  // login / password / session events. Same shape as QRight/Planet logs
  // for operator muscle-memory.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "AuthAuditLog" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT,
      "action" TEXT NOT NULL,
      "ip" TEXT,
      "userAgent" TEXT,
      "metadata" JSONB,
      "at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "AuthAuditLog_user_idx" ON "AuthAuditLog" ("userId", "at" DESC);`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "AuthAuditLog_at_idx" ON "AuthAuditLog" ("at" DESC);`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "AuthAuditLog_action_idx" ON "AuthAuditLog" ("action");`
  );

  // Password reset + email verify tokens. Single-use, expiring. We store
  // the bcrypt hash of the token (not the token itself) so a DB leak
  // can't be replayed against the reset/verify endpoints.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "usedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "PasswordResetToken_user_idx" ON "PasswordResetToken" ("userId");`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "EmailVerifyToken" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "usedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Profile additions: email verification + soft-delete (GDPR-style
  // anonymization). deletedAt + email rewrite on DELETE /account.
  await pool.query(`
    ALTER TABLE "AEVIONUser" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMPTZ;
    ALTER TABLE "AEVIONUser" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;
  `);

  ensuredAuthTier2 = true;
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function clientIp(req: { headers: any; socket?: any; ip?: string }): string | null {
  const xff = req.headers?.["x-forwarded-for"];
  const first = Array.isArray(xff)
    ? xff[0]
    : typeof xff === "string"
    ? xff.split(",")[0]?.trim()
    : null;
  return first || req.ip || req.socket?.remoteAddress || null;
}

function clientUa(req: { headers: any }): string | null {
  const ua = req.headers?.["user-agent"];
  if (Array.isArray(ua)) return ua[0]?.slice(0, 500) || null;
  if (typeof ua === "string") return ua.slice(0, 500);
  return null;
}

function signToken(payload: {
  sub: string;
  email: string;
  role: string;
  sid?: string;
}): string {
  const secret = getJwtSecret();
  const expiresIn = process.env.AUTH_JWT_EXPIRES_IN || "7d";
  return jwt.sign(payload, secret, { expiresIn });
}

function requireAuth(req: any, res: any) {
  const header = req.headers?.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "missing bearer token" });
    return null;
  }
  try {
    const secret = getJwtSecret();
    return jwt.verify(token, secret) as any;
  } catch (e: any) {
    res.status(401).json({ error: "invalid token", details: e?.message });
    return null;
  }
}

// Like requireAuth but ALSO checks AuthSession.revokedAt if the JWT carries
// a sid claim. Legacy tokens (no sid) bypass the check — we don't break
// existing consumers, but new flows can opt into strict revocation.
async function requireAuthStrict(req: any, res: any) {
  const payload = requireAuth(req, res);
  if (!payload) return null;
  const sid = (payload as any).sid as string | undefined;
  if (!sid) return payload;
  await ensureAuthTier2Tables();
  const r = await pool.query(
    `SELECT "revokedAt" FROM "AuthSession" WHERE "id" = $1 AND "userId" = $2 LIMIT 1`,
    [sid, payload.sub]
  );
  if (r.rowCount === 0) {
    res.status(401).json({ error: "session not found" });
    return null;
  }
  if ((r.rows[0] as { revokedAt: Date | null }).revokedAt) {
    res.status(401).json({ error: "session revoked" });
    return null;
  }
  // Touch lastActiveAt — best-effort, never blocks the request.
  pool
    .query(`UPDATE "AuthSession" SET "lastActiveAt" = NOW() WHERE "id" = $1`, [sid])
    .catch(() => {});
  return payload;
}

async function createSession(
  userId: string,
  req: { headers: any; socket?: any; ip?: string }
): Promise<string> {
  await ensureAuthTier2Tables();
  const sid = crypto.randomUUID();
  await pool.query(
    `INSERT INTO "AuthSession" ("id", "userId", "ip", "userAgent")
     VALUES ($1, $2, $3, $4)`,
    [sid, userId, clientIp(req), clientUa(req)]
  );
  return sid;
}

function recordAuthAudit(
  userId: string | null,
  action: string,
  req: { headers: any; socket?: any; ip?: string },
  metadata: Record<string, unknown> | null = null
): void {
  pool
    .query(
      `INSERT INTO "AuthAuditLog" ("id", "userId", "action", "ip", "userAgent", "metadata")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        crypto.randomUUID(),
        userId,
        action,
        clientIp(req),
        clientUa(req),
        metadata ? JSON.stringify(metadata) : null,
      ]
    )
    .catch((err: Error) => {
      console.warn(`[auth] audit insert failed action=${action}:`, err.message);
    });
}

// Constant-time hash equality for token verification.
function tokenMatches(plaintext: string, storedHash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, storedHash);
}

// Mint a single-use token. The plaintext is returned (caller emails it
// or returns it to dev caller); the bcrypt hash is what we persist.
async function mintToken(): Promise<{ plaintext: string; hash: string }> {
  const plaintext = crypto.randomBytes(24).toString("base64url");
  const hash = await bcrypt.hash(plaintext, 10);
  return { plaintext, hash };
}

// ─────────────────────────────────────────────────────────────────────────
// Rate limits
// ─────────────────────────────────────────────────────────────────────────

// Login is the obvious brute-force target. Cap aggressively per IP.
// Email-keyed rate limit comes after — see handler.
const loginIpRateLimit = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyPrefix: "auth:login:ip",
});

const passwordResetRateLimit = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyPrefix: "auth:reset",
});

const emailVerifyRateLimit = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyPrefix: "auth:verify",
});

// ─────────────────────────────────────────────────────────────────────────
// Existing endpoints — unchanged contract, additive Tier 2 wiring
// ─────────────────────────────────────────────────────────────────────────

authRouter.post("/register", async (req, res) => {
  try {
    await ensureAuthTier2Tables();

    const { email, password, name } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({
        error: "email, password, name are required",
      });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        error: "password must be at least 6 characters",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // MVP heuristic: if first user, make ADMIN. Otherwise USER.
    const cnt = await pool.query('SELECT COUNT(*)::int as c FROM "AEVIONUser"');
    const isFirst = Number((cnt.rows?.[0] as { c: number })?.c || 0) === 0;
    const role = isFirst ? "ADMIN" : "USER";

    const id = crypto.randomUUID();

    await pool.query(
      `INSERT INTO "AEVIONUser" ("id","email","passwordHash","name","role")
       VALUES ($1,$2,$3,$4,$5)`,
      [id, email, passwordHash, name, role]
    );

    const sid = await createSession(id, req);
    const token = signToken({ sub: id, email, role, sid });
    recordAuthAudit(id, "register", req, { sid });

    // Send verification email async — fire-and-forget, don't block response.
    void (async () => {
      try {
        const minted = await mintToken();
        const vId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
        await pool.query(
          `INSERT INTO "EmailVerifyToken" ("id","userId","tokenHash","expiresAt") VALUES ($1,$2,$3,$4)`,
          [vId, id, minted.hash, expiresAt],
        );
        sendVerificationEmail({ to: email, name: String(name), token: minted.plaintext });
      } catch { /**/ }
    })();

    res.status(201).json({
      token,
      sessionId: sid,
      user: { id, email, name, role },
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ error: "email already exists" });
    }
    res.status(500).json({ error: "register failed", details: err?.message });
  }
});

authRouter.post("/login", loginIpRateLimit, async (req, res) => {
  try {
    await ensureAuthTier2Tables();

    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const r = await pool.query(
      `SELECT "id","email","name","role","passwordHash","deletedAt"
       FROM "AEVIONUser" WHERE "email"=$1`,
      [email]
    );

    const user = r.rows?.[0] as any;
    if (!user || user.deletedAt) {
      recordAuthAudit(null, "login.failed", req, { email, reason: "no_user" });
      return res.status(401).json({ error: "invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      recordAuthAudit(user.id, "login.failed", req, { email, reason: "bad_password" });
      return res.status(401).json({ error: "invalid credentials" });
    }

    const sid = await createSession(user.id, req);
    const token = signToken({ sub: user.id, email: user.email, role: user.role, sid });
    recordAuthAudit(user.id, "login", req, { sid });

    res.json({
      token,
      sessionId: sid,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err: any) {
    res.status(500).json({ error: "login failed", details: err?.message });
  }
});

authRouter.get("/me", async (req, res) => {
  try {
    const payload: any = requireAuth(req, res);
    if (!payload) return;
    await ensureAuthTier2Tables();

    const r = await pool.query(
      `SELECT "id","email","name","role","createdAt","emailVerifiedAt","deletedAt"
       FROM "AEVIONUser" WHERE "id"=$1`,
      [payload.sub]
    );
    const user = r.rows?.[0] as any;
    if (!user || user.deletedAt) return res.status(404).json({ error: "user not found" });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        emailVerifiedAt: user.emailVerifiedAt,
      },
      tokenPayload: payload,
    });
  } catch (err: any) {
    res.status(500).json({ error: "me failed", details: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Profile management
// ─────────────────────────────────────────────────────────────────────────

// 🔹 PATCH /me — update name. Email change goes through verify flow.
authRouter.patch("/me", async (req, res) => {
  try {
    const payload: any = requireAuth(req, res);
    if (!payload) return;
    await ensureAuthTier2Tables();

    const name = String(req.body?.name || "").trim();
    if (!name || name.length > 200) {
      return res.status(400).json({ error: "name required (≤ 200 chars)" });
    }
    await pool.query(`UPDATE "AEVIONUser" SET "name" = $1 WHERE "id" = $2`, [name, payload.sub]);
    recordAuthAudit(payload.sub, "profile.update", req, { name });
    res.json({ updated: true, name });
  } catch (err: any) {
    res.status(500).json({ error: "update failed", details: err?.message });
  }
});

// 🔹 DELETE /account — soft delete (GDPR-style anonymization).
//    Email is rotated to a tombstone form so it can be re-registered later;
//    name is cleared; passwordHash invalidated; all sessions revoked.
authRouter.delete("/account", async (req, res) => {
  try {
    const payload: any = requireAuth(req, res);
    if (!payload) return;
    await ensureAuthTier2Tables();

    const userId: string = payload.sub;
    const tombstoneEmail = `deleted-${userId.slice(0, 8)}-${Date.now()}@deleted.aevion.local`;
    await pool.query(
      `UPDATE "AEVIONUser"
         SET "email" = $1,
             "name" = 'deleted user',
             "passwordHash" = $2,
             "deletedAt" = NOW()
       WHERE "id" = $3`,
      [tombstoneEmail, "deleted:" + crypto.randomBytes(16).toString("hex"), userId]
    );
    await pool.query(
      `UPDATE "AuthSession" SET "revokedAt" = NOW() WHERE "userId" = $1 AND "revokedAt" IS NULL`,
      [userId]
    );
    recordAuthAudit(userId, "account.delete", req, null);
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: "delete failed", details: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────────────────

// 🔹 GET /sessions — list mine, ordered newest first.
authRouter.get("/sessions", async (req, res) => {
  try {
    const payload: any = requireAuth(req, res);
    if (!payload) return;
    await ensureAuthTier2Tables();

    const r = await pool.query(
      `SELECT "id","createdAt","lastActiveAt","ip","userAgent","revokedAt"
       FROM "AuthSession"
       WHERE "userId" = $1
       ORDER BY "createdAt" DESC
       LIMIT 100`,
      [payload.sub]
    );
    res.setHeader("Cache-Control", "no-store");
    res.json({
      currentSessionId: payload.sid || null,
      items: r.rows.map((row: any) => ({
        id: row.id,
        createdAt: row.createdAt,
        lastActiveAt: row.lastActiveAt,
        ip: row.ip,
        userAgent: row.userAgent,
        revokedAt: row.revokedAt,
        isCurrent: row.id === payload.sid,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "sessions failed", details: err?.message });
  }
});

// 🔹 DELETE /sessions/:id — revoke a single session (mine only).
authRouter.delete("/sessions/:id", async (req, res) => {
  try {
    const payload: any = requireAuth(req, res);
    if (!payload) return;
    await ensureAuthTier2Tables();

    const sid = String(req.params.id);
    const r = await pool.query(
      `UPDATE "AuthSession" SET "revokedAt" = NOW()
       WHERE "id" = $1 AND "userId" = $2 AND "revokedAt" IS NULL`,
      [sid, payload.sub]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found or already revoked" });
    recordAuthAudit(payload.sub, "session.revoke", req, { sid });
    res.json({ id: sid, revoked: true });
  } catch (err: any) {
    res.status(500).json({ error: "revoke failed", details: err?.message });
  }
});

// 🔹 POST /logout — revoke current session (sid from JWT).
authRouter.post("/logout", async (req, res) => {
  try {
    const payload: any = requireAuth(req, res);
    if (!payload) return;
    await ensureAuthTier2Tables();

    const sid = payload.sid as string | undefined;
    if (!sid) {
      // Legacy token without sid — nothing server-side to revoke. Tell the
      // caller to drop the token client-side.
      return res.json({ ok: true, note: "legacy token, no server session" });
    }
    await pool.query(
      `UPDATE "AuthSession" SET "revokedAt" = NOW()
       WHERE "id" = $1 AND "userId" = $2 AND "revokedAt" IS NULL`,
      [sid, payload.sub]
    );
    recordAuthAudit(payload.sub, "logout", req, { sid });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "logout failed", details: err?.message });
  }
});

// 🔹 POST /logout-all — revoke every session for this user EXCEPT current.
authRouter.post("/logout-all", async (req, res) => {
  try {
    const payload: any = requireAuth(req, res);
    if (!payload) return;
    await ensureAuthTier2Tables();

    const sid = payload.sid as string | undefined;
    const r = await pool.query(
      sid
        ? `UPDATE "AuthSession" SET "revokedAt" = NOW()
            WHERE "userId" = $1 AND "revokedAt" IS NULL AND "id" <> $2`
        : `UPDATE "AuthSession" SET "revokedAt" = NOW()
            WHERE "userId" = $1 AND "revokedAt" IS NULL`,
      sid ? [payload.sub, sid] : [payload.sub]
    );
    recordAuthAudit(payload.sub, "logout-all", req, { revokedCount: r.rowCount });
    res.json({ ok: true, revokedCount: r.rowCount });
  } catch (err: any) {
    res.status(500).json({ error: "logout-all failed", details: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Password management
// ─────────────────────────────────────────────────────────────────────────

// 🔹 POST /password/change — current + new. Revokes other sessions.
authRouter.post("/password/change", async (req, res) => {
  try {
    const payload: any = requireAuth(req, res);
    if (!payload) return;
    await ensureAuthTier2Tables();

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "currentPassword and newPassword required" });
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ error: "newPassword must be ≥ 6 chars" });
    }

    const u = await pool.query(
      `SELECT "passwordHash" FROM "AEVIONUser" WHERE "id" = $1`,
      [payload.sub]
    );
    if (u.rowCount === 0) return res.status(404).json({ error: "user not found" });
    const ok = await bcrypt.compare(currentPassword, (u.rows[0] as any).passwordHash);
    if (!ok) {
      recordAuthAudit(payload.sub, "password.change.failed", req, { reason: "bad_current" });
      return res.status(401).json({ error: "current password incorrect" });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE "AEVIONUser" SET "passwordHash" = $1 WHERE "id" = $2`, [
      newHash,
      payload.sub,
    ]);
    // Revoke all OTHER sessions — current stays valid.
    const sid = payload.sid as string | undefined;
    if (sid) {
      await pool.query(
        `UPDATE "AuthSession" SET "revokedAt" = NOW()
         WHERE "userId" = $1 AND "revokedAt" IS NULL AND "id" <> $2`,
        [payload.sub, sid]
      );
    }
    recordAuthAudit(payload.sub, "password.change", req, null);
    res.json({ changed: true });
  } catch (err: any) {
    res.status(500).json({ error: "change failed", details: err?.message });
  }
});

// 🔹 POST /password/reset/request — email lookup → mint single-use token.
//    Always returns 200 (no user enumeration). In dev we ALSO return the
//    token in the response so the flow can be tested without email infra.
authRouter.post("/password/reset/request", passwordResetRateLimit, async (req, res) => {
  try {
    await ensureAuthTier2Tables();
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "email required" });

    const r = await pool.query(
      `SELECT "id" FROM "AEVIONUser" WHERE LOWER("email") = $1 AND "deletedAt" IS NULL LIMIT 1`,
      [email]
    );
    const userId = (r.rows[0] as { id: string } | undefined)?.id || null;

    let plaintext: string | null = null;
    if (userId) {
      const minted = await mintToken();
      plaintext = minted.plaintext;
      const id = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
      await pool.query(
        `INSERT INTO "PasswordResetToken" ("id", "userId", "tokenHash", "expiresAt")
         VALUES ($1, $2, $3, $4)`,
        [id, userId, minted.hash, expiresAt]
      );
      recordAuthAudit(userId, "password.reset.request", req, { tokenId: id });

      // Send reset email — fire-and-forget
      const nameQ = await pool.query(`SELECT "name" FROM "AEVIONUser" WHERE "id" = $1`, [userId]);
      const userName = (nameQ.rows[0] as { name: string } | undefined)?.name ?? "пользователь";
      sendPasswordResetEmail({ to: email, name: userName, token: plaintext! });
    } else {
      // Audit the attempt anyway — useful for spotting enumeration sweeps.
      recordAuthAudit(null, "password.reset.request.unknown", req, { email });
    }

    const dev = process.env.NODE_ENV !== "production";
    res.json({
      ok: true,
      // Only echo the token in dev — prod must email it out-of-band.
      ...(dev && plaintext ? { devToken: plaintext } : {}),
    });
  } catch (err: any) {
    res.status(500).json({ error: "reset request failed", details: err?.message });
  }
});

// 🔹 POST /password/reset/complete — { email, token, newPassword }.
//    Revokes all sessions (paranoid: assumes account compromise).
authRouter.post("/password/reset/complete", async (req, res) => {
  try {
    await ensureAuthTier2Tables();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const token = String(req.body?.token || "").trim();
    const newPassword = req.body?.newPassword;
    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: "email, token, newPassword required" });
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ error: "newPassword must be ≥ 6 chars" });
    }

    const u = await pool.query(
      `SELECT "id" FROM "AEVIONUser" WHERE LOWER("email") = $1 AND "deletedAt" IS NULL LIMIT 1`,
      [email]
    );
    if (u.rowCount === 0) return res.status(400).json({ error: "invalid token" });
    const userId = (u.rows[0] as { id: string }).id;

    // Pull all unused, unexpired tokens for this user. Match in O(N=few)
    // because the bcrypt hash isn't queryable by plaintext.
    const candidates = await pool.query(
      `SELECT "id", "tokenHash" FROM "PasswordResetToken"
       WHERE "userId" = $1 AND "usedAt" IS NULL AND "expiresAt" > NOW()
       ORDER BY "createdAt" DESC
       LIMIT 10`,
      [userId]
    );
    let matchedId: string | null = null;
    for (const row of candidates.rows as { id: string; tokenHash: string }[]) {
      if (await tokenMatches(token, row.tokenHash)) {
        matchedId = row.id;
        break;
      }
    }
    if (!matchedId) {
      recordAuthAudit(userId, "password.reset.complete.failed", req, { reason: "bad_token" });
      return res.status(400).json({ error: "invalid token" });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE "AEVIONUser" SET "passwordHash" = $1 WHERE "id" = $2`, [
      newHash,
      userId,
    ]);
    await pool.query(`UPDATE "PasswordResetToken" SET "usedAt" = NOW() WHERE "id" = $1`, [
      matchedId,
    ]);
    // Revoke ALL sessions on a successful reset — assume the account is hot.
    await pool.query(
      `UPDATE "AuthSession" SET "revokedAt" = NOW() WHERE "userId" = $1 AND "revokedAt" IS NULL`,
      [userId]
    );
    recordAuthAudit(userId, "password.reset.complete", req, null);
    res.json({ reset: true });
  } catch (err: any) {
    res.status(500).json({ error: "reset failed", details: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Email verification
// ─────────────────────────────────────────────────────────────────────────

// 🔹 POST /email/verify/request — auth required. Mint single-use token.
authRouter.post("/email/verify/request", emailVerifyRateLimit, async (req, res) => {
  try {
    const payload: any = requireAuth(req, res);
    if (!payload) return;
    await ensureAuthTier2Tables();

    const u = await pool.query(
      `SELECT "id", "email", "emailVerifiedAt" FROM "AEVIONUser" WHERE "id" = $1`,
      [payload.sub]
    );
    if (u.rowCount === 0) return res.status(404).json({ error: "user not found" });
    const user = u.rows[0] as { id: string; email: string; emailVerifiedAt: Date | null };
    if (user.emailVerifiedAt) {
      return res.json({ ok: true, alreadyVerified: true });
    }

    const minted = await mintToken();
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
    await pool.query(
      `INSERT INTO "EmailVerifyToken" ("id", "userId", "tokenHash", "expiresAt")
       VALUES ($1, $2, $3, $4)`,
      [id, user.id, minted.hash, expiresAt]
    );
    recordAuthAudit(user.id, "email.verify.request", req, { tokenId: id });

    // Get user name for the email
    const nameQ = await pool.query(`SELECT "name" FROM "AEVIONUser" WHERE "id" = $1`, [user.id]);
    const userName = (nameQ.rows[0] as { name: string } | undefined)?.name ?? "пользователь";
    sendVerificationEmail({ to: user.email, name: userName, token: minted.plaintext });

    const dev = process.env.NODE_ENV !== "production";
    res.json({
      ok: true,
      email: user.email,
      ...(dev ? { devToken: minted.plaintext } : {}),
    });
  } catch (err: any) {
    res.status(500).json({ error: "verify request failed", details: err?.message });
  }
});

// 🔹 POST /email/verify/complete — { token }. Auth required.
authRouter.post("/email/verify/complete", async (req, res) => {
  try {
    const payload: any = requireAuth(req, res);
    if (!payload) return;
    await ensureAuthTier2Tables();

    const token = String(req.body?.token || "").trim();
    if (!token) return res.status(400).json({ error: "token required" });

    const candidates = await pool.query(
      `SELECT "id", "tokenHash" FROM "EmailVerifyToken"
       WHERE "userId" = $1 AND "usedAt" IS NULL AND "expiresAt" > NOW()
       ORDER BY "createdAt" DESC
       LIMIT 10`,
      [payload.sub]
    );
    let matchedId: string | null = null;
    for (const row of candidates.rows as { id: string; tokenHash: string }[]) {
      if (await tokenMatches(token, row.tokenHash)) {
        matchedId = row.id;
        break;
      }
    }
    if (!matchedId) {
      recordAuthAudit(payload.sub, "email.verify.complete.failed", req, { reason: "bad_token" });
      return res.status(400).json({ error: "invalid token" });
    }

    await pool.query(`UPDATE "EmailVerifyToken" SET "usedAt" = NOW() WHERE "id" = $1`, [matchedId]);
    await pool.query(`UPDATE "AEVIONUser" SET "emailVerifiedAt" = NOW() WHERE "id" = $1`, [
      payload.sub,
    ]);
    recordAuthAudit(payload.sub, "email.verify.complete", req, null);
    res.json({ verified: true });
  } catch (err: any) {
    res.status(500).json({ error: "verify failed", details: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Audit reader (mine)
// ─────────────────────────────────────────────────────────────────────────

// 🔹 GET /me/audit — list my own audit events.
authRouter.get("/me/audit", async (req, res) => {
  try {
    const payload: any = requireAuth(req, res);
    if (!payload) return;
    await ensureAuthTier2Tables();

    const limitRaw = parseInt(String(req.query.limit || "50"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;

    const r = await pool.query(
      `SELECT "id","action","ip","userAgent","metadata","at"
       FROM "AuthAuditLog"
       WHERE "userId" = $1
       ORDER BY "at" DESC
       LIMIT $2`,
      [payload.sub, limit]
    );
    res.setHeader("Cache-Control", "no-store");
    res.json({
      total: r.rowCount,
      items: r.rows.map((row: any) => ({
        id: row.id,
        action: row.action,
        ip: row.ip,
        userAgent: row.userAgent,
        metadata: row.metadata,
        at: row.at instanceof Date ? row.at.toISOString() : row.at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "audit failed", details: err?.message });
  }
});

// 🔹 GET /whoami-strict — verifies sid against AuthSession.revokedAt.
//    Useful for clients that want server-confirmed session validity
//    (legacy stateless JWT verify is opt-out via lack of sid).
authRouter.get("/whoami-strict", async (req, res) => {
  const payload: any = await requireAuthStrict(req, res);
  if (!payload) return;
  res.json({
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    sid: payload.sid || null,
    legacy: !payload.sid,
  });
});
