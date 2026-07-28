import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

/**
 * `GET /api/quantum-shield/:id/public` — проверка ОТВЕТА, а не только заголовка.
 *
 * У этой ручки уже есть тест на выбор `Cache-Control`
 * (`quantumShieldPublicCache.test.ts`), но он проверяет чистую функцию. Само
 * ТЕЛО ответа не проверял никто, хотя именно в нём лежит `ownerUserId`, который
 * анонимному видеть нельзя. Правило из `docs/PUBLIC-ENDPOINTS.md`: у публичной
 * ручки должен быть тест «чего в ответе быть не должно», ходящий по HTTP.
 *
 * Почему это не формальность: у соседней публичной ссылки мультичата 28.07
 * ровно такой разрыв оказался настоящей дырой — тест на помощнике не замечал
 * утечки, когда помощник просто перестали ВЫЗЫВАТЬ.
 *
 * Проверяются оба среза сразу, потому что «не отдаёт владельцу» — это тоже
 * дефект: аноним не должен видеть `ownerUserId`, а владелец должен, и заголовок
 * кеша обязан соответствовать телу.
 */

const SHIELD_ID = "shield-1";
const OWNER = "usr-владелец-щита";
const SECRET = "test-secret-quantum-shield";

const shieldRow = {
  id: SHIELD_ID,
  objectId: "obj-1",
  objectTitle: "Объект",
  algorithm: "Shamir + Ed25519",
  threshold: 2,
  totalShards: 3,
  publicKey: "ff".repeat(32),
  signature: "ab".repeat(32),
  status: "active",
  legacy: false,
  hmac_key_version: 1,
  verifiedCount: 7,
  lastVerifiedAt: null,
  distribution_policy: "legacy_all_local",
  ownerUserId: OWNER,
  createdAt: "2026-07-28T00:00:00.000Z",
};

// vi.hoisted: фабрика vi.mock поднимается выше объявлений, поэтому обычная
// const здесь даёт «Cannot access before initialization». Тот же приём уже
// применён в build.integration.test.ts.
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery }),
}));

// eslint-disable-next-line import/first
import { quantumShieldRouter } from "../src/routes/quantum-shield";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/quantum-shield", quantumShieldRouter);
  return app;
}

beforeAll(() => {
  process.env.AUTH_JWT_SECRET = SECRET;
});

/**
 * Заглушка отвечает по СОДЕРЖАНИЮ запроса, а не по порядку вызовов.
 *
 * Первая версия раздавала ответы очередью — и первый же тест получил 404:
 * `ensureShieldTable()` съедал заготовленную строку щита, а срабатывает он один
 * раз за модуль, поэтому остальные тесты проходили. Ровно тот класс, из-за
 * которого весь день разбирался флак devhub: порядок вызовов — ненадёжный ключ.
 */
function respondTo(sql: unknown) {
  const q = String(sql);
  if (/FROM\s+"QuantumShield"/i.test(q)) return { rows: [shieldRow], rowCount: 1 };
  if (/FROM\s+"QuantumShieldAudit"/i.test(q)) {
    return { rows: [{ id: "a1", event: "created", actorUserId: OWNER, createdAt: shieldRow.createdAt }], rowCount: 1 };
  }
  return { rows: [], rowCount: 0 };
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: unknown) => respondTo(sql));
});

function tokenFor(sub: string, role = "user") {
  return jwt.sign({ sub, email: `${sub}@aevion.test`, role }, SECRET, { expiresIn: "1h" });
}

describe("GET /api/quantum-shield/:id/public — что уходит наружу", () => {
  it("аноним получает щит, но БЕЗ идентификатора владельца", async () => {
    const res = await request(makeApp()).get(`/api/quantum-shield/${SHIELD_ID}/public`);
    expect(res.status).toBe(200);
    // Полезная часть на месте — иначе проверки ниже были бы про пустоту.
    expect(res.body.id).toBe(SHIELD_ID);
    expect(res.body.publicKey).toBe(shieldRow.publicKey);
    // А владельца нет — ни полем, ни где-то вложенным.
    expect(res.body).not.toHaveProperty("ownerUserId");
    expect(JSON.stringify(res.body), "идентификатор владельца утёк анонимному").not.toContain(OWNER);
    expect(res.body).not.toHaveProperty("auditSnippet");
  });

  it("аноним НЕ получает осколки секрета", async () => {
    const res = await request(makeApp()).get(`/api/quantum-shield/${SHIELD_ID}/public`);
    expect(res.body).not.toHaveProperty("shards");
    expect(JSON.stringify(res.body)).not.toContain("shards");
  });

  it("анонимный ответ можно кешировать публично", async () => {
    const res = await request(makeApp()).get(`/api/quantum-shield/${SHIELD_ID}/public`);
    expect(res.headers["cache-control"]).toContain("public");
    expect(res.headers["cache-control"]).not.toContain("no-store");
  });

  it("владелец получает свой идентификатор, и ответ НЕ кешируется публично", async () => {
    // Обратная сторона: «ничего не отдавать» — тоже дефект. И главное, тело и
    // заголовок обязаны соответствовать друг другу: персонализированный ответ в
    // общем кеше — это утечка следующему, кто спросит.
    const res = await request(makeApp())
      .get(`/api/quantum-shield/${SHIELD_ID}/public`)
      .set("Authorization", `Bearer ${tokenFor(OWNER)}`);
    expect(res.status).toBe(200);
    expect(res.body.ownerUserId).toBe(OWNER);
    expect(res.headers["cache-control"]).toContain("private");
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(res.headers["cache-control"]).not.toContain("public");
  });

  it("чужой вошедший пользователь — как аноним", async () => {
    const res = await request(makeApp())
      .get(`/api/quantum-shield/${SHIELD_ID}/public`)
      .set("Authorization", `Bearer ${tokenFor("usr-посторонний")}`);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("ownerUserId");
    expect(JSON.stringify(res.body)).not.toContain(OWNER);
    expect(res.headers["cache-control"]).toContain("public");
  });

  it("падение журнала аудита не превращает ответ владельца в публично кешируемый", async () => {
    // Ровно та ветка, из-за которой правка и понадобилась: запрос журнала обёрнут
    // в try/catch («таблицы может не быть на старом развёртывании»), и раньше
    // заголовок выбирался по его результату, а не по факту персонализации.
    mockQuery.mockImplementation(async (sql: unknown) => {
      if (/FROM\s+"QuantumShieldAudit"/i.test(String(sql))) {
        throw new Error('relation "QuantumShieldAudit" does not exist');
      }
      return respondTo(sql);
    });

    const res = await request(makeApp())
      .get(`/api/quantum-shield/${SHIELD_ID}/public`)
      .set("Authorization", `Bearer ${tokenFor(OWNER)}`);
    expect(res.status).toBe(200);
    expect(res.body.ownerUserId).toBe(OWNER);
    expect(res.headers["cache-control"], "ответ владельца ушёл бы в общий кеш").toContain("no-store");
    expect(res.headers["cache-control"]).not.toContain("public");
  });
});
