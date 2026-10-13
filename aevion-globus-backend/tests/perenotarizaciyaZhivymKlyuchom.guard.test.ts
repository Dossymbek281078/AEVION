import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

/*
 * 🔴 Пере-нотаризация живым ключом: старая демо-запись остаётся историей,
 * сертификат указывает на новую запись Ed25519 с тем же payload.
 *
 * Решение оркестратора 13.10.2026 (bd проверил verify на настоящих сертификатах —
 * «демонстрационная»: записи сделаны до ключа). Сторож делает настоящий POST к
 * ручке; база подменена: SELECT кандидатов отдаёт одну демо-запись, запись в
 * транзакции перехватывается и проверяется по тексту SQL и параметрам, а
 * подпись — настоящей проверкой Ed25519 открытым ключом.
 */
process.env.AUTH_JWT_SECRET = "test-secret-dlya-storozha-perenotarizacii-32-znaka";

const { журналЗапросов, транзакция } = vi.hoisted(() => ({ журналЗапросов: [] as Array<{ sql: string; params: unknown[] }>, транзакция: [] as Array<{ sql: string; params: unknown[] }> }));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string, params: unknown[] = []) => {
      журналЗапросов.push({ sql, params });
      if (/COUNT\(\*\)::int AS n FROM "IPCertificate"/.test(sql)) return { rows: [{ n: 11 }], rowCount: 1 };
      if (/GROUP BY 1, 2/.test(sql)) return { rows: [{ status: "signed", algorithm: "demo-hmac-sha256", n: 1 }], rowCount: 1 };
      if (/JOIN "IPCertificate" c ON c\."notarySignatureId" = s\."id"/.test(sql)) {
        return { rows: [{ id: "nsig-old1", notaryId: "notary-1", certId: "cert-13cd6ccef0abbc1d", signedHash: "h", notaryRegistryRef: "REG-1", contentHash: "abc123" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    connect: async () => ({
      query: async (sql: string, params: unknown[] = []) => { транзакция.push({ sql, params }); return { rows: [], rowCount: 1 }; },
      release: () => {},
    }),
  }),
}));
vi.mock("../src/lib/rateLimit", async (orig) => ({ ...(await orig<typeof import("../src/lib/rateLimit")>()), rateLimit: () => (_q: unknown, _s: unknown, n: () => void) => n() }));

const пара = crypto.generateKeyPairSync("ed25519");
const ЗАКРЫТЫЙ = пара.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const было = process.env.BUREAU_NOTARY_SIGNING_KEY;
const админ = () => "Bearer " + jwt.sign({ email: "admin@aevion.app", role: "admin" }, process.env.AUTH_JWT_SECRET as string, { algorithm: "HS256" });

async function приложение() {
  const { bureauRouter } = await import("../src/routes/bureau");
  const app = express();
  app.use(express.json());
  app.use("/api/bureau", bureauRouter);
  return app;
}

beforeEach(() => { журналЗапросов.length = 0; транзакция.length = 0; });
afterAll(() => { if (было === undefined) delete process.env.BUREAU_NOTARY_SIGNING_KEY; else process.env.BUREAU_NOTARY_SIGNING_KEY = было; });

describe("пере-нотаризация живым ключом", () => {
  it("без админа — 403, ничего не пишется", async () => {
    process.env.BUREAU_NOTARY_SIGNING_KEY = ЗАКРЫТЫЙ;
    const r = await request(await приложение()).post("/api/bureau/admin/renotarize");
    expect(r.status).toBe(403);
    expect(транзакция.length).toBe(0);
  });

  it("dry=1 — знаменатель без записи", async () => {
    process.env.BUREAU_NOTARY_SIGNING_KEY = ЗАКРЫТЫЙ;
    const r = await request(await приложение()).post("/api/bureau/admin/renotarize?dry=1").set("Authorization", админ());
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.всего).toBe(1);
    expect(r.body.переподписано).toBe(0);
    expect(r.body.сертификаты).toEqual(["cert-13cd6ccef0abbc1d"]);
    // знаменатель для продаж: сколько сертификатов и как распределены привязанные подписи
    expect(r.body.сертификатовВсего).toBe(11);
    expect(r.body.разрезПодписей).toEqual([{ status: "signed", algorithm: "demo-hmac-sha256", n: 1 }]);
    expect(транзакция.length).toBe(0);
  });

  it("ключ спит — отказ словами, ничего не пишется", async () => {
    delete process.env.BUREAU_NOTARY_SIGNING_KEY;
    const r = await request(await приложение()).post("/api/bureau/admin/renotarize").set("Authorization", админ());
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(false);
    expect(r.body.переподписано).toBe(0);
    expect(транзакция.length).toBe(0);
  });

  it("🔴 живой ключ: новая запись ed25519 с тем же payload, указатель сертификата на неё, старая запись не тронута", async () => {
    process.env.BUREAU_NOTARY_SIGNING_KEY = ЗАКРЫТЫЙ;
    const r = await request(await приложение()).post("/api/bureau/admin/renotarize").set("Authorization", админ());
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.всего).toBe(1);
    expect(r.body.переподписано).toBe(1);
    const вставка = транзакция.find((q) => /INSERT INTO "BureauNotarySignature"/.test(q.sql));
    expect(вставка, "новая запись подписи вставлена").toBeTruthy();
    const [newId, notaryId, certId, , signature, , algorithm] = вставка!.params as string[];
    expect(notaryId).toBe("notary-1");
    expect(certId).toBe("cert-13cd6ccef0abbc1d");
    expect(algorithm).toBe("ed25519");
    // подпись настоящая: сходится с открытым ключом на том же payload, что у живой нотаризации
    const ок = crypto.verify(null, Buffer.from("cert-13cd6ccef0abbc1d:abc123"), пара.publicKey, Buffer.from(signature, "base64"));
    expect(ок, "подпись не сходится с открытым ключом").toBe(true);
    const указатель = транзакция.find((q) => /UPDATE "IPCertificate" SET "notarySignatureId"/.test(q.sql));
    expect(указатель, "указатель сертификата переведён").toBeTruthy();
    expect(указатель!.params).toEqual([newId, "cert-13cd6ccef0abbc1d", "nsig-old1"]);
    // старая запись — история: ни одного UPDATE/DELETE по BureauNotarySignature
    expect(транзакция.some((q) => /(UPDATE|DELETE)[\s\S]*"BureauNotarySignature"/.test(q.sql))).toBe(false);
    expect(r.body.сертификаты[0].старая).toBe("nsig-old1");
    expect(r.body.сертификаты[0].новая).toBe(newId);
  });
});
