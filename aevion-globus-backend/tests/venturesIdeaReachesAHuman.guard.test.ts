import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож: предложенная в /ventures идея доходит до человека и может выйти на маркет.
 *
 * 🔴 Замер 20.10.2026: форма обещала «попадёт на маркет после проверки», а письма
 * команде не было и одобрить было нечем — идея ложилась в таблицу, которую никто
 * не читает, автору сказать о решении было некуда.
 */
vi.mock("../src/lib/dbPool", () => ({ getPool: () => { throw new Error("no db in test"); } }));
vi.mock("../src/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("../src/lib/rateLimit")>()),
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
const письма: Array<Record<string, string>> = [];
let письмоУдаётся = true;
vi.mock("../src/lib/constitutionBrevo", () => ({
  sendVenturesIdeaNotice: async (i: Record<string, string>) => { письма.push(i); return письмоУдаётся; },
}));
let админ = false;
vi.mock("../src/lib/adminAuth", () => ({ isAdminRequest: () => админ }));

const { venturesRouter } = await import("../src/routes/ventures");
const app = express();
app.use(express.json());
app.use("/api/ventures", venturesRouter);

beforeEach(() => { письма.length = 0; письмоУдаётся = true; админ = false; });

const идея = { name: "Пекарня-подписка", pitch: "Хлеб по подписке для офисов Алматы", model: "DTC", ceiling: "$10M" };

describe("ventures: идея доходит до человека", () => {
  it("каждая идея — письмо команде с почтой автора; ответ говорит, ушло ли", async () => {
    const r = await request(app).post("/api/ventures/submit").send({ ...идея, email: "Aliya@Mail.kz" });
    expect(r.status).toBe(201);
    expect(r.body.notified).toBe(true);
    expect(письма).toHaveLength(1);
    expect(письма[0]).toMatchObject({ name: идея.name, contact: "aliya@mail.kz", id: r.body.id });
  });
  it("без почты идея всё равно принимается и уходит команде", async () => {
    const r = await request(app).post("/api/ventures/submit").send(идея);
    expect(r.status).toBe(201);
    expect(письма[0].contact).toBe("");
  });
  it("кривая почта — 400 с человеческим текстом, письма нет", async () => {
    const r = await request(app).post("/api/ventures/submit").send({ ...идея, email: "aliya@" });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/почты/);
    expect(письма).toHaveLength(0);
  });
  it("письмо не ушло — это видно в ответе (notified:false), а не молчит", async () => {
    письмоУдаётся = false;
    const r = await request(app).post("/api/ventures/submit").send(идея);
    expect(r.status).toBe(201);
    expect(r.body.notified).toBe(false);
  });
  it("одобрить может только админ; одобренная идея видна на маркете", async () => {
    const r = await request(app).post("/api/ventures/submit").send({ ...идея, name: "Идея для одобрения" });
    const чужой = await request(app).post(`/api/ventures/submissions/${r.body.id}/review`).send({ status: "approved" });
    expect(чужой.status).toBe(403);
    expect((await request(app).get("/api/ventures/submissions")).body.submissions.some((s: { id: string }) => s.id === r.body.id)).toBe(false);
    админ = true;
    expect((await request(app).post(`/api/ventures/submissions/${r.body.id}/review`).send({ status: "maybe" })).status).toBe(400);
    expect((await request(app).post(`/api/ventures/submissions/нет-такой/review`).send({ status: "approved" })).status).toBe(404);
    const ок = await request(app).post(`/api/ventures/submissions/${r.body.id}/review`).send({ status: "approved" });
    expect(ок.body).toMatchObject({ ok: true, status: "approved" });
    expect((await request(app).get("/api/ventures/submissions")).body.submissions.some((s: { id: string }) => s.id === r.body.id)).toBe(true);
  });
});
