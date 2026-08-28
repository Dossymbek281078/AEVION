import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Серверный текст ошибки не показывается человеку без перевода.
 *
 * Замер 28.08.2026: у ручек модуля 119 разных текстов ошибок, по-русски семь.
 * В рабочем окне они выводились как `data.error || "русский запасной"`, то есть
 * русская строка была ЗАПАСНОЙ и появлялась лишь при молчании сервера.
 *
 * Сторож держит форму: показ идёт через devhubServerError. Он переводит частые
 * группы, а незнакомое отдаёт как есть — вместе с понятным поводом.
 */

const DIR = path.resolve(__dirname, "..");
const WORKSPACE = fs.readFileSync(path.join(DIR, "[id]", "page.tsx"), "utf8");
const STOREFRONT = fs.readFileSync(path.join(DIR, "page.tsx"), "utf8");
const BT = String.fromCharCode(96);

describe("серверная ошибка доходит до человека по-русски", () => {
  test("прибор исправен: файл прочитан и не пуст", () => {
    expect(WORKSPACE.length).toBeGreaterThan(2000);
  });

  test("прежней формы «data.error || текст» не осталось", () => {
    // Позиционный поиск, не регулярка: собранная из строки регулярка на этой
    // машине теряет слэши, и детектор молча отвечает «ноль» (см. правила).
    const bad: string[] = [];
    WORKSPACE.split(/\r?\n/).forEach((line, i) => {
      if (line.includes('data.error || "')) bad.push(`строка ${i + 1}`);
    });
    expect(bad, "серверный английский текст снова показывается напрямую").toEqual([]);
  });

  test("показ идёт через переводчик, и мест не меньше девяти", () => {
    // Храповик, а не точное число: девять — замер дня, а мест станет больше.
    const uses = WORKSPACE.split("devhubServerError(data.error").length - 1;
    expect(uses).toBeGreaterThanOrEqual(9);
  });

  test("ни один запасной текст не остался английским", () => {
    // Замер 28.08: пятнадцать запасных текстов были по-английски («Send failed»,
    // «Pages deploy failed»), а два места не имели запасного вовсе — там человек
    // увидел бы «undefined». Запасной текст показывается, когда сервер молчит,
    // то есть в самый растерянный момент.
    const CYR = /[а-яА-ЯёЁ]/;
    const bad: string[] = [];
    // Слэши в этом файле не пишем: на границе вызова они съедаются, и
    // регулярка обрывается прямо в исходнике (поймано 28.08 на этой строке).
    const LF = String.fromCharCode(10), CR = String.fromCharCode(13);
    WORKSPACE.split(LF).forEach((rawLine, i) => {
      const line = rawLine.split(CR).join("");
      for (const key of ["data.error", "d.error", "d?.error", "evt.error"]) {
        const k = line.indexOf(key);
        if (k < 0) continue;
        const tail = line.slice(k + key.length);
        const m = tail.indexOf('|| "');
        if (m < 0) break;
        const q1 = tail.indexOf('"', m);
        const q2 = tail.indexOf('"', q1 + 1);
        const lit = q2 > 0 ? tail.slice(q1 + 1, q2) : "";
        if (lit && !CYR.test(lit)) bad.push(`строка ${i + 1}: ${lit}`);
        break;
      }
    });
    expect(bad, "запасной текст на английском в русском окне").toEqual([]);
  });

  test("переводчик импортирован, а не забыт", () => {
    // Без импорта TypeScript упал бы, но проверка стоит копейки и называет
    // причину прямо — быстрее, чем разбирать ошибку сборки.
    expect(WORKSPACE).toContain('from "@/lib/devhubServerError"');
  });

  test("витрина модуля тоже переводит серверный текст", () => {
    // Прежний замер смотрел только рабочее окно. Витрина — первая страница,
    // которую видит человек, и там было «Failed to create».
    expect(STOREFRONT).toContain("devhubServerError");
    expect(STOREFRONT, "английский запасной на витрине").not.toContain('"Failed to create"');
  });

  test("запасной текст в ОБРАТНЫХ кавычках тоже не английский", () => {
    // Прежняя проверка искала только двойные кавычки и пропустила два места:
    // `SFX error ${r.status}` и `TTS error ${r.status}`. Детектор, у которого
    // уже нашлась слепая зона, обязан её закрыть — иначе его ноль обманчив.
    const CYR = /[а-яА-ЯёЁ]/;
    const bad: string[] = [];
    for (const src of [WORKSPACE, STOREFRONT]) {
      const parts = src.split("|| " + BT);
      parts.slice(1).forEach((tail) => {
        const lit = tail.split(BT)[0];
        if (lit && !CYR.test(lit)) bad.push(lit.slice(0, 40));
      });
    }
    expect(bad, "запасной текст в обратных кавычках по-английски").toEqual([]);
  });
});
