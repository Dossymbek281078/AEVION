import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { getQSignSecret } from "../src/lib/qsignSecret";

// Tier 3 systemic hardening — 2026-05-08 sweep.
//
// Found and fixed across awards.ts, modules.ts, planetCompliance.ts (×3),
// pipeline.ts, quantum-shield.ts: each had its own copy of
// `process.env.<*_SECRET> || "dev-<*>-secret"`. Net effect:
//   - Anyone with the OSS source can sign JWTs / HMACs that the platform
//     accepts when the env var is unset (a default Railway misconfig).
//   - Several of those copies also used the wrong env name (`JWT_SECRET`
//     instead of `AUTH_JWT_SECRET`), so admin endpoints were unusable on
//     prod even with the correct var set.
//
// This test file pins both:
//   1. the new shared helper getQSignSecret() behaviour
//   2. a static grep over src/routes/ that fails if anyone reintroduces the
//      pattern (regression guard).

const ENV_KEYS = ["NODE_ENV", "QSIGN_SECRET"];

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("getQSignSecret production safety", () => {
  test("throws in production if QSIGN_SECRET is unset", () => {
    process.env.NODE_ENV = "production";
    expect(() => getQSignSecret()).toThrow(/QSIGN_SECRET/);
  });

  test("throws in production if QSIGN_SECRET starts with dev-", () => {
    process.env.NODE_ENV = "production";
    process.env.QSIGN_SECRET = "dev-32-chars-long-pad-pad-pad-pad-pad";
    expect(() => getQSignSecret()).toThrow(/QSIGN_SECRET/);
  });

  test("throws in production if QSIGN_SECRET is too short", () => {
    process.env.NODE_ENV = "production";
    process.env.QSIGN_SECRET = "short";
    expect(() => getQSignSecret()).toThrow(/QSIGN_SECRET/);
  });

  test("accepts strong QSIGN_SECRET in production", () => {
    process.env.NODE_ENV = "production";
    process.env.QSIGN_SECRET = "x".repeat(48);
    expect(getQSignSecret()).toBe("x".repeat(48));
  });

  test("accepts default in dev when unset", () => {
    process.env.NODE_ENV = "development";
    expect(getQSignSecret()).toBe("dev-qsign-secret");
  });
});

// Static regression — fails if anyone reintroduces a hardcoded dev fallback.
// This is a defense-in-depth check; CI catches it before merge.
describe("regression: no insecure secret defaults in src/routes/", () => {
  const routesDir = path.join(__dirname, "..", "src", "routes");

  function walkTs(dir: string): string[] {
    const out: string[] = [];
    for (const ent of readdirSync(dir)) {
      const full = path.join(dir, ent);
      const st = statSync(full);
      if (st.isDirectory()) out.push(...walkTs(full));
      else if (ent.endsWith(".ts")) out.push(full);
    }
    return out;
  }

  const files = walkTs(routesDir);

  // Pattern: `<NAME>_SECRET || "dev-` (the regression we fixed).
  const insecureRegex = /process\.env\.[A-Z_]+_SECRET\s*\|\|\s*"dev-/;

  test("no route uses the `process.env.*_SECRET || \"dev-...\"` pattern", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      // Strip line comments before scanning so explanatory comments don't trip.
      const stripped = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      if (insecureRegex.test(stripped)) offenders.push(path.relative(routesDir, f));
    }
    expect(offenders).toEqual([]);
  });

  test("no route hardcodes the literal default secrets", () => {
    const literals = ['"dev-auth-secret"', '"dev-qsign-secret"', '"dev-secret-change-me"'];
    const offenders: { file: string; literal: string }[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      const stripped = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const lit of literals) {
        if (stripped.includes(lit)) offenders.push({ file: path.relative(routesDir, f), literal: lit });
      }
    }
    expect(offenders).toEqual([]);
  });
});
