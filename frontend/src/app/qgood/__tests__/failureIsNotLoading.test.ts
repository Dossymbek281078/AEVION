/**
 * Отказ не имеет права выглядеть ожиданием.
 *
 * До 21.08.2026 обработчик ошибки ставил пустой список упражнений, а экран
 * показывает «загружается…» именно при пустом списке — человек ждал того,
 * чего уже не будет. Третье место этого класса за день: до него нашлись
 * задачи и база дебютов в шахматах.
 *
 * Проверяем ОБА условия. Одного сообщения мало: если обработчик ошибки
 * перестанет поднимать признак, сообщение станет мёртвым кодом, а экран
 * снова будет писать «загружается…» — и тест, смотрящий только на текст,
 * этого не заметит.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PAGE = path.join(__dirname, "..", "page.tsx");

describe("qgood: ожидание и отказ различимы", () => {
  it("страница читается", () => {
    expect(fs.existsSync(PAGE), PAGE).toBe(true);
  });

  it("у отказа своё сообщение", () => {
    const src = fs.readFileSync(PAGE, "utf8");
    expect(src.includes("Упражнения не загрузились"), "сообщение об отказе пропало").toBe(true);
  });

  it("обработчик ошибки поднимает признак отказа", () => {
    const src = fs.readFileSync(PAGE, "utf8");
    expect(src.includes("setExercisesFailed(true)"), "признак отказа больше не поднимается").toBe(true);
    const at = src.indexOf("setExercisesFailed(true)");
    const around = src.slice(Math.max(0, at - 120), at);
    expect(/\.catch\(/.test(around), "признак поднимается вне обработчика ошибки").toBe(true);
  });
});
