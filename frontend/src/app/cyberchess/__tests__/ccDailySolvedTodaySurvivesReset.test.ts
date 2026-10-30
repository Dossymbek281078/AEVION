// Задача дня, ворота 5 «возврат на второй день»: решивший сегодня и вернувшийся
// обязан увидеть «Уже решено сегодня», а повторное решение не растит серию.
// До 30.10.2026: эффект сброса [puzzle] шёл ПОСЛЕ чтения серии при монтировании
// и делал setSolved(false) + setMessage('') — отметка стиралась, задачу можно
// было «решить» ещё раз и получить серию +1 (замер на проде f2db0ee93 30.10).
// Сторож ИСХОДНИКА (форма); что человек видит — браузером.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "daily", "page.tsx"), "utf8");
const i = src.indexOf("chessRef.current = new Chess(puzzle.fen);");
const reset = src.slice(i, src.indexOf("}, [puzzle]);", i));
const j = src.indexOf("const finalizeSolved = useCallback(");
const fin = src.slice(j, j + 1200);

describe("задача дня: «решено сегодня» переживает сброс задачи", () => {
  it("эффект сброса найден", () => { expect(i).toBeGreaterThan(0); });
  it("сброс сверяет cc_daily_last_solved с сегодняшним днём", () => {
    expect(reset).toContain("localStorage.getItem('cc_daily_last_solved') === todayKey()");
    expect(reset).toContain("setSolved(solvedToday);");
  });
  it("прежний безусловный сброс не вернулся", () => {
    expect(reset).not.toContain("setSolved(false);");
    expect(reset).not.toContain("setMessage('');");
  });
  it("повторное решение в тот же день не даёт серии +1", () => {
    expect(fin).toContain("againToday = localStorage.getItem('cc_daily_last_solved') === today");
    expect(fin).toContain("usedHints || againToday ? streak : streak + 1");
  });
});
