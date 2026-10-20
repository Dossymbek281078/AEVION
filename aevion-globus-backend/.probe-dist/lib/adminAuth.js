"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAllowlist = adminAllowlist;
exports.checkAdmin = checkAdmin;
exports.isAdminRequest = isAdminRequest;
const authJwt_1 = require("./authJwt");
function adminAllowlist() {
    return (process.env.CONSTITUTION_ADMIN_ALLOWLIST || "yahiin1978@gmail.com")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
}
function checkAdmin(req) {
    const payload = (0, authJwt_1.verifyBearerOptional)(req);
    if (!payload)
        return { ok: false, reason: "no-token", email: null };
    const p = payload;
    const email = typeof p.email === "string" ? p.email.toLowerCase() : null;
    if (p.role === "admin")
        return { ok: true, reason: "jwt-role", email };
    if (email && adminAllowlist().includes(email)) {
        return { ok: true, reason: "allowlist", email };
    }
    return { ok: false, reason: "denied", email };
}
/** Короткая форма для тех, кому нужен только ответ «да/нет». */
function isAdminRequest(req) {
    return checkAdmin(req).ok;
}
