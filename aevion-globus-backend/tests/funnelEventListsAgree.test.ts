import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Список событий воронки живёт в ДВУХ экземплярах и ведётся порознь.
 *
 *   клиент: frontend/src/lib/useFunnel.ts   -> type ConstitutionEvent
 *   сервер: src/routes/constitutionFunnel.ts -> TRACKED_EVENTS
 *
 * Сервер НЕ ПРОСТО игнорирует незнакомое имя — он отвечает 400 unknown_event.
 * А клиент отправляет через `navigator.sendBeacon`, который ответа не читает
 * вовсе. Значит расхождение списков теряет шаг воронки АБСОЛЮТНО БЕСШУМНО:
 * ни ошибки в консоли, ни записи в Sentry, ни пустой строки в отчёте. Шаг
 * просто перестаёт существовать в цифрах, а код обеих половин выглядит
 * исправным.
 *
 * Замер 29.08.2026: сегодня списки совпадают, все 18 имён. Сторож ставится не
 * по факту дефекта, а потому что цена расхождения не равна его вероятности:
 * добавить событие на клиенте и забыть на сервере — правка на одну строку.
 *
 * Проверяем СОСТАВ, а не размер: равное количество при разных именах — ровно
 * тот случай, который выглядит благополучно и им не является.
 */

const CLIENT = resolve(__dirname, "../../frontend/src/lib/useFunnel.ts");
const SERVER = join(__dirname, "..", "src", "routes", "constitutionFunnel.ts");

/** Имена в двойных кавычках внутри блока, ограниченного началом и концом. */
function quotedNames(src: string, startMark: string, endMark: string): string[] {
  const a = src.indexOf(startMark);
  expect(a, `начало блока не найдено: ${startMark}`).toBeGreaterThan(-1);
  const b = src.indexOf(endMark, a);
  expect(b, `конец блока не найден: ${endMark}`).toBeGreaterThan(a);
  const block = src.slice(a, b);
  const out: string[] = [];
  let i = 0;
  for (;;) {
    const q1 = block.indexOf('"', i);
    if (q1 < 0) break;
    const q2 = block.indexOf('"', q1 + 1);
    if (q2 < 0) break;
    out.push(block.slice(q1 + 1, q2));
    i = q2 + 1;
  }
  return out;
}

const clientEvents = quotedNames(
  readFileSync(CLIENT, "utf8"),
  "export type ConstitutionEvent",
  ";",
);
const serverEvents = quotedNames(
  readFileSync(SERVER, "utf8"),
  "const TRACKED_EVENTS = new Set([",
  "]);",
);

describe("списки событий воронки на клиенте и сервере совпадают", () => {
  test("контроль: оба списка вообще разобрались", () => {
    // Без этого два пустых списка «совпали бы» и тест был бы зелёным впустую.
    expect(clientEvents.length, "клиентский список пуст — разбор смотрит не туда").toBeGreaterThan(10);
    expect(serverEvents.length, "серверный список пуст — разбор смотрит не туда").toBeGreaterThan(10);
  });

  test("контроль: разбор берёт ИМЕНА событий, а не что попало", () => {
    expect(clientEvents, "page_view обязан быть в клиентском списке").toContain("page_view");
    expect(serverEvents, "page_view обязан быть в серверном списке").toContain("page_view");
  });

  test("сервер знает каждое событие, которое умеет слать клиент", () => {
    const unknownToServer = clientEvents.filter((e) => !serverEvents.includes(e));
    expect(
      unknownToServer,
      "клиент шлёт событие, на которое сервер ответит 400 unknown_event. " +
        "Ответ уходит в никуда (sendBeacon его не читает), поэтому шаг воронки " +
        `исчезнет молча: ${unknownToServer.join(", ")}`,
    ).toEqual([]);
  });

  test("сервер не ждёт событий, которых клиент не умеет слать", () => {
    const neverSent = serverEvents.filter((e) => !clientEvents.includes(e));
    expect(
      neverSent,
      "сервер принимает имя, которого нет в типе клиента — либо опечатка, " +
        `либо отправитель удалили и забыли здесь: ${neverSent.join(", ")}`,
    ).toEqual([]);
  });

  test("составы совпадают целиком, а не по размеру", () => {
    // Равное количество при разных именах выглядит благополучно и им не является.
    expect([...clientEvents].sort()).toEqual([...serverEvents].sort());
  });
});
