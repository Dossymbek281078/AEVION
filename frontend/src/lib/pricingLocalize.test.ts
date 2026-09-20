import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  localizeModuleOneLiner,
  localizeNotes,
  localizePromoDescription,
  localizeTier,
  localizeTrustNumber,
  sameDigits,
} from "./pricingLocalize";

/**
 * Сторож английской страницы цен (20.09.2026). Данные тарифов приходят из
 * бэкенда по-русски; здесь проверяется, что для языка en КАЖДАЯ строка
 * фикстуры (та же форма, что у `/api/pricing`) получает перевод, а числа в
 * переводе совпадают с оригиналом. Пропущенный перевод — красный, а не тихий
 * откат на русский (feedback_missing_translation_falls_back_silently).
 */

const CYRILLIC = /[а-яё]/i;

type Fixture = {
  tiers: Array<{ id: string; tagline: string; features: string[]; ctaLabel: string }>;
  modules: Array<{ id: string; oneLiner: string }>;
  notes: string[];
};
type Trust = { numbers: Array<{ label: string; value: string; hint?: string }> };

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8")) as T;
}

const pricing = readJson<Fixture>("../app/pricing/__tests__/__fixtures__/pricing.json");
const trust = readJson<Trust>("../app/pricing/__tests__/__fixtures__/trust.json");

describe("pricingLocalize: тарифы", () => {
  it("фикстура не пуста — контроль прибора", () => {
    expect(pricing.tiers.length).toBeGreaterThanOrEqual(7);
    expect(pricing.modules.length).toBeGreaterThan(30);
    expect(pricing.notes.length).toBeGreaterThan(0);
    expect(trust.numbers.length).toBeGreaterThan(0);
    // и русский текст в ней действительно есть — иначе «нет кириллицы» ничего не проверяет
    expect(pricing.tiers.some((t) => CYRILLIC.test(t.tagline))).toBe(true);
  });

  it("en: у каждого тарифа переведены подзаголовок, кнопка и каждый пункт", () => {
    for (const tier of pricing.tiers) {
      const en = localizeTier(tier, "en");
      expect(en.tagline, `${tier.id}: tagline`).not.toMatch(CYRILLIC);
      expect(en.ctaLabel, `${tier.id}: ctaLabel`).not.toMatch(CYRILLIC);
      en.features.forEach((f, i) => {
        expect(f, `${tier.id}: feature[${i}] «${tier.features[i]}»`).not.toMatch(CYRILLIC);
        expect(sameDigits(tier.features[i], f), `${tier.id}: числа feature[${i}]`).toBe(true);
      });
      expect(en.features.length).toBe(tier.features.length);
      expect(sameDigits(tier.tagline, en.tagline)).toBe(true);
    }
  });

  it("ru и kk: объект возвращается как есть, без копирования", () => {
    for (const tier of pricing.tiers) {
      expect(localizeTier(tier, "ru")).toBe(tier);
      expect(localizeTier(tier, "kk")).toBe(tier);
    }
  });

  it("если бэкенд поменял цену, а перевод отстал — показывается русская строка с верным числом", () => {
    const lite = pricing.tiers.find((t) => t.id === "lite");
    if (!lite) throw new Error("в фикстуре нет lite");
    const idx = lite.features.findIndex((f) => /\$\d/.test(f));
    expect(idx).toBeGreaterThanOrEqual(0);
    const changed = lite.features[idx].replace(/\d+/, (n) => String(Number(n) + 50));
    const mutated = { ...lite, features: lite.features.map((f, i) => (i === idx ? changed : f)) };
    const en = localizeTier(mutated, "en");
    expect(en.features[idx]).toBe(changed); // русская, с новым числом
    en.features.forEach((f, i) => {
      if (i !== idx) expect(f).not.toMatch(CYRILLIC); // остальные — английские
    });
  });
});

describe("pricingLocalize: примечания, промо, модули, доверие", () => {
  it("en: все примечания переведены, числа совпадают", () => {
    const en = localizeNotes(pricing.notes, "en");
    en.forEach((n, i) => {
      expect(n, `note[${i}] «${pricing.notes[i]}»`).not.toMatch(CYRILLIC);
      expect(sameDigits(pricing.notes[i], n)).toBe(true);
    });
    expect(localizeNotes(pricing.notes, "ru")).toBe(pricing.notes);
  });

  it("en: у каждого модуля фикстуры есть английский однострочник", () => {
    for (const m of pricing.modules) {
      const en = localizeModuleOneLiner(m.id, m.oneLiner, "en");
      expect(en, `${m.id}: «${m.oneLiner}»`).not.toMatch(CYRILLIC);
      expect(sameDigits(m.oneLiner, en), `${m.id}: числа`).toBe(true);
    }
    expect(localizeModuleOneLiner("qventure", "совет 5 ролей", "en")).toBe("совет 5 ролей"); // число разошлось → русский
  });

  it("en: подписи блока доверия переведены вместе с подсказками", () => {
    for (const n of trust.numbers) {
      const en = localizeTrustNumber(n, "en");
      expect(en.label, `«${n.label}»`).not.toMatch(CYRILLIC);
      if (n.hint) expect(en.hint, `hint «${n.hint}»`).not.toMatch(CYRILLIC);
      expect(en.value).toBe(n.value);
    }
    expect(localizeTrustNumber(trust.numbers[0], "ru")).toBe(trust.numbers[0]);
  });

  it("промо: известное описание переводится, неизвестное остаётся", () => {
    expect(localizePromoDescription("Запуск GTM — 20% на любой платный тариф", "en")).toBe(
      "GTM launch — 20% off any paid tier",
    );
    expect(localizePromoDescription("Неизвестная акция — 5%", "en")).toBe("Неизвестная акция — 5%");
  });
});
