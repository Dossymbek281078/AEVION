import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/*
 * 🔴 29.10.2026 (окно «Приложения», решение Оркестратора): полоса «Live» на /build показывала бы события
 * проектов-образцов (выдуманных) как живой спрос — на любом языке. GET /api/build/stats/activity
 * обязан исключать образцы во всех трёх запросах (вакансии, отклики, наймы).
 * Мок базы исполняет только одно условие SQL — `NOT IN (…id образцов…)`: если запрос его не несёт,
 * строка образца проходит в выдачу. Так мутация «убрать фильтр из любого запроса» краснеет.
 */
const query = vi.fn();
vi.mock("../src/lib/build", async (orig) => ({
  ...(await orig<typeof import("../src/lib/build")>()),
  buildPool: { query: (...a: unknown[]) => query(...a) },
}));

// eslint-disable-next-line import/first
import { statsRouter } from "../src/routes/build/stats";
// eslint-disable-next-line import/first
import { ПРОЕКТЫ_ОБРАЗЦЫ } from "../src/data/buildExampleProjects";

const ОБРАЗЕЦ = ПРОЕКТЫ_ОБРАЗЦЫ[0]!;
const ЖИВОЙ = "62ba6b97-cc8e-4bf1-9603-e7722ab21f44";
const AT = "2026-10-29T10:00:00.000Z";
const строка = (projectId: string, title: string) => ({ projectId, title, projectCity: "Алматы", createdAt: AT, at: AT });
const app = () => { const a = express(); a.use("/api/build/stats", statsRouter); return a; };

beforeEach(() => {
  query.mockReset();
  query.mockImplementation(async (sql: string) => {
    const s = String(sql);
    const вид = /'ACCEPTED'/.test(s) ? "hire" : /FROM "BuildApplication"/.test(s) ? "app" : "vac";
    const строки = [строка(ОБРАЗЕЦ, `образец-${вид}`), строка(ЖИВОЙ, `живой-${вид}`)];
    const отсев = s.includes(`NOT IN (`) && s.includes(`'${ОБРАЗЕЦ}'`);
    const rows = отсев ? строки.filter((r) => r.projectId !== ОБРАЗЕЦ) : строки;
    return { rows, rowCount: rows.length };
  });
});

describe("QBuild Live: события проектов-образцов не показываются", () => {
  test("знаменатель: 3 запроса × (1 образец + 1 живой) → в выдаче 0 образцов и 3 живых события", async () => {
    const r = await request(app()).get("/api/build/stats/activity");
    expect(r.status).toBe(200);
    const items: { kind: string; title: string }[] = r.body?.data?.items ?? r.body?.items;
    expect(query).toHaveBeenCalledTimes(3);
    const образцы = items.filter((e) => e.title.startsWith("образец"));
    const живые = items.filter((e) => e.title.startsWith("живой"));
    process.stderr.write(`знаменатель: запросов ${query.mock.calls.length}, событий ${items.length}, образцов ${образцы.length}, живых ${живые.length}\n`);
    expect(образцы).toEqual([]);
    expect(живые.map((e) => e.kind).sort()).toEqual(["APPLICATION", "HIRE", "VACANCY"]);
  });

  test("каждый из 3 запросов несёт фильтр образцов по проекту", async () => {
    await request(app()).get("/api/build/stats/activity");
    for (const [sql] of query.mock.calls) expect(String(sql)).toMatch(/p\."id"::text NOT IN \(/);
  });
});
