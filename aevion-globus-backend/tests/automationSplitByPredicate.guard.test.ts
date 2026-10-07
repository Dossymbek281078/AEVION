import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * Отсев автоматики считается ДВУМЯ числами, и каждое проверяется отдельно.
 *
 * Повод: после починки приёма признака `webdriver` первый вопрос был «сколько
 * отсеялось по нему» — а оба способа складывались в одно `ботов`, и проверить
 * починку было нечем. Число, которым нельзя проверить починку, бесполезно
 * именно в тот день, когда оно нужно.
 *
 * ⚠️ Импорты модуля — только `await import` внутри теста: путь к журналу
 * читается ПРИ ИМПОРТЕ, и статическая строка заставила бы ручку читать
 * настоящий журнал (так один сторож уже был зелёным на 122 чужих событиях).
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-split-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const ЧЕЛОВЕК = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const РОБОТ = "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120 Safari/537.36";

beforeEach(() => {
  writeFileSync(
    файл,
    [
      // человек
      { type: "page_view", ts: new Date().toISOString(), sid: "ч", path: "/", ua: ЧЕЛОВЕК },
      // робот по СТРОКЕ браузера
      { type: "page_view", ts: new Date().toISOString(), sid: "р1", path: "/", ua: РОБОТ },
      // управляемый браузер: строка человеческая, признак выдаёт программу
      { type: "page_view", ts: new Date().toISOString(), sid: "р2", path: "/", ua: ЧЕЛОВЕК, webdriver: true },
      { type: "page_view", ts: new Date().toISOString(), sid: "р3", path: "/", ua: ЧЕЛОВЕК, webdriver: true },
    ]
      .map((о) => JSON.stringify(о))
      .join("\n") + "\n",
  );
});

afterAll(() => {
  rmSync(каталог, { recursive: true, force: true });
});

async function приложение() {
  const { eventsRouter } = await import("../src/routes/events");
  const app = express();
  app.use("/api/pricing/events", eventsRouter);
  return app;
}

describe("две приметы автоматики названы по отдельности", () => {
  it("🔴 воронка отдаёт оба числа, и они складываются в общее", async () => {
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.status).toBe(200);
    expect(r.body.botsExcludedByWebdriver, "управляемые браузеры не посчитаны").toBe(2);
    expect(r.body.botsExcludedByUserAgent, "робот по строке браузера не посчитан").toBe(1);
    expect(r.body.botsExcluded).toBe(3);
    // Контроль обратной стороны: человек НЕ попал в отсев и дошёл до разреза.
    expect(r.body.total.visits).toBe(1);
  });

  it("🔴 сводка дня отдаёт те же два числа", async () => {
    const день = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const r = await request(await приложение()).get(`/api/pricing/events/day?date=${день}`);
    expect(r.status).toBe(200);
    expect(r.body.отсеяноПоВебдрайверу).toBe(2);
    expect(r.body.отсеяноПоСтрокеБраузера).toBe(1);
    expect(r.body.отсеяноАвтоматики).toBe(3);
  });

  it("признак важнее строки: управляемый браузер с человеческой строкой отсеян", async () => {
    // Именно этот случай пропускала прежняя проверка: у съёмки Playwright в
    // строке обычный Chrome, и три наших захода легли в живые числа.
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.botsExcludedByWebdriver).toBeGreaterThan(0);
    expect(r.body.botsExcludedNote).toMatch(/06\.10\.2026/);
  });
});
