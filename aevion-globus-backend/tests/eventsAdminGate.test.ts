import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { timingSafeEqual } from "crypto";

// events.ts admin gate hardening — 2026-05-10.
//
// Found during overnight Tier 3 sweep. /api/pricing/events/{summary,recent,
// by-variant} were gated like:
//
//   const required = process.env.ADMIN_TOKEN?.trim();
//   if (required) {
//     const got = (req.headers["x-admin-token"])?.trim();
//     if (got !== required) return 401;  // non-timing-safe!
//   }
//   // ...rest of handler
//
// Two bugs in the same shape:
//   1. Fail-OPEN: when ADMIN_TOKEN env unset, the if block doesn't run at
//      all → endpoint serves analytics to anyone (we already saw this in
//      qpaynet.isAdmin yesterday).
//   2. `got !== required` is non-timing-safe — string equality leaks token
//      length and prefix-match through timing.
//
// Fixed via shared adminGateBlocks(req) helper:
//   - prod + ADMIN_TOKEN unset → blocks (fail-closed)
//   - prod + ADMIN_TOKEN set + wrong header → blocks (timing-safe)
//   - prod + ADMIN_TOKEN set + correct header → allows
//   - dev/test + unset → allows (convenience)

function adminGateBlocks(env: NodeJS.ProcessEnv, headerVal: string | undefined): boolean {
  const required = env.ADMIN_TOKEN?.trim();
  if (!required) {
    return env.NODE_ENV === "production";
  }
  const got = (headerVal ?? "").trim();
  if (got.length !== required.length) return true;
  try {
    return !timingSafeEqual(Buffer.from(got), Buffer.from(required));
  } catch {
    return true;
  }
}

const ENV_KEYS = ["NODE_ENV", "ADMIN_TOKEN"];

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("events.ts adminGateBlocks", () => {
  test("PROD + token unset → BLOCKS (fail-closed)", () => {
    process.env.NODE_ENV = "production";
    expect(adminGateBlocks(process.env, undefined)).toBe(true);
    expect(adminGateBlocks(process.env, "anything")).toBe(true);
  });

  test("DEV + token unset → ALLOWS (convenience)", () => {
    process.env.NODE_ENV = "development";
    expect(adminGateBlocks(process.env, undefined)).toBe(false);
  });

  test("PROD + token set + correct header → ALLOWS", () => {
    process.env.NODE_ENV = "production";
    process.env.ADMIN_TOKEN = "x".repeat(40);
    expect(adminGateBlocks(process.env, "x".repeat(40))).toBe(false);
  });

  test("PROD + token set + wrong header → BLOCKS", () => {
    process.env.NODE_ENV = "production";
    process.env.ADMIN_TOKEN = "x".repeat(40);
    expect(adminGateBlocks(process.env, "y".repeat(40))).toBe(true);
  });

  test("PROD + token set + missing header → BLOCKS", () => {
    process.env.NODE_ENV = "production";
    process.env.ADMIN_TOKEN = "x".repeat(40);
    expect(adminGateBlocks(process.env, undefined)).toBe(true);
    expect(adminGateBlocks(process.env, "")).toBe(true);
  });

  test("PROD + token set + length-mismatched header → BLOCKS (no timingSafeEqual throw)", () => {
    process.env.NODE_ENV = "production";
    process.env.ADMIN_TOKEN = "x".repeat(40);
    expect(adminGateBlocks(process.env, "short")).toBe(true);
    expect(adminGateBlocks(process.env, "x".repeat(100))).toBe(true);
  });

  test("PROD + token set + whitespace around header → trimmed, then compared", () => {
    process.env.NODE_ENV = "production";
    process.env.ADMIN_TOKEN = "x".repeat(40);
    expect(adminGateBlocks(process.env, "   " + "x".repeat(40) + "   ")).toBe(false);
  });
});
