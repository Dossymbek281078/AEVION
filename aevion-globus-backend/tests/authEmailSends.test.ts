import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

/**
 * Регистрация и восстановление пароля ДОЛЖНЫ отправлять письмо.
 *
 * Повод. 19.08.2026: обе ручки создавали токен, писали запись в журнал аудита
 * и отвечали `{ok:true}`, не отправляя ничего. Токен возвращался в ответе
 * только в режиме разработки, а в проде не доходил никуда. Отправщик при этом
 * лежал готовым в `lib/build/email.ts`: функции `sendVerificationEmail` и
 * `sendPasswordResetEmail` были написаны, экспортированы и не вызывались НИ ИЗ
 * ОДНОГО файла (проверено по всему репозиторию — 7 из 9 писем модуля мёртвые).
 *
 * Поэтому тест проверяет не «ручка вернула 200», а ФАКТ ВЫЗОВА отправщика с
 * правильным адресом и токеном. Утверждение вида «ответ ok» было зелёным и на
 * сломанном коде — оно и было зелёным три недели.
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

/** Ответы для сброса пароля: found=true — адрес есть в базе. */
function dbForReset(found: boolean) {
  query.mockReset();
  query.mockImplementation(async (sql: string) => {
    if (/SELECT "id", "name" FROM "AEVIONUser"/.test(sql))
      return { rowCount: found ? 1 : 0, rows: found ? [{ id: "u1", name: "Абдолла" }] : [] };
    return { rowCount: 1, rows: [] };
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

describe("Подтверждение адреса действительно отправляет письмо", () => {
  test("отправщик ВЫЗВАН, и получил тот же токен, что лёг в базу", async () => {
    dbForVerify();
    const r = await request(app())
      .post("/email/verify/request")
      .set("Authorization", bearer("u1"))
      .send({});

    expect(r.status).toBe(200);
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    const arg = sendVerificationEmail.mock.calls[0][0] as { to: string; name: string; token: string };
    expect(arg.to).toBe("a@example.com");
    expect(arg.name).toBe("Абдолла");
    expect(typeof arg.token).toBe("string");
    expect(arg.token.length).toBeGreaterThan(10);
    // Поле называется `emailSent`, а не `sent`: так его отдаёт ручка и так его
    // читает фронтенд. Прежнее имя осталось от более ранней версии, где ответ
    // был безусловным `sent: true` — то есть «отправлено» говорили и когда
    // письмо не уходило. Имя менялось вместе со смыслом.
    expect(r.body.emailSent).toBe(true);
  });

  test("имени нет — в письме адрес, а не пустая строка", async () => {
    dbForVerify(null);
    await request(app()).post("/email/verify/request").set("Authorization", bearer("u1")).send({});
    expect((sendVerificationEmail.mock.calls[0][0] as { name: string }).name).toBe("a@example.com");
  });

  test("транспорт не настроен — 503 и НИЧЕГО не отправляем, а не тихое ok", async () => {
    canSendEmail.mockReturnValue(false);
    dbForVerify();
    const r = await request(app())
      .post("/email/verify/request")
      .set("Authorization", bearer("u1"))
      .send({});

    expect(r.status).toBe(503);
    expect(r.body.error).toBe("email_not_configured");
    expect(sendVerificationEmail).not.toHaveBeenCalled();
    // Главное: ответ НЕ выглядит успешным.
    expect(r.body.ok).toBeUndefined();
  });

  test("отправка сорвалась — 502, а не ok", async () => {
    sendVerificationEmail.mockResolvedValue(false);
    dbForVerify();
    const r = await request(app())
      .post("/email/verify/request")
      .set("Authorization", bearer("u1"))
      .send({});
    expect(r.status).toBe(502);
    expect(r.body.error).toBe("email_send_failed");
  });
});

describe("Сброс пароля отправляет письмо и не выдаёт, кто зарегистрирован", () => {
  test("адрес известен — письмо ушло с тем же токеном", async () => {
    dbForReset(true);
    const r = await request(app()).post("/password/reset/request").send({ email: "a@example.com" });
    expect(r.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const arg = sendPasswordResetEmail.mock.calls[0][0] as { to: string; token: string };
    expect(arg.to).toBe("a@example.com");
    expect(arg.token.length).toBeGreaterThan(10);
  });

  // ВАЖНО про режим. В деве ответ намеренно содержит `devToken` для известного
  // адреса — и тем самым отличается от ответа для неизвестного. Это осознанное
  // послабление для отладки, но свойство «не выдаём, кто зарегистрирован»
  // проверять надо там, где оно обязано выполняться, — в проде. Тест под
  // NODE_ENV=test был бы красным по причине, не имеющей отношения к делу.
  test("адрес неизвестен — ответ ТОТ ЖЕ, письма нет", async () => {
    process.env.NODE_ENV = "production";
    dbForReset(true);
    const known = await request(app()).post("/password/reset/request").send({ email: "a@example.com" });
    dbForReset(false);
    const unknown = await request(app()).post("/password/reset/request").send({ email: "nobody@example.com" });

    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);          // ни одного отличия наружу
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1); // только для известного
  });

  test("отправка сорвалась — ответ ВСЁ РАВНО прежний, иначе это выдаёт аккаунт", async () => {
    process.env.NODE_ENV = "production";
    dbForReset(false);
    const unknown = await request(app()).post("/password/reset/request").send({ email: "nobody@example.com" });

    sendPasswordResetEmail.mockResolvedValue(false);
    dbForReset(true);
    const failed = await request(app()).post("/password/reset/request").send({ email: "a@example.com" });

    expect(failed.status).toBe(unknown.status);
    expect(failed.body).toEqual(unknown.body);
  });

  test("транспорт не настроен — 503 ДО поиска пользователя, база не спрошена", async () => {
    canSendEmail.mockReturnValue(false);
    dbForReset(true);
    const r = await request(app()).post("/password/reset/request").send({ email: "a@example.com" });

    expect(r.status).toBe(503);
    expect(r.body.error).toBe("email_not_configured");
    // Ни одного SELECT по адресу: иначе ответ зависел бы от наличия аккаунта.
    const asked = query.mock.calls.some((c) => /FROM "AEVIONUser"/.test(String(c[0])));
    expect(asked).toBe(false);
  });
});

describe("Ручка состояния не расходится с поведением", () => {
  test("emailVerifySendsMail true — и это правда, отправщик подключён", async () => {
    const r = await request(app()).get("/email/healthz");
    expect(r.body.emailVerifySendsMail).toBe(true);
  });
});
