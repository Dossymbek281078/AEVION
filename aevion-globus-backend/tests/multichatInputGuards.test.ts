// Входные значения веера и счётчик поиска.
//
// Оба места отвечают 200 и выглядят исправно, а ошибаются молча.
//
// 1. Два агента с одинаковым id пишут ответы в ОДНУ подветку
//    `${convId}:${agentId}`. Отказа нет, ответы сохранены — но раскладка «по
//    агенту» (публичная страница, карта разногласий) видит одного, и второй
//    ответ, за который заплачено, с экрана исчезает.
//
// 2. Поиск отдаёт `total` равным длине СТРАНИЦЫ, а не числу совпадений.
//    Клиент, который покажет «найдено N», покажет размер страницы. И тот же
//    обработчик при нечисловом limit молча возвращает пустой список — то есть
//    «ничего не найдено» вместо «параметр неверный».

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { multichatRouter } from "../src/routes/multichat";

const SECRET = "test-secret-multichat-guards-0123456789";
const USER = "user_guards_test";

let app: express.Express;
let dataDir: string;
let token: string;
const prev: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ["AEVION_DATA_DIR", "AUTH_JWT_SECRET", "DATABASE_URL"]) prev[k] = process.env[k];
  dataDir = mkdtempSync(path.join(tmpdir(), "aevion-mc-guards-"));
  process.env.AEVION_DATA_DIR = dataDir;
  process.env.AUTH_JWT_SECRET = SECRET;
  delete process.env.DATABASE_URL;

  token = jwt.sign({ sub: USER, email: "e@aevion.local", role: "USER" }, SECRET, { expiresIn: "1h" });

  app = express();
  app.use(express.json());
  app.use("/api/multichat", multichatRouter);
});

afterEach(() => {
  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  rmSync(dataDir, { recursive: true, force: true });
});

const auth = (r: request.Test) => r.set("Authorization", `Bearer ${token}`);

describe("Веер: одинаковые id агентов", () => {
  test("отклоняются до вызова моделей, а не теряют ответ молча", async () => {
    const conv = await auth(request(app).post("/api/multichat/conversations")).send({ title: "Дубли" });
    const id: string = conv.body.id;

    const r = await auth(request(app).post(`/api/multichat/conversations/${id}/dispatch`)).send({
      prompt: "Вопрос с двумя одинаковыми агентами",
      agents: [{ id: "analyst", role: "Аналитик" }, { id: "analyst", role: "Второй аналитик" }],
    });

    expect(r.status).toBe(400);
    expect(String(r.body.error)).toMatch(/id/i);

    // И денег это не стоило: вопрос в ленту не записан, значит вызовов не было.
    const dump = await auth(request(app).get(`/api/multichat/conversations/${id}/export.json`));
    expect(dump.body.turns).toHaveLength(0);
  });
});

describe("Поиск бесед", () => {
  async function seed(titles: string[]) {
    for (const t of titles) {
      await auth(request(app).post("/api/multichat/conversations")).send({ title: t });
    }
  }

  test("total — число совпадений, а не размер страницы", async () => {
    await seed(["тариф раз", "тариф два", "тариф три", "найм"]);

    const r = await auth(request(app).get("/api/multichat/search?q=тариф&limit=2"));
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(2);
    // Три беседы совпали, показаны две. «total: 2» превращает страницу в итог.
    expect(r.body.total).toBe(3);
  });

  test("нечисловой limit — отказ с причиной, а не пустой список", async () => {
    await seed(["тариф раз", "тариф два"]);

    const r = await auth(request(app).get("/api/multichat/search?q=тариф&limit=abc"));
    // Пустой список на кривой параметр читается как «ничего не найдено» —
    // человек уходит искать в другое место вместо того, чтобы исправить запрос.
    expect(r.status).toBe(400);
    expect(String(r.body.error)).toMatch(/limit/i);
  });
});
