import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { stripComments } from "./_stripComments";

// Доска задачи дня доступна с клавиатуры и диктора. 19.08.2026.
//
// Найдено окном запуска живым прохождением пути новичка: дерево доступности
// видело один образ «Шахматная доска» без клеток и фигур — партия была
// недоступна и с клавиатуры, и с экранным диктором. Для публичного запуска
// 30.08 это значит, что часть людей просто не сможет играть.
//
// Проверка текстовая по исходнику, и это сказано прямо: страница тянет chess.js
// и рисует 64 клетки, поднимать её в jsdom ради разметки дороже, чем полезно.

const SRC = path.join(__dirname, "..", "daily", "page.tsx");
const src = () => stripComments(fs.readFileSync(SRC, "utf-8"));

describe("доска задачи дня доступна без мыши", () => {
  test("клетка — кнопка, а не div с обработчиком", () => {
    const s = src();
    expect(s).toMatch(/<button\s+type="button"/);
    // Прежний вариант: <div key=... onClick=...> — ни фокуса, ни роли.
    expect(s).not.toMatch(/<div\s+key=\{`\$\{r\}-\$\{c\}`\}/);
  });

  test("у каждой клетки есть подпись словами", () => {
    expect(src()).toMatch(/aria-label=\{squareLabel\(/);
  });

  test("подпись называет координату, фигуру и состояние", () => {
    const s = src();
    expect(s).toMatch(/PIECE_NAME/);
    expect(s).toMatch(/'выбрана'/);
    expect(s).toMatch(/'возможный ход'/);
  });

  test("фигуры названы словами, а не только глифами", () => {
    const s = src();
    // Диктор читает ♞ как «чёрный шахматный конь» по-английски или молчит.
    expect(s).toMatch(/'чёрный конь'/);
    expect(s).toMatch(/'белая пешка'/);
  });

  test("у самой доски есть имя", () => {
    expect(src()).toMatch(/aria-label="Шахматная доска задачи дня"/);
  });

  test("выбранная клетка помечена состоянием, а не только цветом", () => {
    // Цвет не доходит до диктора и не виден дальтоникам.
    expect(src()).toMatch(/aria-pressed=\{!!sel\}/);
  });
});
