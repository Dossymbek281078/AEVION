import { describe, test, expect, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../src/lib/authJwt";

// Bureau Tier 3 hardening — auth/JWT regressions for security findings 2026-05-08:
//
//   bureau.ts isBureauAdmin used `JWT_SECRET` env (wrong name — auth uses
//   `AUTH_JWT_SECRET`) AND fell back to a public dev default. Either every
//   admin request 403'd, or anyone who knew the OSS code could forge a
//   token. Now uses `getJwtSecret()` which fails closed in production.
//
// Stripe-provider tests live in stripeProviderHardening.test.ts so they can
// run independently — local dev may lack the stripe package.

const AUTH_KEYS = ["AUTH_JWT_SECRET", "JWT_SECRET", "NODE_ENV"];

beforeEach(() => {
  for (const k of AUTH_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of AUTH_KEYS) delete process.env[k];
});

describe("getJwtSecret production safety", () => {
  test("throws in production if AUTH_JWT_SECRET is unset", () => {
    process.env.NODE_ENV = "production";
    expect(() => getJwtSecret()).toThrow(/AUTH_JWT_SECRET/);
  });

  test("throws in production if AUTH_JWT_SECRET starts with dev-", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_JWT_SECRET = "dev-something-32chars-long-pad-pad-pad";
    expect(() => getJwtSecret()).toThrow(/AUTH_JWT_SECRET/);
  });

  test("throws in production if AUTH_JWT_SECRET is too short", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_JWT_SECRET = "short";
    expect(() => getJwtSecret()).toThrow(/AUTH_JWT_SECRET/);
  });

  test("accepts strong AUTH_JWT_SECRET in production", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_JWT_SECRET = "x".repeat(48);
    expect(getJwtSecret()).toBe("x".repeat(48));
  });

  test("accepts default in dev when AUTH_JWT_SECRET unset", () => {
    process.env.NODE_ENV = "development";
    expect(getJwtSecret()).toBe("dev-auth-secret");
  });
});

describe("admin token cannot be forged with public default secret", () => {
  test("token signed with the old hardcoded default 'dev-secret-change-me' fails verify", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_JWT_SECRET = "x".repeat(48); // strong real secret

    // Simulate an attacker who read the OSS code and used the old default.
    const attackerToken = jwt.sign(
      { sub: "u1", email: "evil@example.com", role: "admin" },
      "dev-secret-change-me",
    );

    expect(() => jwt.verify(attackerToken, getJwtSecret(), { algorithms: ["HS256"] })).toThrow();
  });

  test("token signed with the production secret verifies correctly", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_JWT_SECRET = "x".repeat(48);

    const goodToken = jwt.sign({ sub: "u1", email: "ok@example.com", role: "admin" }, "x".repeat(48));
    const decoded = jwt.verify(goodToken, getJwtSecret(), { algorithms: ["HS256"] }) as Record<string, unknown>;
    expect(decoded.email).toBe("ok@example.com");
    expect(decoded.role).toBe("admin");
  });

  test("only HS256 is accepted (alg confusion attack — RS256 token rejected)", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_JWT_SECRET = "x".repeat(48);

    // jwt.sign with secret + RS256 isn't valid; we instead simulate via 'none' alg.
    const noAlgToken = jwt.sign({ sub: "u", role: "admin" }, "", { algorithm: "none" } as jwt.SignOptions);
    expect(() => jwt.verify(noAlgToken, getJwtSecret(), { algorithms: ["HS256"] })).toThrow();
  });
});
