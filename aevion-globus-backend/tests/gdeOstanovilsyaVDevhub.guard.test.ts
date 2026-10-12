import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";
import { деньАлматыНазад } from "./helpers/суткиАлматы";

/*
 * 🔴 ГДЕ ЧЕЛОВЕК ОСТАНОВИЛСЯ ВНУТРИ DevHub.
 *
 * Разрезы отвечают «сколько дошло до шага», но не «где оборвалось»: сессия,
 * дошедшая до генерации и ушедшая, видна и в build_from_idea, и в generation,
 * и ни один из них не говорит, что дальше её не было. Для починки пути это
 * главный вопрос, и до 12.10.2026 ответить на него было нечем.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-laststep-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const сегодня = () => `${деньАлматыНазад(0)}T07:00:00.000Z`;
function журнал(события: Array<Record<string, unknown>>) {
  writeFileSync(файл, события.map((о) => JSON.stringify({ ua: UA, ts: сегодня(), ...о })).join("\n") + "\n");
}
const вход = (sid: string, path = "/devhub") => ({ type: "page_view", sid, path });
const шаг = (sid: string, feature: string) => ({ type: "feature_use", sid, source: "devhub", path: "/devhub", meta: { feature } });

beforeAll(async () => { await import("../src/routes/events"); }, 120_000);
beforeEach(() => журнал([]));
afterAll(() => rmSync(каталог, { recursive: true, force: true }));

async function разрез() {
  const { eventsRouter } = await import("../src/routes/events");
  const app = express();
  app.use("/api/pricing/events", eventsRouter);
  const r = await request(app).get("/api/pricing/events/funnel?days=7");
  expect(r.status).toBe(200);
  expect(r.body.byLastStep, "разрез отсутствует в ТЕЛЕ ответа").toBeTruthy();
  return r.body.byLastStep as Record<string, { сессий: number; сессийНаших: number }>;
}

describe("последний шаг внутри DevHub", () => {
  it("🔴 каждая сессия считается ОДИН раз — по месту, где остановилась", async () => {
    журнал([
      // дошёл до генерации и ушёл
      вход("a"), шаг("a", "build_from_idea"), шаг("a", "generation"),
      // открыл и ушёл, не нажав ничего
      вход("b"),
      // дошёл до выкатки — самый дальний
      вход("c"), шаг("c", "build_from_idea"), шаг("c", "generation"), шаг("c", "deploy_pages"),
    ]);
    const f = await разрез();
    expect(f["generation"]?.сессий).toBe(1);
    expect(f["открыл страницу"]?.сессий).toBe(1);
    expect(f["deploy_pages"]?.сессий).toBe(1);
    // Главное свойство: сессия «a» НЕ попала в build_from_idea — она там была,
    // но остановилась дальше. Иначе это обычный разрез, а не место обрыва.
    expect(f["build_from_idea"], "сессия сосчитана не по МЕСТУ ОСТАНОВКИ").toBeUndefined();
    expect(Object.keys(f).length, "знаменатель: мест остановки").toBe(3);
  });

  it("🔴 возврат на страницу не откатывает достигнутый шаг", async () => {
    // Человек сгенерировал и вернулся на /devhub посмотреть список. Считать
    // это «открыл страницу» значило бы занижать глубину пути.
    журнал([вход("a"), шаг("a", "generation"), вход("a")]);
    const f = await разрез();
    expect(f["generation"]?.сессий).toBe(1);
    expect(f["открыл страницу"]).toBeUndefined();
  });

  it("наши пробы отделены", async () => {
    журнал([
      вход("чел"), шаг("чел", "generation"),
      { type: "page_view", sid: "наш", path: "/devhub?c=probe-user-99", ts: сегодня(), ua: UA },
      шаг("наш", "generation"),
    ]);
    const f = await разрез();
    expect(f["generation"].сессий).toBe(2);
    expect(f["generation"].сессийНаших).toBe(1);
  });

  it("контроль: сессии БЕЗ событий DevHub сюда не попадают", async () => {
    журнал([
      { type: "page_view", sid: "ш", path: "/cyberchess", ts: сегодня(), ua: UA },
      { type: "feature_use", sid: "ш", source: "cyberchess", path: "/cyberchess", ts: сегодня(), ua: UA, meta: { feature: "chess_game_start" } },
    ]);
    const f = await разрез();
    expect(Object.keys(f).length, "в разрез DevHub попали чужие сессии").toBe(0);
  });

  it("пояснение едет вместе с данными", async () => {
    журнал([вход("a")]);
    const { eventsRouter } = await import("../src/routes/events");
    const app = express();
    app.use("/api/pricing/events", eventsRouter);
    const r = await request(app).get("/api/pricing/events/funnel?days=7");
    expect(String(r.body.byLastStepNote), "разрез без объяснения прочтут неверно").toContain("остановился");
  });
});
