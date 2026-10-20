import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/*
 * 🔴 152 (18.10.2026). Перед подъёмом «👍 интересно» в первый экран /ventures нужно доказать, что голос
 * принимается БЕЗ входа: ни токена, ни куки. Запрос идёт к ручке, печатается тело ответа.
 * БД в тесте недоступна (getPool бросает) — маршрут честно уходит в память, как на проде при падении БД.
 * На проде 18.10 22:2x: POST /api/ventures/ideas/zz/interest без заголовков → 404 {"error":"unknown-idea"}
 * (стены авторизации перед маршрутом нет — иначе был бы 401 до разбора id).
 */
vi.mock("../src/lib/dbPool", () => ({ getPool: () => { throw new Error("no db in test"); } }));
vi.mock("../src/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("../src/lib/rateLimit")>()),
  rateLimit: () => (_q: unknown, _s: unknown, n: () => void) => n(),
}));

async function приложение() {
  const { venturesRouter } = await import("../src/routes/ventures");
  const app = express();
  app.use(express.json());
  app.use("/api/ventures", venturesRouter);
  return app;
}

describe("152: голос «интересно» принимается без входа", () => {
  it("🔴 первый голос гостя → 201 ok, счётчик 1; повтор того же гостя → 200 alreadyVoted, счётчик не растёт", async () => {
    const app = await приложение();
    const voterId = "test-guest-152";
    const r1 = await request(app).post("/api/ventures/ideas/01/interest").send({ voterId, kind: "build" });
    console.log("тело 1:", JSON.stringify(r1.body));
    expect(r1.status).toBe(201);
    expect(r1.body).toMatchObject({ ok: true, ideaId: "01", alreadyVoted: false, interest: 1 });
    // 20.10.2026: без базы голос в памяти процесса — ответ обязан это сказать (форма не запомнит его как окончательный).
    expect(r1.body.storage).toBe("memory");

    const r2 = await request(app).post("/api/ventures/ideas/01/interest").send({ voterId, kind: "build" });
    console.log("тело 2:", JSON.stringify(r2.body));
    expect(r2.status).toBe(200);
    expect(r2.body).toMatchObject({ ok: true, alreadyVoted: true, interest: 1 });

    const r3 = await request(app).post("/api/ventures/ideas/01/interest").send({ voterId: "test-guest-152-b" });
    expect(r3.status).toBe(201);
    expect(r3.body.interest).toBe(2);
  });

  it("неизвестный замысел → 404 unknown-idea (как на проде), а не 401/403", async () => {
    const app = await приложение();
    const r = await request(app).post("/api/ventures/ideas/zz/interest").send({ voterId: "x" });
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: "unknown-idea" });
  });

  it("список замыслов отдаёт счётчик interest каждому из 20", async () => {
    const app = await приложение();
    const r = await request(app).get("/api/ventures/ideas");
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(20);
    expect(r.body.ideas.every((i: { interest: unknown }) => typeof i.interest === "number")).toBe(true);
  });
});
