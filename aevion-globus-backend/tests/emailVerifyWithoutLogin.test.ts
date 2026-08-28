import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import bcrypt from "bcryptjs";

/**
 * Ссылка из письма обязана срабатывать у того, кто НЕ вошёл.
 *
 * Повод — замер 28.08.2026. Я проверил ручку завершения, подставив bearer сам,
 * и записал «работает». Потом открыл ту же ссылку в ЧИСТОМ браузере, как её
 * открывает человек на телефоне: 401, а на экране служебное «отсутствует
 * bearer token». Проверял я путь тем способом, которым удобно мне, а не тем,
 * которым идёт человек.
 *
 * Секрет хранится bcrypt-хешем, найти его по значению нельзя — поэтому в ссылку
 * кладётся идентификатор строки, и сервер берёт по нему одну запись.
 */

const query = vi.fn();
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: (...a: unknown[]) => query(...a) }) }));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));
vi.mock("../src/lib/rateLimit", () => ({
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// eslint-disable-next-line import/first
import { authRouter } from "../src/routes/auth";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use(authRouter);
  return a;
};

const ID = "11111111-2222-4333-8444-555555555555";
const SECRET = "s3cret-token-value";

/** Одна живая строка токена с настоящим bcrypt-хешем. */
async function dbWithLiveToken() {
  const hash = await bcrypt.hash(SECRET, 10);
  query.mockReset();
  query.mockImplementation(async (sql: string) => {
    if (/SELECT "id", "userId", "tokenHash"/.test(sql))
      return { rowCount: 1, rows: [{ id: ID, userId: "u1", tokenHash: hash }] };
    return { rowCount: 1, rows: [] };
  });
}

beforeEach(() => vi.clearAllMocks());

describe("подтверждение адреса без входа", () => {
  test("ссылка из письма срабатывает БЕЗ заголовка авторизации", async () => {
    await dbWithLiveToken();
    const r = await request(app())
      .post("/email/verify/complete")
      .send({ token: SECRET, tokenId: ID });
    expect(r.status, "человек с телефона снова получает отказ").toBe(200);
    expect(r.body).toEqual({ verified: true });
    // Отметка ставится ТОМУ пользователю, чья строка найдена, а не «текущему»:
    // текущего здесь нет вовсе.
    const updates = query.mock.calls.map((c) => String(c[0]));
    expect(updates.some((s) => /UPDATE "AEVIONUser" SET "emailVerifiedAt"/.test(s))).toBe(true);
  });

  test("чужой секрет с верным идентификатором не проходит", async () => {
    await dbWithLiveToken();
    const r = await request(app())
      .post("/email/verify/complete")
      .send({ token: "wrong-secret", tokenId: ID });
    expect(r.status).toBe(400);
  });

  test("кривой идентификатор — 400, а не 500", async () => {
    // Postgres на неверном uuid бросает исключение: без своей проверки ошибка
    // ЗАПРОСА стала бы нашей аварией и шумом в Sentry.
    await dbWithLiveToken();
    const r = await request(app())
      .post("/email/verify/complete")
      .send({ token: SECRET, tokenId: "не-uuid" });
    expect(r.status).toBe(400);
  });

  test("старый путь без идентификатора по-прежнему требует входа", async () => {
    // Ссылки, разосланные до правки, содержат только секрет — они обязаны
    // продолжать работать у вошедшего человека, а у невошедшего честно отказывать.
    await dbWithLiveToken();
    const r = await request(app()).post("/email/verify/complete").send({ token: SECRET });
    expect(r.status).toBe(401);
  });
});
