import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { defaultRepertoire } from "../openingRepertoireData";
import { OPENING_REPERTOIRE_TEXT } from "../openingRepertoireText";

/**
 * Заметки заготовленных веток репертуара сохраняются у игрока по-русски и на /en и /kk
 * показывались русскими (замер 27.10.2026 браузером: 4 из 4 оставшихся чужих строк на 12 экранах CC).
 * Сторож: у каждой заметки заготовки есть en и kk, а карточка ветки выводит заметку через tt.
 */
describe("заметки заготовленных веток переведены", () => {
  const заметки = defaultRepertoire().map((b) => b.notes).filter((n): n is string => !!n);

  it("заготовок с заметкой не меньше четырёх (иначе сторож ничего не проверяет)", () => {
    expect(заметки.length).toBeGreaterThanOrEqual(4);
  });

  it.each(заметки)("«%s» — есть en без кириллицы и kk", (n) => {
    const tr = OPENING_REPERTOIRE_TEXT[n];
    expect(tr?.en, n).toBeTruthy();
    expect(tr?.en).not.toMatch(/[А-Яа-яЁё]/);
    expect(tr?.kk, n).toBeTruthy();
  });

  it("карточка ветки выводит заметку через tt", () => {
    const src = readFileSync(join(__dirname, "..", "OpeningRepertoire.tsx"), "utf8");
    expect(src).toContain("{tt(L, branch.notes)}");
    expect(src).not.toMatch(/\{branch\.notes\}/);
  });
});
