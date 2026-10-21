// 🔴 21.10.2026 (окно Приложения): на kk-главной шапка и подвал шли английскими литералами
// (Bureau, Awards, Bank, Chess, Company, Terms… — замер yazyk-glavnaya-porog.mjs на 5a207d78a,
// kk 1463×724). Живой переводчик возвращал их эхом. Теперь подписи — из siteChromeI18n.ts.
// Сторож: словарь полон на ru/kk; в разметке шапки и подвала не осталось английских
// литералов, кроме имён продуктов; отрисовка при kk даёт казахские подписи под translate="no",
// а при de — английские БЕЗ translate="no" (их доводит живой переводчик).
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "../../app/__tests__/helpers/sourceCode";
import { CHROME_DICT, CHROME_KEYS } from "../siteChromeI18n";

const язык = vi.hoisted(() => ({ lang: "kk" }));
vi.mock("@/lib/i18n", async (orig) => ({
  ...(await orig<typeof import("@/lib/i18n")>()),
  useI18nOptional: () => ({ lang: язык.lang }),
}));

import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";
import { I18nProvider } from "@/lib/i18n";

const DIR = join(__dirname, "..");
const КИРИЛЛИЦА = /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ]/;
/** Пишутся одинаково на всех языках. */
const ИМЕНА = new Set(["AEVION", "QRight", "QSign", "CyberChess", "GitHub", "API"]);
/** Ключи, где ru вправе совпасть с en (имя направления). */
const RU_РАВЕН_EN = new Set(["planetCompliance"]);

/** Английские литералы в JSX-тексте: >…< без фигурных скобок, кроме имён продуктов. */
function латинскиеЛитералы(src: string): string[] {
  const out: string[] = [];
  for (const m of stripComments(src).matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)) {
    const t = m[1].replace(/&copy;/g, "").trim();
    if (!t || ИМЕНА.has(t) || t.includes("@") || !/[A-Za-z]{2,}/.test(t) || /[{};=]/.test(t)) continue;
    out.push(t);
  }
  return out;
}

class RO { observe() {} unobserve() {} disconnect() {} }

describe("шапка и подвал говорят на языке посетителя", () => {
  beforeEach(() => { (globalThis as { ResizeObserver?: unknown }).ResizeObserver = RO; });

  test("знаменатель и полнота словаря: ru и kk у каждого ключа, переводимые не равны en", () => {
    console.log(`ключей словаря ${CHROME_KEYS.length}`);
    expect(CHROME_KEYS.length).toBeGreaterThan(25);
    const плохо: string[] = [];
    for (const k of CHROME_KEYS) {
      const en = CHROME_DICT.en[k], ru = CHROME_DICT.ru[k], kk = CHROME_DICT.kk[k];
      if (!ru?.trim() || !kk?.trim()) плохо.push(`${k}: пусто`);
      if (ru === en && !RU_РАВЕН_EN.has(k)) плохо.push(`${k}: ru = en`);
      if (kk === en) плохо.push(`${k}: kk = en`);
      if (!КИРИЛЛИЦА.test(kk)) плохо.push(`${k}: kk без кириллицы`);
    }
    expect(плохо, плохо.join("; ")).toEqual([]);
  });

  test("в разметке шапки и подвала нет английских литералов-подписей", () => {
    const найдено: string[] = [];
    for (const f of ["SiteHeader.tsx", "SiteFooter.tsx"]) {
      const src = readFileSync(join(DIR, f), "utf8");
      for (const t of латинскиеЛитералы(src)) найдено.push(`${f}: ${t}`);
      // Прежняя форма списков: label-литерал вместо ключа словаря.
      if (/label: "[A-Za-z]/.test(src)) найдено.push(`${f}: label-литерал`);
    }
    expect(найдено, найдено.join("; ")).toEqual([]);
  });

  test("КОНТРОЛЬ детектора: возвращённый литерал ловится", () => {
    expect(латинскиеЛитералы('<a href="/terms">Terms</a>')).toEqual(["Terms"]);
    expect(латинскиеЛитералы('<span translate="no">CyberChess</span>')).toEqual([]);
  });

  test("kk: подвал и шапка казахские, под translate=\"no\"", () => {
    язык.lang = "kk";
    const ф = render(<SiteFooter />).container;
    const текстФ = ф.textContent || "";
    for (const k of ["products", "termsOfService", "helpCenter", "rights", "city"] as const)
      expect(текстФ, `нет kk-подписи ${k}`).toContain(CHROME_DICT.kk[k]);
    expect(текстФ).not.toContain("Terms of Service");
    const условия = [...ф.querySelectorAll("span")].find((s) => s.textContent === CHROME_DICT.kk.termsOfService);
    expect(условия?.getAttribute("translate")).toBe("no");

    // LanguageSwitcher в шапке зовёт useI18n — нужен настоящий провайдер; язык подписей — из подменённого useI18nOptional.
    const ш = render(<I18nProvider><SiteHeader /></I18nProvider>).container;
    const текстШ = ш.textContent || "";
    for (const k of ["auth", "bureau", "awards", "chess", "pricing", "tagline"] as const)
      expect(текстШ, `нет kk-подписи ${k}`).toContain(CHROME_DICT.kk[k]);
    expect(текстШ).not.toMatch(/Awards|Pricing|Chess/);
    // Переключатель ИИ в шапке — тоже из словаря (замер 21.10: «AI: Cloud» в остатке kk).
    expect(текстШ).toContain(CHROME_DICT.kk.aiCloud);
    expect(текстШ).not.toContain("AI: Cloud");
  });

  test("de: английские подписи БЕЗ translate=\"no\" — их доводит живой переводчик", () => {
    язык.lang = "de";
    const ф = render(<SiteFooter />).container;
    const условия = [...ф.querySelectorAll("span")].find((s) => s.textContent === "Terms of Service");
    expect(условия, "нет английской подписи при de").toBeTruthy();
    expect(условия!.getAttribute("translate")).toBeNull();
  });
});
