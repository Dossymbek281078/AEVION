import { describe, test, expect } from "vitest";

// GET /api/auth/admin/correlate/:userId (routes/auth.ts) — cross-account
// device correlation for multi-accounting/ban-evasion detection (built
// alongside the CyberChess anti-cheat server-time-signal work, but this
// endpoint is platform-wide: any AEVION module can use it, not just chess).
//
// requireAuth() already pins JWT alg to HS256 and is covered implicitly by
// every other authenticated route in this file; what's specific to THIS
// route is the extra admin-role gate layered on top. Re-implemented inline
// here (same convention as aevMintAuthGate.test.ts) to pin the predicate
// without spinning up Express + a real Postgres connection.

function adminGatePredicate(role: string | undefined, userIdParam: string): "allowed" | "forbidden" | "bad_request" {
  if (role !== "ADMIN") return "forbidden";
  if (!userIdParam.trim()) return "bad_request";
  return "allowed";
}

describe("GET /admin/correlate/:userId — admin gate", () => {
  test("role !== 'ADMIN' → forbidden, regardless of a valid userId", () => {
    expect(adminGatePredicate("USER", "user123")).toBe("forbidden");
  });

  test("no role at all (legacy token) → forbidden", () => {
    expect(adminGatePredicate(undefined, "user123")).toBe("forbidden");
  });

  test("role === 'ADMIN' + valid userId → allowed", () => {
    expect(adminGatePredicate("ADMIN", "user123")).toBe("allowed");
  });

  test("role === 'ADMIN' but empty/whitespace userId → bad_request, not allowed", () => {
    expect(adminGatePredicate("ADMIN", "")).toBe("bad_request");
    expect(adminGatePredicate("ADMIN", "   ")).toBe("bad_request");
  });

  test("case-sensitive: 'admin' (lowercase) does not satisfy the ADMIN check", () => {
    // AEVIONUser.role is stored/compared as exactly "ADMIN" (see auth.ts
    // register handler: role = isFirst ? "ADMIN" : "USER") — a role value
    // that merely looks admin-ish but isn't the exact stored casing must
    // not slip through.
    expect(adminGatePredicate("admin", "user123")).toBe("forbidden");
  });
});
