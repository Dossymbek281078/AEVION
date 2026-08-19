import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Отказ хранилища не имеет права выглядеть как «такой записи нет».
 *
 * Замер 20.08.2026 (роутеры подняты с падающей базой, замер до правки):
 *
 *   GET /signals/12345   -> 404 {"error":"not_found"}
 *   GET /tracks/12345    -> 404 {"error":"not_found"}
 *   GET /articles/12345  -> 404 {"error":"not_found"}
 *
 * Устройство одинаковое: запрос в базу внутри try, `catch` пишет в лог, и
 * управление уходит НИЖЕ — в запасное хранилище в памяти. В проде оно пустое,
 * поэтому наружу шёл 404.
 *
 * 404 — законный ответ, он никого не тревожит: ни Sentry, ни дежурного, ни
 * пользователя, который просто решит, что ссылка устарела. Отказ хранилища
 * при этом мог длиться часами, и единственный след — строка в логе.
 *
 * Это тот же класс, что уже описан в failureIsNotAnEmptyResult.test.ts
 * (успех за несделанную работу), но опаснее: там пустой список, а здесь
 * УТВЕРЖДЕНИЕ о конкретной записи, которое читается как факт.
 *
 * Граница важна и в другую сторону: когда база не настроена вовсе
 * (isXDbReady() === false), память И ЕСТЬ хранилище, и 404 там честен. Поэтому
 * 503 отдаётся только из catch — то есть когда база объявлена готовой и всё
 * равно упала.
 */

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async () => {
      throw new Error("storage unreachable");
    },
  }),
}));

// Признак готовности базы обязателен, и это не украшение теста.
//
// Первый замер я снял, подменив только пул, и получил те же 404 — но пришли они
// из ПАМЯТИ: в тесте `dbReady` остаётся null, ветка с базой не выполняется
// вовсе, и запрос до падающего пула не доходит. То есть измерялся не тот путь,
// а ответ выглядел подтверждением. В проде признак ставит запуск приложения,
// поэтому здесь он ставится руками.
vi.mock("../src/lib/ensureMapRealityTables", () => ({
  ensureMapRealityTables: async () => {},
  isMapRealityDbReady: () => true,
}));
vi.mock("../src/lib/ensureVoiceOfEarthTables", () => ({
  ensureVoiceOfEarthTables: async () => {},
  isVoiceOfEarthDbReady: () => true,
}));
vi.mock("../src/lib/ensureQNewsTables", () => ({
  ensureQNewsTables: async () => {},
  isQNewsDbReady: () => true,
}));

import { mapRealityRouter } from "../src/routes/mapReality";
import { voiceOfEarthRouter } from "../src/routes/voiceOfEarth";
import { qnewsRouter } from "../src/routes/qnews";

const CASES: Array<[string, express.Router, string]> = [
  ["MapReality", mapRealityRouter, "/signals/12345"],
  ["VoiceOfEarth", voiceOfEarthRouter, "/tracks/12345"],
  ["QNews", qnewsRouter, "/articles/qnews-12345"],
];

function mount(router: express.Router) {
  const app = express();
  app.use("/x", router);
  return app;
}

describe("упавшее хранилище не отвечает «не найдено»", () => {
  test.each(CASES)("%s не выдаёт 404 за отказ базы", async (_name, router, path) => {
    const res = await request(mount(router)).get(`/x${path}`);
    expect(
      res.status,
      `404 читается как «записи нет»; отказ хранилища обязан быть различим`,
    ).not.toBe(404);
    expect(res.status).toBe(503);
    expect(res.body?.error).toBe("storage_unavailable");
    // Человеку нужен не код, а фраза: «нет записи» и «не смогли спросить» —
    // разные новости, и вторую нельзя оставлять только в логе.
    expect(String(res.body?.warning ?? ""), "нет объяснения человеку").toMatch(/недоступно/);
  });

  test("контроль: 400 на заведомо неверном id по-прежнему 400", async () => {
    // Иначе тест был бы зелёным и на роутере, который на ВСЁ отвечает 503.
    const res = await request(mount(mapRealityRouter)).get("/x/signals/abc");
    expect(res.status).toBe(400);
  });

  test("контроль: ручка без обращения к базе не задета", async () => {
    const res = await request(mount(mapRealityRouter)).get("/x/health");
    expect(res.status).not.toBe(503);
  });
});
