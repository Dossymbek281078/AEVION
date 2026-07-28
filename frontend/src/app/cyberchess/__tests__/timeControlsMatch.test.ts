import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/* Список контролей времени для матчмейкинга существует в трёх местах: константа
   `ALLOWED_TIME_CONTROLS` на бэкенде, тип-union и массив `TIME_CONTROLS` на странице
   матчмейкинга. Сегодня они совпадают — проверено 28.07.2026, тупика для игрока нет.
   Но три копии одного решения расходятся не «если», а «когда»: добавят контроль на
   бэкенде, клиент о нём не узнает; уберут — клиент будет предлагать несуществующий
   и игрок встанет в очередь, из которой его не спарят.

   Бэкенд отдаёт этот список ручкой `/__meta/time-controls`, созданной ровно против
   такого расхождения, и она не подключена. Пока не подключена — расхождение ловит
   этот тест: он читает ОБА исходника и сравнивает.

   Правильное решение — брать список с сервера. Этот тест тогда можно удалить. */

const BACKEND = join(
  __dirname, "..", "..", "..", "..", "..",
  "aevion-globus-backend", "src", "routes", "cyberchessMatchmaking.ts",
);
const CLIENT = join(__dirname, "..", "matchmaking", "page.tsx");

/** Значения из `export const ALLOWED_TIME_CONTROLS = [...]`. */
function backendList(src: string): string[] {
  const m = src.match(/ALLOWED_TIME_CONTROLS\s*=\s*\[([\s\S]*?)\]/);
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

/** Значения `value:` из массива TIME_CONTROLS на странице матчмейкинга. */
function clientList(src: string): string[] {
  const m = src.match(/TIME_CONTROLS[^=]*=\s*\[([\s\S]*?)\n\];/);
  if (!m) return [];
  return [...m[1].matchAll(/value:\s*"([^"]+)"/g)].map((x) => x[1]);
}

describe("контроли времени: клиент и бэкенд", () => {
  const backendExists = existsSync(BACKEND);

  it("оба исходника на месте — иначе тест ничего не проверяет", () => {
    expect(backendExists, `не найден ${BACKEND}`).toBe(true);
    expect(existsSync(CLIENT)).toBe(true);
  });

  it.skipIf(!backendExists)("разборщики что-то нашли, а не молча вернули пусто", () => {
    expect(backendList(readFileSync(BACKEND, "utf8")).length).toBeGreaterThan(0);
    expect(clientList(readFileSync(CLIENT, "utf8")).length).toBeGreaterThan(0);
  });

  it.skipIf(!backendExists)("списки совпадают по составу и порядку", () => {
    const back = backendList(readFileSync(BACKEND, "utf8"));
    const front = clientList(readFileSync(CLIENT, "utf8"));
    expect(
      front,
      `Клиент предлагает ${front.join(", ")}, а матчмейкинг принимает ${back.join(", ")}. ` +
        `Расхождение означает, что игрок встанет в очередь, из которой его не спарят. ` +
        `Правильно — брать список с /__meta/time-controls, а не править вторую копию.`,
    ).toEqual(back);
  });
});

describe("разбор списков", () => {
  it("читает список бэкенда", () => {
    expect(backendList('export const ALLOWED_TIME_CONTROLS = [\n "60+0",\n "180+0",\n] as const;'))
      .toEqual(["60+0", "180+0"]);
  });

  it("читает список клиента", () => {
    const src = 'const TIME_CONTROLS: X[] = [\n  { value: "60+0", label: "1+0" },\n  { value: "180+0", label: "3+0" },\n];';
    expect(clientList(src)).toEqual(["60+0", "180+0"]);
  });

  it("отсутствие списка даёт пусто, а не падение", () => {
    expect(backendList("ничего похожего")).toEqual([]);
    expect(clientList("ничего похожего")).toEqual([]);
  });
});
