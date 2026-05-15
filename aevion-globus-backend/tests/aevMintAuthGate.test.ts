import { describe, test, expect, beforeEach, afterEach } from "vitest";

// AEV /mint + /sync auth gate — R1 boundary closure (2026-05-09 → 2026-05-10).
//
// The legacy QTrade-style mining MVP exposed POST /api/aev/wallet/:device/mint
// and /sync as PUBLIC endpoints. Anyone with any deviceId could mint
// arbitrary amounts of AEC. Documented as a critical finding in
// docs/bank/AEV_PUBLIC_MINT_FINDING_2026-05-09.md.
//
// The fix is a coordinated 3-step change:
//   1. (THIS FILE pins the predicate) — a production-only auth gate
//   2. bank-prod-smoke.js authenticates BEFORE running runAev()
//   3. (Future) frontend mining UI uses internalMintForDevice() server side
//
// requireAuthForMintIfProd is in routes/aev.ts; we re-implement it inline
// here to test the predicate without spinning up Express. The duplication
// is intentional — keep these in lockstep.

function predicate(env: NodeJS.ProcessEnv, hasBearer: boolean): "allowed" | "blocked" {
  const isProd = env.NODE_ENV === "production";
  const escapeHatch = env.AEV_PUBLIC_MINT_ENABLED === "1";
  if (hasBearer) return "allowed";
  if (isProd && !escapeHatch) return "blocked";
  return "allowed";
}

const ENV_KEYS = ["NODE_ENV", "AEV_PUBLIC_MINT_ENABLED"];

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("AEV mint auth gate — R1 boundary enforcement", () => {
  test("PROD + no bearer → blocked", () => {
    process.env.NODE_ENV = "production";
    expect(predicate(process.env, false)).toBe("blocked");
  });

  test("PROD + bearer → allowed", () => {
    process.env.NODE_ENV = "production";
    expect(predicate(process.env, true)).toBe("allowed");
  });

  test("DEV + no bearer → allowed (smoke + local)", () => {
    process.env.NODE_ENV = "development";
    expect(predicate(process.env, false)).toBe("allowed");
  });

  test("test env (NODE_ENV unset) + no bearer → allowed", () => {
    expect(predicate(process.env, false)).toBe("allowed");
  });

  test("PROD + escape hatch AEV_PUBLIC_MINT_ENABLED=1 → allowed even without bearer", () => {
    process.env.NODE_ENV = "production";
    process.env.AEV_PUBLIC_MINT_ENABLED = "1";
    expect(predicate(process.env, false)).toBe("allowed");
  });

  test("PROD + escape hatch set to 0/empty → still blocked", () => {
    process.env.NODE_ENV = "production";
    process.env.AEV_PUBLIC_MINT_ENABLED = "0";
    expect(predicate(process.env, false)).toBe("blocked");
    process.env.AEV_PUBLIC_MINT_ENABLED = "";
    expect(predicate(process.env, false)).toBe("blocked");
  });

  test("PROD + escape hatch set to 'true' (not '1') → still blocked (strict comparison)", () => {
    // Forces ops to use the documented value — no ambiguous truthy strings.
    process.env.NODE_ENV = "production";
    process.env.AEV_PUBLIC_MINT_ENABLED = "true";
    expect(predicate(process.env, false)).toBe("blocked");
    process.env.AEV_PUBLIC_MINT_ENABLED = "yes";
    expect(predicate(process.env, false)).toBe("blocked");
  });

  test("PROD + bearer + escape hatch off → allowed (bearer always wins)", () => {
    process.env.NODE_ENV = "production";
    expect(predicate(process.env, true)).toBe("allowed");
  });
});
