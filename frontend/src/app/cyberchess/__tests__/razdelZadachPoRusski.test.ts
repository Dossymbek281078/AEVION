import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bezKommentariev } from "./bezKommentariev";

/**
 * Раздел «Задачи» — второй по важности путь после партии. Обход браузером
 * 02.09.2026 показал: сам путь работает (фигура подсвечивает ходы, неверный
 * ход честно отвечает «Неверно · Попробуй»), но подписи режимов остались
 * английскими — «Custom» и «Rush» среди «Обучение», «3 мин», «5 мин».
 *
 * И подпись доски для экранного диктора говорила «партия ещё не начата»
 * в разделе задач, где партии нет вовсе.
 */

const КОД = () => bezKommentariev(readFileSync(join(__dirname, "..", "page.tsx"), "utf8"));

describe("раздел задач говорит по-русски", () => {
  it("подписи режимов решения — русские", () => {
    const код = КОД();
    const i = код.indexOf('["learn","📚","Обучение"]');
    expect(i, "список режимов пропал — проверку переписать").toBeGreaterThan(0);
    const список = код.slice(i, i + 220);
    for (const слово of ['"Custom"', '"Rush"']) {
      expect(список, `${слово} видно человеку среди русских подписей`).not.toContain(слово);
    }
    expect(список).toContain('"Свой"');
    expect(список).toContain('"Серия"');
  });

  it("подпись доски в задачах не говорит про партию", () => {
    const код = КОД();
    expect(код).toContain('tab==="puzzles"?", ход ещё не сделан"');
  });

  it("список возможностей на витрине модуля — по-русски", () => {
    const код = КОД();
    for (const слово of ["🎓 Coach AI", "📊 Analysis"]) {
      expect(код, `«${слово}» на витрине модуля`).not.toContain(слово);
    }
  });
});
