// Сертификаты выпускаются даже когда постоянный ключ платформы недоступен —
// это сделано намеренно, чтобы отсутствие настройки не ломало выдачу. Но
// тогда узнать о проблеме иначе было бы НЕЧЕМ: пакет выходит без заверения, и
// это откроется, только когда кто-нибудь его проверит.
//
// Поэтому состояние ключа видно снаружи одной командой.
import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

let keyThrows = false;

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: vi.fn(async () => ({ rows: [] })) }),
}));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));
vi.mock("../src/lib/qsignV2/keyRegistry", () => ({
  resolveEd25519: vi.fn(async () => {
    if (keyThrows) throw new Error("env seed missing");
    return { kid: "qsign-ed25519-v1", algo: "Ed25519", privateKey: {}, publicKeyHex: "ab" };
  }),
}));

// eslint-disable-next-line import/first
import { pipelineRouter } from "../src/routes/pipeline";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use("/api/pipeline", pipelineRouter);
  return a;
};

beforeEach(() => {
  keyThrows = false;
});

describe("состояние говорит, можно ли заверять сертификаты", () => {
  test("ключ разрешается — available", async () => {
    const r = await request(app()).get("/api/pipeline/health");
    // Код ответа здесь не про ключ: с пустым моком базы ручка честно отдаёт
    // 503 «хранилище недоступно». Проверяем поле, а не статус.
    expect([200, 503]).toContain(r.status);
    expect(r.body?.crypto?.platformAttestationKey).toBe("available");
  });

  test("семя не задано — unavailable, а не молчание", async () => {
    keyThrows = true;
    const r = await request(app()).get("/api/pipeline/health");
    expect([200, 503]).toContain(r.status);
    expect(
      r.body?.crypto?.platformAttestationKey,
      "отказ ключа не виден снаружи: сертификаты выходили бы без заверения незаметно",
    ).toBe("unavailable");
  });

  test("отказ ключа НЕ роняет состояние целиком", async () => {
    // Иначе проверка состояния сама станет источником аварии, а нам надо
    // ровно наоборот: она должна работать хуже всего именно тогда, когда
    // что-то не так.
    keyThrows = true;
    const r = await request(app()).get("/api/pipeline/health");
    // Тело обязано прийти целиком: отказ одного поля не отменяет остальных.
    expect([200, 503]).toContain(r.status);
    expect(r.body?.crypto?.hmacKeyVersion).toBeDefined();
  });
});
