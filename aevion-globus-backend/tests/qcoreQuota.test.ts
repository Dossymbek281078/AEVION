import { describe, it, expect, afterEach } from "vitest";
import { enforcePremiumModelQuota } from "../src/lib/qcoreQuota";
import { isPremiumModel, getPremiumModelNames } from "../src/services/qcoreai/pricing";

function mockRes() {
  const res: any = {
    status(_c: number) { return this; },
    json(_b: any) { return this; },
  };
  return res;
}

describe("isPremiumModel", () => {
  it("flags frontier models priced at/above the $5/1M output threshold", () => {
    expect(isPremiumModel("anthropic", "claude-fable-5")).toBe(true);
    expect(isPremiumModel("anthropic", "claude-opus-4-8")).toBe(true);
    expect(isPremiumModel("openai", "gpt-4-turbo")).toBe(true);
  });

  it("does not flag cheap paid models or the free fleet", () => {
    expect(isPremiumModel("openai", "gpt-4o-mini")).toBe(false);
    expect(isPremiumModel("deepseek", "deepseek-chat")).toBe(false);
    expect(isPremiumModel("groq", "llama-3.3-70b-versatile")).toBe(false); // free fleet, $0
  });

  it("returns false for an unpriced/unknown provider or model", () => {
    expect(isPremiumModel("nonexistent-provider", "nonexistent-model")).toBe(false);
    expect(isPremiumModel("anthropic", "nonexistent-model")).toBe(false);
  });
});

describe("getPremiumModelNames", () => {
  it("returns a non-empty list that includes the known frontier models", () => {
    const names = getPremiumModelNames();
    expect(names).toContain("claude-fable-5");
    expect(names).toContain("claude-opus-4-8");
    expect(names.length).toBeGreaterThan(0);
  });
});

describe("enforcePremiumModelQuota", () => {
  const savedFlag = process.env.QCOREAI_PREMIUM_QUOTA;
  afterEach(() => {
    if (savedFlag === undefined) delete process.env.QCOREAI_PREMIUM_QUOTA;
    else process.env.QCOREAI_PREMIUM_QUOTA = savedFlag;
  });

  it("is a no-op (dormant) when QCOREAI_PREMIUM_QUOTA is unset", async () => {
    delete process.env.QCOREAI_PREMIUM_QUOTA;
    const req = { headers: {} };
    const blocked = await enforcePremiumModelQuota(req as any, mockRes(), "anthropic", "claude-fable-5");
    expect(blocked).toBe(false);
  });

  it("is a no-op for a non-premium model even when the flag is on", async () => {
    process.env.QCOREAI_PREMIUM_QUOTA = "1";
    const req = { headers: {} };
    const blocked = await enforcePremiumModelQuota(req as any, mockRes(), "openai", "gpt-4o-mini");
    expect(blocked).toBe(false);
  });

  it("is a no-op for an anonymous caller even on a premium model with the flag on", async () => {
    process.env.QCOREAI_PREMIUM_QUOTA = "1";
    const req = { headers: {} }; // no Authorization header — anonymous
    const blocked = await enforcePremiumModelQuota(req as any, mockRes(), "anthropic", "claude-fable-5");
    expect(blocked).toBe(false);
  });
});
