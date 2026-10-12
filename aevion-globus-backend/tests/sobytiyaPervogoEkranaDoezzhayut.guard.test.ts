import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";
import { деньАлматыНазад } from "./helpers/суткиАлматы";

/*
 * 🔴 СОБЫТИЯ ПЕРВОГО ЭКРАНА /devhub ДОЕЗЖАЮТ ДО РАЗРЕЗОВ.
 *
 * Фронт (волна 94, 12.10.2026) шлёт feature_use с source "devhub":
 * textarea_focus, example_chip_click, scroll_25/50/100, time_5s/15s/60s.
 * Сервер их не знает по имени — и не должен: byFeature и byLastStep считают
 * любой шаг. Этот сторож доказывает настоящим GET, что они (а) видны в
 * byFeature под ключом devhub|<шаг> и (б) последний из них становится местом
 * остановки в byLastStep. Знаменатель назван: четыре семейства.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-firstscreen-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const сегодня = () => `${деньАлматыНазад(0)}T07:00:00.000Z`;
function журнал(с: Array<Record<string, unknown>>) {
  writeFileSync(файл, с.map((о) => JSON.stringify({ ua: UA, ts: сегодня(), ...о })).join("\n") + "\n");
}
const вход = (sid: string) => ({ type: "page_view", sid, path: "/devhub" });
const шаг = (sid: string, feature: string) => ({ type: "feature_use", sid, source: "devhub", path: "/devhub", meta: { feature } });

beforeAll(async () => { await import("../src/routes/events"); }, 120_000);
beforeEach(() => журнал([]));
afterAll(() => rmSync(каталог, { recursive: true, force: true }));

async function воронка() {
  const { eventsRouter } = await import("../src/routes/events");
  const app = express();
  app.use("/api/pricing/events", eventsRouter);
  const r = await request(app).get("/api/pricing/events/funnel?days=7");
  expect(r.status).toBe(200);
  return r.body as { byFeature: Record<string, { сессий: number }>; byLastStep: Record<string, { сессий: number }> };
}

const СЕМЕЙСТВА = ["textarea_focus", "example_chip_click", "scroll_25", "time_5s"] as const;

describe("события первого экрана", () => {
  it("🔴 все четыре семейства видны в byFeature под devhub| — знаменатель 4 из 4", async () => {
    журнал([вход("a"), ...СЕМЕЙСТВА.map((f) => шаг("a", f))]);
    const { byFeature } = await воронка();
    for (const f of СЕМЕЙСТВА) expect(byFeature["devhub|" + f]?.сессий, "нет в byFeature: " + f).toBe(1);
    expect(СЕМЕЙСТВА.length).toBe(4);
  });

  it("🔴 ушедший после прокрутки виден в byLastStep как остановившийся на ней", async () => {
    // Раньше такая сессия была «открыл страницу» и ничем не отличалась от
    // ушедшего за секунду. Теперь видно: дочитал до половины и ушёл.
    журнал([вход("b"), шаг("b", "scroll_25"), шаг("b", "scroll_50"), шаг("b", "time_15s")]);
    const { byLastStep } = await воронка();
    expect(byLastStep["time_15s"]?.сессий).toBe(1);
    expect(byLastStep["открыл страницу"]).toBeUndefined();
  });

  it("контроль: сессия без событий первого экрана по-прежнему «открыл страницу»", async () => {
    журнал([вход("c")]);
    const { byLastStep } = await воронка();
    expect(byLastStep["открыл страницу"]?.сессий).toBe(1);
  });
});
