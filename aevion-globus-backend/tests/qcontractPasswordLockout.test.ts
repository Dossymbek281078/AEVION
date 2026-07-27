import { describe, test, expect, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Проверка ограничения попыток пароля документа QContract.
 *
 * Проверяем МАРШРУТ, а не собственные функции-счётчики: тест на своих же входах
 * доказывал бы только что функция считает, а вопрос был в том, дойдёт ли отказ до
 * человека, который перебирает пароль. Поэтому supertest + мок пула, как в
 * build.integration.test.ts.
 *
 * У каждого теста СВОЙ токен: счётчики живут в модульной Map и переживают тест,
 * общий токен склеил бы независимые проверки.
 */

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery }),
}));

// eslint-disable-next-line import/first
import { qcontractRouter } from "../src/routes/qcontract";

const PASSWORD = "correct horse battery staple";
const PASSWORD_HASH = crypto.createHash("sha256").update(PASSWORD).digest("hex");

function makeApp() {
  const app = express();
  // Как в проде (index.ts): один доверенный прокси. Без этой строки req.ip был бы
  // адресом сокета, одинаковым для всех запросов теста, и проверка «блокировка
  // одного адреса не запирает другой» проходила бы по неверной причине.
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use("/api/qcontract", qcontractRouter);
  return app;
}

/** Пул отвечает так, будто документ существует и закрыт паролем. */
function serveDocument() {
  mockQuery.mockImplementation(async (sql: string) => {
    if (/SELECT[\s\S]*FROM qcontract_documents WHERE access_token/i.test(sql)) {
      return {
        rows: [
          {
            id: "doc-1",
            title: "Договор",
            content: "секретное содержимое",
            content_type: "text",
            password_hash: PASSWORD_HASH,
            max_views: null,
            view_count: 0,
            expires_at: null,
            revoked_at: null,
            require_signature: false,
            qright_id: null,
          },
        ],
      };
    }
    return { rows: [] };
  });
}

const view = (app: express.Express, token: string, password: string, ip = "10.0.0.1") =>
  request(app)
    .post(`/api/qcontract/view/${token}`)
    .set("x-forwarded-for", ip)
    .send({ password });

describe("QContract: подбор пароля документа", () => {
  test("после пяти неверных попыток шестая получает 429, а не очередной 403", async () => {
    serveDocument();
    const app = makeApp();
    const token = "tok-bruteforce";

    for (let i = 1; i <= 5; i++) {
      const res = await view(app, token, `wrong-${i}`);
      expect(res.status, `попытка ${i} должна быть обычным отказом`).toBe(403);
      expect(res.body.error).toBe("wrong_password");
    }

    const locked = await view(app, token, "wrong-6");
    expect(locked.status).toBe(429);
    expect(locked.body.error).toBe("too_many_password_attempts");
    expect(locked.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(locked.headers["retry-after"]).toBeDefined();
  });

  test("верный пароль отдаёт документ и обнуляет накопленные неудачи", async () => {
    serveDocument();
    const app = makeApp();
    const token = "tok-recovers";

    for (let i = 1; i <= 4; i++) {
      expect((await view(app, token, `wrong-${i}`)).status).toBe(403);
    }

    const ok = await view(app, token, PASSWORD);
    expect(ok.status).toBe(200);
    expect(ok.body.content).toBe("секретное содержимое");

    // Если бы счётчик не сбрасывался, пятая неудача после успеха уже заперла бы
    // человека — то есть верный ввод не помогал бы. Это и проверяем.
    const afterSuccess = await view(app, token, "wrong-again");
    expect(afterSuccess.status).toBe(403);
  });

  test("блокировка одного адреса не запирает документ для другого", async () => {
    serveDocument();
    const app = makeApp();
    const token = "tok-per-ip";

    for (let i = 1; i <= 6; i++) {
      await view(app, token, `wrong-${i}`, "10.0.0.7");
    }
    expect((await view(app, token, "wrong-7", "10.0.0.7")).status).toBe(429);

    // Другой адрес по тому же документу ещё не исчерпал свой лимит: иначе
    // посторонний запирал бы чужой документ шестью неверными вводами.
    const other = await view(app, token, "wrong-1", "10.0.0.8");
    expect(other.status).toBe(403);
  });
});
