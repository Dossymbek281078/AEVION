/**
 * Редактор и знакомство Constitution говорят на языке читателя: подсказки и полюса ползунков,
 * имена стран и пресетов.
 *
 * ПОВОД (5.11.2026, прод 3c9b2d343757, Playwright en-US 1463×724): /constitution?country=us
 * показывал 44 русские строки («Каждый сам за себя», «Скандинавская», «США», «Кочевая Степь»…),
 * шаг знакомства 3 — «Tweak «Ротация / жребий»». Метки ползунков шли через словарь, а hint/low/high,
 * COUNTRIES[].name и PRESETS[].name были русскими литералами и держались на живом переводе.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { COUNTRIES, PRESETS, SLIDER_META } from "@/lib/constitution";
import { countryName, presetName, regimeText, sliderText, SLIDER_TEXT } from "@/lib/constitutionI18n";

const КИР = /[А-Яа-яЁё]/;
const КАЗ = /[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/;
const src = (...p: string[]) => readFileSync(join(__dirname, "..", ...p), "utf8");

describe("constitution: редактор на языке читателя", () => {
  it("КОНТРОЛЬ: русский источник действительно русский (иначе проверка кириллицы слепа)", () => {
    expect(SLIDER_META.every((m) => КИР.test(m.hint) && КИР.test(m.low) && КИР.test(m.high))).toBe(true);
    expect(COUNTRIES.filter((c) => КИР.test(c.name)).length).toBe(COUNTRIES.length);
    expect(PRESETS.filter((p) => КИР.test(p.name)).length).toBeGreaterThanOrEqual(9);
  });

  it("en: подсказки и полюса всех 8 ползунков без кириллицы", () => {
    for (const m of SLIDER_META) {
      const s = sliderText(m.key, "en", m);
      for (const v of [s.hint, s.low, s.high]) { expect(v.length).toBeGreaterThan(3); expect(КИР.test(v), `${m.key}: ${v}`).toBe(false); }
    }
  });

  it("kk: все 8 ползунков переведены (не равны русскому) и не пустые", () => {
    for (const m of SLIDER_META) {
      const s = sliderText(m.key, "kk", m);
      expect(s.hint).not.toBe(m.hint); expect(s.low).not.toBe(m.low); expect(s.high).not.toBe(m.high);
    }
    expect(Object.keys(SLIDER_TEXT.kk).sort()).toEqual(SLIDER_META.map((m) => m.key).sort());
  });

  it("страны: каждая страна и каждый пресет имеют en и kk; en без кириллицы, kk не русская копия", () => {
    for (const c of COUNTRIES) {
      expect(КИР.test(countryName(c.code, "en", c.name)), c.code).toBe(false);
      const kk = countryName(c.code, "kk", c.name);
      expect(kk.length, c.code).toBeGreaterThan(1);
    }
    expect(countryName("kz", "kk", "Казахстан")).toBe("Қазақстан");
    for (const p of PRESETS) {
      expect(КИР.test(presetName(p.name, "en")), p.name).toBe(false);
      expect(presetName(p.name, "kk").length, p.name).toBeGreaterThan(1);
    }
    expect(КАЗ.test(presetName("Скандинавская", "kk"))).toBe(true);
  });

  it("ru и чужие языки остаются русским источником", () => {
    expect(countryName("us", "ru", "США")).toBe("США");
    expect(presetName("СССР 1980", "ru")).toBe("СССР 1980");
    expect(presetName("СССР 1980", undefined)).toBe("СССР 1980");
    const m = SLIDER_META[0];
    expect(sliderText(m.key, "ru", m)).toEqual({ hint: m.hint, low: m.low, high: m.high });
    expect(regimeText({ id: "nordic", name: "Скандинавская модель", era: "x" }, "en").name).toBe("Nordic model");
    expect(regimeText({ id: "nordic", name: "Скандинавская модель", era: "x" }, "ru").name).toBe("Скандинавская модель");
  });

  it("страницы берут тексты через помощники, а не литералами", () => {
    const ed = src("page.tsx");
    expect(ed).toMatch(/\.\.\.sliderText\(m\.key, lang, m\)/);
    expect(ed).toMatch(/presetName\(p\.name, lang\)/);
    expect(ed).toMatch(/countryName\(p\.code, lang, p\.name\)/);
    expect(ed).not.toMatch(/🌍 Planet Leaderboard/);
    const w = src("welcome", "page.tsx");
    expect(w).toMatch(/countryName\(c\.code, lang, c\.name\)/);
    expect(w).toMatch(/sliderText\(weakestKey, lang, metaRu\)/);
    expect(w).toMatch(/regimeText\(regime, lang\)/);
  });

  it("ключи страницы цен есть в ru, en и kk; литералов в разметке нет", () => {
    const keys = ["constitution.editor.leaderboardLink", "constitution.pricing.tier.period.forever", "constitution.pricing.back", "constitution.pricing.title", "constitution.pricing.mostPopular", "constitution.pricing.from", "constitution.showcase.freeToFrom"];
    for (const l of ["ru", "en", "kk"]) {
      const d = readFileSync(join(__dirname, "..", "..", "..", "lib", "i18n-lang", `${l}.ts`), "utf8");
      for (const k of keys) expect(d, `${l}: ${k}`).toContain(`"${k}":`);
    }
    const pr = src("pricing", "page.tsx");
    expect(pr).not.toMatch(/>\s*Constitution Pricing\s*</);
    expect(pr).not.toMatch(/★ MOST POPULAR/);
    expect(pr).not.toMatch(/period: "forever"/);
  });
});
