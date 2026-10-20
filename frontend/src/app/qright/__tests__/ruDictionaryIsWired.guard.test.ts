import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QRIGHT_DICT, tq, qrightDictCoverage } from "../qrightI18n";

/**
 * 🔴 19.10.2026: /qright в подписи пяти писем русскоязычным бюро, а страница была
 * целиком английской при RU. Словарь без проводки в разметку — это ноль переводов
 * на экране, поэтому сторож держит ОБА конца: каждый ключ словаря обёрнут в
 * tq(lang, "<ключ>") в page.tsx (или идёт через данные — типы работ), и перевод
 * действительно русский (кириллица есть), а не пустой и не английская копия.
 */
const страница = readFileSync(join(process.cwd(), "src/app/qright/page.tsx"), "utf8");
const RU = QRIGHT_DICT.ru ?? {};
/** Типы работ приходят из данных KIND_OPTIONS — проводка одна на все семь. */
const ЧЕРЕЗ_ДАННЫЕ = new Set(["Music / Audio", "Code / Software", "Design / Visual", "Text / Article", "Video / Film", "Idea / Concept", "Other"]);

describe("/qright: русский словарь проведён в разметку", () => {
  test("КОНТРОЛЬ прибора: словарь не пустой", () => {
    expect(qrightDictCoverage().ru).toBeGreaterThan(80);
    expect(страница.includes('from "./qrightI18n"')).toBe(true);
  });
  test("каждый ключ словаря обёрнут в tq(lang, …) в page.tsx", () => {
    const непроведённые = Object.keys(RU).filter((k) => {
      if (ЧЕРЕЗ_ДАННЫЕ.has(k)) return !страница.includes("tq(lang, opt.label)");
      return !страница.includes(`tq(lang, "${k}")`) && !страница.includes(`tq(lang, '${k}')`);
    });
    expect(непроведённые, `не проведены ${непроведённые.length} из ${Object.keys(RU).length}`).toEqual([]);
  });
  test("переводы русские: кириллица есть, значение не равно ключу", () => {
    const плохие = Object.entries(RU).filter(([k, v]) => !/[А-Яа-яЁё]/.test(v) || v === k);
    expect(плохие.map(([k]) => k), `без кириллицы или копия ключа: ${плохие.length}`).toEqual([]);
  });
  test("🔴 20.10: ни один КЛЮЧ словаря не содержит кириллицы — ключ = английский источник для en", () => {
    // Продажи замерили на проде: при en подсказка поля бюро была русско-английской
    // («например: Патентное бюро «Пример» — leave empty…»), потому что tq при en
    // отдаёт ключ как есть. Ключей было 2 таких из 119.
    const ключи = Object.entries(QRIGHT_DICT).flatMap(([язык, d]) => Object.keys(d ?? {}).map((k) => `${язык} :: ${k}`));
    expect(ключи.length, "ключей в словаре").toBeGreaterThan(80);
    const скириллицей = ключи.filter((k) => /[А-Яа-яЁё]/.test(k.split(" :: ")[1]));
    expect(скириллицей, `ключей ${ключи.length}, с кириллицей ${скириллицей.length}`).toEqual([]);
    expect(/[А-Яа-яЁё]/.test("например"), "КОНТРОЛЬ признака").toBe(true);
    expect(tq("en", "e.g. Example Patent Bureau — leave empty if you register as the author")).not.toMatch(/[А-Яа-яЁё]/);
    expect(tq("ru", "e.g. Example Patent Bureau — leave empty if you register as the author")).toBe("например: Патентное бюро «Пример» — оставьте пустым, если регистрируете как автор");
  });
  test("tq: ru переводит, en и незнакомый язык отдают источник, незнакомый ключ — как есть", () => {
    expect(tq("ru", "Protect Your Work")).toBe("Защитите свою работу");
    expect(tq("en", "Protect Your Work")).toBe("Protect Your Work");
    expect(tq("kk", "Protect Your Work")).toBe("Protect Your Work");
    expect(tq(undefined, "Protect Your Work")).toBe("Protect Your Work");
    expect(tq("ru", "no such key")).toBe("no such key");
  });
  test("на экране не остаётся «только латиница» у ключевых подписей формы (по словарю)", () => {
    for (const k of ["What are you protecting? *", "Describe your work *", "Type of work", "Protect My Work", "Bureau / organisation (shown on the verification page)"]) {
      expect(RU[k], k).toBeTruthy();
      expect(страница.includes(`tq(lang, "${k}")`), `проводка: ${k}`).toBe(true);
    }
  });
});
