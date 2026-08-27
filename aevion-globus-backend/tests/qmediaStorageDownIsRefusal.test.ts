import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/**
 * База настроена и УПАЛА: отказ надо назвать отказом.
 *
 * Пустой список треков читается как «я ничего не загружал», а 201 — как
 * «загружено». Оба ответа выглядят законно и потому незаметны: человек либо
 * загрузит всё заново, либо будет считать сохранённым то, чего нет.
 *
 * Признак `storage: "memory"` здесь неуместен: он верен там, где базы НЕТ
 * ВОВСЕ и память и есть хранилище. Когда база есть и упала, память — ловушка.
 */

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql?: string) => {
      const head = String(sql ?? "").trimStart().toUpperCase();
      if (head.startsWith("CREATE") || head.startsWith("ALTER")) return { rows: [], rowCount: 0 };
      throw new Error("storage unreachable");
    },
  }),
  isDbConfigured: () => true,
}));
vi.mock("../src/lib/ensureQMediaTables", () => ({
  ensureQMediaTables: async () => {},
  isQMediaDbReady: () => true,
  getQMediaDbError: () => null,
}));

import { qmediaRouter } from "../src/routes/qmedia";

const TOKEN = jwt.sign({ sub: "author-1" }, "dev-auth-secret", { algorithm: "HS256", expiresIn: "1h" });

function app() {
  const a = express();
  a.use(express.json());
  a.use("/x", qmediaRouter);
  return a;
}

describe("отказ хранилища QMedia — отказ, а не пустота", () => {
  test("публичный список: 503, а не пустой список", async () => {
    const res = await request(app()).get("/x/tracks");
    expect(res.status, `ответил ${res.status}`).toBe(503);
    expect(res.body.items, "пустой список выдан за настоящий ответ").toBeUndefined();
  });

  test("мои треки: 503, а не «вы ничего не загружали»", async () => {
    const res = await request(app()).get("/x/me/tracks").set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(503);
    expect(res.body.items).toBeUndefined();
  });

  test("загрузка трека: 503, а не 201 о том, чего нет", async () => {
    const res = await request(app())
      .post("/x/me/tracks")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ title: "Пропадёт" });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("storage_unavailable");
  });

  test("контроль: отказ приходит от ХРАНИЛИЩА, а не от разбора запроса", async () => {
    // Без обязательного поля ответ обязан остаться 400: иначе «503 на всё»
    // выглядело бы работающей проверкой, ничего не проверяя.
    const res = await request(app())
      .post("/x/me/tracks")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ artist: "без названия" });
    expect(res.status).toBe(400);
  });

  test("производные выборки тоже не выдают пустоту за ответ", async () => {
    const res = await request(app()).get("/x/trending");
    expect(res.status).toBe(503);
  });
});
