/**
 * Сессии QCoreAI гостя — только его.
 *
 * До 24.10.2026 все разлогиненные были владельцем null, а хранилище отдавало
 * null-сессию ЛЮБОМУ. Замер прода: GET /api/qcoreai/sessions без входа — 50
 * чужих гостевых сессий (заголовок = начало вопроса, aiSummary); GET
 * /sessions/:id — переписка целиком (userInput, finalContent).
 *
 * Теперь гость — guest:<id> из заголовка сайта; null-сессии (все старые
 * гостевые) не отдаются никому. База замокана отказом — хранилище в памяти.
 */
import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn().mockRejectedValue(new Error("no db in test")) }) }));

import { ensureSession, getSession, listSessions } from "../src/services/qcoreai/store";
import { qcoreaiRouter } from "../src/routes/qcoreai";

const app = express();
app.use(express.json());
app.use("/api/qcoreai", qcoreaiRouter);

describe("хранилище: сессия гостя видна только ему", () => {
  test("A видит свою, B и «без владельца» — нет", async () => {
    const s = await ensureSession({ userId: "guest:AAAA1111", seedTitle: "личный вопрос A" });
    expect((await getSession(s.id, "guest:AAAA1111"))?.id, "знаменатель: A открывает своё").toBe(s.id);
    expect(await getSession(s.id, "guest:BBBB2222")).toBeNull();
    expect(await getSession(s.id, null)).toBeNull();
    expect((await listSessions("guest:AAAA1111")).map((x) => x.id)).toContain(s.id);
    expect(await listSessions("guest:BBBB2222")).toEqual([]);
  });

  test("сессия без владельца (старые гостевые) не отдаётся никому", async () => {
    const legacy = await ensureSession({ userId: null, seedTitle: "старая общая" });
    expect(await getSession(legacy.id, null)).toBeNull();
    expect(await getSession(legacy.id, "user-123")).toBeNull();
    expect(await listSessions(null)).toEqual([]);
  });
});

describe("ручки: гость по заголовку, без заголовка — пусто", () => {
  test("GET /sessions: A видит своё, B и запрос без личности — нет", async () => {
    const s = await ensureSession({ userId: "guest:AAAA1111", seedTitle: "ещё вопрос A" });
    const a = await request(app).get("/api/qcoreai/sessions").set({ "x-devhub-guest": "AAAA1111" });
    const b = await request(app).get("/api/qcoreai/sessions").set({ "x-devhub-guest": "BBBB2222" });
    const none = await request(app).get("/api/qcoreai/sessions");
    expect(a.body.items.map((x: { id: string }) => x.id), "знаменатель").toContain(s.id);
    expect(b.body.items).toEqual([]);
    expect(none.body.items).toEqual([]);
    expect((await request(app).get(`/api/qcoreai/sessions/${s.id}`).set({ "x-devhub-guest": "BBBB2222" })).status).toBe(404);
    expect((await request(app).get(`/api/qcoreai/sessions/${s.id}`)).status).toBe(404);
  });
});
