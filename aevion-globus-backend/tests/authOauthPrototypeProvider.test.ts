import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Имя провайдера приходит из адреса и попадало в поиск по обычному объекту:
 *
 *   const provider = getProviders()[id];
 *
 * Обычный объект наследует ключи прототипа, поэтому `constructor` возвращал
 * функцию `Object` — проверка `if (!provider)` её пропускала, и запрос доходил
 * до ветки «провайдер не настроен».
 *
 * Замер на живом проде 19.08.2026:
 *
 *   GET /api/auth/oauth/zzz-nonexistent-xyz/start -> 404 unknown provider
 *   GET /api/auth/oauth/constructor/start         -> 503 provider not configured
 *
 * Доступа это не давало. Опасность в другом: разный ответ на два одинаково
 * несуществующих имени — щель, по которой снаружи узнают, как устроено внутри.
 * Тем более что ответ 503 называет имена переменных окружения.
 *
 * Тест закрывает класс на обеих ручках сразу.
 */

vi.mock("../src/lib/authJwt", () => ({ getJwtSecret: () => "test-secret" }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }) }));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));

// eslint-disable-next-line import/first
import { authOauthRouter } from "../src/routes/authOauth";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use(authOauthRouter);
  return a;
};

const PROTO = ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"];

describe("OAuth: ключ прототипа — не провайдер", () => {
  beforeEach(() => {
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    delete process.env.GITHUB_OAUTH_CLIENT_ID;
    delete process.env.GITHUB_OAUTH_CLIENT_SECRET;
  });

  test("обычное несуществующее имя даёт 404 (контроль)", async () => {
    const r = await request(app()).get("/zzz-nonexistent-xyz/start");
    expect(r.status).toBe(404);
    expect(r.body.error).toMatch(/unknown provider/i);
  });

  test("настоящий провайдер узнаётся (контроль)", async () => {
    // Без настроек он ответит 503 «не настроен» — но НЕ 404, то есть имя
    // распознано. Без этой проверки тест был бы зелёным и на коде, который
    // не знает вообще никого.
    const r = await request(app()).get("/google/start");
    expect(r.status).not.toBe(404);
  });

  for (const path of ["start", "callback"]) {
    test.each(PROTO)(`/${path}: ключ %s отвечает как неизвестный провайдер`, async (id) => {
      const r = await request(app()).get(`/${id}/${path}`);
      expect(r.status).toBe(404);
      expect(JSON.stringify(r.body)).not.toMatch(/OAUTH_CLIENT/);
    });
  }
});
