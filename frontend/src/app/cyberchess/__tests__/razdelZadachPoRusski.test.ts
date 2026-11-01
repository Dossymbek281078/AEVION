import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bezKommentariev } from "./bezKommentariev";
import { ruOf } from "./_ruSlovar";

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
    // 13–19.10.2026: подписи режимов — ключи pz.mode.* (ru-значения проверяются в словаре)
    const i = код.indexOf('["learn","📚",cc.t("pz.mode.learn")]');
    expect(i, "список режимов пропал — проверку переписать").toBeGreaterThan(0);
    const список = код.slice(i, i + 260);
    for (const слово of ['"Custom"', '"Rush"']) {
      expect(список, `${слово} видно человеку среди русских подписей`).not.toContain(слово);
    }
    expect(список).toContain('cc.t("pz.mode.custom")');
    expect(список).toContain('"Серия"');
    expect(ruOf("pz.mode.learn")).toBe("Обучение");
    expect(ruOf("pz.mode.3min")).toBe("3 мин");
    expect(ruOf("pz.mode.5min")).toBe("5 мин");
    expect(ruOf("pz.mode.custom")).toBe("Свой");
    for (const k of ["pz.mode.learn", "pz.mode.3min", "pz.mode.5min", "pz.mode.custom"]) {
      expect(ruOf(k), `ru ${k} не должен быть английским`).not.toMatch(/Custom|Rush/);
    }
  });

  it("подпись доски в задачах не говорит про партию", () => {
    const код = КОД();
    // 13–19.10.2026: фраза — ключ a11y.noMovePuzzle, выбирается по tab==="puzzles"
    expect(код).toContain('tab==="puzzles"?cc.t("a11y.noMovePuzzle"):cc.t("a11y.notStarted")');
    expect(ruOf("a11y.noMovePuzzle")).toBe(", ход ещё не сделан");
  });

  it("список возможностей на витрине модуля — по-русски", () => {
    const код = КОД();
    for (const слово of ["🎓 Coach AI", "📊 Analysis"]) {
      expect(код, `«${слово}» на витрине модуля`).not.toContain(слово);
    }
  });
});
