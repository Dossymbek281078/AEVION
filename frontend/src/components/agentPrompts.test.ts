import { describe, test, expect } from "vitest";
import { suggestPromptsFor } from "./agentPrompts";

describe("suggestPromptsFor", () => {
  test("returns 3–4 prompts that all name the module", () => {
    const out = suggestPromptsFor({ id: "qright", code: "QRIGHT", name: "QRight", kind: "registry" });
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(out.length).toBeLessThanOrEqual(4);
    expect(out.every((p) => p.includes("QRight"))).toBe(true);
  });

  test("fintech-ish modules get a payment-link prompt", () => {
    const out = suggestPromptsFor({ id: "qpaynet-embedded", name: "QPayNet", tags: ["fintech", "pay"] });
    expect(out.some((p) => /payment link/i.test(p))).toBe(true);
    expect(out.some((p) => /voice a 20-second/i.test(p))).toBe(false);
  });

  test("music/awards modules get a music prompt", () => {
    const out = suggestPromptsFor({ id: "awards", name: "Awards", tags: ["music", "film"] });
    expect(out.some((p) => /music clip/i.test(p))).toBe(true);
  });

  test("generic module gets the voice-intro prompt (no category match)", () => {
    const out = suggestPromptsFor({ id: "qlife", name: "QLife" });
    expect(out.some((p) => /voice a 20-second/i.test(p))).toBe(true);
  });

  test("falls back to code/id when name is empty", () => {
    const out = suggestPromptsFor({ id: "x1", code: "X1", name: "" });
    expect(out[0]).toContain("X1");
  });
});
