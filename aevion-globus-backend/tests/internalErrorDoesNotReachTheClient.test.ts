import { describe, test, expect } from "vitest";
import { PublicError, safeErrorText } from "../src/lib/safeError";

/**
 * Внутренняя ошибка не уходит наружу дословно.
 *
 * Найдено доказательным замером 21.08.2026: подставная ошибка базы несла
 * уникальный маркер, и он оказался в телах ответов 28 ручек восьми модулей
 * (bureau, lifebox, pipeline, planetCompliance, psyappDeps, qcontract, qpaynet,
 * qpersona). Настоящая ошибка Postgres в этом месте содержит хост, порт и имя
 * пользователя базы.
 *
 * Это не гипотеза из чтения кода: маркер в ответе — прямое доказательство.
 */

describe("safeErrorText", () => {
  test("текст драйвера базы наружу НЕ проходит", () => {
    const real = new Error("connect ECONNREFUSED db-prod-7.internal:5432 user=aevion_app");
    const out = safeErrorText(real, "не удалось получить данные");
    expect(out).toBe("не удалось получить данные");
    expect(out).not.toMatch(/ECONNREFUSED|internal:5432|user=/);
  });

  test("наш собственный текст для пользователя проходит", () => {
    // Иначе «безопасность» съела бы полезные подсказки вроде «файл больше 10 МБ».
    const mine = new PublicError("Файл больше 10 МБ — уменьшите размер.");
    expect(safeErrorText(mine, "не удалось загрузить")).toBe("Файл больше 10 МБ — уменьшите размер.");
  });

  test("не-ошибки тоже не протекают", () => {
    expect(safeErrorText("PGPASSWORD=hunter2", "сбой")).toBe("сбой");
    expect(safeErrorText({ stack: "секрет" }, "сбой")).toBe("сбой");
    expect(safeErrorText(null, "сбой")).toBe("сбой");
  });

  test("контроль: подмена работает в обе стороны", () => {
    // Если однажды PublicError перестанет отличаться от Error, этот тест
    // покраснеет раньше, чем секрет уедет к пользователю.
    expect(new PublicError("x") instanceof Error).toBe(true);
    expect(new Error("x") instanceof PublicError).toBe(false);
  });
});
