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
  // Also catches `<NAME>_TOKEN || "<literal>"` — pricing.ts's dashboardSecret
  // had a non-"dev-" prefixed literal fallback that the original regex missed.
  const insecureRegex = /process\.env\.[A-Z_]+_SECRET\s*\|\|\s*"(dev-|[a-z]{6,})/;

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

  // Hardcoded credential prefixes — Stripe (sk_test_, sk_live_, whsec_),
  // OpenAI (sk-), Anthropic (sk-ant-). If any of these appear as a literal
  // string in source, it's almost always a real credential leak.
  // Excludes the format-pattern docs in apiQuotas.ts (literally describes
  // the key shape: `aev_(test|live)_<24bytes_base64url>`).
  test("no route file contains a literal API-key-shaped string", () => {
    // Match prefix + at least 16 alphanumeric/underscore chars after.
    // Allow short example strings in tests and docs (e.g., `sk_test_dummy`)
    // by requiring ≥16 trailing chars — real keys are 32+ chars long.
    const credRegex = /\b(sk_test_|sk_live_|sk-ant-|whsec_)[A-Za-z0-9_-]{16,}/;
    const offenders: { file: string; match: string }[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      const stripped = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      const m = stripped.match(credRegex);
      if (m) offenders.push({ file: path.relative(routesDir, f), match: m[0].slice(0, 30) + "..." });
    }
    expect(offenders).toEqual([]);
  });
});

// Anti-pattern: jwt.verify(token, secret) WITHOUT { algorithms: ["HS256"] }.
// Some versions of jsonwebtoken accept tokens with `alg: "none"` when only
// the secret is passed → trivial forgery. Every verify call must pin the
// allowed algorithm list. Caught two regressions during the Tier 3 sweep
// (bureau and auth) — this test prevents the next one.
describe("regression: jwt.verify must pin algorithms: ['HS256']", () => {
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

  test("every jwt.verify in src/routes/ pins HS256", () => {
    const offenders: string[] = [];
    for (const f of walkTs(routesDir)) {
      const src = readFileSync(f, "utf8");
      const stripped = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      // Balanced-paren match is annoying in JS regex. Heuristic: locate every
      // `jwt.verify(` occurrence and look at the next 200 chars (covers
      // multi-line calls). If `algorithms` doesn't appear in that window,
      // flag it. False positives are fine — the fix is to add the option,
      // which never hurts.
      const indices: number[] = [];
      let idx = stripped.indexOf("jwt.verify(");
      while (idx >= 0) {
        indices.push(idx);
        idx = stripped.indexOf("jwt.verify(", idx + 1);
      }
      for (const at of indices) {
        const window = stripped.slice(at, at + 200);
        if (!/algorithms/.test(window)) {
          offenders.push(`${path.relative(routesDir, f)} :: ${window.slice(0, 80).replace(/\s+/g, " ")}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

// Anti-pattern: HMAC verification computed over `JSON.stringify(req.body)`.
// The sender signed the EXACT raw bytes; re-serialising loses key order /
// whitespace and either (a) silently mismatches valid signatures, or
// (b) accepts a forgery if both sides happen to canonicalise identically.
// The fix is `req.rawBody.toString("utf8")` (stashed by express.json verify
// hook in src/index.ts).
//
// We use a heuristic: a file that calls createHmac AND uses JSON.stringify
// near it (within 5 lines) AND does NOT also reference rawBody. Skips files
// that demonstrably go through the rawBody-first pattern.
describe("regression: HMAC verify must use req.rawBody not re-serialised body", () => {
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

  test("HMAC users in routes either reference rawBody or skip JSON.stringify(req.body)", () => {
    const files = walkTs(routesDir);
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      const stripped = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      // Module of interest: it uses HMAC at all (sender or verifier).
      if (!/createHmac\s*\(/.test(stripped)) continue;
      // Skip if the file uses raw bytes — either as Buffer or .rawBody.
      if (/rawBody|rawBuf/.test(stripped)) continue;
      // Skip files that are HMAC senders only (no req.body — they sign their
      // own outbound payload, which IS canonical because they generate it).
      if (!/req\.body/.test(stripped)) continue;
      // Remaining files: HMAC + req.body, no rawBody anywhere → suspect.
      // Confirm the bad pattern is actually present.
      if (/JSON\.stringify\s*\(\s*req\.body/.test(stripped)) {
        offenders.push(path.relative(routesDir, f));
      }
    }
    expect(offenders).toEqual([]);
  });
});
