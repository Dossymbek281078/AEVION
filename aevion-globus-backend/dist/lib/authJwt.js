"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJwtSecret = getJwtSecret;
exports.verifyBearerOptional = verifyBearerOptional;
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function getJwtSecret() {
    return process.env.AUTH_JWT_SECRET || "dev-auth-secret";
}
/** Returns payload or null if missing/invalid token (no HTTP response). */
function verifyBearerOptional(req) {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token)
        return null;
    try {
        return jsonwebtoken_1.default.verify(token, getJwtSecret());
    }
    catch {
        return null;
    }
}
/**
 * Express middleware: rejects with 401 unless a valid bearer token is present.
 * On success, attaches the decoded payload to `req.auth` so route handlers
 * can scope queries to the authenticated user.
 */
function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
        res.status(401).json({ error: "missing bearer token" });
        return;
    }
    try {
        req.auth = jsonwebtoken_1.default.verify(token, getJwtSecret());
        next();
    }
    catch (e) {
        res.status(401).json({
            error: "invalid token",
            details: e instanceof Error ? e.message : String(e),
        });
    }
}
