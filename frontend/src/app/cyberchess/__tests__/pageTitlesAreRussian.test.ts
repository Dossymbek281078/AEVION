import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.join(__dirname, "..");

// 20.08.2026. Заголовки страниц — поверхность, которую не видит ни один тест,
// а человек видит первой: вкладка браузера, закладка, строка в поиске. Было 18
// английских из 30 файлов: «Personal CPI Dashboard», «Chessy Economy»,
// «CyberChess Studio · Streamer mode», «Training Hub — daily-задания».
//
// ВАЖНО про прибор: первый свип ответил «подозрительных 1» и НЕ ошибся вслух —
// у него потерялся обратный слэш, и регулярка молча искала не то. Поэтому здесь
// нет ни одной регулярки со слэшами: только startsWith/indexOf/includes.

const ZHARGON = ["hub", "daily", "dashboard", "leaderboard", "streamer mode", "brackets", "badges"];

// Имена, которые остаются английскими намеренно: продукт, валюта, чужие
// программы. Их присутствие НЕ повод краснеть.
const IMENA = ["cyberchess", "chessy", "obs", "pip", "cpi"];

function metaStroki(src: string): string[] {
  const out: string[] = [];
  for (const line of src.split("\n")) {
    const t = line.trim();
    if (!(t.startsWith("title:") || t.startsWith("description:"))) continue;
    const i = t.indexOf('"');
    if (i < 0) continue;
    const j = t.indexOf('"', i + 1);
    if (j < 0) continue;
    const v = t.slice(i + 1, j);
    if (v.length >= 8) out.push(v);
  }
  return out;
}

function fajly(d: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__") fajly(p, acc);
    } else if (e.name === "layout.tsx") acc.push(p);
  }
  return acc;
}

describe("заголовки страниц модуля — по-русски", () => {
  test("прибор ловит заведомо плохой заголовок", () => {
    const obrazec = '  title: "Training Hub — daily-задания, эндшпиль",';
    const stroki = metaStroki(obrazec);
    expect(stroki.length, "разбор не нашёл заголовок вообще").toBe(1);
    const low = stroki[0].toLowerCase();
    expect(ZHARGON.some((w) => low.includes(w)), "жаргон в образце не распознан").toBe(true);
  });

  test("прибор молчит на нормальном заголовке", () => {
    const obrazec = '  title: "Тренировки — задания дня, эндшпиль, координаты",';
    const low = metaStroki(obrazec)[0].toLowerCase();
    expect(ZHARGON.some((w) => low.includes(w))).toBe(false);
    expect(IMENA.some((w) => low.includes(w))).toBe(false);
  });

  test("во всех layout заголовки без английского жаргона", () => {
    const spisok = fajly(ROOT);
    expect(spisok.length, "обход не нашёл layout — сторож ничего не проверил").toBeGreaterThan(5);
    const plohie: string[] = [];
    for (const f of spisok) {
      for (const v of metaStroki(fs.readFileSync(f, "utf-8"))) {
        const low = v.toLowerCase();
        const najdeno = ZHARGON.filter((w) => low.includes(w));
        if (najdeno.length) plohie.push(`${path.relative(ROOT, f)}: ${v.slice(0, 60)} [${najdeno}]`);
      }
    }
    expect(plohie).toEqual([]);
  });
});
