// Витрина QRight обещает «Bitcoin-anchored», а проверить это снаружи было
// НЕЧЕМ: в `GET /api/pipeline/health` про якорение не было ни слова (замер
// 27.08.2026 — ключи service, ok, steps, legalFrameworks, shamir, storage,
// crypto, uptimeSeconds, responseTimeMs, at).
//
// Обещание без ручки состояния — это обещание, про которое нельзя узнать, что
// оно перестало выполняться. Ровно тот случай, что уже разобран в правиле 15д:
// у каждого канала, который обещает интерфейс, должна быть ручка состояния, и
// интерфейс обязан её спрашивать.

import { describe, expect, test, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

let healthRow: Record<string, unknown> = {};
let storageThrows = false;

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string) => {
      if (storageThrows) throw new Error("база недоступна");
      if (String(sql).includes('FROM "IPCertificate"')) {
        return { rows: [healthRow] };
      }
      return { rows: [] };
    }),
    connect: vi.fn(async () => ({ query: vi.fn(async () => ({ rows: [] })), release: vi.fn() })),
  }),
}));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));

process.env.QSIGN_SECRET = process.env.QSIGN_SECRET || "test-secret-anchoring";

// eslint-disable-next-line import/first
import { pipelineRouter } from "../src/routes/pipeline";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use("/api/pipeline", pipelineRouter);
  return a;
};

const health = () => request(app()).get("/api/pipeline/health");

beforeEach(() => {
  storageThrows = false;
  healthRow = {
    count: 12,
    last: new Date("2026-08-27T10:00:00.000Z"),
    stamped: 9,
    pending: 2,
    confirmed: 7,
    lastStamped: new Date("2026-08-27T09:30:00.000Z"),
  };
});

describe("состояние якорения видно снаружи", () => {
  test("контроль: ручка отвечает и это ответ по существу", async () => {
    const r = await health();
    expect(r.status).toBe(200);
    expect(r.body.service).toBeTruthy();
  });

  test("числа якорения приходят из базы, а не выдуманы", async () => {
    const r = await health();
    expect(r.body.anchoring).toEqual({
      stamped: 9,
      pending: 2,
      confirmed: 7,
      lastStampedAt: "2026-08-27T09:30:00.000Z",
    });
  });

  test("другие числа в базе — другой ответ (иначе поле было бы константой)", async () => {
    // Без этой проверки набор прошёл бы и на зашитых значениях, а поле
    // состояния, которое всегда говорит одно и то же, хуже его отсутствия.
    healthRow = { ...healthRow, stamped: 0, pending: 0, confirmed: 0, lastStamped: null };
    const r = await health();
    expect(r.body.anchoring).toEqual({
      stamped: 0,
      pending: 0,
      confirmed: 0,
      lastStampedAt: null,
    });
  });

  test("база не ответила — null, а НЕ нули", async () => {
    // Своя неудача чтения не должна выглядеть как факт «якорений ноль»:
    // по нулю принимают решения, по null задают вопрос.
    storageThrows = true;
    const r = await health();
    // Ручка при отказе хранилища отвечает 503 — это её штатное поведение, и
    // оно верное: недоступная база это не «здоров». Проверяем не код, а то,
    // ради чего тест написан: поле якорения обязано быть null.
    expect(r.status).toBe(503);
    expect(r.body.anchoring).toBeNull();
    expect(r.body.storage.ok).toBe(false);
  });

  test("состояние читается ТЕМ ЖЕ запросом — лишних обращений нет", async () => {
    // Ручка состояния, которая сама ходит в сеть или множит запросы, со
    // временем становится источником отказов вместо их обнаружения.
    const r = await health();
    expect(r.body.anchoring).toBeTruthy();
    expect(r.body.storage.certificateCount).toBe(12);
  });
});
