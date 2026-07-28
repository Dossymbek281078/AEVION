import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Персону может править только тот, у кого есть секрет правки.
 *
 * До 28.07 `PATCH /personas/:alias` правил персону по псевдониму ИЗ АДРЕСА без
 * всякой сверки: кто открыл чужую персону, тот её и переписывал. Секрета у
 * персоны не было вовсе — ни одного упоминания в модуле.
 *
 * Псевдоним здесь не может служить ключом, в отличие от `lifebox`: там он
 * общий секрет и наружу не отдаётся, а тут он ПУБЛИЧНЫЙ АДРЕС страницы.
 *
 * Переход сделан неломающим: у персон, созданных ДО правки, секрета нет, и
 * требовать его значило бы отобрать доступ у настоящих владельцев. Такие записи
 * сохраняют прежнее поведение (и пишут предупреждение в лог), все новые —
 * защищены. Что делать со старыми, решает основатель.
 */

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/ensureQPersonaTables", () => ({
  ensureQPersonaTables: async () => {},
  isQPersonaDbReady: () => false, // работаем в памяти: секрет проверяется тем же кодом
  getQPersonaDbError: () => null,
}));

// eslint-disable-next-line import/first
import { qpersonaRouter } from "../src/routes/qpersona";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qpersona", qpersonaRouter);
  return app;
}

let app: express.Express;
let alias: string;
let secret: string;

beforeEach(async () => {
  mockQuery.mockReset();
  app = makeApp();
  alias = "persona-" + Math.floor(Math.random() * 1e6).toString(36);
  const res = await request(app)
    .post("/api/qpersona/personas")
    .send({ alias, displayName: "Владелец" });
  expect(res.status, "не удалось создать персону").toBe(201);
  secret = res.body.editSecret;
});

describe("QPersona: секрет правки", () => {
  it("создание возвращает секрет РОВНО один раз", () => {
    expect(secret, "секрет не выдан при создании").toBeTruthy();
    expect(String(secret).length).toBeGreaterThan(16);
  });

  it("владелец с секретом правит персону", async () => {
    const res = await request(app)
      .patch(`/api/qpersona/personas/${alias}`)
      .set("x-edit-secret", secret)
      .send({ bio: "своя биография" });
    expect(res.status).toBe(200);
    expect(res.body.persona.bio).toBe("своя биография");
  });

  it("посторонний БЕЗ секрета получает отказ", async () => {
    // Ровно тот сценарий, который работал до правки.
    const res = await request(app)
      .patch(`/api/qpersona/personas/${alias}`)
      .send({ bio: "переписано посторонним" });
    expect(res.status, "правка без секрета прошла").toBe(403);
  });

  it("посторонний с НЕВЕРНЫМ секретом получает отказ", async () => {
    const res = await request(app)
      .patch(`/api/qpersona/personas/${alias}`)
      .set("x-edit-secret", "wrong-secret-entirely")  // латиница: кириллица в заголовке HTTP недопустима
      .send({ bio: "переписано" });
    expect(res.status).toBe(403);
  });

  it("секрет той же ДЛИНЫ, но другой — тоже отказ", async () => {
    // Сравнение идёт побайтово с защитой от утечки по времени; проверяем, что
    // совпадение длины само по себе ничего не даёт.
    const wrong = "x".repeat(String(secret).length);
    const res = await request(app)
      .patch(`/api/qpersona/personas/${alias}`)
      .set("x-edit-secret", wrong)
      .send({ bio: "переписано" });
    expect(res.status).toBe(403);
  });

  it("секрет НЕ уходит в чтение — ни списком, ни карточкой", async () => {
    const one = await request(app).get(`/api/qpersona/personas/${alias}`);
    expect(JSON.stringify(one.body), "секрет утёк в карточке").not.toContain(secret);
    expect(one.body.persona).not.toHaveProperty("edit_secret");

    const list = await request(app).get("/api/qpersona/personas?limit=50");
    expect(JSON.stringify(list.body), "секрет утёк в списке").not.toContain(secret);
    for (const p of (list.body.personas ?? []) as Array<Record<string, unknown>>) {
      expect(p).not.toHaveProperty("edit_secret");
    }
  });

  it("ответ на саму правку тоже без секрета", async () => {
    const res = await request(app)
      .patch(`/api/qpersona/personas/${alias}`)
      .set("x-edit-secret", secret)
      .send({ bio: "ещё раз" });
    expect(JSON.stringify(res.body)).not.toContain(secret);
    expect(res.body.persona).not.toHaveProperty("edit_secret");
  });
});
