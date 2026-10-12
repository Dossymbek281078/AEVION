import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "node:crypto";

/**
 * 🔴 ПОДПИСЬ БЮРО ПРОВЕРЯЕТСЯ РУЧКОЙ — ТЕМ ЖЕ ПУТЁМ, ЧТО У ТРЕТЬЕЙ СТОРОНЫ.
 *
 * Замер 12.10.2026: открытый ключ платформы не публиковался нигде,
 * проверяльщика подписи нотариуса не было вовсе. Включить ключ значило
 * написать в сертификате «ed25519», которое не проверит никто. Теперь:
 * /notary-key отдаёт открытый ключ с опознавателем, /…/notarization/verify
 * сверяет подпись с ним, /health называет три режима (ed25519 / demo / сломан).
 *
 * Сторож делает настоящие GET к роутеру; база — заглушка, отвечающая на те же
 * SELECT, что и прод. Главная мутация — «подменили подпись → не сходится».
 */
const база = { contentHash: "abc123", signature: "", algorithm: "ed25519", keyId: "" as string | null, status: "signed" };
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql: string) => {
      if (/FROM "IPCertificate"/.test(sql)) return { rows: [{ notarySignatureId: "sig-1", contentHash: база.contentHash, title: "t" }], rowCount: 1 };
      if (/FROM "BureauNotarySignature"/.test(sql)) return { rows: [{ signature: база.signature, signatureAlgorithm: база.algorithm, keyId: база.keyId, status: база.status }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
    connect: async () => ({ query: async () => ({ rows: [], rowCount: 0 }), release: () => {} }),
  }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/rateLimit", async (orig) => ({ ...(await orig<typeof import("../src/lib/rateLimit")>()), rateLimit: () => (_q: unknown, _s: unknown, n: () => void) => n() }));

const пара = crypto.generateKeyPairSync("ed25519");
const ЗАКРЫТЫЙ = пара.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const было = process.env.BUREAU_NOTARY_SIGNING_KEY;

async function приложение() {
  vi.resetModules();
  const { bureauRouter } = await import("../src/routes/bureau");
  const app = express();
  app.use(express.json());
  app.use("/api/bureau", bureauRouter);
  return app;
}
function подписать(payload: string) {
  return crypto.sign(null, Buffer.from(payload, "utf8"), пара.privateKey).toString("base64");
}

beforeEach(() => {
  if (было === undefined) delete process.env.BUREAU_NOTARY_SIGNING_KEY; else process.env.BUREAU_NOTARY_SIGNING_KEY = было;
  база.signature = ""; база.algorithm = "ed25519"; база.keyId = null; база.status = "signed";
});

describe("открытый ключ и проверка подписи", () => {
  it("🔴 с ключом: /notary-key отдаёт открытый ключ и id, /health — ed25519", async () => {
    process.env.BUREAU_NOTARY_SIGNING_KEY = ЗАКРЫТЫЙ;
    const app = await приложение();
    const k = await request(app).get("/api/bureau/notary-key");
    expect(k.status).toBe(200);
    expect(k.body.mode).toBe("ed25519");
    expect(String(k.body.publicKeyPem)).toContain("BEGIN PUBLIC KEY");
    expect(String(k.body.keyId)).toMatch(/^[0-9a-f]{16}$/);
    const h = await request(app).get("/api/bureau/health");
    expect(h.body.notarySignature).toBe("ed25519");
  });

  it("🔴 настоящая подпись сходится; ПОДМЕНЁННАЯ — нет", async () => {
    process.env.BUREAU_NOTARY_SIGNING_KEY = ЗАКРЫТЫЙ;
    const app = await приложение();
    const { keyId } = (await request(app).get("/api/bureau/notary-key")).body;
    база.keyId = keyId;
    база.signature = подписать("cert-1:" + база.contentHash);
    const ок = await request(app).get("/api/bureau/cert/cert-1/notarization/verify");
    expect(ок.status).toBe(200);
    expect(ок.body.ok, JSON.stringify(ок.body)).toBe(true);
    // Подмена одного байта подписи — проверка обязана это увидеть.
    база.signature = подписать("cert-1:" + база.contentHash + "x");
    const плохо = await request(app).get("/api/bureau/cert/cert-1/notarization/verify");
    expect(плохо.body.ok).toBe(false);
    expect(String(плохо.body.reason)).toContain("не сходится");
  });

  it("🔴 демо-подпись проверку не проходит и названа своим именем", async () => {
    process.env.BUREAU_NOTARY_SIGNING_KEY = ЗАКРЫТЫЙ;
    база.algorithm = "demo-hmac-sha256"; база.signature = "deadbeef";
    const r = await request(await приложение()).get("/api/bureau/cert/cert-1/notarization/verify");
    expect(r.body.ok).toBe(false);
    expect(r.body.reason).toBe("demo-signature");
  });

  it("подпись другим ключом — key-mismatch, а не ложное «не сходится»", async () => {
    process.env.BUREAU_NOTARY_SIGNING_KEY = ЗАКРЫТЫЙ;
    база.keyId = "0000000000000000"; база.signature = подписать("cert-1:" + база.contentHash);
    const r = await request(await приложение()).get("/api/bureau/cert/cert-1/notarization/verify");
    expect(r.body.ok).toBe(false);
    expect(r.body.reason).toBe("key-mismatch");
  });

  it("🔴 без ключа — честный demo; негодный PEM — «сломан», не demo", async () => {
    delete process.env.BUREAU_NOTARY_SIGNING_KEY;
    let app = await приложение();
    expect((await request(app).get("/api/bureau/notary-key")).body.mode).toBe("demo");
    expect((await request(app).get("/api/bureau/health")).body.notarySignature).toBe("demo");
    process.env.BUREAU_NOTARY_SIGNING_KEY = "-----BEGIN PRIVATE KEY-----\nне ключ\n-----END PRIVATE KEY-----";
    app = await приложение();
    const h = await request(app).get("/api/bureau/health");
    expect(h.body.notarySignature, "негодный ключ спрятан под demo").toBe("сломан");
    const k = await request(app).get("/api/bureau/notary-key");
    expect(k.body.mode).toBe("сломан");
    expect(String(k.body.reason)).toBeTruthy();
  });
});
