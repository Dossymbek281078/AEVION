"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authJwt_1 = require("../lib/authJwt");
const ensureUsersTable_1 = require("../lib/ensureUsersTable");
const dbPool_1 = require("../lib/dbPool");
const rateLimit_1 = require("../lib/rateLimit");
exports.authRouter = (0, express_1.Router)();
// 10 register attempts per minute per IP, refilled gradually.
// Login gets a more relaxed bucket (legitimate password retries are common).
const registerLimiter = (0, rateLimit_1.rateLimit)({ capacity: 10, refillPerSec: 10 / 60 });
const loginLimiter = (0, rateLimit_1.rateLimit)({ capacity: 30, refillPerSec: 30 / 60 });
const pool = (0, dbPool_1.getPool)();
function signToken(payload) {
    const secret = (0, authJwt_1.getJwtSecret)();
    const expiresIn = process.env.AUTH_JWT_EXPIRES_IN || "7d";
    return jsonwebtoken_1.default.sign(payload, secret, { expiresIn });
}
function requireAuth(req, res) {
    const header = req.headers?.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
        res.status(401).json({ error: "missing bearer token" });
        return null;
    }
    try {
        const secret = (0, authJwt_1.getJwtSecret)();
        return jsonwebtoken_1.default.verify(token, secret);
    }
    catch (e) {
        res.status(401).json({ error: "invalid token", details: e?.message });
        return null;
    }
}
// ======================
// Register
// ======================
exports.authRouter.post("/register", registerLimiter, async (req, res) => {
    try {
        await (0, ensureUsersTable_1.ensureUsersTable)(pool);
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
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        // MVP heuristic: if first user, make ADMIN. Otherwise USER.
        const cnt = await pool.query('SELECT COUNT(*)::int as c FROM "AEVIONUser"');
        const isFirst = Number(cnt.rows?.[0]?.c || 0) === 0;
        const role = isFirst ? "ADMIN" : "USER";
        const id = crypto_1.default.randomUUID();
        await pool.query(`
      INSERT INTO "AEVIONUser" ("id","email","passwordHash","name","role")
      VALUES ($1,$2,$3,$4,$5)
      `, [id, email, passwordHash, name, role]);
        const token = signToken({ sub: id, email, role });
        res.status(201).json({
            token,
            user: { id, email, name, role },
        });
    }
    catch (err) {
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
exports.authRouter.post("/login", loginLimiter, async (req, res) => {
    try {
        await (0, ensureUsersTable_1.ensureUsersTable)(pool);
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: "email and password are required" });
        }
        const r = await pool.query(`SELECT "id","email","name","role","passwordHash" FROM "AEVIONUser" WHERE "email"=$1`, [email]);
        const user = r.rows?.[0];
        if (!user)
            return res.status(401).json({ error: "invalid credentials" });
        const ok = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!ok)
            return res.status(401).json({ error: "invalid credentials" });
        const token = signToken({ sub: user.id, email: user.email, role: user.role });
        res.json({
            token,
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
        });
    }
    catch (err) {
        res.status(500).json({ error: "login failed", details: err?.message });
    }
});
// ======================
// Me
// ======================
exports.authRouter.get("/me", async (req, res) => {
    try {
        const payload = requireAuth(req, res);
        if (!payload)
            return;
        await (0, ensureUsersTable_1.ensureUsersTable)(pool);
        const userId = payload.sub;
        const r = await pool.query(`SELECT "id","email","name","role","createdAt" FROM "AEVIONUser" WHERE "id"=$1`, [userId]);
        const user = r.rows?.[0];
        if (!user)
            return res.status(404).json({ error: "user not found" });
        res.json({ user, tokenPayload: payload });
    }
    catch (err) {
        res.status(500).json({ error: "me failed", details: err?.message });
    }
});
