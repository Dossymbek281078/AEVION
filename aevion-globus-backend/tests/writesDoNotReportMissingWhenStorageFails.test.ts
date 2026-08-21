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
vi.mock("../src/lib/ensureQStoreTables", () => ({
  ensureQStoreTables: async () => {},
  isQStoreDbReady: () => true,
  getQStoreDbError: () => null,
}));
vi.mock("../src/lib/ensureQLearnTables", () => ({
  ensureQLearnTables: async () => {},
  isQLearnDbReady: () => true,
  getQLearnDbError: () => null,
}));
vi.mock("../src/lib/ensureQNewsTables", () => ({
  ensureQNewsTables: async () => {},
  isQNewsDbReady: () => true,
  getQNewsDbError: () => null,
}));

import { mapRealityRouter } from "../src/routes/mapReality";
import { devhubRouter } from "../src/routes/devhub";
import { qstoreRouter } from "../src/routes/qstore";
import { qnewsRouter } from "../src/routes/qnews";
import { qlearnRouter } from "../src/routes/qlearn";
import jwt from "jsonwebtoken";

function app(router: express.Router, base: string) {
  const a = express();
  a.use(express.json());
  a.use(base, router);
  return a;
}

// Настоящий токен: 54 ручки записи из 76 закрыты авторизацией, и без него
// зонд их просто не видит. Секрет в dev-режиме тот же, что у приложения.
const TOKEN = jwt.sign({ sub: "probe-user" }, "dev-auth-secret", {
  algorithm: "HS256",
  expiresIn: "1h",
});

describe("запись при упавшем хранилище не отвечает «не найдено»", () => {
  test("QStore: продавец удаляет СВОЙ товар", async () => {
    const res = await request(app(qstoreRouter, "/x"))
      .delete("/x/me/products/12345")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({});
    expect(res.status, "продавцу отвечали «товара нет» про его же товар").not.toBe(404);
    expect(res.status).toBe(503);
  });

  test("QNews: закладка на статью", async () => {
    const res = await request(app(qnewsRouter, "/x"))
      .post("/x/articles/12345/bookmark")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({});
    expect(res.status, "закладка молча не ставилась, а ответ звучал как «нет статьи»").not.toBe(404);
    expect(res.status).toBe(503);
  });

  test("QLearn: запись на курс", async () => {
    const res = await request(app(qlearnRouter, "/x"))
      .post("/x/courses/12345/enroll")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({});
    expect(res.status, "студент видел «курса нет», а запись молча не прошла").not.toBe(404);
    expect(res.status).toBe(503);
    expect(String(res.body?.warning ?? "")).toMatch(/НЕ сохранена/);
  });

  test("контроль: без токена по-прежнему 401, а не 503", async () => {
    // Иначе тест был бы зелёным и на ручке, которая отвечает 503 до проверки прав.
    const res = await request(app(qstoreRouter, "/x")).delete("/x/me/products/12345").send({});
    expect(res.status).toBe(401);
  });

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
