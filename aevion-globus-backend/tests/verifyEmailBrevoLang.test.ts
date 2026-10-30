import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { buildEmailVerifyEmail } from "../src/lib/constitutionBrevo";
import jwt from "jsonwebtoken";

/**
 * ЗАПАСНОЙ путь (Brevo) письма подтверждения почты: тот же язык, что у основного (ru|en|kk).
 * Повод 31.10.2026: sendEmailVerify/buildEmailVerifyEmail были только русскими.
 * Письмо подтверждения почты идёт на языке человека (ru|en|kk): тело `lang` -> Accept-Language -> ru.
 * Повод 31.10.2026: англоязычному человеку письмо приходило по-русски, тема «Подтвердите email — AEVION».
 */
const sendVerificationEmail = vi.fn();
const sendEmailVerify = vi.fn();
const sendPasswordResetEmail = vi.fn();
const canSendEmail = vi.fn();

vi.mock("../src/lib/build/email", () => ({
  canSendEmail: (...a: unknown[]) => canSendEmail(...a),
  sendVerificationEmail: (...a: unknown[]) => sendVerificationEmail(...a),
  sendPasswordResetEmail: (...a: unknown[]) => sendPasswordResetEmail(...a),
}));

const query = vi.fn();
vi.mock("../src/lib/constitutionBrevo", async (orig) => ({
  ...(await orig<object>()),
  sendEmailVerify: (...a: unknown[]) => sendEmailVerify(...a),
}));

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
const BREVO_BEFORE = process.env.BREVO_API_KEY;
afterEach(() => { process.env.NODE_ENV = NODE_ENV_BEFORE; if (BREVO_BEFORE === undefined) delete process.env.BREVO_API_KEY; else process.env.BREVO_API_KEY = BREVO_BEFORE; });
beforeEach(() => {
  vi.clearAllMocks();
  process.env.BREVO_API_KEY = "test-key-not-real";
  canSendEmail.mockReturnValue(false);   // основной провайдер не настроен -> Brevo
  sendEmailVerify.mockResolvedValue(true);
});

const CYR = /[А-Яа-яЁё]/;
const KK = /[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/;
const URL = "https://aevion.app/build/verify-email?token=abc&id=1";

describe("buildEmailVerifyEmail по языкам", () => {
  test("без lang — прежний русский", () => {
    const p = buildEmailVerifyEmail("a@example.com", URL);
    expect(p.subject).toBe("Подтвердите адрес — AEVION");
    expect(p.htmlContent).toContain("Подтвердить адрес");
    expect(p.textContent).toContain("Подтвердите адрес: " + URL);
  });
  test("en — ни одной кириллицы в теме, html и тексте; ссылка та же", () => {
    const p = buildEmailVerifyEmail("a@example.com", URL, "en");
    expect(p.subject).toBe("Confirm your email — AEVION");
    expect(CYR.test(p.subject + p.htmlContent + p.textContent)).toBe(false);
    expect(p.htmlContent).toContain(`href="${URL}"`);
    expect(p.textContent).toContain(URL);
  });
  test("kk — казахские буквы и слова, ссылка та же", () => {
    const p = buildEmailVerifyEmail("a@example.com", URL, "kk");
    expect(p.subject).toBe("Email мекенжайыңызды растаңыз — AEVION");
    expect(KK.test(p.htmlContent)).toBe(true);
    expect(KK.test(p.textContent ?? "")).toBe(true);
    expect(p.htmlContent).not.toContain("Подтвердить");
    expect(p.htmlContent).toContain(`href="${URL}"`);
    expect(p.textContent).toContain(URL);
  });
});

describe("запасной путь: ручка отдаёт Brevo тот же язык", () => {
  const brevoLang = async (hdr?: string, body: Record<string, unknown> = {}) => {
    dbForVerify();
    let rq = request(app()).post("/email/verify/request").set("Authorization", bearer("u1"));
    if (hdr !== undefined) rq = rq.set("Accept-Language", hdr);
    const r = await rq.send(body);
    expect(r.status).toBe(200);
    expect(sendVerificationEmail).not.toHaveBeenCalled();
    return sendEmailVerify.mock.calls[0][2];
  };
  test("Accept-Language en -> en", async () => { expect(await brevoLang("en-US,en;q=0.9")).toBe("en"); });
  test("тело lang kk важнее заголовка", async () => { expect(await brevoLang("en", { lang: "kk" })).toBe("kk"); });
  test("без всего -> ru", async () => { expect(await brevoLang()).toBe("ru"); });
});
