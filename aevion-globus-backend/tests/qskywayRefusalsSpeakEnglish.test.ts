import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Отказ — худший момент, чтобы заговорить на языке, которого человек не знает.
 *
 * Замер 28.08.2026 по модулю: 18 полей отдавали русский текст без английской
 * пары, и пять из них — именно отказы (два ответа 429 от ограничителей и три
 * ошибки, включая недоступность реестра QRight, то есть платный контур).
 *
 * Нашлось не глазами: я чинил СВОЮ оплошность (`blindHeight.note` без пары) и
 * задал тот же вопрос всему файлу.
 *
 * Здесь проверяются только ОТКАЗЫ — законченный слой. Остальные 13 мест
 * (пояснения `note`) ждут отдельного захода; список с приоритетом лежит в
 * Desktop/АЕВИОН/02-QSkyway/2026-08-28-русский-текст-в-ответах-API.md
 *
 * Проверка по ИСХОДНИКУ, а не по живому ответу: поднимать сервер и доводить его
 * до 429 ради двух строк дороже, чем прочитать файл, а промахнуться тут негде —
 * строки литеральные.
 */

const SRC = readFileSync(path.join(__dirname, "..", "src", "routes", "qskyway.ts"), "utf8");

function hasCyrillic(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x400 && c <= 0x4ff) return true;
  }
  return false;
}

// Отказы, у которых обязана быть английская половина. Ключ — кусок русской
// строки, значение — то, что обязано стоять рядом.
//
// ⚠️ Английская половина сверяется ЦЕЛИКОМ и с закрывающей кавычкой. Первая
// версия искала обрывок «no corridor within the regulator», и мутация её НЕ
// поймала: includes находит подстроку и в «…regulatorX». Тот же дефект я в этот
// же день нашёл у себя дважды — он въедливый.
const REFUSALS: Array<[string, string]> = [
  ["нет коридора в пределах опубликованного потолка", "no corridor within the regulator's published ceiling"],
  ["пруф слишком большой", "proof too large"],
  ["реестр QRight недоступен", "QRight registry unavailable — registration was not performed"],
  ["Слишком много проверок якоря", "Too many anchor checks — verification calls external calendars, try again in a minute."],
  ["Слишком много обращений к реестру", "Too many registry requests — try again in a minute."],
];

describe("отказы QSkyway говорят и по-английски", () => {
  it("контроль прибора: исходник прочитан и он тот самый", () => {
    // Без этого «все пять на месте» неотличимо от «файл пуст».
    expect(SRC.length).toBeGreaterThan(10000);
    expect(hasCyrillic(SRC)).toBe(true);
    expect(SRC.includes("qskywayRouter")).toBe(true);
  });

  for (const [ru, en] of REFUSALS) {
    it("отказ «" + ru.slice(0, 34) + "…» несёт английскую половину", () => {
      // Русскую половину ищем как НАЧАЛО строкового литерала: без кавычки перед
      // ней утверждение держалось бы и на тексте, куда фразу вставили внутрь
      // другой — то есть проверяло бы не то место.
      expect(SRC.includes(String.fromCharCode(34) + ru), "русская половина исчезла — обновите проверку").toBe(true);
      expect(SRC.includes(en + String.fromCharCode(34)), "английской половины нет: отказ придёт только по-русски").toBe(true);
      expect(hasCyrillic(en)).toBe(false);
    });
  }

  it("перечень не усох: пять отказов, а не сколько осталось", () => {
    // Список из трёх строк тоже был бы зелёным и обещал бы охват, которого нет.
    expect(REFUSALS.length).toBe(5);
  });
});
