import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/*
 * 🔴 22.10.2026, утечка переменных Railway: QPAYNET_ENCRYPTION_KEY считается засвеченным. До этой правки
 * смена ключа теряла все зашифрованные секреты вебхуков (decryptSecret знал один ключ). Теперь прежний ключ
 * живёт в QPAYNET_ENCRYPTION_KEY_PREV только для чтения, needsEncryption() просит перешифровать такие строки,
 * а POST /api/qpaynet/admin/reencrypt добивает нетронутые и говорит, когда PREV можно убрать.
 */

const КЛЮЧ1 = "11".repeat(32);
const КЛЮЧ2 = "22".repeat(32);
const ENV = ["QPAYNET_ENCRYPTION_KEY", "QPAYNET_ENCRYPTION_KEY_PREV", "QPAYNET_ADMIN_EMAILS", "AUTH_JWT_SECRET", "NODE_ENV"];

async function крипто() {
  const m = await import("../src/lib/qpaynetCrypto");
  m.__resetQpaynetCryptoCache();
  return m;
}

beforeEach(() => { for (const k of ENV) delete process.env[k]; });
afterEach(async () => { (await крипто()).__resetQpaynetCryptoCache(); for (const k of ENV) delete process.env[k]; });

describe("qpaynetCrypto: прежний ключ читает, текущий пишет", () => {
  test("🔴 строка под прежним ключом открывается при PREV и требует перешифровки; после перешифровки — нет", async () => {
    process.env.QPAYNET_ENCRYPTION_KEY = КЛЮЧ1;
    let m = await крипто();
    const старая = m.encryptSecret("whsec_проба")!;
    expect(старая.startsWith("enc:v1:")).toBe(true);

    process.env.QPAYNET_ENCRYPTION_KEY = КЛЮЧ2;
    process.env.QPAYNET_ENCRYPTION_KEY_PREV = КЛЮЧ1;
    m = await крипто();
    expect(m.decryptSecret(старая)).toBe("whsec_проба");
    expect(m.openSecret(старая).key).toBe("prev");
    expect(m.needsEncryption(старая), "строка под прежним ключом должна перешифроваться").toBe(true);
    expect(m.prevKeyCount()).toBe(1);

    const новая = m.encryptSecret("whsec_проба")!;
    expect(новая).not.toBe(старая);
    expect(m.openSecret(новая).key).toBe("current");
    expect(m.needsEncryption(новая)).toBe(false);
    expect(m.decryptSecret(новая)).toBe("whsec_проба");
  });

  test("КОНТРОЛЬ: без PREV строка под прежним ключом не открывается — ошибка называет PREV, а не молчит", async () => {
    process.env.QPAYNET_ENCRYPTION_KEY = КЛЮЧ1;
    let m = await крипто();
    const старая = m.encryptSecret("whsec_проба")!;
    process.env.QPAYNET_ENCRYPTION_KEY = КЛЮЧ2;
    m = await крипто();
    expect(() => m.decryptSecret(старая)).toThrow(/QPAYNET_ENCRYPTION_KEY_PREV/);
    expect(m.needsEncryption(старая)).toBe(false);
  });

  test("КОНТРОЛЬ: открытый текст и выключенное шифрование — поведение прежнее", async () => {
    let m = await крипто();
    expect(m.isEncryptionEnabled()).toBe(false);
    expect(m.encryptSecret("plain")).toBe("plain");
    expect(m.decryptSecret("plain")).toBe("plain");
    expect(m.needsEncryption("plain")).toBe(false);
    process.env.QPAYNET_ENCRYPTION_KEY = КЛЮЧ1;
    m = await крипто();
    expect(m.needsEncryption("plain")).toBe(true);
    expect(m.needsEncryption("")).toBe(false);
    expect(m.needsEncryption(null)).toBe(false);
  });
});

/* ── ручка перешифровки ── */
let строки: Record<string, Array<{ id: string; v: string }>> = {};
let обновлений: Array<{ table: string; id: string; value: string }> = [];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const s = String(sql);
      const t = /FROM (qpaynet_\w+)/.exec(s)?.[1] ?? /UPDATE (qpaynet_\w+)/.exec(s)?.[1] ?? "";
      if (/^SELECT/i.test(s.trim())) return { rows: строки[t] ?? [], rowCount: (строки[t] ?? []).length };
      if (/^UPDATE/i.test(s.trim())) {
        обновить(t, String(params?.[1]), String(params?.[0]));
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
    connect: vi.fn(async () => ({ query: vi.fn(async () => ({ rows: [], rowCount: 0 })), release: vi.fn() })),
  }),
  getPoolStats: () => ({}),
}));
function обновить(table: string, id: string, value: string) {
  обновлений.push({ table, id, value });
  const r = (строки[table] ?? []).find((x) => x.id === id);
  if (r) r.v = value;
}

const СЕКРЕТ = "test-jwt-secret-with-32-plus-characters-ok";
async function приложение() {
  process.env.AUTH_JWT_SECRET = СЕКРЕТ;
  process.env.QPAYNET_ADMIN_EMAILS = "admin@aevion.app";
  const { qpaynetRouter } = await import("../src/routes/qpaynet");
  const a = express();
  a.use(express.json());
  a.use("/api/qpaynet", qpaynetRouter);
  return a;
}
const токен = (email: string) => jwt.sign({ sub: "u_" + email, email }, СЕКРЕТ, { algorithm: "HS256", expiresIn: "1h" });

describe("POST /api/qpaynet/admin/reencrypt", () => {
  test("🔴 перешифровывает строки под прежним ключом и открытый текст; текущие не трогает; dryRun только считает", async () => {
    process.env.QPAYNET_ENCRYPTION_KEY = КЛЮЧ1;
    let m = await крипто();
    const подСтарым = m.encryptSecret("s1")!;
    process.env.QPAYNET_ENCRYPTION_KEY = КЛЮЧ2;
    process.env.QPAYNET_ENCRYPTION_KEY_PREV = КЛЮЧ1;
    m = await крипто();
    const подНовым = m.encryptSecret("s2")!;
    строки = {
      qpaynet_merchant_webhooks: [{ id: "w1", v: подСтарым }, { id: "w2", v: подНовым }, { id: "w3", v: "plain-secret" }],
      qpaynet_payment_requests: [{ id: "p1", v: подСтарым }, { id: "p2", v: "enc:v1:" + Buffer.from("x".repeat(40)).toString("base64") }],
    };
    обновлений = [];
    const app = await приложение();

    const сухой = await request(app).post("/api/qpaynet/admin/reencrypt?dryRun=1").set("Authorization", `Bearer ${токен("admin@aevion.app")}`);
    expect(сухой.status).toBe(200);
    expect(сухой.body.dryRun).toBe(true);
    expect(сухой.body.prevKeysConfigured).toBe(1);
    expect(обновлений, "dryRun ничего не пишет").toHaveLength(0);
    const w = сухой.body.tables.find((t: { table: string }) => t.table === "qpaynet_merchant_webhooks");
    expect(w).toMatchObject({ total: 3, current: 1, prev: 1, plain: 1, unreadable: 0, rewritten: 0 });
    const p = сухой.body.tables.find((t: { table: string }) => t.table === "qpaynet_payment_requests");
    expect(p).toMatchObject({ total: 2, prev: 1, unreadable: 1, rewritten: 0 });
    expect(сухой.body.canDropPrev).toBe(false);

    const боевой = await request(app).post("/api/qpaynet/admin/reencrypt").set("Authorization", `Bearer ${токен("admin@aevion.app")}`);
    expect(боевой.status).toBe(200);
    expect(обновлений.map((u) => u.table + ":" + u.id).sort()).toEqual(["qpaynet_merchant_webhooks:w1", "qpaynet_merchant_webhooks:w3", "qpaynet_payment_requests:p1"]);
    for (const u of обновлений) expect(m.openSecret(u.value).key).toBe("current");
    expect(m.decryptSecret(строки.qpaynet_merchant_webhooks[0].v)).toBe("s1");
    expect(m.decryptSecret(строки.qpaynet_merchant_webhooks[2].v)).toBe("plain-secret");
    // нечитаемая строка остаётся и держит canDropPrev=false — о ней надо решать отдельно, не молча
    expect(боевой.body.canDropPrev).toBe(false);
    expect(JSON.stringify(боевой.body)).not.toContain("s1");
    expect(JSON.stringify(боевой.body)).not.toContain(КЛЮЧ1);

    // после уборки нечитаемой строки — всё под текущим ключом, PREV можно снимать
    строки.qpaynet_payment_requests = строки.qpaynet_payment_requests.filter((r) => r.id !== "p2");
    const чисто = await request(app).post("/api/qpaynet/admin/reencrypt?dryRun=1").set("Authorization", `Bearer ${токен("admin@aevion.app")}`);
    expect(чисто.body.canDropPrev, "dryRun тоже может сказать, что PREV снимать можно").toBe(true);
  });

  test("КОНТРОЛЬ: без входа 401, не админ 403, без ключа шифрования 409", async () => {
    строки = {};
    const app = await приложение();
    process.env.QPAYNET_ENCRYPTION_KEY = КЛЮЧ2;
    (await крипто());
    expect((await request(app).post("/api/qpaynet/admin/reencrypt")).status).toBe(401);
    expect((await request(app).post("/api/qpaynet/admin/reencrypt").set("Authorization", `Bearer ${токен("user@aevion.app")}`)).status).toBe(403);
    delete process.env.QPAYNET_ENCRYPTION_KEY;
    (await крипто());
    const r = await request(app).post("/api/qpaynet/admin/reencrypt").set("Authorization", `Bearer ${токен("admin@aevion.app")}`);
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("encryption_disabled");
  });
});
