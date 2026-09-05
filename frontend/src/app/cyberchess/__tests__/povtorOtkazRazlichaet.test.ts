import { describe, it, expect } from "vitest";
import { tekstOtkaza, kodOtveta, ReplayFetchError } from "../replays/[gameId]/otkaz";

/**
 * «Повтор недоступен» показывался с одним советом на два разных случая:
 * записи нет вовсе и запрос не дошёл. Совет «обновите страницу» в первом
 * случае неисполним — человек жмёт перезагрузку, пока не уйдёт.
 *
 * Код ответа при этом БЫЛ: он сворачивался в строку «HTTP 404» и терялся.
 */
describe("страница повтора различает «партии нет» и «не дошёл запрос»", () => {
  it("404 и 410 говорят, что записи нет, и не советуют обновляться", () => {
    for (const код of [404, 410]) {
      const текст = tekstOtkaza(код);
      expect(текст).toContain("Такой партии нет");
      expect(текст).not.toContain("Проверьте связь");
      expect(текст).not.toContain("обнов");
    }
  });

  it("остальные коды и отсутствие кода советуют проверить связь", () => {
    for (const код of [500, 502, 403, null]) {
      const текст = tekstOtkaza(код);
      expect(текст).toContain("Проверьте связь");
      expect(текст).not.toContain("Такой партии нет");
    }
  });

  it("два случая дают РАЗНЫЙ текст (иначе различение декоративно)", () => {
    expect(tekstOtkaza(404)).not.toBe(tekstOtkaza(500));
  });

  it("код ответа достаётся из ошибки запроса, а из посторонней — нет", () => {
    // Мутация «kodOtveta всегда null» пережила первую редакцию этого теста:
    // он проверял только посторонние ошибки. Положительный случай обязателен.
    expect(kodOtveta(new ReplayFetchError(404))).toBe(404);
    expect(kodOtveta(new ReplayFetchError(500))).toBe(500);
    expect(kodOtveta(new Error("сеть отвалилась"))).toBeNull();
    expect(kodOtveta(null)).toBeNull();
  });

  it("ошибка запроса доводит код до текста целиком", () => {
    expect(tekstOtkaza(kodOtveta(new ReplayFetchError(404)))).toContain("Такой партии нет");
    expect(tekstOtkaza(kodOtveta(new ReplayFetchError(503)))).toContain("Проверьте связь");
  });
});
