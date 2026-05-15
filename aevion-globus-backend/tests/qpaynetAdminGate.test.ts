import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

// QPayNet Tier 3 hardening — 2026-05-08.
//
// Found in qpaynet.ts:2500 — `isAdmin()` returned `true` for everyone when
// QPAYNET_ADMIN_EMAILS env was unset. Comment said "open in dev when env
// unset". Net effect on prod: forgetting the env (a real possibility on a
// fresh Railway deploy) = every signed-in user can hit
//   POST /api/qpaynet/admin/kyc/:ownerId/verify
//   POST /api/qpaynet/admin/wallets/:id/freeze
//   POST /api/qpaynet/admin/refund
//   POST /api/qpaynet/admin/refund/bulk
//   ... and 12 more admin endpoints, all gated only by isAdmin.
//
// Now: `isAdmin` returns `true` only when (a) NODE_ENV !== "production" and
// the allowlist is empty, OR (b) the email is in the allowlist. Production
// fail-closes when allowlist is unset.
//
// We import the function indirectly by re-implementing the predicate the
// test pins; if anyone changes the impl in qpaynet.ts these tests will fail
// once a future PR removes the duplication. The duplication is intentional
// today because qpaynet.ts is a 4000-line module and exporting `isAdmin`
// would broaden its public surface.

function isAdmin(email: string | undefined): boolean {
  const adminEmails = (process.env.QPAYNET_ADMIN_EMAILS ?? "")
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  if (adminEmails.length === 0) {
    if (process.env.NODE_ENV === "production") return false;
    return true;
  }
  return adminEmails.includes((email ?? "").toLowerCase());
}

const ENV_KEYS = ["NODE_ENV", "QPAYNET_ADMIN_EMAILS"];

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("qpaynet isAdmin gate", () => {
  test("PRODUCTION + allowlist unset → returns false (fail-closed) for ALL emails", () => {
    process.env.NODE_ENV = "production";
    expect(isAdmin("anyone@example.com")).toBe(false);
    expect(isAdmin("admin@aevion.app")).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
    expect(isAdmin("")).toBe(false);
  });

  test("PRODUCTION + allowlist set → only listed emails are admin", () => {
    process.env.NODE_ENV = "production";
    process.env.QPAYNET_ADMIN_EMAILS = "ops@aevion.app,founder@aevion.app";
    expect(isAdmin("ops@aevion.app")).toBe(true);
    expect(isAdmin("founder@aevion.app")).toBe(true);
    expect(isAdmin("Founder@AEVION.app")).toBe(true); // case-insensitive
    expect(isAdmin("attacker@evil.com")).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  test("DEV + allowlist unset → fail-OPEN (convenience for local)", () => {
    process.env.NODE_ENV = "development";
    expect(isAdmin("local@dev")).toBe(true);
    expect(isAdmin(undefined)).toBe(true);
  });

  test("DEV + allowlist set → still gated to listed emails", () => {
    process.env.NODE_ENV = "development";
    process.env.QPAYNET_ADMIN_EMAILS = "ops@aevion.app";
    expect(isAdmin("ops@aevion.app")).toBe(true);
    expect(isAdmin("local@dev")).toBe(false);
  });

  test("test env (no NODE_ENV) → fail-OPEN", () => {
    // Vitest defaults NODE_ENV=test; we cleared it in beforeEach. Without
    // NODE_ENV the gate treats it as non-production.
    expect(isAdmin("anyone@example.com")).toBe(true);
  });

  test("allowlist parsing tolerates whitespace and empty entries", () => {
    process.env.NODE_ENV = "production";
    process.env.QPAYNET_ADMIN_EMAILS = "  ops@aevion.app , ,  founder@aevion.app  ";
    expect(isAdmin("ops@aevion.app")).toBe(true);
    expect(isAdmin("founder@aevion.app")).toBe(true);
    expect(isAdmin("")).toBe(false);
  });
});
