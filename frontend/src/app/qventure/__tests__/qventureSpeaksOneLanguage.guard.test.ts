import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * QVENTURE ГОВОРИТ НА ОДНОМ ЯЗЫКЕ.
 *
 * Замер 01.09.2026 до правки: 189 русских слов и 26 английских подписей на
 * ОДНОЙ странице, а экран результата — 47 английских подписей при русских
 * сообщениях рядом. Соседний DevHub при этом полностью русский.
 *
 * Это была не «поддержка двух языков», а несогласованность: словаря в модуле
 * нет, выбор давно сделан соседями, а часть строк просто не переписали.
 * Половинчатость хуже любого из двух последовательных вариантов — человек
 * видит границу между экранами и не понимает, где оказался.
 *
 * Сторож следит за ОДНОРОДНОСТЬЮ. Подключат модуль к словарю — правило
 * снимут вместе с зашитыми строками.
 */

const KATALOG = path.join(__dirname, "..");

// Термины остаются латиницей намеренно: в русской инвестиционной практике
// их не переводят, и перевод сделал бы текст хуже. Список ПОИМЁННЫЙ — без
// него сторож либо пропустит всё, либо покрасит верное.
const TERMINY = new Set([
  "ARR", "ARR (USD)", "LTV", "CAC", "LTV/CAC", "LTV / CAC ratio", "TAM", "IRR",
  "ACV", "USD", "MRR", "WoW", "MoM", "YoY", "PDF", "CSV", "API", "AI",
  "QVenture", "AEVION", "AEVION QVENTURE", "OK",
]);

/** Исходник без комментариев: они бывают на обоих языках и к экрану не относятся. */
function kod(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; ) {
    if (raw.startsWith("/*", i)) { const j = raw.indexOf("*/", i + 2); i = j < 0 ? raw.length : j + 2; continue; }
    if (raw.startsWith("//", i)) { const j = raw.indexOf(String.fromCharCode(10), i); i = j < 0 ? raw.length : j; continue; }
    out += raw[i++];
  }
  return out;
}

/**
 * Текст между тегами, начинающийся с латинской буквы. Разбор позиционный:
 * класс символов, собранный строкой, у нас уже терял обратный слэш и делал
 * сторожа пустым МОЛЧА.
 */
function podpisi(src: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== ">") continue;
    const j = src.indexOf("<", i + 1);
    if (j < 0) break;
    const t = src.slice(i + 1, j).trim();
    if (t.length < 2 || t.length > 60) continue;
    // Нарушение — строка БЕЗ кириллицы вовсе. «TAM снизу вверх (USD)»
    // начинается с термина и всё же русская: флагом по первой букве её
    // пришлось бы вносить в исключения, а исключения растут и прячут
    // настоящие случаи.
    if (/[А-ЯЁа-яё]/.test(t)) continue;
    if (!/^[A-Za-z]/.test(t)) continue;
    // Название платформы и адреса — не подписи.
    if (/^aevion\.|^[A-Za-z]+\.[a-z]{2,}\//.test(t)) continue;
    if (t.replace(/[^A-Za-z]+/g, " ").trim().split(" ").every((w) => TERMINY.has(w))) continue;
    if (/[{}=]/.test(t)) continue;
    out.push(t);
  }
  return out;
}

function fajly(): string[] {
  const out: string[] = [];
  const obojti = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== "__tests__") obojti(p); continue; }
      if (e.name.endsWith(".tsx")) out.push(p);
    }
  };
  obojti(KATALOG);
  return out;
}

describe("QVenture говорит на одном языке", () => {
  test("контроль: файлы найдены и подписи извлекаются", () => {
    const f = fajly();
    expect(f.length, "экраны модуля не найдены — проверка обнулилась").toBeGreaterThanOrEqual(6);
    // Извлекатель обязан ВИДЕТЬ русские подписи. Без этого «английских нет»
      // означало бы «я ничего не разобрал».
    const vsego = f
      .map((p) => kod(fs.readFileSync(p, "utf8")))
      .flatMap((s) => {
        const out: string[] = [];
        for (let i = 0; i < s.length; i++) {
          if (s[i] !== ">") continue;
          const j = s.indexOf("<", i + 1);
          if (j < 0) break;
          const t = s.slice(i + 1, j).trim();
          if (/^[А-ЯЁа-яё]/.test(t)) out.push(t);
        }
        return out;
      });
    expect(vsego.length, "разбор не видит русских подписей — сторож пустой").toBeGreaterThan(20);
  });

  test("английских подписей нет, кроме терминов", () => {
    const narusheniya: string[] = [];
    for (const p of fajly()) {
      for (const t of podpisi(kod(fs.readFileSync(p, "utf8")))) {
        if (TERMINY.has(t)) continue;
        narusheniya.push(path.basename(p) + ": " + t);
      }
    }
    expect(
      narusheniya,
      "английская подпись на русском экране: модуль снова говорит на двух языках",
    ).toEqual([]);
  });
});
