import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

/**
 * Письмо подтверждения почты идёт на языке человека (ru|en|kk): тело `lang` -> Accept-Language -> ru.
 * Повод 31.10.2026: англоязычному человеку письмо приходило по-русски, тема «Подтвердите email — AEVION».
 */
const sendVerificationEmail = vi.fn();
const sendPasswordResetEmail = vi.fn();
const canSendEmail = vi.fn();

vi.mock("../src/lib/build/email", () => ({
  canSendEmail: (...a: unknown[]) => canSendEmail(...a),
  sendVerificationEmail: (...a: unknown[]) => sendVerificationEmail(...a),
  sendPasswordResetEmail: (...a: unknown[]) => sendPasswordResetEmail(...a),
}));

const query = vi.fn();
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: (...a: unknown[]) => query(...a) }) }));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));

// Ограничитель частоты глушим НАМЕРЕННО: supertest ходит с одного адреса, и
// на четвёртом запросе тест получал 429 вместо проверяемого ответа. Предмет
// этого файла — отправка письма, а не лимиты; лимиты проверяются отдельно.
vi.mock("../src/lib/rateLimit", () => ({
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// eslint-disable-next-line import/first
import { authRouter } from "../src/routes/auth";
// eslint-disable-next-line import/first
import { getJwtSecret } from "../src/lib/authJwt";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use(authRouter);
  return a;
};
const bearer = (sub: string) =>
  "Bearer " + jwt.sign({ sub, sid: "sess-1" }, getJwtSecret(), { algorithm: "HS256", expiresIn: "1h" });

/** Ответы на запросы ручки подтверждения: пользователь найден, не подтверждён. */
function dbForVerify(name: string | null = "Абдолла") {
  query.mockReset();
  query.mockImplementation(async (sql: string) => {
    if (/SELECT .*"emailVerifiedAt"/.test(sql))
      return { rowCount: 1, rows: [{ id: "u1", email: "a@example.com", name, emailVerifiedAt: null }] };
    return { rowCount: 1, rows: [] };            // INSERT токена, журнал аудита
  });
}


const NODE_ENV_BEFORE = process.env.NODE_ENV;
afterEach(() => { process.env.NODE_ENV = NODE_ENV_BEFORE; });
beforeEach(() => {
  vi.clearAllMocks();
  canSendEmail.mockReturnValue(true);
  sendVerificationEmail.mockResolvedValue(true);
  sendPasswordResetEmail.mockResolvedValue(true);
});

const langOf = async (hdr?: string, body: Record<string, unknown> = {}) => {
  dbForVerify();
  let rq = request(app()).post("/email/verify/request").set("Authorization", bearer("u1"));
  if (hdr !== undefined) rq = rq.set("Accept-Language", hdr);
  const r = await rq.send(body);
  expect(r.status).toBe(200);
  return (sendVerificationEmail.mock.calls[0][0] as { lang?: string }).lang;
};

describe("язык письма подтверждения почты в ручке", () => {
  test("Accept-Language en -> en", async () => { expect(await langOf("en-US,en;q=0.9")).toBe("en"); });
  test("Accept-Language kk / kz -> kk", async () => {
    expect(await langOf("kk-KZ,kk;q=0.9")).toBe("kk");
    vi.clearAllMocks(); sendVerificationEmail.mockResolvedValue(true);
    expect(await langOf("kz")).toBe("kk");
  });
  test("без заголовка -> ru", async () => { expect(await langOf()).toBe("ru"); });
  test("неподдерживаемый (de) -> en", async () => { expect(await langOf("de-DE,de;q=0.9")).toBe("en"); });
  test("явное поле lang главнее заголовка", async () => { expect(await langOf("en-US", { lang: "kk" })).toBe("kk"); });
  test("мусор в lang игнорируется, решает заголовок", async () => { expect(await langOf("en", { lang: "xx" })).toBe("en"); });
});
