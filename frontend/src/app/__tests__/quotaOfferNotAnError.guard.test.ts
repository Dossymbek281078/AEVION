/**
 * 🔴 Волна 2 (19.10.2026): когда бесплатная норма действий исчерпана, человек видит
 * ПРЕДЛОЖЕНИЕ с ценой плана и путём к тарифам, а не красную «ошибку». Две поверхности:
 * регистрация в QRight (POST /api/pipeline/protect → 402 free_quota_exceeded) и
 * публикация на Бирже стартапов (POST /api/startupx/ideas → 402).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const QRIGHT = readFileSync(join(root, "qright", "page.tsx"), "utf8");
const WIZARD = readFileSync(join(root, "startup-exchange", "components", "ListingWizard.tsx"), "utf8");
const LIB = readFileSync(join(root, "startup-exchange", "lib.ts"), "utf8");

describe("норма исчерпана — предложение, не ошибка (волна 2)", () => {
  it("QRight: 402 free_quota_exceeded уходит в предложение, а не в throw", () => {
    expect(QRIGHT).toContain('if (res.status === 402 && data?.error === "free_quota_exceeded") {');
    const i = QRIGHT.indexOf('if (res.status === 402 && data?.error === "free_quota_exceeded") {');
    const j = QRIGHT.indexOf("if (!res.ok) throw new Error", i);
    expect(j, "402 обрабатывается до общего throw").toBeGreaterThan(i);
    expect(QRIGHT).toContain('data-testid="quota-offer"');
    expect(QRIGHT).toContain("planetFromPerMonth()");
    expect(QRIGHT).toContain('href="/pricing#tiers"');
  });
  it("Биржа: ApiError несёт код, визард показывает предложение с ценой плана", () => {
    expect(LIB).toContain("free_quota_exceeded:");
    expect(LIB).toContain("body?.issues ?? [], body?.error)");
    expect(WIZARD).toContain('e instanceof ApiError && e.code === "free_quota_exceeded"');
    expect(WIZARD).toContain('data-testid="quota-offer"');
    expect(WIZARD).toContain("planetFromPerMonth()");
    expect(WIZARD).toContain('href="/pricing#tiers"');
  });
  it("цена в предложении — из лесенки плана, не числом", () => {
    for (const [имя, src] of [["qright", QRIGHT], ["wizard", WIZARD]] as const) {
      const i = src.indexOf('data-testid="quota-offer"');
      const блок = src.slice(i, i + 900);
      expect(блок, `${имя}: цена вписана числом`).not.toMatch(/\$(150|250)\b/);
      expect(блок).toContain('planetPricePerMonth("lite")');
    }
  });
});
