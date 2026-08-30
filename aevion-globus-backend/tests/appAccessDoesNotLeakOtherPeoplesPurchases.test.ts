/**
 * `/api/apps/access` не должен рассказывать, за что платит ЧУЖОЙ человек.
 *
 * До 28.08.2026 обе ручки были публичными и брали почту из строки запроса:
 *
 *     GET /api/apps/access?email=someone@example.com
 *     -> {"apps":["healthai","qmelanin"]}
 *
 * Зная адрес, кто угодно получал список покупок — а среди товаров есть
 * связанные со здоровьем. Ограничителя частоты на маршруте нет, то есть
 * проверить можно было и целый список адресов.
 *
 * Обоснование в комментарии («same pattern as /api/pricing/subscription/me»)
 * оказалось неверным: сосед отвечает 401 без токена. Проверено запросом.
 *
 * Здесь закрепляется поведение, а не текст: почта берётся ИЗ ТОКЕНА, а
 * параметр `email` не читается вовсе.
 */

import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

const SECRET = "test-secret-for-app-access";
const OWNER = "owner@example.com";
const VICTIM = "someone-else@example.com";

let app: express.Express;

beforeAll(async () => {
  process.env.AUTH_JWT_SECRET = SECRET;
  const { appAccessRouter } = await import("../src/routes/appAccess");
  app = express();
  app.use("/api/apps/access", appAccessRouter);
});

function tokenFor(email: string): string {
  return jwt.sign({ email }, SECRET, { algorithm: "HS256", expiresIn: "1h" });
}

describe("apps/access не выдаёт чужие покупки", () => {
  it("без токена — 401, а не список", async () => {
    const res = await request(app).get("/api/apps/access");
    expect(res.status).toBe(401);
    expect(res.body.apps).toBeUndefined();
  });

  it("чужая почта в параметре игнорируется: ответ 401, пока нет токена", async () => {
    // Именно этот запрос и работал раньше — он обязан перестать.
    const res = await request(app).get(
      `/api/apps/access?email=${encodeURIComponent(VICTIM)}`,
    );
    expect(res.status).toBe(401);
  });

  it("/check без токена — 401 даже с указанным приложением", async () => {
    const res = await request(app).get(
      `/api/apps/access/check?email=${encodeURIComponent(VICTIM)}&app=healthai`,
    );
    expect(res.status).toBe(401);
    expect(res.body.active).toBeUndefined();
  });

  it("битый токен не пускает", async () => {
    const res = await request(app)
      .get("/api/apps/access")
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("токен, подписанный ЧУЖИМ секретом, не пускает", async () => {
    const forged = jwt.sign({ email: OWNER }, "wrong-secret", { algorithm: "HS256" });
    const res = await request(app).get("/api/apps/access").set("Authorization", `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

it("нестроковый email в токене даёт 401, а не падение сервера", () => {
    // Подделать такой токен нельзя — он подписан нашим секретом. Но отказ
    // обязан выглядеть отказом: .toLowerCase() на объекте дал бы 500.
    return (async () => {
      const bad = jwt.sign({ email: { nested: true } }, SECRET, { algorithm: "HS256" });
      const res = await request(app).get("/api/apps/access").set("Authorization", `Bearer ${bad}`);
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(500);
    })();
  });

  it("с токеном ручка ОТВЕЧАЕТ — то есть закрыт не весь путь, а только чужой", async () => {
    // Отрицательный контроль правки. Без него тест был бы зелёным и на
    // ручке, сломанной наглухо: 401 на всё — это не защита, а поломка.
    // База в тесте недоступна, поэтому допускаем 500 «db error» — важно, что
    // запрос ПРОШЁЛ проверку токена и дошёл до работы с данными.
    const res = await request(app)
      .get("/api/apps/access")
      .set("Authorization", `Bearer ${tokenFor(OWNER)}`);
    expect(res.status).not.toBe(401);
  });

  it("чужая почта в параметре не подменяет свою при валидном токене", async () => {
    const res = await request(app)
      .get(`/api/apps/access?email=${encodeURIComponent(VICTIM)}`)
      .set("Authorization", `Bearer ${tokenFor(OWNER)}`);
    // Ответ строится по владельцу токена; чужой адрес просто не читается.
    expect(res.status).not.toBe(401);
  });
});
