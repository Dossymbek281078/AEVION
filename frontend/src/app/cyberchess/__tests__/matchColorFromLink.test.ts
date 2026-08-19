import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { stripComments } from "./_stripComments";

// Цвет из ссылки разворачивает доску. 19.08.2026.
//
// Сервер кладёт цвет в ссылку на партию: `/cyberchess?matchId=…&color=black`.
// Страница читала оттуда ТОЛЬКО matchId, а цвет выбрасывала — игрок за чёрных
// приходил из турнира и видел доску белыми к себе.
//
// Класс тот же, что весь день: значение передают, а получатель его не читает.
// Здесь особенно тихо — доска работает, ходы принимаются, просто смотришь с
// чужой стороны.

const SRC = path.join(__dirname, "..", "page.tsx");
const src = () => stripComments(fs.readFileSync(SRC, "utf-8")).replace(/\s+/g, " ");

describe("ссылка на партию из турнира", () => {
  test("цвет из ссылки читается там же, где matchId", () => {
    const s = src();
    const i = s.indexOf('params.get("matchId")');
    expect(i, "чтение matchId исчезло").toBeGreaterThan(-1);
    expect(s.slice(i, i + 320)).toMatch(/params\.get\("color"\)/);
  });

  test("чёрный разворачивает доску, белый — возвращает", () => {
    // Оба направления важны: если ставить flip только для чёрных, переход из
    // одной партии в другую оставил бы доску перевёрнутой.
    const s = src();
    const i = s.indexOf('params.get("color")');
    const блок = s.slice(i, i + 200);
    expect(блок).toMatch(/"black"\).*sFlip\(true\)/);
    expect(блок).toMatch(/"white"\).*sFlip\(false\)/);
  });
});
