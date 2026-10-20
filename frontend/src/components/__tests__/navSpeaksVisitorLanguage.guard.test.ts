import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NAV_DICT, NAV_KEYS, tNav } from "../navI18n";

/**
 * 20.10.2026, окно «Приложения», развилка 1 по слову оркестратора: общая навигация
 * Wave1Nav (126 страниц) и степпер PipelineSteps говорили по-английски литералами;
 * по-русски их переписывал машинный доводчик AutoTranslate после монтирования, а на
 * kk внутри приложений (APP_PREFIXES) ярлыки оставались английскими (замер /qsign:
 * 4–25 английских слов в кадре). Теперь ярлыки — из словаря navI18n.ts (ru/en/kk).
 *
 * Сторож: у каждого ключа есть ru и kk; переводимые ключи (не имена продуктов) не
 * равны английскому; в обоих компонентах не осталось английских ярлыков-литералов
 * в <Link>…</Link> и в aria-label; контроль детектора на возвращённом ярлыке.
 */
const DIR = join(__dirname, "..");
const NAV = readFileSync(join(DIR, "Wave1Nav.tsx"), "utf8");
const STEPS = readFileSync(join(DIR, "PipelineSteps.tsx"), "utf8");

/** Имена продуктов пишутся одинаково на всех языках — им разрешено совпадать с en. */
const PRODUCT_KEYS = new Set(["qright", "qsign"]);
const PRODUCT_NAMES = new Set(["QRight", "QSign", "QCoreAI", "QTradeOffline", "HealthAI", "QContract", "QPayNet", "DevHub", "QTrade"]);

/** Ярлыки-литералы между >…</Link> в разметке, кроме имён продуктов и чистых знаков. */
function literalLabels(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/>([^<>{}]+)<\/Link>/g)) {
    const t = m[1].trim();
    if (!t || PRODUCT_NAMES.has(t) || !/[A-Za-zА-Яа-я]/.test(t)) continue;
    out.push(t);
  }
  return out;
}

describe("навигация первой волны говорит на языке посетителя", () => {
  test("у каждого ключа есть ru и kk; переводимые не равны en", () => {
    const bad: string[] = [];
    for (const k of NAV_KEYS) {
      const en = tNav("en", k);
      for (const lang of ["ru", "kk"] as const) {
        const v = NAV_DICT[lang]?.[k];
        if (!v || (!PRODUCT_KEYS.has(k) && v === en)) bad.push(`${lang}:${k}`);
      }
    }
    expect(bad, `ключей всего ${NAV_KEYS.length}`).toEqual([]);
    expect(NAV_KEYS.length).toBeGreaterThanOrEqual(20);
  });

  test("неизвестный язык даёт английский; ru даёт русские ярлыки, что были до словаря", () => {
    expect(tNav("de", "deepDive")).toBe("Deep dive");
    expect(tNav(undefined, "chess")).toBe("Chess");
    expect(tNav("ru", "startupExchange")).toBe("Биржа стартапов");
    expect(tNav("ru", "smeta")).toBe("Смета");
    expect(tNav("kk", "auth")).toBe("Кіру");
  });

  test("в Wave1Nav и PipelineSteps не осталось ярлыков-литералов", () => {
    expect(literalLabels(NAV), "Wave1Nav").toEqual([]);
    expect(literalLabels(STEPS), "PipelineSteps").toEqual([]);
    expect(NAV).not.toContain('aria-label="Wave 1 navigation"');
    expect(NAV).not.toContain('title="AEV кошелёк"');
    expect(NAV).not.toContain('lang === "ru" ?');
    expect(STEPS).not.toContain('label: "Auth"');
  });

  test("оба компонента берут ярлыки из словаря; каждый вызванный ключ существует", () => {
    expect(NAV).toContain('from "./navI18n"');
    expect(STEPS).toContain('from "./navI18n"');
    const keys = new Set<string>(NAV_KEYS);
    const called = [...NAV.matchAll(/\bn\("([a-zA-Z]+)"\)/g), ...(NAV + STEPS).matchAll(/tNav\([^,]+, "([a-zA-Z]+)"\)/g)].map((m) => m[1]);
    expect(called.length).toBeGreaterThanOrEqual(18);
    expect(called.filter((k) => !keys.has(k))).toEqual([]);
    // шаги конвейера — ключи словаря
    for (const m of STEPS.matchAll(/label: "([a-zA-Z]+)"/g)) expect(keys.has(m[1]), `шаг ${m[1]}`).toBe(true);
  });

  test("степпер помечен для прибора (data-aevion-pipeline)", () => {
    expect(STEPS).toContain('data-aevion-pipeline=""');
  });

  test("контроль: детектор видит вернувшийся ярлык", () => {
    expect(literalLabels(NAV.replace('{n("deepDive")}', "Deep dive"))).toEqual(["Deep dive"]);
    expect(literalLabels('<Link href="/x">QRight</Link><Link href="/y">{n("demo")}</Link>')).toEqual([]);
  });
});
