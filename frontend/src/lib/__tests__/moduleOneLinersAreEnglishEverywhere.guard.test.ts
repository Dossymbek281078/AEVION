/*
 * Английский однострочник есть у КАЖДОГО модуля, и его показывают все страницы.
 *
 * 🔴 Замер 01.10.2026 на проде (волна 7). Словарь MODULE_ONE_LINER_EN покрывает все
 * 44 модуля, расхождений по цифрам нет, кириллицы в английских строках нет — с этим
 * всё в порядке. Дефект был в другом: локализатор звали в ОДНОМ месте из четырёх.
 * Страницы /pricing/[tierId], /pricing/compare и /pricing/for/[industry] выводили
 * поле `{m.oneLiner}` как есть, то есть англоязычный посетитель читал русское
 * описание модуля на трёх страницах из четырёх.
 *
 * Существующий pricingLocalize.test проверяет ФИКСТУРУ — он не узнает о модуле,
 * который завели в настоящем прайсе. Этот сторож читает реальный список модулей
 * бэкенда, поэтому новый модуль без перевода покраснеет сразу.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MODULE_ONE_LINER_EN, sameDigits } from "../pricingLocalize";

const ЗДЕСЬ = dirname(fileURLToPath(import.meta.url));
const ЦЕНЫ = join(ЗДЕСЬ, "..", "..", "..", "..", "aevion-globus-backend", "src", "data", "pricing.ts");
const СТРАНИЦЫ = join(ЗДЕСЬ, "..", "..", "app", "pricing");

/** id → русский однострочник из настоящего прайса бэкенда. */
function модулиБэкенда(): Record<string, string> {
  const src = readFileSync(ЦЕНЫ, "utf8");
  const итог: Record<string, string> = {};
  let id: string | null = null;
  for (const строка of src.split("\n")) {
    const i = /^\s*id:\s*"([^"]+)"/.exec(строка);
    if (i) { id = i[1]; continue; }
    const o = /^\s*oneLiner:\s*"([^"]+)"/.exec(строка);
    if (o && id) { итог[id] = o[1]; id = null; }
  }
  return итог;
}

function файлыСтраниц(каталог: string, собрано: string[] = []): string[] {
  for (const имя of readdirSync(каталог)) {
    const путь = join(каталог, имя);
    if (statSync(путь).isDirectory()) {
      if (имя === "__tests__") continue;
      файлыСтраниц(путь, собрано);
    } else if (имя === "page.tsx") собрано.push(путь);
  }
  return собрано;
}

describe("однострочники модулей на английском", () => {
  it("контроль прибора: прайс прочитан и модулей много", () => {
    const модули = модулиБэкенда();
    expect(Object.keys(модули).length, "прайс не разобрался — сторож ослеп").toBeGreaterThan(40);
    expect(Object.keys(MODULE_ONE_LINER_EN).length, "словарь пуст").toBeGreaterThan(40);
  });

  it("у каждого модуля прайса есть английская строка", () => {
    const модули = модулиБэкенда();
    const нет = Object.keys(модули).filter((id) => !MODULE_ONE_LINER_EN[id]);
    expect(нет, `проверено модулей: ${Object.keys(модули).length}`).toEqual([]);
  });

  it("цифры английской строки совпадают с русской", () => {
    const модули = модулиБэкенда();
    const расх = Object.entries(модули)
      .filter(([id, ru]) => MODULE_ONE_LINER_EN[id] && !sameDigits(ru, MODULE_ONE_LINER_EN[id]))
      .map(([id]) => id);
    expect(расх, "число в переводе разошлось с оригиналом").toEqual([]);
  });

  it("в английской строке нет кириллицы — иначе это не перевод", () => {
    const плохие = Object.entries(MODULE_ONE_LINER_EN)
      .filter(([, v]) => /[А-Яа-я]/.test(v))
      .map(([k]) => k);
    expect(плохие).toEqual([]);
  });

  it("ни одна страница цен не выводит однострочник МИМО локализатора", () => {
    const файлы = файлыСтраниц(СТРАНИЦЫ);
    expect(файлы.length, "страниц не найдено — проверять было нечего").toBeGreaterThan(3);
    const виновные: string[] = [];
    for (const путь of файлы) {
      const текст = readFileSync(путь, "utf8");
      for (const строка of текст.split("\n")) {
        if (/\{\s*m\.oneLiner\s*\}/.test(строка)) виновные.push(путь.replace(СТРАНИЦЫ, "pricing"));
      }
    }
    expect(виновные, `проверено страниц: ${файлы.length}`).toEqual([]);
  });
});
