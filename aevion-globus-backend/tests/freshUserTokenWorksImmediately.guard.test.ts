import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Только что зарегистрированный человек должен пройти закрытую ручку СРАЗУ.
 *
 * Замер на проде 12.10.2026 (окно Приложения-31.12): регистрация 201, затем
 * «Подписать» в QSign → 401 «invalid bearer token»; тот же токен через пару
 * минут прошёл. Карта версий токенов перечитывается раз в 5 минут, а
 * регистрация в неё не писала, и «нет в карте» значило «пользователя нет».
 *
 * Сторож идёт через НАСТОЯЩУЮ ручку /register и настоящую проверку
 * verifyBearerOptional — ту же цепочку, что у QSign и остальных модулей.
 */

const query = vi.fn();
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: (...a: unknown[]) => query(...a) }) }));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));
vi.mock("../src/lib/rateLimit", () => ({
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

process.env.AUTH_JWT_SECRET = "test-secret-svezhiy-polzovatel-32-znaka-i-bolshe";

const tv = await import("../src/lib/tokenVersion");
const { verifyBearerOptional } = await import("../src/lib/authJwt");
const { authRouter } = await import("../src/routes/auth");

const app = () => {
  const a = express();
  a.use(express.json());
  a.use(authRouter);
  return a;
};

/** База: в карте версий один старый пользователь, нового адреса нет нигде. */
function база() {
  query.mockReset();
  query.mockImplementation(async (sql: string) => {
    if (/SELECT "id", COALESCE\("tokenVersion", 0\) AS "tv" FROM "AEVIONUser"/.test(String(sql))) {
      return { rows: [{ id: "u-staryy", tv: 0 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
}

const заголовок = (token: string) => ({ headers: { authorization: "Bearer " + token } }) as any;

beforeEach(() => {
  tv.__resetTokenVersionsForTests();
  база();
});

describe("новый пользователь проходит закрытые ручки сразу после регистрации", () => {
  test("КОНТРОЛЬ: карта загружена и чужой выдуманный id отвергается", async () => {
    expect(await tv.loadTokenVersions()).toBe(true);
    expect(tv.isEnforcing()).toBe(true);
    expect(tv.tokenVersionAccepted("u-vydumannyy", 0)).toBe(false);
  });

  test("⭐ токен из /register принимается без ожидания перезагрузки карты", async () => {
    await tv.loadTokenVersions();
    const r = await request(app())
      .post("/register")
      .send({ name: "Новичок", email: "novichok@example.com", password: "nadezhnyy-parol-123" });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const token = r.body.token as string;
    expect(typeof token).toBe("string");

    const payload = verifyBearerOptional(заголовок(token));
    expect(payload, "свежий токен отвергнут — новичок увидит 401 до 5 минут").not.toBeNull();
    expect(tv.tokenVersionStatus().users).toBe(2);
  });

  test("известному пользователю выпуск токена версию НЕ откатывает", () => {
    tv.rememberIssuedUser("u-x", 5);
    tv.rememberIssuedUser("u-x", 0);
    expect(tv.currentTokenVersion("u-x")).toBe(5);
  });
});
