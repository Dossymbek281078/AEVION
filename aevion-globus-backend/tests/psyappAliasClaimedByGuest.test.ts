/**
 * Псевдоним в трекере зависимостей занят тем гостем, кто его завёл.
 *
 * До 24.10.2026 гость псевдоним не «занимал» (владелец null), и вид
 * зависимости, дата начала и число срывов читал любой, кто угадал
 * псевдоним. Теперь новый псевдоним гостя — guest:<id>; другой гость
 * получает отказ, сам владелец — данные. База замокана отказом.
 */
import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn().mockRejectedValue(new Error("no db in test")) }) }));

import { psyappDepsRouter } from "../src/routes/psyappDeps";

const app = express();
app.use(express.json());
app.use("/api/psyapp-deps", psyappDepsRouter);
const A = { "x-devhub-guest": "guestAAAA1111" };
const B = { "x-devhub-guest": "guestBBBB2222" };

describe("псевдоним гостя — только его", () => {
  test("A завёл, A читает; B и запрос без личности — отказ", async () => {
    const made = await request(app).post("/api/psyapp-deps/users/probe-anna-2410/start").set(A).send({ addiction: "smoking" });
    expect(made.status, JSON.stringify(made.body)).toBeLessThan(300);
    const a = await request(app).get("/api/psyapp-deps/users/probe-anna-2410").set(A);
    expect(a.status, "знаменатель: владелец читает").toBe(200);
    expect(a.body.user?.addiction).toBe("smoking");
    const b = await request(app).get("/api/psyapp-deps/users/probe-anna-2410").set(B);
    expect(b.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(b.body)).not.toContain("smoking");
    const none = await request(app).get("/api/psyapp-deps/users/probe-anna-2410");
    expect(none.status).toBeGreaterThanOrEqual(400);
    const relapse = await request(app).post("/api/psyapp-deps/users/probe-anna-2410/relapse").set(B).send({});
    expect(relapse.status, "B не может отметить срыв за A").toBeGreaterThanOrEqual(400);
  });
});
