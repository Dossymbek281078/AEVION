/**
 * /api/qgood/health обязан отвечать о ТОЙ базе, которой пользуются ручки.
 *
 * 21.08.2026 сторож запасного хранилища впервые за 86 замеров поднял тревогу:
 * «qgood НА ПАМЯТИ». Тревога оказалась ложной, но причина настоящая — health
 * читал isQGoodDbReady(), флаг из lib/ensureQGoodTables. Его ставит ровно одно
 * место модуля (психологическая часть), а десять основных ручек работают через
 * локальную ensureTables() и флага не трогают. То есть при исправной базе
 * health честно отвечал «memory».
 *
 * Ложная тревога в стороже дороже молчания: к ней привыкают и перестают
 * читать — поэтому проверяем не «есть поле», а «поле получено из базы».
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const query = vi.fn();
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query }) }));

import { qgoodRouter } from "../src/routes/qgood";

const app = express();
app.use(express.json());
app.use("/api/qgood", qgoodRouter);

beforeEach(() => { query.mockReset(); });

describe("qgood /health — состояние настоящей базы", () => {
  test("база отвечает -> postgres, и запрос действительно был", async () => {
    query.mockResolvedValue({ rows: [{ "?column?": 1 }] });

    const r = await request(app).get("/api/qgood/health");

    expect(r.status).toBe(200);
    expect(r.body.db).toBe("postgres");
    // Без этой проверки тест зеленел бы и на зашитой строке "postgres".
    expect(query, "health не спросил базу вовсе").toHaveBeenCalled();
  });

  test("база не отвечает -> memory, а не падение", async () => {
    query.mockRejectedValue(new Error("connection refused"));

    const r = await request(app).get("/api/qgood/health");

    expect(r.status).toBe(200);
    expect(r.body.db).toBe("memory");
  });
});
