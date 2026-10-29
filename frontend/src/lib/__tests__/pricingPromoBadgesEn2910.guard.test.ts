import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROMO_EN, BADGE_STATUS_EN, localizePromoDescription, localizeTrustBadge } from "../pricingLocalize";

/**
 * 29.10.2026, замер прода f4a0c073a: на /en/pricing по-русски шли 3 подсказки промо
 * («Стартапам в первый год…», «Реферальный…») и знаки соответствия («аудит не пройден»,
 * «Хранение в РК»). Тексты приходят ДАННЫМИ с бэкенда — перевод по русскому тексту.
 * Сторож: каждое промо и каждый не-live статус бэкенда имеет перевод.
 */
const БЭК = join(process.cwd(), "..", "aevion-globus-backend", "src", "data");
const промо = [...readFileSync(join(БЭК, "pricing.ts"), "utf8").matchAll(/^\s+description: "([^"]+)",$/gm)].map((m) => m[1]).filter((d) => /[А-Яа-яЁё]/.test(d));
const статусы = [...readFileSync(join(БЭК, "trust.ts"), "utf8").matchAll(/status: "([^"]+)", category/g)].map((m) => m[1]).filter((s) => s !== "live");

describe("/pricing на en: промо и знаки соответствия переведены", () => {
  it("КОНТРОЛЬ: прибор нашёл промо и статусы в данных бэкенда", () => {
    expect(промо.length).toBeGreaterThanOrEqual(5);
    expect(статусы).toContain("аудит не пройден");
  });

  it("каждое промо бэкенда имеет английский текст", () => {
    expect(промо.filter((d) => !PROMO_EN[d])).toEqual([]);
    for (const d of промо) expect(localizePromoDescription(d, "en")).not.toMatch(/[А-Яа-яЁё]/);
  });

  it("каждый не-live статус знака имеет английский текст", () => {
    expect(статусы.filter((s) => !BADGE_STATUS_EN[s])).toEqual([]);
  });

  it("знак «Хранение в РК» на en — без кириллицы; на ru и kk — как с бэкенда", () => {
    const b = { id: "kz-152", label: "Хранение в РК", status: "локализацию данных в РК не предоставляем" };
    const en = localizeTrustBadge(b, "en");
    expect(`${en.label} ${en.status}`).not.toMatch(/[А-Яа-яЁё]/);
    expect(localizeTrustBadge(b, "ru")).toEqual(b);
    expect(localizeTrustBadge(b, "kk")).toEqual(b);
  });

  it("изменился статус на бэкенде — показывается русский, а не устаревший перевод", () => {
    const b = { id: "soc2", label: "SOC2 Type II", status: "аудит назначен" };
    expect(localizeTrustBadge(b, "en").status).toBe("аудит назначен");
  });
});
