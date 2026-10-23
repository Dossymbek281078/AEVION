/**
 * Доска deepsan и дневник настроения qgood — у каждого посетителя свои.
 *
 * До 23.10.2026: в deepsan_tasks/deepsan_sessions владельца не было вовсе
 * (одна доска на всех; PATCH/DELETE /tasks/:id пускали к чужой задаче), а
 * qgood читал всех разлогиненных как user_id "anonymous" — настроение и
 * «что происходит» одного гостя видел следующий. Замер прода 23.10: GET
 * /api/deepsan/stats без заголовков отдавал общие 450 минут фокуса.
 *
 * Личность гостя — заголовок x-devhub-guest (его ставит сайт), вошедшего —
 * JWT. Без личности читать нечего, а писать в deepsan нельзя.
 *
 * База замокана отказом: ручки работают на запасном хранилище в памяти, и
 * сторож проверяет именно разделение, а не SQL (SQL проверяет греп ниже).
 */
import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn().mockRejectedValue(new Error("no db in test")) }) }));

import { deepSanRouter } from "../src/routes/deepsan";
import { qgoodRouter } from "../src/routes/qgood";
import { qlifeRouter } from "../src/routes/qlife";

const app = express();
app.use(express.json());
app.use("/api/deepsan", deepSanRouter);
app.use("/api/qgood", qgoodRouter);
app.use("/api/qlife", qlifeRouter);

const A = { "x-devhub-guest": "guestAAAA1111" };
const B = { "x-devhub-guest": "guestBBBB2222" };

describe("deepsan: доска гостя видна только ему", () => {
  test("задача A не видна B, B не может её править и удалять", async () => {
    const made = await request(app).post("/api/deepsan/tasks").set(A).send({ title: "план A" });
    expect(made.status).toBe(201);
    const id = made.body.data.id;

    const listA = await request(app).get("/api/deepsan/tasks").set(A);
    const listB = await request(app).get("/api/deepsan/tasks").set(B);
    expect(listA.body.data.map((t: { id: number }) => t.id)).toContain(id);
    expect(listB.body.data, "B видит задачи A").toEqual([]);

    expect((await request(app).patch(`/api/deepsan/tasks/${id}`).set(B).send({ done: true })).status).toBe(404);
    expect((await request(app).delete(`/api/deepsan/tasks/${id}`).set(B)).status).toBe(404);
    // задача A цела и не тронута
    const again = await request(app).get("/api/deepsan/tasks").set(A);
    expect(again.body.data.find((t: { id: number }) => t.id === id)?.done).toBe(false);

    const stB = await request(app).get("/api/deepsan/stats").set(B);
    expect(stB.body.data.totalTasks).toBe(0);
    const stA = await request(app).get("/api/deepsan/stats").set(A);
    expect(stA.body.data.totalTasks, "знаменатель: у A задача считается").toBe(1);
  });

  test("фокус-сессия A не активна у B", async () => {
    const s = await request(app).post("/api/deepsan/focus").set(A).send({ durationMin: 25 });
    expect(s.status).toBe(201);
    expect((await request(app).get("/api/deepsan/focus/active").set(B)).body.data).toBeNull();
    expect((await request(app).get("/api/deepsan/focus/active").set(A)).body.data?.id).toBe(s.body.data.id);
    expect((await request(app).patch(`/api/deepsan/focus/${s.body.data.id}/done`).set(B).send({})).status).toBe(404);
  });

  test("без личности: читать нечего, писать нельзя", async () => {
    expect((await request(app).post("/api/deepsan/tasks").send({ title: "x" })).status).toBe(400);
    expect((await request(app).get("/api/deepsan/tasks")).body.data).toEqual([]);
  });

  test("в базе каждый запрос к таблицам несёт owner_id", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../src/routes/deepsan.ts"), "utf8");
    const sql = src.match(/`[^`]*\b(?:FROM|INTO|UPDATE)\s+deepsan_(?:tasks|sessions)\b[^`]*`/g) || [];
    expect(sql.length, "знаменатель: запросов к таблицам").toBeGreaterThanOrEqual(9);
    // Список задач собирает WHERE из условий, и первое из них — владелец.
    const where = src.includes('const conditions: string[] = ["owner_id = $1"];');
    const без = sql.filter((q) => !/owner_id/.test(q) && !(where && q.includes("${where}")));
    expect(без.map((q) => q.slice(0, 80))).toEqual([]);
  });
});

describe("qgood: дневник настроения гостя виден только ему", () => {
  test("запись A не видна B и не видна запросу без личности", async () => {
    const w = await request(app).post("/api/qgood/mood").set(A).send({ score: 3, emotion: "тревога", context: "личное A" });
    expect(w.status).toBeLessThan(300);
    const a = await request(app).get("/api/qgood/mood").set(A);
    const b = await request(app).get("/api/qgood/mood").set(B);
    const none = await request(app).get("/api/qgood/mood");
    expect(a.body.moods.length, "знаменатель: A видит свою запись").toBe(1);
    expect(b.body.moods, "B видит дневник A").toEqual([]);
    expect(none.body.moods).toEqual([]);
  });

  test("общая корзина anonymous не читается, даже если в неё писали", async () => {
    await request(app).post("/api/qgood/mood").send({ score: 5, context: "без личности" });
    const none = await request(app).get("/api/qgood/mood");
    expect(none.body.moods).toEqual([]);
    const tr = await request(app).get("/api/qgood/mood/trends");
    expect(tr.body.total_entries).toBe(0);
  });
});

describe("qlife: биомаркеры и тренды гостя видны только ему", () => {
  // 24.10.2026, прод: гость видел чужую запись weight 70 кг от 19.06, а
  // /biomarkers/trends сводил показатели ВСЕХ пользователей.
  test("запись A не видна B, без личности — пусто, писать без личности нельзя", async () => {
    const w = await request(app).post("/api/qlife/biomarkers").set(A).send({ type: "weight_kg", value: 81, unit: "kg", notes: "личное A" });
    expect(w.status).toBeLessThan(300);
    const a = await request(app).get("/api/qlife/biomarkers").set(A);
    const b = await request(app).get("/api/qlife/biomarkers").set(B);
    const none = await request(app).get("/api/qlife/biomarkers");
    expect(a.body.biomarkers.length, "знаменатель: A видит своё").toBe(1);
    expect(b.body.biomarkers).toEqual([]);
    expect(none.body.biomarkers).toEqual([]);
    expect((await request(app).post("/api/qlife/biomarkers").send({ type: "weight_kg", value: 1, unit: "kg" })).status).toBe(400);
  });
  test("тренды — только свои", async () => {
    const ta = await request(app).get("/api/qlife/biomarkers/trends").set(A);
    const tb = await request(app).get("/api/qlife/biomarkers/trends").set(B);
    expect(Object.keys(ta.body.trends), "знаменатель: у A тренд веса").toContain("weight_kg");
    expect(tb.body.trends).toEqual({});
  });
});
