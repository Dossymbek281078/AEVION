// Список бесед мультичата под параллельной нагрузкой.
//
// Файл бесед один на всех пользователей, а создание/переименование/шаринг
// делали read-modify-write тремя отдельными await. Две одновременные
// операции читали один список и обе писали свою версию — вторая затирала
// первую, и беседа пропадала из библиотеки без единой ошибки: запрос
// вернул 201 с её id, а в файле её нет.
//
// Тот же дефект, что в chatHistory (c7656fbe8) и в кошельке AEV (c3d54b7d5),
// только на другом файле — поэтому проверяется отдельно.

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { multichatRouter } from "../src/routes/multichat";

const SECRET = "test-secret-for-multichat-store-0123456789";

let app: express.Express;
let dataDir: string;
let token: string;
let prevDataDir: string | undefined;
let prevSecret: string | undefined;
let prevDbUrl: string | undefined;

beforeEach(() => {
  prevDataDir = process.env.AEVION_DATA_DIR;
  prevSecret = process.env.AUTH_JWT_SECRET;
  prevDbUrl = process.env.DATABASE_URL;
  dataDir = mkdtempSync(path.join(tmpdir(), "aevion-mc-store-"));
  process.env.AEVION_DATA_DIR = dataDir;
  process.env.AUTH_JWT_SECRET = SECRET;
  // Файловая ветка: ветка Postgres здесь не проверяется.
  delete process.env.DATABASE_URL;

  token = jwt.sign({ sub: "user_store_test", email: "store@aevion.local", role: "USER" }, SECRET, {
    expiresIn: "1h",
  });

  app = express();
  app.use(express.json());
  app.use("/api/multichat", multichatRouter);
});

afterEach(() => {
  if (prevDataDir === undefined) delete process.env.AEVION_DATA_DIR;
  else process.env.AEVION_DATA_DIR = prevDataDir;
  if (prevSecret === undefined) delete process.env.AUTH_JWT_SECRET;
  else process.env.AUTH_JWT_SECRET = prevSecret;
  if (prevDbUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = prevDbUrl;
  rmSync(dataDir, { recursive: true, force: true });
});

const auth = (r: request.Test) => r.set("Authorization", `Bearer ${token}`);

describe("Мультичат: проверка доступа к модулю", () => {
  test("GET /health отвечает — иначе пейволл-гейт страницы молча не срабатывает", async () => {
    // Страница модуля зовёт эту ручку через fetchOrPaywall, а тот трактует
    // всё, кроме 402, как «не заблокировано». Пока ручки не было, её 404
    // означал «пускать всех»: в день включения PAYWALL_MODULES человек без
    // модуля увидел бы страницу вместо предложения купить.
    const r = await auth(request(app).get("/api/multichat/health"));
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });

  test("без токена — 401, и это НЕ повод показывать пейволл", async () => {
    // 402 отдаёт requireModule выше по стеку; сам роутер про оплату не знает
    // и на анонима отвечает обычным 401.
    const r = await request(app).get("/api/multichat/health");
    expect(r.status).toBe(401);
  });
});

describe("Мультичат: список бесед при параллельных операциях", () => {
  test("одновременно созданные беседы все попадают в список", async () => {
    const N = 12;
    const created = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        auth(request(app).post("/api/multichat/conversations")).send({ title: `Беседа ${i}` }),
      ),
    );
    expect(created.every((r) => r.status === 201)).toBe(true);

    const list = await auth(request(app).get("/api/multichat/conversations"));
    expect(list.status).toBe(200);
    // Каждый id, на который ответили 201, обязан существовать: вернуть id и
    // потерять запись — худший вид отказа, потому что он выглядит успехом.
    const ids = new Set(list.body.items.map((c: { id: string }) => c.id));
    for (const r of created) expect(ids.has(r.body.id)).toBe(true);
    expect(list.body.items).toHaveLength(N);
  });

  test("переименование и шаринг разных бесед не затирают друг друга", async () => {
    const a = await auth(request(app).post("/api/multichat/conversations")).send({ title: "A" });
    const b = await auth(request(app).post("/api/multichat/conversations")).send({ title: "B" });

    await Promise.all([
      auth(request(app).patch(`/api/multichat/conversations/${a.body.id}`)).send({ title: "A переименована" }),
      auth(request(app).post(`/api/multichat/conversations/${b.body.id}/share`)).send({}),
    ]);

    const list = await auth(request(app).get("/api/multichat/conversations"));
    const items: Array<{ id: string; title: string; shareToken?: string | null }> = list.body.items;
    expect(items).toHaveLength(2);
    expect(items.find((c) => c.id === a.body.id)?.title).toBe("A переименована");
    expect(items.find((c) => c.id === b.body.id)?.shareToken).toBeTruthy();
  });

  test("удаление одной беседы не уносит соседние", async () => {
    const convs = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        auth(request(app).post("/api/multichat/conversations")).send({ title: `C${i}` }),
      ),
    );

    await Promise.all([
      auth(request(app).delete(`/api/multichat/conversations/${convs[0].body.id}`)),
      auth(request(app).patch(`/api/multichat/conversations/${convs[1].body.id}`)).send({ title: "жив" }),
      auth(request(app).post(`/api/multichat/conversations/${convs[2].body.id}/share`)).send({}),
    ]);

    const list = await auth(request(app).get("/api/multichat/conversations"));
    expect(list.body.items).toHaveLength(4);
  });
});
