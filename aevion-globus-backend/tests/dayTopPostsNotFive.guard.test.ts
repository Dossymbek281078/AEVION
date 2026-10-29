import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";
import { деньАлматыНазад } from "./helpers/суткиАлматы";

/*
 * 🔴 /day ОТДАЁТ ТОП ПОСТОВ ДО 50 И ЧЕСТНО НАЗЫВАЕТ, СКОЛЬКО ОБРЕЗАНО.
 *
 * 29.10.2026 (Продажи через Оркестратора): ручка резала топПостов до пяти
 * строк. Волна писем услуг даёт 26 меток в день — 21 из них выпадала из
 * ответа, и замер читал их как «0 визитов». Ноль, который означает «не
 * показано», неотличим от нуля «никто не пришёл».
 *
 * ⚠️ Импорты модуля — только `await import` внутри теста: путь к журналу
 * читается ПРИ ИМПОРТЕ.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-top50-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const вчера = `${деньАлматыНазад(1)}T07:00:00.000Z`;

function журнал(события: Array<Record<string, unknown>>) {
  writeFileSync(файл, события.map((о) => JSON.stringify({ ua: UA, ...о })).join("\n") + "\n");
}

beforeAll(async () => {
  await import("../src/routes/events");
}, 120_000);
beforeEach(() => журнал([]));
afterAll(() => rmSync(каталог, { recursive: true, force: true }));

async function приложение() {
  const { eventsRouter } = await import("../src/routes/events");
  const app = express();
  app.use("/api/pricing/events", eventsRouter);
  return app;
}

/** N постов с разными метками, у каждого один живой визит. */
function постов(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    type: "page_view",
    ts: вчера,
    sid: `s${i}`,
    path: `/?c=mail&post=w29-${i}`,
    // Пост в разрезе — пара meta.channel + meta.post (events.ts: ключПоста).
    meta: { channel: "mail", post: `w29-${String(i).padStart(2, "0")}` },
  }));
}

describe("/day: топ постов не пять", () => {
  it("🔴 26 меток дня видны все 26, обрезано 0", async () => {
    журнал(постов(26));
    const r = await request(await приложение()).get(`/api/pricing/events/day?date=${деньАлматыНазад(1)}`);
    expect(r.status).toBe(200);
    expect(r.body.топПостов, "метки писем выпали из ответа").toHaveLength(26);
    expect(r.body.топПостовВсего).toBe(26);
    expect(r.body.топПостовОбрезано).toBe(0);
  });

  it("🔴 55 меток: отдано 50, обрезано названо числом 5", async () => {
    журнал(постов(55));
    const r = await request(await приложение()).get(`/api/pricing/events/day?date=${деньАлматыНазад(1)}`);
    expect(r.body.топПостов).toHaveLength(50);
    expect(r.body.топПостовВсего).toBe(55);
    expect(r.body.топПостовОбрезано, "обрезка молчит — читается как ноль визитов").toBe(5);
  });
});
