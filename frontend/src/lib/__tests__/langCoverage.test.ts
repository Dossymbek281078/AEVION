import { describe, it, expect } from "vitest";
import { coverageOf, coveragePercent, isUsable, langsByCoverage } from "../langCoverage";
import { translations, LANGS } from "../i18n-data";

/**
 * The switcher offered eleven languages as equals while eight of them held
 * about 1% of the interface. These checks keep the label honest in both
 * directions: it must not overstate a thin language, and it must not understate
 * a finished one once translations land.
 */

describe("language coverage", () => {
  it("matches what the dictionary actually holds", () => {
    const biggest = Math.max(...LANGS.map((l) => Object.keys(translations[l]).length));
    for (const lang of LANGS) {
      const expected = Object.keys(translations[lang]).length / biggest;
      expect(coverageOf(lang), lang).toBeCloseTo(expected, 6);
    }
  });

  it("splits the languages the way today's data does", () => {
    const { usable, partial } = langsByCoverage();
    expect(usable.sort()).toEqual(["en", "kk", "ru"]);
    expect(partial.length).toBe(8);
  });

  it("never rounds a thin language up into a promise", () => {
    // 0.9% has to read as 0%, not 1%: the rounding must not flatter.
    for (const lang of langsByCoverage().partial) {
      expect(coveragePercent(lang), lang).toBeLessThanOrEqual(coverageOf(lang) * 100);
      expect(coveragePercent(lang), `${lang} should stay in single digits today`).toBeLessThan(10);
    }
  });

  it("promotes a language as soon as it is genuinely translated", () => {
    // The threshold is data-driven, not a list of language codes — the day
    // German is filled in, it stops being labelled partial without an edit.
    const before = isUsable("de");
    expect(before).toBe(false);
    const de = translations.de as Record<string, string>;
    const ru = translations.ru as Record<string, string>;
    const added: string[] = [];
    for (const key of Object.keys(ru)) {
      if (de[key] === undefined) { de[key] = ru[key]; added.push(key); }
    }
    try {
      expect(isUsable("de"), "a filled-in language counts as usable").toBe(true);
      expect(coveragePercent("de")).toBeGreaterThanOrEqual(99);
    } finally {
      for (const key of added) delete de[key];
    }
    expect(isUsable("de"), "and the fixture is restored").toBe(false);
  });
});
