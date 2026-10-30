import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "src", "services", "qcoreai");
const providers = readFileSync(join(root, "providers.ts"), "utf8");
const pricing = readFileSync(join(root, "pricing.ts"), "utf8");

const LIVE = "google/gemma-4-31b-it:free";

describe("OpenRouter: умолчание живое (30.10.2026)", () => {
  it("умолчание OPENROUTER_MODEL — gemma-4-31b, переменная окружения главнее", () => {
    expect(providers).toContain(`process.env.OPENROUTER_MODEL || "${LIVE}"`);
  });

  it("nemotron-3-super в providers.ts только в комментарии со словом «снят»", () => {
    for (const line of providers.split("\n").filter((l) => l.includes("nemotron-3-super"))) {
      expect(line.trim().startsWith("//") && /снят/.test(line)).toBe(true);
    }
  });

  it("в pricing.ts у каждого бесплатного слуги OpenRouter, кроме живого, пометка «снят»", () => {
    const block = pricing.slice(pricing.indexOf("openrouter: freeModels("), pricing.indexOf("groq: freeModels("));
    const lines = block.split("\n").filter((l) => /^\s*"[^"]+:free",/.test(l));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      if (l.includes(`"${LIVE}"`)) expect(l).not.toMatch(/снят/);
      else expect(l).toMatch(/\/\/ снят 30\.10\.2026/);
    }
  });
});
