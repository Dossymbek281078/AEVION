import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/**
 * Базы НЕТ ВОВСЕ (так работает локальная разработка и демо-развёртывание).
 *
 * Тогда память И ЕСТЬ хранилище: отказывать не в чем, курс действительно
 * создан — но живёт до перезапуска, и сказать об этом надо. Признак —
 * поле `storage` в теле, как уже принято в модуле.
 *
 * Отличие от qlearnCreateTellsWhereItSaved: там база настроена и УПАЛА, и
 * там правильный ответ — отказ. Два разных случая, два разных ответа; их
 * легко перепутать, потому и разнесены по файлам.
 */

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: async () => ({ rows: [], rowCount: 0 }) }),
  isDbConfigured: () => false,
}));
vi.mock("../src/lib/ensureQLearnTables", () => ({
  ensureQLearnTables: async () => {},
  isQLearnDbReady: () => false,
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

describe("базы нет: создаём и честно говорим, где сохранили", () => {
  test("курс создаётся и назван признак памяти", async () => {
    const res = await request(app())
      .post("/x/me/courses")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ title: "Курс без базы", description: "о чём-то", category: "tech" });
    expect(res.status, `курс не создан: ${JSON.stringify(res.body)}`).toBe(201);
    expect(res.body?.course?.title, "признак заменил функцию: курса нет").toBe("Курс без базы");
    expect(res.body?.storage, "201 неотличим от настоящего сохранения").toBe("memory");
    expect(String(res.body?.warning ?? "")).toMatch(/до перезапуска/);
  });

  test("урок создаётся и тоже назван признак", async () => {
    const course = await request(app())
      .post("/x/me/courses")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ title: "Курс", description: "d", category: "tech" });
    const courseId = course.body?.course?.id as string;
    const res = await request(app())
      .post(`/x/me/courses/${courseId}/lessons`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ title: "Урок", content: "текст" });
    expect(res.status, `урок не создан: ${JSON.stringify(res.body)}`).toBe(201);
    expect(res.body?.lesson?.title).toBe("Урок");
    expect(res.body?.storage).toBe("memory");
  });
});
