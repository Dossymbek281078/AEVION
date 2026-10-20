"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJwtSecret = getJwtSecret;
exports.verifyBearerOptional = verifyBearerOptional;
exports.verifyBearerToken = verifyBearerToken;
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const tokenVersion_1 = require("./tokenVersion");
function getJwtSecret() {
    const secret = process.env.AUTH_JWT_SECRET;
    // In production we refuse to issue or verify with a default/dev secret —
    // anything else lets anyone with the OSS code forge tokens.
    if (process.env.NODE_ENV === "production") {
        if (!secret || secret.length < 32 || secret.startsWith("dev-")) {
            throw new Error("AUTH_JWT_SECRET is missing or weak in production — refusing to mint/verify JWTs");
        }
        return secret;
    }
    return secret || "dev-auth-secret";
}
/** Returns payload or null if missing/invalid token (no HTTP response). */
function verifyBearerOptional(req) {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token)
        return null;
    try {
        const payload = jsonwebtoken_1.default.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
        // Подпись верна — но токен мог быть отозван. До 21.08.2026 этой проверки
        // не было вовсе: поле `tv` описано абзацем выше и не читалось никем,
        // то есть отозвать выданный токен было НЕЛЬЗЯ ничем.
        if (!(0, tokenVersion_1.tokenVersionAccepted)(payload?.sub, payload?.tv))
            return null;
        return payload;
    }
    catch {
        return null;
    }
}
/**
 * Verify a raw token string (e.g. from a WebSocket `?token=` query).
 * Browsers can't set Authorization on WebSocket upgrade — query params are
 * the standard workaround. Returns null on missing/invalid.
 */
function verifyBearerToken(token) {
    if (!token)
        return null;
    try {
        const payload = jsonwebtoken_1.default.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
        // То же и для веб-сокетов: без этого отозванный токен продолжал бы
        // работать именно там, где соединение живёт долго.
        if (!(0, tokenVersion_1.tokenVersionAccepted)(payload?.sub, payload?.tv))
            return null;
        return payload;
    }
    catch {
        return null;
    }
}
/**
 * Express middleware — rejects unauthenticated requests with 401.
 * On success attaches the JWT payload as `(req as any).auth`.
 * Used by bank-track routes that require a signed-in user.
 */
function requireAuth(req, res, next) {
    const payload = verifyBearerOptional(req);
    if (!payload) {
        res.status(401).json({ error: "auth required" });
        return;
    }
    req.auth = payload;
    next();
}
