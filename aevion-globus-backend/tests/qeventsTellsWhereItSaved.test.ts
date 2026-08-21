import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/sourceCode";

/**
 * QEvents называет, где оказались событие, запись на него и место в очереди.
 *
 * Замер 19.08.2026: три места, и одно хуже прочих.
 *
 *   создание события  — есть ветка с базой, при отказе memEvents, ответ одинаков
 *   запись на событие — то же с memRSVPs
 *   лист ожидания     — ветки с базой НЕТ ВОВСЕ, только memWaitlist
 *
 * Третье теряется при КАЖДОЙ выкатке, а не при сбое базы: человек получает
 * «вы первый в очереди», и после ближайшего деплоя очереди не существует.
 * Выкаток бэкенда за 19.08 было шесть.
 *
 * Полная починка очереди требует таблицы и вынесена отдельно. Здесь — честный
 * признак: пока хранилища нет, человек об этом узнаёт.
 */

const SRC = stripComments(readFileSync(join(__dirname, "..", "src", "routes", "qevents.ts"), "utf8"));

describe("QEvents не выдаёт временное хранилище за постоянное", () => {
  test("контроль: обе ветки записи на месте", () => {
    // Иначе проверки ниже искали бы в переписанном файле и молчали.
    expect(SRC).toContain("isQEventsDbReady()");
    expect(SRC).toContain("memEvents.set");
    expect(SRC).toContain("memWaitlist.set");
  });

  test("создание события называет хранилище", () => {
    expect(SRC, "ответ снова не различает базу и память").toMatch(
      /res\.status\(201\)\.json\(\{\s*event,\s*storage:\s*isQEventsDbReady\(\)/,
    );
  });

  test("запись на событие называет хранилище", () => {
    expect(SRC).toMatch(/attendeeCount:\s*event\.attendeeCount,\s*storage:\s*isQEventsDbReady\(\)/);
  });

  test("очередь честно помечена временной и предупреждает словами", () => {
    // У неё нет ветки с базой вовсе, поэтому "memory" здесь жёстко —
    // вычисляемый признак был бы враньём: базы у неё нет ни при каком её
    // состоянии.
    expect(SRC, "очередь снова молчит о том, что она временная").toMatch(
      /position:[\s\S]{0,80}storage:\s*"memory"/,
    );
    expect(SRC, "предупреждения словами нет — интерфейс может признак не читать").toMatch(
      /warning:[\s\S]{0,120}перезапуск/,
    );
  });
});
