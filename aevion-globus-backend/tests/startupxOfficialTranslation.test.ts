/**
 * Заявка самой AEVION (id 21) на /en: официальный перевод подставляется в ответ, оригинал и база не трогаются.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OFFICIAL_TRANSLATIONS, withOfficialTranslation } from "../src/lib/startupx/officialTranslations";

const CYR = /[Ѐ-ӿ]/;
const RU = { id: 21, title: "AEVION — планета модулей на общем слое доверия", description: "Для кого: малый и средний бизнес.", tier: "product" };

describe("официальный перевод заявки AEVION", () => {
  it("lang=en для id 21: английский без кириллицы, translated:true", () => {
    const v = withOfficialTranslation(RU, "en") as typeof RU & { translated?: boolean; originalLang?: string };
    expect(v.translated).toBe(true);
    expect(v.originalLang).toBe("ru");
    expect(CYR.test(v.title)).toBe(false);
    expect(CYR.test(v.description)).toBe(false);
    expect(v.tier).toBe("product");
  });

  it("без lang и при lang=ru: тот же объект, русский оригинал", () => {
    expect(withOfficialTranslation(RU, "ru")).toBe(RU);
    expect(withOfficialTranslation(RU, "")).toBe(RU);
    expect(RU.title).toContain("планета");
  });

  it("у других id ничего не меняется", () => {
    const other = { id: 22, title: "Чужая", description: "Описание" };
    expect(withOfficialTranslation(other, "en")).toBe(other);
  });

  it("перевод не добавляет чисел: набор чисел совпадает с оригиналом", () => {
    const nums = (s: string) => (s.match(/\d+/g) ?? []).sort();
    expect(nums(OFFICIAL_TRANSLATIONS[21].en.description)).toEqual(
      ["19", "29", "49", "149", "9", "32", "44", "20", "2026"].sort(),
    );
  });

  it("все выдачи ленты и карточки пропускают перевод через withOfficialTranslation", () => {
    const src = readFileSync(join(__dirname, "../src/routes/startupExchange.ts"), "utf8");
    expect((src.match(/(?<!function )listingResponse\(/g) ?? []).length).toBe(4);
    expect((src.match(/withOfficialTranslation\(publicView\(/g) ?? []).length).toBe(0);
  });
});
