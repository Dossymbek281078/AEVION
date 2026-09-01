// Заверение платформы — единственный слой, чей ключ проверяющий берёт НЕ из
// сертификата. Пакет его везёт, но третья сторона (суд, площадка,
// работодатель) открывает СНАЧАЛА страницу проверки, а она берёт данные из
// этой ручки. Поле, не дошедшее сюда, для неё не существует.
import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

let rows: Array<Record<string, unknown>> = [];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string) =>
      String(sql).includes('FROM "IPCertificate"') ? { rows } : { rows: [] },
    ),
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

const base = {
  id: "cert-x",
  title: "Работа",
  contentHash: "a".repeat(64),
  signatureHmac: "b".repeat(64),
  signatureEd25519: "c".repeat(128),
  algorithm: "SHA-256 + HMAC + Ed25519",
  status: "active",
};

beforeEach(() => {
  rows = [];
});

describe("ручка проверки отдаёт заверение платформы", () => {
  test("заверение есть — доезжает целиком", async () => {
    rows = [
      { ...base, platformAttestationKid: "qsign-ed25519-v1", platformAttestationSig: "d".repeat(128) },
    ];
    const r = await request(app()).get("/api/pipeline/verify/cert-x");
    expect(r.status).toBe(200);
    const pa = r.body?.certificate?.platformAttestation;
    expect(pa, "поле не дошло до страницы проверки").toBeTruthy();
    expect(pa.kid).toBe("qsign-ed25519-v1");
    // Подпись НЕ сокращается, в отличие от соседней: её проверяют, а не
    // разглядывают. Обрезанную проверить нельзя.
    expect(pa.signature).toBe("d".repeat(128));
  });

  test("заверения нет — честный null", async () => {
    rows = [{ ...base }];
    const r = await request(app()).get("/api/pipeline/verify/cert-x");
    expect(r.status).toBe(200);
    expect(r.body?.certificate?.platformAttestation).toBeNull();
  });
});
