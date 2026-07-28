import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import crypto from "node:crypto";

/**
 * Лимит траты — единственное, ради чего маска существует. Держался он на схеме
 * «SELECT остаток → сравнили в коде → UPDATE минус сумма», между которыми ничего
 * не стояло: два одновременных платежа читали ОДИН остаток, оба проходили
 * проверку и оба вычитали. Остаток уходил в минус. Одноразовая маска при этом
 * отзывалась ПОСЛЕ списания, поэтому по ней проходили оба платежа.
 *
 * Теперь списание занимается одним UPDATE с условиями в WHERE. Проверяем именно
 * последствия: проигравший гонку получает отказ и НЕ оставляет авторизованный
 * платёж в истории.
 */

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/ecosystemEvents", () => ({ emitVeilNetXEntry: async () => null }));

// eslint-disable-next-line import/first
import { qmaskcardRouter } from "../src/routes/qmaskcard";

function signJwt(payload: Record<string, unknown>, secret = "dev-auth-secret"): string {
  const b64 = (s: string) =>
    Buffer.from(s).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`)
    .digest("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${header}.${body}.${sig}`;
}

const USER = "user-1";
const MASK = {
  id: "mask-1", userId: USER, kind: "single-use", currency: "USD",
  lockedToMerchant: null, lockedToCategory: null,
  spendLimitCents: 10_000, remainingCents: 10_000,
  expiresAt: null, frozenAt: null, revokedAt: null,
};

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qmaskcard", qmaskcardRouter);
  return app;
}

/** Пул: маска существует; занятие средств удаётся или нет по флагу. */
function serve({ claimed }: { claimed: boolean }) {
  const seen: string[] = [];
  mockQuery.mockImplementation(async (sql: string) => {
    seen.push(sql);
    if (/SELECT[\s\S]*FROM "QMaskCardMask"/i.test(sql)) return { rows: [MASK], rowCount: 1 };
    // Проверка частоты платежей за час — без неё обработчик падает на rows[0].n.
    if (/SELECT COUNT\(\*\)[\s\S]*FROM "QMaskCardCharge"/i.test(sql)) return { rows: [{ n: 0 }], rowCount: 1 };
    if (/UPDATE "QMaskCardMask"[\s\S]*remainingCents" - /i.test(sql)) {
      return claimed ? { rows: [{ remainingCents: 5000 }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  });
  return seen;
}

const charge = (app: express.Express) =>
  request(app)
    .post("/api/qmaskcard/charges")
    .set("Authorization", `Bearer ${signJwt({ sub: USER, email: "u@test.aev" })}`)
    .send({ maskId: "mask-1", amountCents: 5000, currency: "USD", merchantName: "Shop" });

describe("QMaskCard: списание занимается атомарно", () => {
  beforeEach(() => mockQuery.mockReset());

  test("успешное занятие средств авторизует платёж", async () => {
    serve({ claimed: true });
    const res = await charge(makeApp());
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe("authorized");
  });

  test("проигравший гонку НЕ оставляет авторизованный платёж в истории", async () => {
    const seen = serve({ claimed: false });
    const res = await charge(makeApp());
    expect(res.status).not.toBe(201);
    const authorized = seen.filter((s) => /INSERT INTO "QMaskCardCharge"[\s\S]*'authorized'/i.test(s));
    expect(authorized).toEqual([]);
  });

  test("условия лимита стоят в САМОМ запросе списания", async () => {
    const seen = serve({ claimed: true });
    await charge(makeApp());
    const claim = seen.find((s) => /UPDATE "QMaskCardMask"[\s\S]*remainingCents" - /i.test(s)) ?? "";
    // Без этого условие снова уехало бы в код, и гонка вернулась бы.
    expect(claim).toMatch(/"remainingCents"\s*>=\s*\$1/);
    // Одноразовая маска должна гаситься тем же запросом, а не следующим.
    expect(claim).toMatch(/single-use/);
  });
});
