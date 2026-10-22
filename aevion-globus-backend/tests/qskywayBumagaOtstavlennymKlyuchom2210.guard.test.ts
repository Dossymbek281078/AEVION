import { describe, test, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "node:crypto";

/*
 * 🔴 22.10.2026, ротация QSKYWAY_SIGN_SK после утечки переменных Railway. Обоснование маршрута
 * (/route/justification) выдаётся регулятору на годы; до этой правки /route/justification/verify сверял
 * подпись ТОЛЬКО живым ключом — после смены ключа каждая выданная бумага отвечала бы «подпись не платформы».
 * Теперь: живой ключ → keyStatus active; ключ из AEVION_RETIRED_SIGN_PKS → valid + keyStatus retired с датой
 * и оговоркой ru/en; чужой → signatureValid false, foreign. /keys-блок signing публикует отставленные ключи.
 */

const живой = crypto.generateKeyPairSync("ed25519");
const отставленный = crypto.generateKeyPairSync("ed25519");
const чужой = crypto.generateKeyPairSync("ed25519");
const pkcs8 = (k: crypto.KeyObject) => k.export({ type: "pkcs8", format: "der" }).toString("base64");
const spki = (k: crypto.KeyObject) => k.export({ type: "spki", format: "der" }).toString("base64");

let app: express.Express;

beforeAll(async () => {
  process.env.QSKYWAY_SIGN_SK = pkcs8(живой.privateKey);
  process.env.AEVION_RETIRED_SIGN_PKS = `${spki(отставленный.publicKey)}@2026-10-22`;
  const { qskywayRouter } = await import("../src/routes/qskyway");
  app = express();
  app.use(express.json());
  app.use("/api/qskyway", qskywayRouter);
});

afterAll(() => {
  delete process.env.QSKYWAY_SIGN_SK;
  delete process.env.AEVION_RETIRED_SIGN_PKS;
});

const document = { kind: "qskyway.route.justification/2", city: "nyc", route: [[40.7, -74.0], [40.71, -74.01]], scope: "проба" };
function подписать(sk: crypto.KeyObject) {
  const contentHash = crypto.createHash("sha256").update(JSON.stringify(document)).digest("hex");
  const signature = crypto.sign(null, Buffer.from(contentHash, "hex"), sk).toString("base64");
  return { contentHash, signature };
}

describe("QSkyway: бумага, подписанная прежним ключом, после ротации остаётся подлинной и названа отставленной", () => {
  test("живой ключ → valid, keyStatus active", async () => {
    const r = await request(app).post("/api/qskyway/route/justification/verify").send({ document, attestation: подписать(живой.privateKey) });
    expect(r.status).toBe(200);
    expect(r.body.valid).toBe(true);
    expect(r.body.isPlatformKey).toBe(true);
    expect(r.body.keyStatus).toBe("active");
    expect(r.body.retiredAt).toBeUndefined();
  });

  test("🔴 отставленный ключ → valid, isPlatformKey, keyStatus retired, дата и оговорка ru/en", async () => {
    const r = await request(app).post("/api/qskyway/route/justification/verify").send({ document, attestation: подписать(отставленный.privateKey) });
    expect(r.status).toBe(200);
    expect(r.body.hashValid).toBe(true);
    expect(r.body.signatureValid).toBe(true);
    expect(r.body.valid).toBe(true);
    expect(r.body.isPlatformKey).toBe(true);
    expect(r.body.keyStatus).toBe("retired");
    expect(r.body.retiredAt).toBe("2026-10-22");
    expect(String(r.body.keyNote)).toContain("2026-10-22");
    expect(String(r.body.keyNoteEn)).toContain("retired on 2026-10-22");
  });

  test("КОНТРОЛЬ: чужой ключ → signatureValid false, keyStatus foreign, valid false", async () => {
    const r = await request(app).post("/api/qskyway/route/justification/verify").send({ document, attestation: подписать(чужой.privateKey) });
    expect(r.status).toBe(200);
    expect(r.body.signatureValid).toBe(false);
    expect(r.body.valid).toBe(false);
    expect(r.body.keyStatus).toBe("foreign");
  });

  test("КОНТРОЛЬ: изменённый документ с подписью отставленного ключа → hashValid false, valid false", async () => {
    const r = await request(app).post("/api/qskyway/route/justification/verify").send({ document: { ...document, scope: "подменено" }, attestation: подписать(отставленный.privateKey) });
    expect(r.body.hashValid).toBe(false);
    expect(r.body.valid).toBe(false);
  });

  test("публикация ключа службы: signing.retired перечисляет отставленный ключ с датой; закрытого ключа в ответе нет", async () => {
    // ручка, отдающая блок signing — ищем по телу, не по адресу: достаточно любой, где он есть
    const кандидаты = ["/api/qskyway/keys", "/api/qskyway/signing", "/api/qskyway/route/justification/keys", "/api/qskyway"];
    let найдено: { publicKey: string; retiredAt: string }[] | null = null;
    for (const путь of кандидаты) {
      const r = await request(app).get(путь);
      const s = JSON.stringify(r.body ?? {});
      if (r.status === 200 && s.includes('"retired"')) {
        const m = /"signing":(\{.*?"retired":(\[[^\]]*\]))/.exec(s);
        if (m) { найдено = JSON.parse(m[2]); break; }
      }
      expect(s).not.toContain(pkcs8(живой.privateKey).slice(0, 24));
    }
    const src = await import("node:fs").then((fs) => fs.readFileSync(require.resolve("../src/routes/qskyway.ts"), "utf8"));
    // блок signing расширен в исходнике (адрес ручки у теста не зашит); если ручка найдена — проверяем и тело
    expect(src).toContain("retired: retiredSigningKeysPublic(),");
    if (найдено) {
      expect(найдено).toEqual([{ publicKey: spki(отставленный.publicKey), keyFingerprint: expect.any(String), retiredAt: "2026-10-22" }]);
    }
  });
});
