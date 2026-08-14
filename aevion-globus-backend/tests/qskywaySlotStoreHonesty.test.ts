import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Рынок 4D-слотов — единственное место модуля, где выдаётся ПРАВО, и до
 * 13.08.2026 все три операции с ним молча меняли хранилище при ошибке базы:
 *
 *   • чтение возвращало пустую память → упавший запрос показывался как
 *     «слотов пока не забронировано», то есть сбой выдавался за факт о рынке;
 *   • счёт возвращал ноль по той же причине;
 *   • бронь ЗАПИСЫВАЛАСЬ В ПАМЯТЬ и отдавала квитанцию «право зафиксировано»,
 *     хотя список читается из базы (значит записи там нет) и проверка лимита
 *     на следующий запрос считает тоже по базе — право выдано, но система его
 *     не покажет и не учтёт.
 *
 * Поле `store` при этом продолжало говорить `postgres`.
 *
 * Здесь база подменяется на всегда падающую, и проверяется, что обе ручки
 * отвечают отказом, а не выдумывают пустой рынок и не выдают квитанцию.
 */
/**
 * База, которая ПОДНЯЛАСЬ, а потом отвалилась. Первый запрос — создание таблицы
 * при инициализации — проходит, поэтому `slotsDbAvailable` становится true и
 * модуль считает Postgres рабочим. Все последующие запросы падают.
 *
 * Первая версия этого мока роняла ВСЕ запросы, и дефект не воспроизводился:
 * инициализация тоже падала, модуль честно уходил в законный режим памяти и
 * отвечал 200/201. Это другой, разрешённый случай — Postgres не настроен вовсе,
 * и `store: "memory"` говорит об этом прямо. Опасен именно разрыв НА ХОДУ.
 */
vi.mock("../src/lib/dbPool", () => {
  const boom = () => { throw new Error("connection refused (тест)"); };
  return {
    getPool: () => ({
      // Инициализация опознаётся по тексту запроса, а не счётчиком «первый
      // вызов»: фабрика мока создаётся один раз на файл, и счётчик переживал бы
      // `vi.resetModules()`, из-за чего во втором тесте падало бы уже создание
      // таблицы — то есть проверялся бы законный режим памяти, а не разрыв.
      query: async (sql?: string) =>
        typeof sql === "string" && sql.includes("CREATE TABLE") ? { rows: [], rowCount: 0 } : boom(),
      connect: async () => ({ query: async () => boom(), release: () => {} }),
    }),
    getPoolStats: () => null,
  };
});

describe("рынок слотов не выдаёт сбой хранилища за факт о рынке", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.resetModules();
    const { qskywayRouter } = await import("../src/routes/qskyway");
    app = express().use(express.json()).use("/api/qskyway", qskywayRouter);
  });

  test("GET /slots отвечает 503, а не пустым рынком", async () => {
    const r = await request(app).get("/api/qskyway/slots");
    // Ключевое: НЕ 200 с count: 0. Пустой рынок и нечитаемый — разные ответы.
    expect(r.status).toBe(503);
    expect(String(r.body.error)).toContain("недоступен");
    expect(r.body.count).toBeUndefined();
  });

  test("POST /slots не выдаёт квитанцию, когда право негде записать", async () => {
    const r = await request(app).post("/api/qskyway/slots").send({
      routeId: "test-route", t0: "2026-07-11T09:00:00Z", t1: "2026-07-11T09:03:00Z", holder: "тест",
    });
    expect(r.status).toBe(503);
    expect(r.body.ok).toBeUndefined();
    expect(r.body.slot).toBeUndefined();
    // Отказ по хранилищу нельзя путать с «слот занят»: первое чинят, второе пережидают.
    expect(String(r.body.error)).not.toContain("занят");
    expect(String(r.body.error)).toContain("не зафиксировано");
  });

  test("некорректный запрос по-прежнему отвергается раньше хранилища", async () => {
    // Иначе 503 начал бы прятать обычные ошибки ввода.
    const r = await request(app).post("/api/qskyway/slots").send({ routeId: "r" });
    expect(r.status).toBe(400);
  });
});
