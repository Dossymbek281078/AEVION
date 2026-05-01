import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getJwtSecret, invalidateTokenVersionCache } from "../lib/authJwt";
import { ensureUsersTable } from "../lib/ensureUsersTable";
import { getPool } from "../lib/dbPool";
import { rateLimit } from "../lib/rateLimit";

export const authRouter = Router();

// 10 register attempts per minute per IP, refilled gradually.
// Login gets a more relaxed bucket (legitimate password retries are common).
const registerLimiter = rateLimit({ capacity: 10, refillPerSec: 10 / 60 });
const loginLimiter = rateLimit({ capacity: 30, refillPerSec: 30 / 60 });

const pool = getPool();

function signToken(payload: {
  sub: string;
  email: string;
  role: string;
  tv?: number;
}) {
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

// ======================
// Register
// ======================
authRouter.post("/register", registerLimiter, async (req, res) => {
  try {
    await ensureUsersTable(pool);

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
    const isFirst = Number(cnt.rows?.[0]?.c || 0) === 0;
    const role = isFirst ? "ADMIN" : "USER";

    const id = crypto.randomUUID();

    await pool.query(
      `
      INSERT INTO "AEVIONUser" ("id","email","passwordHash","name","role")
      VALUES ($1,$2,$3,$4,$5)
      `,
      [id, email, passwordHash, name, role]
    );

    const token = signToken({ sub: id, email, role, tv: 0 });
    res.status(201).json({
      token,
      user: { id, email, name, role },
    });
  } catch (err: any) {
    // Duplicate email -> 409
    if (err?.code === "23505") {
      return res.status(409).json({ error: "email already exists" });
    }
    res.status(500).json({ error: "register failed", details: err?.message });
  }
});

// ======================
// Login
// ======================
authRouter.post("/login", loginLimiter, async (req, res) => {
  try {
    await ensureUsersTable(pool);

    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const r = await pool.query(
      `SELECT "id","email","name","role","passwordHash","tokenVersion" FROM "AEVIONUser" WHERE "email"=$1`,
      [email]
    );

    const user = r.rows?.[0];
    if (!user) return res.status(401).json({ error: "invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      tv: Number(user.tokenVersion ?? 0),
    });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err: any) {
    res.status(500).json({ error: "login failed", details: err?.message });
  }
});

// ======================
// Sign out everywhere — bumps tokenVersion, invalidates all live JWTs
// for this user. The current request's JWT is rejected on the very
// next call (cache TTL ≤10s on remote nodes, immediate on this node).
// ======================
authRouter.post("/sign-out-everywhere", async (req, res) => {
  try {
    const payload: any = requireAuth(req, res);
    if (!payload) return;
    await ensureUsersTable(pool);
    const r = await pool.query(
      `UPDATE "AEVIONUser"
       SET "tokenVersion" = "tokenVersion" + 1
       WHERE "id" = $1
       RETURNING "tokenVersion"`,
      [payload.sub],
    );
    const next = r.rows?.[0]?.tokenVersion;
    if (next == null) return res.status(404).json({ error: "user not found" });
    invalidateTokenVersionCache(payload.sub);
    res.json({ ok: true, tokenVersion: Number(next) });
  } catch (err: any) {
    res.status(500).json({ error: "sign-out-everywhere failed", details: err?.message });
  }
});

// ======================
// Me
// ======================
authRouter.get("/me", async (req, res) => {
  try {
    const payload: any = requireAuth(req, res);
    if (!payload) return;

    await ensureUsersTable(pool);

    const userId = payload.sub;
    const r = await pool.query(
      `SELECT "id","email","name","role","createdAt" FROM "AEVIONUser" WHERE "id"=$1`,
      [userId]
    );
    const user = r.rows?.[0];
    if (!user) return res.status(404).json({ error: "user not found" });

    res.json({ user, tokenPayload: payload });
  } catch (err: any) {
    res.status(500).json({ error: "me failed", details: err?.message });
  }
});

