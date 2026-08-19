import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { themeRu } from "../daily/themes";

const SRC = path.join(__dirname, "..", "daily", "page.tsx");
const src = () => fs.readFileSync(SRC, "utf-8");

// 20.08.2026. Найдено глазами на живой странице, а не тестом: на флагманской
// странице модуля запуска смешаны языки — «Daily Puzzle», «держи streak»,
// «Текущий streak», а тема задачи приходила английской меткой прямо из банка.
// Правило платформы: вся проза по-русски.

describe("страница задачи дня говорит по-русски", () => {
  test("перевод темы работает и честно отступает на незнакомой", () => {
    expect(themeRu("Discovered attack")).toBe("Вскрытое нападение");
    expect(themeRu("Fork")).toBe("Вилка");
    // Незнакомую метку показываем КАК ЕСТЬ: пустота или прочерк были бы хуже —
    // по английскому слову человек хотя бы поймёт, о чём задача.
    expect(themeRu("Хитрая новая тема")).toBe("Хитрая новая тема");
    expect(themeRu("Zwischenzug")).toBe("Zwischenzug");
  });

  test("тема на экран идёт через перевод, а не сырой меткой", () => {
    expect(src()).toContain("themeRu(puzzle.theme)");
    expect(src()).not.toContain(">{puzzle.theme}<");
  });

  test("английских подписей на экране нет", () => {
    // Смотрим ТОЛЬКО видимый текст: в ключах localStorage слово streak
    // законно (cc_daily_streak), и запрещать его там значило бы ломать
    // сохранённые данные ради косметики.
    const kod = src()
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .filter((l) => !l.includes("localStorage") && !l.includes("cc_daily"))
      .join("\n");
    for (const angl of ["Daily Puzzle", "Текущий streak", "Лучший streak", "держи streak"]) {
      expect(kod, `английская подпись «${angl}» вернулась на страницу`).not.toContain(angl);
    }
  });
});
