/**
 * 🔴 19.10.2026 — бренд бюро на странице проверки (заявка Продаж, обещано письмами
 * WPK и Central Illustration Agency).
 *
 * Поле `partnerName` у записи — СПРАВОЧНОЕ: не входит ни в contentHash, ни в HMAC.
 * Иначе правка имени бюро ломала бы проверку (урок 19.10: поля QRight в contentHash).
 * Три порога заявки: (1) /verify отдаёт partner; (2) contentHash до и после — один и
 * тот же; (3) запись без партнёра выглядит как прежде (partner: null, valid: true).
 */
import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CERT_ID = "cert-test-partner-0000000001";
type Row = Record<string, unknown>;
let certRow: Row = {};
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string) => {
      const q = String(sql);
      if (q.includes('SELECT * FROM "IPCertificate"')) return { rows: [certRow] };
      if (q.includes('FROM "QuantumShield"')) {
        return { rows: [{ status: "active", legacy: false, distribution_policy: "distributed_v2" }] };
      }
      return { rows: [] };
    }),
  }),
}));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));
process.env.QSIGN_SECRET = process.env.QSIGN_SECRET || "test-secret-for-partner-brand";

import { pipelineRouter } from "../src/routes/pipeline";
import { canonicalContentHash } from "../src/lib/contentHash";

const app = () => { const a = express(); a.use(express.json()); a.use("/api/pipeline", pipelineRouter); return a; };
const FIELDS = { title: "Товарный знак «Ак Жол»", description: "словесный знак, заявка бюро", kind: "trademark", country: "KZ", city: "Астана" };
function makeRow(extra: Row): Row {
  return {
    id: CERT_ID, objectId: "obj-p1", ...FIELDS, authorName: "ТОО «Ромашка»", authorEmail: "a@example.com",
    contentHash: canonicalContentHash(FIELDS), fileHash: null, signatureHmac: "0".repeat(64), signatureEd25519: "1".repeat(128),
    algorithm: "SHA-256 + HMAC-SHA256 + Ed25519", protectedAt: "2026-10-19T00:00:00.000Z", signedAt: null, qsignKeyVersion: 1,
    status: "active", shieldId: "qs-p1", shardCount: 3, shardThreshold: 2, verifiedCount: 0, legalBasis: {},
    otsProof: null, otsStatus: null, otsBitcoinBlockHeight: null, otsStampedAt: null,
    authorPublicKey: null, authorSignature: null, authorKeyAlgo: null, ...extra,
  };
}
const get = () => request(app()).get(`/api/pipeline/verify/${CERT_ID}`);
const SRC = readFileSync(join(__dirname, "..", "src", "routes", "pipeline.ts"), "utf8");

describe("бренд бюро на /verify — поле вне подписи (19.10.2026)", () => {
  beforeEach(() => { certRow = makeRow({}); });

  it("contentHash не зависит от partnerName — тот же хеш с полем и без", () => {
    const без = canonicalContentHash(FIELDS);
    const с = canonicalContentHash({ ...FIELDS, partnerName: "Консалтинг WPK" } as typeof FIELDS);
    expect(с).toBe(без);
    // контроль прибора: поле, которое ВХОДИТ в хеш, его меняет
    expect(canonicalContentHash({ ...FIELDS, title: FIELDS.title + "!" })).not.toBe(без);
  });

  it("/verify отдаёт partner, и запись остаётся valid", async () => {
    certRow = makeRow({ partnerName: "Консалтинг WPK" });
    const r = await get();
    expect(r.status, JSON.stringify(r.body).slice(0, 200)).toBe(200);
    expect(r.body.valid).toBe(true);
    expect(r.body.integrity?.contentHashValid).toBe(true);
    expect(r.body.certificate?.partner).toBe("Консалтинг WPK");
  });

  it("без партнёра — partner: null, ответ как прежде (valid, hash цел)", async () => {
    const r = await get();
    expect(r.status).toBe(200);
    expect(r.body.valid).toBe(true);
    expect(r.body.certificate?.partner).toBeNull();
    certRow = makeRow({ partnerName: "   " });
    const r2 = await get();
    expect(r2.body.certificate?.partner, "пробелы — это «нет партнёра»").toBeNull();
  });

  it("protectOne принимает partnerName строкой ≤ 80 и пишет его в свою колонку, не в хеш", () => {
    expect(SRC).toContain('ADD COLUMN IF NOT EXISTS "partnerName" TEXT');
    expect(SRC).toMatch(/INSERT INTO "IPCertificate" \([^)]*"partnerName"\)/);
    expect(SRC).toContain("partnerName.trim().slice(0, 80)");
    expect(SRC).toContain('throw new ProtectInputError("partnerName must be a string")');
    // хеш считается только из title/description/kind/country/city — partnerName туда не передаётся
    const i = SRC.indexOf("const contentHash = canonicalContentHash({");
    expect(i).toBeGreaterThan(0);
    expect(SRC.slice(i, i + 160)).not.toContain("partner");
  });
});
