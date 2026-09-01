import { describe, test, expect, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * «Скоро будет» о том, чего не будет.
 *
 * Ручка доказательства решала по НАЛИЧИЮ ФАЙЛА:
 *
 *   if (!proof) -> 404 { reason: "OT_PROOF_PENDING" }
 *
 * PENDING значит «готовится». Но апрельские сертификаты выданы ДО появления
 * якорения в биткойн: доказательства у них нет и не будет никогда. Третьей
 * стороне — суду, работодателю, площадке, — которая проверяет такой
 * сертификат, мы отвечали «скоро».
 *
 * Замер на проде 28.08.2026:
 *   GET /api/pipeline/ots/cert-2bc929b3eec31e53/proof
 *   -> 404 {"error":"proof not ready","reason":"OT_PROOF_PENDING"}
 *
 * Различение уже существовало в ДВУХ соседних ручках того же файла (проверка и
 * дообновление отдают `status: otsStatus ?? "not_stamped"`); эта просто не
 * спрашивала колонку в SELECT.
 *
 * Проверяются все три ветви, а не одна: «не начинали», «идёт», «сорвалось».
 * Починка одной ветви класса выглядит как починка класса и потому опаснее
 * отсутствия починки.
 */

let certRow: Record<string, unknown> = {};

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string) => {
      if (String(sql).includes('FROM "IPCertificate" WHERE "id" = $1')) {
        return { rows: certRow === null ? [] : [certRow] };
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

const CERT = "cert-test-000000000000ots";

describe("ручка доказательства объясняет, ПОЧЕМУ доказательства нет", () => {
  test("сертификат до появления якорения: не «скоро», а «не будет»", async () => {
    certRow = { otsProof: null, contentHash: "a".repeat(64), otsStatus: null };
    const r = await request(app()).get(`/api/pipeline/ots/${CERT}/proof`);
    expect(r.status).toBe(404);
    expect(r.body.reason).toBe("OT_NOT_STAMPED");
    expect(r.body.status).toBe("not_stamped");
    // Формулировка обязана отрицать будущее, иначе она читается как «подождите».
    expect(String(r.body.note)).toMatch(/no proof will become available/);
    expect(String(r.body.note)).not.toMatch(/in progress/);
  });

  test("якорение идёт: PENDING остаётся правдой", async () => {
    certRow = { otsProof: null, contentHash: "a".repeat(64), otsStatus: "pending" };
    const r = await request(app()).get(`/api/pipeline/ots/${CERT}/proof`);
    expect(r.status).toBe(404);
    expect(r.body.reason).toBe("OT_PROOF_PENDING");
    expect(r.body.status).toBe("pending");
    expect(String(r.body.note)).toMatch(/in progress/);
  });

  test("якорение сорвалось: это третий ответ, а не «идёт»", async () => {
    certRow = { otsProof: null, contentHash: "a".repeat(64), otsStatus: "failed" };
    const r = await request(app()).get(`/api/pipeline/ots/${CERT}/proof`);
    expect(r.status).toBe(404);
    expect(r.body.reason).toBe("OT_STAMP_FAILED");
    expect(r.body.status).toBe("failed");
    expect(String(r.body.note)).not.toMatch(/in progress/);
  });

  test("три ветви дают три РАЗНЫХ ответа", async () => {
    const seen = new Set<string>();
    for (const s of [null, "pending", "failed"]) {
      certRow = { otsProof: null, contentHash: "a".repeat(64), otsStatus: s };
      const r = await request(app()).get(`/api/pipeline/ots/${CERT}/proof`);
      seen.add(`${r.body.reason}|${r.body.note}`);
    }
    expect(seen.size).toBe(3);
  });

  test("ручка проверки тоже называет причину, а не только «missing»", async () => {
    certRow = { otsProof: null, contentHash: "a".repeat(64), otsStatus: null };
    const r = await request(app()).post(`/api/pipeline/ots/${CERT}/verify`);
    expect(r.status).toBe(409);
    expect(r.body.status).toBe("not_stamped");
    expect(String(r.body.note)).toMatch(/no proof will become available/);
  });
});
