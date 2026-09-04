import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/**
 * Работа, сделанная гостем, не пропадает при входе в аккаунт.
 *
 * Замер 03.09.2026: человек пробовал DevHub гостем, входил — и ТЕРЯЛ все свои
 * проекты из виду. Гостевые висят на "guest:<id>", после входа личностью
 * становится sub из токена, и список отдаёт пустоту. Механизма переноса не
 * было НИ ОДНОГО: ни ручки, ни присваивания в SQL (проверено обоими способами).
 *
 * Бьёт дважды: по первой опоре планеты («вошёл один раз — узнают везде») и по
 * воронке — работа исчезает ровно тогда, когда человек решил остаться.
 *
 * Про безопасность: гостевой идентификатор сам по себе даёт доступ к этим
 * проектам, он и есть ключ. Перенос не открывает ничего нового — он переписывает
 * владельца на того, кто ключ уже держит. Здесь это закреплено отдельным
 * случаем: ЧУЖИЕ проекты не переезжают.
 */
const { режим } = vi.hoisted(() => ({ режим: { падать: false } }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async () => { if (режим.падать) throw new Error("нет базы"); return { rows: [], rowCount: 0 }; },
  }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  // В памяти: перенос обязан работать и при недоступной базе, иначе работа
  // «переедет» наполовину, а это выглядит как потеря.
  isDevHubDbReady: () => false,
}));

const SECRET = "test-secret-for-devhub-guest-adoption-long-enough";

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";

function приложение() {
  const app = express();
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}

describe("гостевая работа переживает вход в аккаунт", () => {
  beforeEach(() => {
    __resetDevHubStore();
    process.env.AUTH_JWT_SECRET = SECRET;
    режим.падать = false;
  });

  test("прибор исправен: гость создаёт проект и видит его", async () => {
    // Контроль. Без него следующие случаи проверяли бы поломку стенда.
    const app = приложение();
    const создан = await request(app).post("/api/devhub/projects")
      .set("x-devhub-guest", "guest-abc-0001").send({ name: "проба" });
    expect([200, 201], `создание не прошло: ${JSON.stringify(создан.body).slice(0, 120)}`)
      .toContain(создан.status);
    const список = await request(app).get("/api/devhub/projects")
      .set("x-devhub-guest", "guest-abc-0001");
    expect(список.body.projects?.length, "гость не видит свой проект").toBe(1);
  });

  test("ДО переноса вошедший своей гостевой работы не видит — это и есть дефект", async () => {
    const app = приложение();
    await request(app).post("/api/devhub/projects")
      .set("x-devhub-guest", "guest-abc-0001").send({ name: "проба" });
    const token = jwt.sign({ sub: "user-77" }, SECRET);
    const список = await request(app).get("/api/devhub/projects")
      .set("x-devhub-guest", "guest-abc-0001")
      .set("Authorization", `Bearer ${token}`);
    expect(список.body.projects?.length, "работа видна и без переноса — значит проверяется не то").toBe(0);
  });

  test("после переноса вошедший видит свою работу", async () => {
    const app = приложение();
    await request(app).post("/api/devhub/projects")
      .set("x-devhub-guest", "guest-abc-0001").send({ name: "проба" });
    const token = jwt.sign({ sub: "user-77" }, SECRET);

    const перенос = await request(app).post("/api/devhub/studio/adopt-guest")
      .set("x-devhub-guest", "guest-abc-0001")
      .set("Authorization", `Bearer ${token}`);
    expect(перенос.status, `перенос не прошёл: ${JSON.stringify(перенос.body).slice(0, 120)}`).toBe(200);
    expect(перенос.body.adopted, "перенос отчитался, но ничего не перенёс").toBe(1);

    const список = await request(app).get("/api/devhub/projects")
      .set("Authorization", `Bearer ${token}`);
    expect(список.body.projects?.length, "работа не переехала в аккаунт").toBe(1);
  });

  test("ЧУЖАЯ гостевая работа не переезжает", async () => {
    // Главное утверждение про безопасность: переносится только то, чей ключ
    // прислан. Иначе вход превращался бы в присвоение чужого.
    const app = приложение();
    await request(app).post("/api/devhub/projects")
      .set("x-devhub-guest", "guest-mine-0001").send({ name: "моё" });
    await request(app).post("/api/devhub/projects")
      .set("x-devhub-guest", "guest-other-002").send({ name: "чужое" });
    const token = jwt.sign({ sub: "user-77" }, SECRET);

    await request(app).post("/api/devhub/studio/adopt-guest")
      .set("x-devhub-guest", "guest-mine-0001")
      .set("Authorization", `Bearer ${token}`);

    const список = await request(app).get("/api/devhub/projects")
      .set("Authorization", `Bearer ${token}`);
    expect(список.body.projects?.length, "переехало чужое").toBe(1);
    expect(список.body.projects?.[0]?.name).toBe("моё");
  });

  test("не вошёл — отказ ОБЪЯСНЯЕТ, что делать", async () => {
    const r = await request(приложение()).post("/api/devhub/studio/adopt-guest")
      .set("x-devhub-guest", "guest-abc-0001");
    expect(r.status).toBe(400);
    expect(String(r.body.message), "отказ не говорит человеку, что делать").toMatch(/Войдите/i);
  });

  test("ОБЩИЙ ящик не присваивается входом", async () => {
    // Худший способ сделать хуже переносом: человек из приватного браузера
    // попадает в общий ящик "anonymous" (личность негде хранить — заголовок не
    // шлётся), входит, и ВСЯ чужая работа из общего ящика переезжает к нему.
    // На проде в этом ящике 17 проектов с июля, так что это не гипотеза.
    //
    // Поэтому "anonymous" для переноса не личность, а признак того, что
    // личности нет.
    const app = приложение();
    await request(app).post("/api/devhub/projects").send({ name: "чужое из общего ящика" });
    const token = jwt.sign({ sub: "user-77" }, SECRET);

    const перенос = await request(app).post("/api/devhub/studio/adopt-guest")
      .set("Authorization", `Bearer ${token}`);
    expect(перенос.status, "перенос принял общий ящик за личность").toBe(400);
    expect(перенос.body.error).toBe("no_guest_id");

    const список = await request(app).get("/api/devhub/projects")
      .set("Authorization", `Bearer ${token}`);
    expect(список.body.projects?.length, "чужая работа из общего ящика переехала").toBe(0);
  });

  test("поток попыток упирается в предел", async () => {
    // Единственный осмысленный способ навредить этой ручкой — перебирать чужие
    // гостевые идентификаторы. Без предела перебор ничем не ограничен, а
    // «ограничитель есть» и «поверхность защищена» — разные утверждения:
    // проверяем не наличие вызова, а СПОСОБНОСТЬ отказать.
    //
    // Идёт последним в файле намеренно: предел считается на весь модуль, и
    // израсходованный бюджет ломал бы соседние случаи.
    const app = приложение();
    const token = jwt.sign({ sub: "user-77" }, SECRET);
    const коды: number[] = [];
    for (let i = 0; i < 18; i++) {
      const r = await request(app).post("/api/devhub/studio/adopt-guest")
        .set("x-devhub-guest", `guest-perebor-${i}`)
        .set("Authorization", `Bearer ${token}`);
      коды.push(r.status);
    }
    // Контроль в другую сторону: ограничитель, отказывающий сразу, тоже
    // сломан — он не даст перенести работу ни одному живому человеку.
    expect(коды[0], "предел отказал на ПЕРВОЙ попытке — так перенос не сработает ни у кого")
      .not.toBe(429);
    expect(коды, `предел не сработал за 18 попыток подряд: ${коды.join(",")}`).toContain(429);
  });
});
