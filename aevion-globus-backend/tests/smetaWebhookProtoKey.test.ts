import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import jwt from "jsonwebtoken";
import request from "supertest";
import express from "express";
import { smetaTrainerRouter } from "../src/routes/smeta-trainer";
import { getJwtSecret } from "../src/lib/authJwt";

/**
 * DELETE /admin/webhooks/:id — идентификатор берётся прямо из адреса, а список
 * вебхуков лежит обычным объектом в JSON-файле.
 *
 * С оператором `in` запрос на несуществующий вебхук с именем ключа прототипа
 * («constructor», «__proto__», …) проходил проверку существования насквозь:
 * вместо 404 вызывающий получал ok:true про вебхук, которого никогда не было,
 * а файл переписывался впустую. Найдено развёрткой по AST 05.08.2026 —
 * то же семейство, что и qmelanin/pricing, но проявляется не 500-й, а ЛОЖНЫМ
 * УСПЕХОМ, поэтому пробником враждебного ввода не ловилось.
 *
 * Каталог данных на тест свой: readJsonFile читает AEVION_DATA_DIR в момент
 * вызова, а не на импорте, поэтому подмена в beforeEach работает.
 */
const PROTO_KEYS = ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"];

let dataDir: string;

function appWithAuth() {
  const app = express();
  app.use(express.json());
  app.use("/api/smeta-trainer", smetaTrainerRouter);
  return app;
}

function bearer(): string {
  return "Bearer " + jwt.sign({ sub: "student-1" }, getJwtSecret(), { algorithm: "HS256" });
}

function seedWebhooks(value: Record<string, unknown>) {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, "smeta_webhooks.json"), JSON.stringify(value), "utf8");
}

function readWebhooks(): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(dataDir, "smeta_webhooks.json"), "utf8"));
}

beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "smeta-webhook-test-"));
  process.env.AEVION_DATA_DIR = dataDir;
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
  delete process.env.AEVION_DATA_DIR;
});

describe("DELETE /admin/webhooks/:id — ключ прототипа не считается существующим", () => {
  for (const key of PROTO_KEYS) {
    test(`id="${key}" → 404, а не ложный ok`, async () => {
      seedWebhooks({ "wh-real": { url: "https://example.test/hook", events: ["attempt"] } });

      const res = await request(appWithAuth())
        .delete(`/api/smeta-trainer/admin/webhooks/${encodeURIComponent(key)}`)
        .set("Authorization", bearer());

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("not_found");
      // Настоящий вебхук не должен пострадать от чужого запроса.
      expect(Object.keys(readWebhooks())).toEqual(["wh-real"]);
    });
  }

  test("существующий вебхук по-прежнему удаляется", async () => {
    seedWebhooks({ "wh-real": { url: "https://example.test/hook", events: ["attempt"] } });

    const res = await request(appWithAuth())
      .delete("/api/smeta-trainer/admin/webhooks/wh-real")
      .set("Authorization", bearer());

    // Страховка от «починили, запретив всё»: без неё тесты выше были бы
    // зелёными и на заглушке, которая всегда отвечает 404.
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Object.keys(readWebhooks())).toEqual([]);
  });

  test("без токена — 401, до проверки существования дело не доходит", async () => {
    seedWebhooks({});
    const res = await request(appWithAuth()).delete("/api/smeta-trainer/admin/webhooks/constructor");
    expect(res.status).toBe(401);
  });
});
