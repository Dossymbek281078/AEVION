"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stubKycProvider = void 0;
exports.__resetStubKycSessions = __resetStubKycSessions;
exports.__seedStubKycSession = __seedStubKycSession;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Deterministic stub for development and CI.
 *
 * Behaviour rules (so tests can assert):
 *   - Sessions expire 30 minutes after start.
 *   - getSession() always returns "approved" with the declared name +
 *     country, plus a synthesized doc type. This lets the upgrade flow
 *     run end-to-end without a real KYC vendor.
 *   - If declaredName starts with "FAIL_KYC_", the result is "rejected"
 *     with a reason — useful for unit tests of the negative path.
 *   - parseWebhook expects a body of {sessionId, force?} and returns the
 *     same deterministic result. No signature check (production
 *     providers MUST verify signatures; the route layer enforces only
 *     that the parsed sessionId exists in our DB).
 */
const stubSessions = new Map();
function decideFor(input) {
    const now = new Date().toISOString();
    if (typeof input.declaredName === "string" &&
        input.declaredName.startsWith("FAIL_KYC_")) {
        return {
            status: "rejected",
            decidedAt: now,
            reason: "Stub provider: synthetic rejection (declared name starts with FAIL_KYC_)",
            verifiedName: null,
            verifiedDocType: null,
            verifiedCountry: null,
            raw: { stub: true, decision: "rejected", input },
        };
    }
    return {
        status: "approved",
        decidedAt: now,
        reason: null,
        verifiedName: input.declaredName ?? "Stub Test Subject",
        verifiedDocType: "passport",
        verifiedCountry: input.declaredCountry ?? "KZ",
        raw: { stub: true, decision: "approved", input },
    };
}
exports.stubKycProvider = {
    id: "stub",
    async startSession(input) {
        const sessionId = "kyc-stub-" + crypto_1.default.randomBytes(8).toString("hex");
        const createdAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        stubSessions.set(sessionId, { input, createdAt, expiresAt });
        return {
            sessionId,
            redirectUrl: `/bureau/kyc-stub/${sessionId}`,
            status: "pending",
            expiresAt,
        };
    },
    async getSession(sessionId) {
        const s = stubSessions.get(sessionId);
        if (!s) {
            return {
                status: "expired",
                decidedAt: new Date().toISOString(),
                reason: "Stub session not found",
                verifiedName: null,
                verifiedDocType: null,
                verifiedCountry: null,
                raw: null,
            };
        }
        if (new Date(s.expiresAt).getTime() < Date.now()) {
            stubSessions.delete(sessionId);
            return {
                status: "expired",
                decidedAt: new Date().toISOString(),
                reason: "Stub session expired",
                verifiedName: null,
                verifiedDocType: null,
                verifiedCountry: null,
                raw: null,
            };
        }
        return decideFor(s.input);
    },
    parseWebhook(_headers, rawBody) {
        let body;
        try {
            body = JSON.parse(rawBody);
        }
        catch {
            throw new Error("Stub webhook: body is not valid JSON");
        }
        const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
        if (!sessionId) {
            throw new Error("Stub webhook: sessionId missing");
        }
        const s = stubSessions.get(sessionId);
        if (!s) {
            throw new Error(`Stub webhook: unknown sessionId ${sessionId}`);
        }
        return { sessionId, result: decideFor(s.input) };
    },
};
/** Test-only: reset session storage. */
function __resetStubKycSessions() {
    stubSessions.clear();
}
/** Test-only: pre-seed a session (used by route tests). */
function __seedStubKycSession(sessionId, input) {
    stubSessions.set(sessionId, {
        input,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
}
