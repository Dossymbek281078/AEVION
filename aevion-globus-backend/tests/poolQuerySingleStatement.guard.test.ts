import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * pool.query принимает ОДИН SQL-стейтмент; второй аргумент — параметры.
 *
 * 07.09.2026, живой урок с прода: три ALTER для IPCertificate были переданы
 * одним вызовом тремя аргументами-строками. pg прочитал второй как массив
 * параметров, ни один ALTER не исполнился — БЕЗ ошибки. На свежем стенде
 * всё работало (CREATE несёт колонки), на СТАРОЙ таблице прода /protect
 * отвечал 500 «column does not exist», и текстовые сторожа колонок были
 * зелёными честно: колонка в тексте есть, не исполнялся ВЫЗОВ.
 *
 * Сторож ловит форму «query(`…`, `…`» — второй шаблонный литерал сразу за
 * запятой. Массив параметров так не пишут (он в [ ]), поэтому ложных
 * срабатываний у формы нет; проверено свипом 07.09 — ноль совпадений на
 * всём src после починки.
 */

const SRC = join(__dirname, "..", "src");

function файлы(d: string, out: string[] = []): string[] {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) файлы(p, out);
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

const ФОРМА = /query\(\s*(?:\/\/[^\n]*\n\s*)*`[^`]*`\s*,\s*(?:\/\/[^\n]*\n\s*)*`/g;

describe("pool.query — один SQL-стейтмент на вызов", () => {
  it("в src нет вызовов query с несколькими SQL-литералами через запятую", () => {
    const находки: string[] = [];
    for (const p of файлы(SRC)) {
      const s = readFileSync(p, "utf8");
      let m: RegExpExecArray | null;
      ФОРМА.lastIndex = 0;
      while ((m = ФОРМА.exec(s))) {
        const строка = s.slice(0, m.index).split("\n").length;
        находки.push(`${p.slice(SRC.length + 1)}:${строка}`);
      }
    }
    expect(
      находки,
      "SQL-литерал на месте ПАРАМЕТРОВ: pg молча не исполнит его — " +
        "разбить на отдельные await pool.query (см. шапку файла, урок 07.09)",
    ).toEqual([]);
  });

  it("прибор находит сломанный образец (положительный контроль)", () => {
    const образец = "await pool.query(  `ALTER TABLE a;`,  `ALTER TABLE b;`  );";
    ФОРМА.lastIndex = 0;
    expect(ФОРМА.test(образец), "форма перестала находиться — сторож пуст").toBe(true);
  });
});
