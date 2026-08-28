import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import crypto from "node:crypto";

/**
 * «Публичный ключ опубликован, поэтому проверить подпись может кто угодно» —
 * так говорил тултип рядом с полем Ed25519 на странице проверки сертификата.
 *
 * Замер на проде 28.08.2026, GET /api/pipeline/verify/<certId>:
 *   signatureEd25519 — 67 символов, то есть ПЕРВЫЕ 64 плюс многоточие;
 *   publicKeyEd25519 — в ответе ОТСУТСТВУЕТ.
 *
 * По этим данным проверить нельзя ничего. Возможность при этом РЕАЛЬНА, но в
 * другом месте: полная подпись и публичный ключ лежат в офлайн-пакете, и
 * офлайн-проверка на сайте действительно сверяет их через WebCrypto.
 *
 * Поэтому здесь закрепляется не текст подписи под полем, а РАСПОЛОЖЕНИЕ
 * возможности: где обрезано, а где полно. Если однажды ручка проверки начнёт
 * отдавать подпись целиком и ключ — этот тест покраснеет и напомнит, что
 * подпись под полем («first 64 chars») пора поправить обратно.
 */

let certRow: Record<string, unknown> = {};

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string) => {
      const q = String(sql);
      if (q.includes('FROM "IPCertificate"')) return { rows: [certRow] };
      if (q.includes('FROM "QuantumShield"')) {
        return { rows: [{ status: "active", legacy: false, distribution_policy: "distributed_v2" }] };
      }
      return { rows: [] };
    }),
  }),
}));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));

// eslint-disable-next-line import/first
import { pipelineRouter } from "../src/routes/pipeline";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use("/api/pipeline", pipelineRouter);
  return a;
};

const CERT_ID = "cert-sig-0000000000000001";
const FULL_SIG = "a".repeat(128);

beforeEach(() => {
  const pub = crypto.generateKeyPairSync("ed25519").publicKey;
  const spkiHex = pub.export({ format: "der", type: "spki" }).toString("hex");
  certRow = {
    id: CERT_ID,
    objectId: "obj-1",
    shieldId: "qs-1",
    title: "Степной рассвет",
    kind: "photo",
    description: "фотография",
    authorName: null,
    country: "KZ",
    city: "Астана",
    contentHash: "b".repeat(64),
    fileHash: null,
    signatureHmac: "0".repeat(64),
    signatureEd25519: FULL_SIG,
    publicKeyEd25519: spkiHex,
    algorithm: "SHA-256 + HMAC-SHA256 + Ed25519",
    status: "active",
    protectedAt: new Date("2026-08-01T00:00:00Z"),
    signedAt: new Date("2026-08-01T00:00:10Z"),
    shardCount: 3,
    shardThreshold: 2,
    verifiedCount: 0,
    legalBasis: {},
    otsProof: null,
    otsStatus: null,
    otsBitcoinBlockHeight: null,
    otsStampedAt: null,
    authorPublicKey: null,
    authorSignature: null,
    authorKeyAlgo: null,
  };
});

describe("подпись проверяема там, где мы это обещаем", () => {
  test("ручка проверки отдаёт подпись ОБРЕЗАННОЙ и без публичного ключа", async () => {
    const r = await request(app()).get(`/api/pipeline/verify/${CERT_ID}`);
    expect(r.status).toBe(200);
    const c = r.body.certificate;
    expect(c.signatureEd25519, "подпись не обрезана — подпись поля «first 64 chars» устарела").not.toBe(FULL_SIG);
    expect(String(c.signatureEd25519)).toContain("...");
    expect(
      "publicKeyEd25519" in c,
      "ключ появился в ответе — значит проверка стала возможна прямо со страницы, поправьте подпись поля",
    ).toBe(false);
  });

  test("офлайн-пакет отдаёт подпись ЦЕЛИКОМ и публичный ключ", async () => {
    const r = await request(app()).get(`/api/pipeline/certificate/${CERT_ID}/bundle.json`);
    expect(r.status).toBe(200);
    const a = r.body?.proofs?.aevionEd25519;
    expect(a, "в пакете нет подписи AEVION — обещание «проверьте без нас» пусто").toBeTruthy();
    expect(a.signature, "подпись в пакете обрезана — проверить по ней нельзя").toBe(FULL_SIG);
    expect(String(a.publicKeyRawHex).length, "публичный ключ в пакете пуст").toBeGreaterThan(0);
    expect(String(a.signedPayload).length, "нет подписанного текста — сверять не с чем").toBeGreaterThan(0);
  });


  test("БЕЗ отметки времени подписи пакет отдаёт null — и это честно, но обещание на странице должно это учитывать", async () => {
    // Открытие 28.08.2026: подпись попадает в пакет только при наличии
    // signedAt, потому что подписанный текст восстанавливается байт в байт.
    // Замер на проде: у 5 записей из 7 отметки нет, и пакет приходит без
    // подписи AEVION. Офлайн-проверка ведёт себя честно («пропущено»), а вот
    // страница обещала «every proof» безусловно — это и было поправлено.
    certRow.signedAt = null;
    const r = await request(app()).get(`/api/pipeline/certificate/${CERT_ID}/bundle.json`);
    expect(r.status).toBe(200);
    expect(r.body.proofs.aevionEd25519, "поведение изменилось — проверьте оговорку на странице проверки").toBeNull();
  });


  test("в пакете лежит СЫРОЙ 32-байтовый ключ, а не SPKI-обёртка", async () => {
    // Офлайн-проверка ждёт ровно 32 байта и сама оборачивает их в SPKI.
    // Отдай мы DER, она упала бы с «expected 32-byte raw Ed25519».
    const r = await request(app()).get(`/api/pipeline/certificate/${CERT_ID}/bundle.json`);
    const hex = String(r.body.proofs.aevionEd25519.publicKeyRawHex);
    expect(hex.length, `ожидались 64 hex-символа (32 байта), пришло ${hex.length}`).toBe(64);
  });

  // ПОСЛЕДНИМ намеренно: он исчерпывает предел частоты, и стоя выше ронял бы
  // соседей — состояние ограничителя общее на весь модуль.
  test("у ручки пакета есть предел частоты — она стала публичной поверхностью", async () => {
    // Карточки предпросмотра ссылки спрашивают пакет при каждом построении.
    // Раньше его дёргали редко (по нажатию «скачать») и предела не было вовсе.
    // 241-й запрос в минуту обязан получить отказ, а не обслуживание.
    let last = 200;
    for (let i = 0; i < 245; i++) {
      const r = await request(app()).get(`/api/pipeline/certificate/${CERT_ID}/bundle.json`);
      last = r.status;
      if (last === 429) break;
    }
    expect(last, "предела нет: 245 запросов подряд прошли").toBe(429);
  }, 60000);
});
