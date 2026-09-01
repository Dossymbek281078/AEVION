import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { bezKommentariev } from "./bezKommentariev";

/**
 * Обход экрана «Коуч» глазами 01.09.2026. Английские слова и внутренние
 * термины там, где человек читает:
 *
 *   «👤 You 800»                — при том что в режиме за двоих рядом «Игрок»
 *   «AI-коуч: выкл», «Против AI» — в модуле уже принято «ИИ»
 *   «Coach видит текущий FEN, eval Stockfish… Pro: Anthropic Claude Sonnet»
 *
 * Последняя строка — подсказка ДЛЯ РАЗРАБОТЧИКА на продающем экране: она
 * называет внутренний формат позиции, имя движка и поставщика модели.
 * Шахматисту это не говорит ничего.
 */

const KOD = () => readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");

describe("экран коуча говорит по-русски", () => {
  it("игрок подписан «Вы», а не «You»", () => {
    const s = KOD();
    expect(s.length).toBeGreaterThan(100000); // контроль: файл прочитан
    expect(s).not.toContain('"You"');
    expect(s).toContain('"Вы"');
  });

  it("режим за двоих — «Игрок 1/2»", () => {
    const s = KOD();
    expect(s).not.toContain('"Player 1"');
    expect(s).toContain('"Игрок 1"');
  });

  it("тренер называется ИИ, а не AI", () => {
    const s = KOD();
    expect(s).not.toContain("AI-коуч");
    expect(s).not.toContain('"Против AI"');
    expect(s).toContain("ИИ-коуч");
  });

  it("подсказка о тренере — без внутренних слов", () => {
    const kod = bezKommentariev(KOD());
    for (const slovo of ["Coach видит", "eval Stockfish", "Anthropic Claude Sonnet", "текущий FEN"]) {
      expect(kod).not.toContain(slovo);
    }
    expect(kod).toContain("Тренер видит вашу позицию");
  });

  it("контроль: вырезалка комментариев не съедает текст экрана", () => {
    // Без этого предыдущая проверка была бы зелёной на пустой строке.
    const kod = bezKommentariev(KOD());
    expect(kod.length).toBeGreaterThan(100000);
    expect(kod).toContain("Начать партию");
  });

  it("внутренний результат партии НЕ тронут", () => {
    // «You win» — значение состояния, по нему идут сравнения. Массовая замена
    // «You» на «Вы» легко задела бы его и сломала определение исхода партии.
    const s = KOD();
    expect(s).toContain('over?.includes("You win")');
    expect((s.match(/You win/g) || []).length).toBeGreaterThan(15);
  });
});
