import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/**
 * Создание курса и урока: 201 не должен быть неотличим от сохранения.
 *
 * При отказе базы запись уходила в память процесса, а ответ был ровно тем же —
 * 201 с объектом. Автор считает курс созданным; курс живёт до перезапуска.
 *
 * Строка с признаком достижима в двух случаях, и оба честны: база не настроена
 * вовсе (тогда память И ЕСТЬ хранилище) и база упала. В обоих запись не в базе,
 * и говорить об этом надо одинаково.
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
vi.mock("../src/lib/ensureQLearnTables", () => ({
  ensureQLearnTables: async () => {},
  isQLearnDbReady: () => true,
  getQLearnDbError: () => null,
}));

import { qlearnRouter } from "../src/routes/qlearn";

const TOKEN = jwt.sign({ sub: "author-1" }, "dev-auth-secret", { algorithm: "HS256", expiresIn: "1h" });

function app() {
  const a = express();
  a.use(express.json());
  a.use("/x", qlearnRouter);
  return a;
}

describe("QLearn: создание говорит, куда сохранило", () => {
  test("курс", async () => {
    const res = await request(app())
      .post("/x/me/courses")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ title: "Курс", description: "о чём-то", category: "tech", level: "beginner" });
    expect(res.status, `неожиданный ответ ${res.status}: проверка не состоялась`).toBe(201);
    expect(res.body?.storage, "201 неотличим от настоящего сохранения").toBe("memory");
    expect(String(res.body?.warning ?? "")).toMatch(/до перезапуска/);
  });

  test("урок", async () => {
    const res = await request(app())
      .post("/x/me/courses/c1/lessons")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ title: "Урок", content: "текст", order: 1 });
    expect(res.status, `неожиданный ответ ${res.status}: проверка не состоялась`).toBe(201);
    expect(res.body?.storage).toBe("memory");
  });

  test("контроль: курс всё же СОЗДАН, а не отвергнут", async () => {
    // Признак не должен подменять работу: запись обязана существовать, просто
    // не в базе. Иначе «честность» превратилась бы в потерю функции.
    const res = await request(app())
      .post("/x/me/courses")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ title: "Второй", description: "d", category: "tech", level: "beginner" });
    expect(res.body?.course?.id, "объект курса не вернулся").toBeTruthy();
    expect(res.body?.course?.title).toBe("Второй");
  });
});
