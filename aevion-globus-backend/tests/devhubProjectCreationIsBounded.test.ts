import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Создание проекта останавливается при перебор.
 *
 * Это единственная запись в базу, доступная БЕЗ входа и без какой-либо платы.
 * Замер 29.08.2026: ни ограничителя темпа, ни потолка на пользователя, ни
 * общего ограничителя на приложении — любой скрипт мог заполнять таблицу
 * проектов сколько угодно.
 *
 * Дорогие ручки защищены месячной нормой, и это верно: там тратятся деньги.
 * Здесь тратится место и время базы, а значит работа всех остальных.
 */
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: vi.fn() }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";

// ОДИН адрес на все запросы: здесь проверяется именно предел по адресу.
// В остальных файлах адрес меняется на каждый запрос — там проверяют другое.
function appFromOneClient(ip: string) {
  const app = express();
  app.set("trust proxy", true);
  app.use((req, _res, next) => {
    req.headers["x-forwarded-for"] = ip;
    next();
  });
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}

describe("создание проектов не бесконечно", () => {
  beforeEach(() => {
    __resetDevHubStore();
  });

  test("одиннадцатый проект с одного адреса за минуту отбивается", async () => {
    const app = appFromOneClient("10.55.0.1");
    let ok = 0;
    let blocked = 0;
    for (let i = 0; i < 14; i++) {
      const r = await request(app).post("/api/devhub/projects").send({ name: `проект ${i}` });
      if (r.status === 429) blocked += 1;
      else if (r.status < 400) ok += 1;
    }
    // Контроль прибора: если бы НИ ОДИН не прошёл, «отбивает» ничего не
    // значило бы — предел мог сработать на первом же и по другой причине.
    expect(ok, "не прошёл ни один проект — проверяется не предел").toBeGreaterThan(5);
    expect(blocked, "перебор не отбивается: создание проектов ничем не ограничено").toBeGreaterThan(0);
  });

  test("другой адрес не наказан за соседа", async () => {
    // Иначе предел бил бы по всем сразу: один скрипт закрывал бы модуль
    // для живых людей.
    const noisy = appFromOneClient("10.55.0.2");
    for (let i = 0; i < 14; i++) {
      await request(noisy).post("/api/devhub/projects").send({ name: `шум ${i}` });
    }
    const quiet = appFromOneClient("10.55.0.3");
    const r = await request(quiet).post("/api/devhub/projects").send({ name: "тихий" });
    expect(r.status, "сосед наказан за чужой перебор").toBeLessThan(400);
  });

  test("сниппеты ограничены тем же пределом", async () => {
    // Тот же класс, что и проекты: запись в базу без входа и без платы.
    // Здесь даже хуже — содержимое до ста килобайт на запись.
    const app = appFromOneClient("10.55.0.4");
    let ok = 0;
    let blocked = 0;
    for (let i = 0; i < 14; i++) {
      const r = await request(app)
        .post("/api/devhub/snippets")
        .send({ title: `кусок ${i}`, content: "console.log(1)" });
      if (r.status === 429) blocked += 1;
      else if (r.status < 400) ok += 1;
    }
    expect(ok, "не прошёл ни один сниппет — проверяется не предел").toBeGreaterThan(5);
    expect(blocked, "перебор сниппетов не отбивается").toBeGreaterThan(0);
  });
});
