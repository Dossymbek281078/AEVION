import crypto from "crypto";
import {
  KycProvider,
  KycResult,
  KycSession,
  KycSessionStart,
} from "./provider";

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

const stubSessions = new Map<
  string,
  { input: KycSessionStart; createdAt: string; expiresAt: string }
>();

function decideFor(input: KycSessionStart): KycResult {
  const now = new Date().toISOString();
  if (
    typeof input.declaredName === "string" &&
    input.declaredName.startsWith("FAIL_KYC_")
  ) {
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

export const stubKycProvider: KycProvider = {
  id: "stub",

  async startSession(input: KycSessionStart): Promise<KycSession> {
    const sessionId = "kyc-stub-" + crypto.randomBytes(8).toString("hex");
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

  async getSession(sessionId: string): Promise<KycResult> {
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

  parseWebhook(_headers: Record<string, string>, rawBody: string) {
    let body: { sessionId?: unknown };
    try {
      body = JSON.parse(rawBody) as { sessionId?: unknown };
    } catch {
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
export function __resetStubKycSessions(): void {
  stubSessions.clear();
}

/** Test-only: pre-seed a session (used by route tests). */
export function __seedStubKycSession(
  sessionId: string,
  input: KycSessionStart,
): void {
  stubSessions.set(sessionId, {
    input,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
}
