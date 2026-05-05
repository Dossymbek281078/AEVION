import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { bureauAecReward } from "../src/routes/bureau";

// Tests the env-var-driven AEC reward sizing for Bureau tiers.
// Default behaviour (no env vars) is 0 across all tiers — boundary rule R1
// from docs/bank/AEC_FIAT_BOUNDARY.md says reward sizing is a product
// decision and ships as 0 by default.

const KEYS = [
  "BUREAU_VERIFIED_AEC_REWARD",
  "BUREAU_NOTARIZED_AEC_REWARD",
  "BUREAU_FILED_KZ_AEC_REWARD",
  "BUREAU_FILED_PCT_AEC_REWARD",
];

beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

describe("bureauAecReward", () => {
  test("defaults to 0 for every known tier when env vars unset", () => {
    expect(bureauAecReward("verified")).toBe(0);
    expect(bureauAecReward("notarized")).toBe(0);
    expect(bureauAecReward("filed-kz")).toBe(0);
    expect(bureauAecReward("filed-pct")).toBe(0);
  });

  test("returns 0 for unknown tier", () => {
    expect(bureauAecReward("unknown-tier")).toBe(0);
    expect(bureauAecReward("")).toBe(0);
  });

  test("reads env vars per tier", () => {
    process.env.BUREAU_VERIFIED_AEC_REWARD = "50";
    process.env.BUREAU_NOTARIZED_AEC_REWARD = "150";
    process.env.BUREAU_FILED_KZ_AEC_REWARD = "500";
    process.env.BUREAU_FILED_PCT_AEC_REWARD = "1000";
    expect(bureauAecReward("verified")).toBe(50);
    expect(bureauAecReward("notarized")).toBe(150);
    expect(bureauAecReward("filed-kz")).toBe(500);
    expect(bureauAecReward("filed-pct")).toBe(1000);
  });

  test("floors fractional values", () => {
    process.env.BUREAU_VERIFIED_AEC_REWARD = "50.9";
    expect(bureauAecReward("verified")).toBe(50);
  });

  test("rejects negative values, falls back to 0", () => {
    process.env.BUREAU_VERIFIED_AEC_REWARD = "-50";
    expect(bureauAecReward("verified")).toBe(0);
  });

  test("rejects non-numeric values, falls back to 0", () => {
    process.env.BUREAU_VERIFIED_AEC_REWARD = "fifty";
    expect(bureauAecReward("verified")).toBe(0);
  });

  test("rejects empty string, falls back to 0", () => {
    process.env.BUREAU_VERIFIED_AEC_REWARD = "";
    expect(bureauAecReward("verified")).toBe(0);
  });
});
