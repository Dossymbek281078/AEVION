import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * LifeBox: псевдоним больше не ключ сам по себе (lib/lifeboxOwnerKey.ts).
 * Находка 12.10.2026 (окно Приложения-31.12): угадал чужой псевдоним —
 * читаешь заголовки и открытые капсулы, удаляешь их. Сторож идёт через
 * настоящие ручки роутера, хранилище — память процесса (база не настроена).
 */

vi.mock("../src/lib/rateLimit", () => ({
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
delete process.env.DATABASE_URL;

const { lifeboxRouter } = await import("../src/routes/lifebox");
const keys = await import("../src/lib/lifeboxOwnerKey");
const app = express();
app.use(express.json());
app.use(lifeboxRouter);

const завтра = () => new Date(Date.now() + 86_400_000).toISOString();
const капсула = (alias: string, key?: string) => {
  const r = request(app).post("/capsules");
  if (key) r.set("x-lifebox-key", key);
  return r.send({ alias, title: "t", content: "секрет", category: "future_self", unlock_at: завтра() });
};

beforeEach(() => keys.__resetLifeboxKeysForTests());

describe("LifeBox: ключ владельца псевдонима", () => {
  test("первая капсула нового псевдонима выдаёт ключ один раз", async () => {
    const a = `t_${Date.now()}_a`;
    const r1 = await капсула(a);
    expect(r1.status, JSON.stringify(r1.body)).toBe(201);
    expect(typeof r1.body.ownerKey).toBe("string");
    expect(r1.body.ownerKey.length).toBeGreaterThan(20);
    const r2 = await капсула(a, r1.body.ownerKey);
    expect(r2.status).toBe(201);
    expect(r2.body.ownerKey, "ключ показан второй раз").toBeUndefined();
  });

  test("⭐ без ключа чужой не видит список, не пишет, не удаляет", async () => {
    const a = `t_${Date.now()}_b`;
    const r1 = await капсула(a);
    const key = r1.body.ownerKey as string;
    const id = r1.body.capsule.id;

    expect((await request(app).get(`/capsules/${a}`)).status).toBe(403);
    expect((await капсула(a)).status).toBe(403);
    expect((await request(app).delete(`/capsules/${id}?alias=${a}`)).status).toBe(403);
    expect((await request(app).get(`/capsules/${a}`).set("x-lifebox-key", key + "x")).status).toBe(403);

    const свой = await request(app).get(`/capsules/${a}`).set("x-lifebox-key", key);
    expect(свой.status).toBe(200);
    expect(свой.body.count).toBe(1);
    expect((await request(app).delete(`/capsules/${id}?alias=${a}`).set("x-lifebox-key", key)).status).toBe(200);
  });

  test("КОНТРОЛЬ: старый псевдоним без ключа работает как раньше и не захватывается", async () => {
    const a = `t_${Date.now()}_c`;
    // «старый» = капсулы появились до ключей: имитируем, создав капсулу и стерев ключи
    await капсула(a);
    keys.__resetLifeboxKeysForTests();
    expect((await request(app).get(`/capsules/${a}`)).status).toBe(200);
    const r = await капсула(a);
    expect(r.status).toBe(201);
    expect(r.body.ownerKey, "старый псевдоним захвачен первым, кто написал").toBeUndefined();
  });
});
