import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Единственная ручка модуля, которая ПИШЕТ, имеет предел частоты.
 *
 * ПОВОД. 28.08.2026: у проверки якоря и у регистрации редакции ограничитель
 * стоял, а у записи брони — нет. То есть предел был у того, что читает, и
 * отсутствовал у того, что создаёт строки в боевой базе.
 *
 * Опознания звонящего здесь нет по устройству: демо-кнопка публичной страницы
 * подписывается зашитым «AEVION demo». Значит предел по адресу — единственное,
 * что стоит между 41 записью и сорока тысячами.
 *
 * Проверка по ИСХОДНИКУ, а не прогоном: чтобы увидеть 429, надо послать семь
 * настоящих запросов, то есть создать шесть настоящих записей. Проверять
 * защиту от мусора, производя мусор, — плохой размен.
 */
const SRC = readFileSync(path.join(__dirname, "..", "src", "routes", "qskyway.ts"), "utf8");

describe("запись брони ограничена по частоте", () => {
  test("ограничитель объявлен и ПОДКЛЮЧЁН к ручке записи", () => {
    expect(SRC.includes("slotBookLimiter"), "ограничитель исчез").toBe(true);
    // ⚠️ Объявить мало: лимитер, который забыли подключить, выглядит защитой и
    // ею не является. Требуем его ИМЕННО в строке объявления маршрута.
    const line = SRC.split(String.fromCharCode(10))
      .find((l) => l.includes('qskywayRouter.post("/slots"'));
    expect(line, "ручка записи исчезла").toBeTruthy();
    expect(
      String(line).includes("slotBookLimiter"),
      "ограничитель объявлен, но к ручке записи НЕ подключён: " + String(line).slice(0, 90),
    ).toBe(true);
  });

  test("предел не задран до бессмысленного", () => {
    // Ограничитель с пределом в тысячу — это отсутствие ограничителя с видом
    // защиты. Закрепляем порядок величины, а не число: менять можно, но
    // осознанно и вместе с этой строкой.
    const block = SRC.slice(SRC.indexOf("const slotBookLimiter"), SRC.indexOf("const slotBookLimiter") + 400);
    const m = block.match(/max:\s*(\d+)/);
    expect(m, "у ограничителя нет предела").toBeTruthy();
    expect(Number(m![1]), "предел выше 30 в минуту — это уже не ограничение").toBeLessThanOrEqual(30);
    expect(Number(m![1]), "предел ниже 3 в минуту отобьёт живого человека").toBeGreaterThanOrEqual(3);
  });

  test("отказ говорит на двух языках", () => {
    const block = SRC.slice(SRC.indexOf("const slotBookLimiter"), SRC.indexOf("const slotBookLimiter") + 700);
    expect(/Слишком много/.test(block), "нет русского текста отказа").toBe(true);
    expect(/Too many/.test(block), "нет английского текста отказа").toBe(true);
  });
});
