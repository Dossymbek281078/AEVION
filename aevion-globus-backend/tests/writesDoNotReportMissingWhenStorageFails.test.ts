import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * То же, что у чтений, но на ЗАПИСЯХ — и там цена ошибки выше.
 *
 * Найдено зондом по PATCH/DELETE/PUT 21.08.2026. Из 76 ручек 54 закрыты
 * авторизацией и до хранилища не доходят вовсе (эту половину зонд честно не
 * видит), а среди оставшихся нашлась та же схема:
 *
 *   try   { ...база... }
 *   catch { запись = память.get(id) ?? null }   // в проде память пуста
 *   if (!запись) 404 "not found"
 *
 * Для чтения это ложь о чужой записи. Для УДАЛЕНИЯ хуже: человек читает 404 как
 * «уже удалено» и уходит, а запись на месте. Для звезды или отметки «прочитано»
 * действие молча не происходит, а ответ выглядит осмысленным.
 *
 * Отделено ПОЛОЖИТЕЛЬНЫМ контролем: с работающей базой те же ручки отвечают
 * 200. Значит база на пути, и её отказ подменялся отсутствием записи.
 */

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql?: string) => {
      const head = String(sql ?? "").trimStart().toUpperCase();
      if (head.startsWith("CREATE") || head.startsWith("ALTER")) return { rows: [], rowCount: 0 };
      throw new Error("storage unreachable");
    },
  }),
  isDbConfigured: () => true,
}));
vi.mock("../src/lib/ensureMapRealityTables", () => ({
  ensureMapRealityTables: async () => {},
  isMapRealityDbReady: () => true,
  getMapRealityDbError: () => null,
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: async () => {},
  isDevHubDbReady: () => true,
  getDevHubDbError: () => null,
}));

import { mapRealityRouter } from "../src/routes/mapReality";
import { devhubRouter } from "../src/routes/devhub";

function app(router: express.Router, base: string) {
  const a = express();
  a.use(express.json());
  a.use(base, router);
  return a;
}

describe("запись при упавшем хранилище не отвечает «не найдено»", () => {
  test("MapReality: поддержать сигнал", async () => {
    const res = await request(app(mapRealityRouter, "/x"))
      .post("/x/signals/12345/support")
      .send({ supporterAlias: "кто-то" });
    expect(res.status, "404 читается как «сигнала нет»").not.toBe(404);
    expect(res.status).toBe(503);
    expect(String(res.body?.warning ?? "")).toMatch(/недоступно/);
  });

  test("DevHub: поставить звезду фрагменту", async () => {
    const res = await request(app(devhubRouter, "/x")).post("/x/snippets/12345/star").send({});
    expect(res.status, "звезда молча не поставилась, а ответ выглядел осмысленным").not.toBe(404);
    expect(res.status).toBe(503);
  });

  test("DevHub: удалить проект", async () => {
    // Худший из трёх: 404 читается как «уже удалено».
    const res = await request(app(devhubRouter, "/x")).delete("/x/projects/12345").send({});
    expect(res.status).toBe(503);
    expect(String(res.body?.warning ?? "")).toMatch(/НЕ значит/);
  });

  test("контроль: заведомо неверный путь по-прежнему 404", async () => {
    // Иначе тест был бы зелёным и на роутере, который на всё отвечает 503.
    const res = await request(app(devhubRouter, "/x")).delete("/x/no-such-route-here").send({});
    expect(res.status).toBe(404);
  });
});
