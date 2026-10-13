import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 /recent?since= отдаёт события не старше момента — иначе разбор читателей
 * писем слеп дальше 1000 последних событий (13.10.2026: визиты ai25/ai38/ai4
 * были раньше хвоста). Граница включительная; limit по-прежнему сверху.
 * ⚠️ Импорт модуля — только `await import` внутри теста: путь к журналу
 * читается ПРИ ИМПОРТЕ.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-since-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;
delete process.env.ADMIN_TOKEN;

const T0 = Date.parse("2026-10-13T06:00:00.000Z");
const стр = (sid: string, смещениеМс: number) => JSON.stringify({ type: "page_view", sid, path: "/proof?c=mail-ai25", ts: new Date(T0 + смещениеМс).toISOString() });

beforeAll(async () => {
  writeFileSync(файл, [стр("старое", -60_000), стр("ровно", 0), стр("после", 1_000), стр("позже", 120_000)].join("\n") + "\n");
  await import("../src/routes/events");
}, 120_000);
afterAll(() => { rmSync(каталог, { recursive: true, force: true }); });

async function приложение() {
  const { eventsRouter } = await import("../src/routes/events");
  const app = express();
  app.use("/api/pricing/events", eventsRouter);
  return app;
}

describe("/recent?since=", () => {
  it("🔴 ISO-момент: событие ровно в since входит, более старое — нет", async () => {
    const r = await request(await приложение()).get("/api/pricing/events/recent?since=2026-10-13T06:00:00.000Z");
    expect(r.status).toBe(200);
    const sids = (r.body.items as Array<{ sid: string }>).map((x) => x.sid);
    expect(sids).toEqual(["позже", "после", "ровно"]);
    expect(r.body.matched).toBe(3);
    expect(r.body.total).toBe(4);
    expect(r.body.since).toBe("2026-10-13T06:00:00.000Z");
  });

  it("эпоха в миллисекундах — та же граница; limit режет сверху", async () => {
    const r = await request(await приложение()).get(`/api/pricing/events/recent?since=${T0}&limit=2`);
    const sids = (r.body.items as Array<{ sid: string }>).map((x) => x.sid);
    expect(sids).toEqual(["позже", "после"]);
    expect(r.body.matched).toBe(3);
  });

  it("без since — прежнее поведение: хвост целиком, since: null", async () => {
    const r = await request(await приложение()).get("/api/pricing/events/recent?limit=10");
    expect((r.body.items as unknown[]).length).toBe(4);
    expect(r.body.since).toBeNull();
  });

  it("мусор в since — не падение и не фильтр", async () => {
    const r = await request(await приложение()).get("/api/pricing/events/recent?since=вчера");
    expect(r.status).toBe(200);
    expect((r.body.items as unknown[]).length).toBe(4);
  });
  it("🔴 since+until — окно: новее until не входит, ровно until входит; limit не мешает", async () => {
    const r = await request(await приложение()).get(`/api/pricing/events/recent?since=${T0 - 60_000}&until=${T0 + 1_000}&limit=2`);
    expect(r.status).toBe(200);
    // новейшие первыми; «позже» (+120 с) отрезано until, «старое» (−60 с) входит по since; limit=2 режет уже внутри окна
    expect(r.body.items.map((e: { sid: string }) => e.sid)).toEqual(["после", "ровно"]);
    expect(r.body.until).toBe("2026-10-13T06:00:01.000Z");
    expect(r.body.matched).toBe(3);
  });

  it("until без since — хвост до момента", async () => {
    const r = await request(await приложение()).get("/api/pricing/events/recent?until=2026-10-13T05:59:59.000Z");
    expect(r.body.items.map((e: { sid: string }) => e.sid)).toEqual(["старое"]);
    expect(r.body.since).toBeNull();
    expect(r.body.matched).toBe(1);
  });
});
