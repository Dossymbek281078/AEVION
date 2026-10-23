import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 23.10.2026, паспорт multichat п.2 (замер yazyk-devhub.mjs на проде a26c5584c): строка остатка гостя
 * «Бесплатно без входа: осталось 2 запроса…» показывалась по-русски и на en, и на kk — она была литералом
 * в JSX, мимо словаря MC_UI. Сторож: тексты гостя живут в MC_UI для всех трёх языков, а разметка берёт их
 * оттуда. Проверка по исходнику (MC_UI не экспортируется).
 */
const ИСХОДНИК = readFileSync(join(process.cwd(), "src/app/multichat-engine/CouncilConsole.tsx"), "utf8");
const словарь = (lang: string) => {
  const i = ИСХОДНИК.indexOf(`\n  ${lang}: {`);
  expect(i, `MC_UI.${lang}`).toBeGreaterThan(-1);
  return ИСХОДНИК.slice(i, ИСХОДНИК.indexOf("},", i) + 2);
};

describe("Мультичат: строка остатка гостя, стена и подпись «3 агента» — на языке посетителя", () => {
  it("разметка берёт тексты из MC, а не из русских литералов", () => {
    const span = ИСХОДНИК.slice(ИСХОДНИК.indexOf("{authed === false"), ИСХОДНИК.indexOf("</span>", ИСХОДНИК.indexOf("{authed === false")));
    expect(span).toContain("MC.guestLeft(");
    expect(span).toContain("MC.guestOut");
    expect(span).toContain("MC.independent");
    // кириллица допустима только в именах (гостьМожет, свободно), но не внутри строковых литералов
    expect(span, "русский литерал в разметке").not.toMatch(/["`][^"`\n]*[а-яё]/i);
  });

  it("ru, en, kk: у каждого языка все три текста, и они на своём языке", () => {
    for (const lang of ["ru", "en", "kk"]) {
      const d = словарь(lang);
      expect(d, `${lang}.guestLeft`).toContain("guestLeft:");
      expect(d, `${lang}.guestOut`).toContain("guestOut:");
      expect(d, `${lang}.independent`).toContain("independent:");
    }
    const en = словарь("en").replace(/^\s*en: \{/, "");
    expect(en, "en без кириллицы").not.toMatch(/[а-яё]/i);
    const kk = словарь("kk");
    expect(kk.match(/guestLeft:[^\n]*/)![0], "kk остаток — казахские буквы").toMatch(/[әғқңөұүһі]/);
    expect(kk.match(/guestOut:[^\n]*/)![0], "kk стена — казахские буквы").toMatch(/[әғқңөұүһі]/);
    expect(kk.match(/independent:[^\n]*/)![0], "kk подпись — казахские буквы").toMatch(/[әғқңөұүһі]/);
    const ru = словарь("ru");
    expect(ru).toContain("осталось ${n}");
  });

  it("остаток подставляется числом (функция от n), а не зашит", () => {
    for (const lang of ["ru", "en", "kk"]) {
      expect(словарь(lang), `${lang}.guestLeft — функция`).toMatch(/guestLeft: \(n\) => `[^`]*\$\{n\}/);
    }
  });
});
