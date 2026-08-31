import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Каждая ручка модуля, которая ПИШЕТ или ходит наружу, имеет предел частоты.
 *
 * ПОВОД. 28.08.2026: у проверки якоря и у регистрации редакции ограничитель
 * стоял, а у записи брони — нет. То есть предел был у того, что читает, и
 * отсутствовал у того, что создаёт строки в боевой базе. Свип показал, что это
 * не единичный случай, а класс: 40 таких ручек в 19 модулях платформы.
 *
 * Опознания звонящего здесь нет по устройству: страница публичная, а демо-кнопка
 * подписывается зашитым «AEVION demo». Значит предел по адресу — единственное,
 * что стоит между 41 записью и сорока тысячами.
 *
 * Проверка по ИСХОДНИКУ, а не прогоном: чтобы увидеть 429, надо послать семь
 * настоящих запросов, то есть создать шесть настоящих записей. Проверять
 * защиту от мусора, производя мусор, — плохой размен.
 *
 * ⚠️ Чего здесь НЕТ и почему. Публичный расчёт (`/route`, `/route/justification`,
 * `/route/justification/verify`) предела не имеет намеренно. Он ничего не пишет
 * и никуда не ходит — только процессор. Поставить предел мешает не смысл, а
 * устройство: общий `lib/rateLimit.ts` не умеет сбрасывать бакеты между
 * тестами, поэтому 19 существующих проверок модуля начинают падать на 429.
 * Чинится это правкой ОБЩЕГО файла всех модулей — отдельным решением, не
 * попутно.
 */
const SRC = readFileSync(path.join(__dirname, "..", "src", "routes", "qskyway.ts"), "utf8");
const LINES = SRC.split(String.fromCharCode(10));
const QUOTE = String.fromCharCode(34);

/**
 * ⚠️ Список ПОЛОЖИТЕЛЬНЫЙ, а у положительных списков своя беда: усохнет — и
 * сторож станет зелёным, охраняя пустоту. Пол ниже это закрывает.
 */
const MUST_BE_LIMITED = [
  { route: "/slots", limiter: "slotBookLimiter", why: "создаёт строки в боевой базе" },
  { route: "/airspace/register", limiter: "registerLimiter", why: "регистрирует редакцию" },
  { route: "/airspace/anchor", limiter: "anchorLimiter", why: "обращается в календари OpenTimestamps" },
  { route: "/airspace/anchor/verify", limiter: "anchorVerifyLimiter", why: "проверка ходит в чужие календари" },
];

function declarationLine(route: string): string | undefined {
  return LINES.find((l) => l.includes(QUOTE + route + QUOTE) && l.includes("qskywayRouter.post("));
}

function maxOf(limiter: string): number | null {
  const at = SRC.indexOf("const " + limiter + " = rateLimit(");
  if (at < 0) return null;
  const block = SRC.slice(at, at + 400);
  const key = block.indexOf("max:");
  if (key < 0) return null;
  const n = parseInt(block.slice(key + 4).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

describe("пишущие и ходящие наружу ручки ограничены по частоте", () => {
  test("список не усох", () => {
    // Мутация: удали строку из MUST_BE_LIMITED — этот тест обязан покраснеть.
    expect(MUST_BE_LIMITED.length).toBeGreaterThanOrEqual(4);
  });

  for (const { route, limiter, why } of MUST_BE_LIMITED) {
    test("предел ПОДКЛЮЧЁН к " + route + " (" + why + ")", () => {
      expect(SRC.includes("const " + limiter), "ограничитель " + limiter + " исчез").toBe(true);
      const line = declarationLine(route);
      expect(line, "ручка " + route + " исчезла").toBeTruthy();
      // Объявить мало: лимитер, который забыли подключить, выглядит защитой и
      // ею не является. Требуем его ИМЕННО в строке объявления маршрута.
      expect(
        String(line).includes(limiter),
        "ограничитель объявлен, но к " + route + " НЕ подключён: " + String(line).slice(0, 90),
      ).toBe(true);
    });

    test("предел у " + route + " в разумных границах", () => {
      // Ограничитель с пределом в тысячу — это отсутствие ограничителя с видом
      // защиты. Закрепляем порядок величины, а не число.
      const m = maxOf(limiter);
      expect(m, "у " + limiter + " не нашлось max").not.toBeNull();
      expect(Number(m), "предел выше 30 в минуту — уже не ограничение").toBeLessThanOrEqual(30);
      expect(Number(m), "предел ниже 3 в минуту отобьёт живого человека").toBeGreaterThanOrEqual(3);
    });

    test("отказ у " + route + " говорит на двух языках", () => {
      const at = SRC.indexOf("const " + limiter + " = rateLimit(");
      const block = SRC.slice(at, at + 800);
      expect(block.includes("Слишком много"), "нет русского текста отказа").toBe(true);
      expect(block.includes("Too many"), "нет английского текста отказа").toBe(true);
    });
  }
});
