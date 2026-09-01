// Подпись Ed25519 в пакете самосогласована: и подпись, и ключ к ней приезжают
// в ОДНОМ файле. Значит посторонний соберёт такой пакет своей парой ключей, а
// проверяющий офлайн не отличит его от нашего.
//
// Заверение эфемерного ключа ПОСТОЯННЫМ ключом платформы это замыкает: kid
// указывает на ключ, который берётся независимо, с /api/qsign/v2/keys.
//
// Здесь проверяется, что заверение доезжает до пакета и что его отсутствие
// показывается ЧЕСТНЫМ null, а не молчанием: сертификаты, выпущенные до этой
// правки, заверения не имеют, и выдать это за «всё в порядке» нельзя.
import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

let rows: Array<Record<string, unknown>> = [];
let seenSql: string[] = [];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string) => {
      seenSql.push(String(sql));
      if (String(sql).includes('FROM "IPCertificate"')) return { rows };
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

function cert(extra: Record<string, unknown> = {}) {
  return {
    id: "cert-test",
    title: "Работа",
    description: "Описание",
    kind: "text",
    contentHash: "a".repeat(64),
    signatureEd25519: "b".repeat(128),
    publicKeyEd25519: "302a300506032b6570032100" + "c".repeat(64),
    signedAt: new Date("2026-08-29T00:00:00Z"),
    ...extra,
  };
}

beforeEach(() => {
  seenSql = [];
});

describe("пакет везёт заверение платформы", () => {
  test("заверение есть — доезжает вместе с kid", async () => {
    rows = [
      cert({
        platformAttestationKid: "qsign-ed25519-v1",
        platformAttestationSig: "d".repeat(128),
      }),
    ];
    const r = await request(app()).get("/api/pipeline/certificate/cert-test/bundle.json");
    expect(r.status).toBe(200);
    const pa = r.body?.proofs?.platformAttestation;
    expect(pa, "заверение не доехало до пакета").toBeTruthy();
    expect(pa.kid).toBe("qsign-ed25519-v1");
    expect(pa.signature).toBe("d".repeat(128));
    // Проверяющему надо сказать, ГДЕ взять открытый ключ независимо, иначе
    // поле бесполезно: он снова поверит содержимому пакета.
    expect(String(pa.note)).toMatch(/qsign\/v2\/keys/);
  });

  test("заверения нет — честный null, а не пропущенное поле", async () => {
    rows = [cert()];
    const r = await request(app()).get("/api/pipeline/certificate/cert-test/bundle.json");
    expect(r.status).toBe(200);
    expect(
      "platformAttestation" in (r.body?.proofs ?? {}),
      "поле пропало вовсе: «нет заверения» и «мы про него не знаем» стали неразличимы",
    ).toBe(true);
    expect(r.body.proofs.platformAttestation).toBeNull();
  });

  test("половина заверения — это НЕ заверение", async () => {
    // Подпись без kid непроверяема: неизвестно, чьим ключом сверять.
    rows = [cert({ platformAttestationSig: "d".repeat(128) })];
    const r = await request(app()).get("/api/pipeline/certificate/cert-test/bundle.json");
    expect(r.body.proofs.platformAttestation).toBeNull();
  });
});
