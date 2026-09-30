import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Ручки пайплайна «книга → озвучка → фильм» обязаны НИЧЕГО НЕ ТРАТИТЬ, пока человек
 * не увидел цену и не согласился с ней.
 *
 * Замысел основателя 28.09: цену человек слышит сразу, дорогие шаги идут последними.
 * Здесь закреплены три вещи, каждая из которых стоила бы денег, если её упустить:
 *   1) ни один внешний вызов не уходит — ни к поставщику видео, ни к озвучке;
 *   2) без подтверждения заказ не переходит в работу;
 *   3) неготовый канал не превращается в «начнём, а там разберёмся»: у нас уже был
 *      случай, когда Replicate отвечал «no credit» на живом проде, и заказ, брошенный
 *      на середине, оставил бы человека с книгой без фильма.
 */
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: async () => { throw new Error("нет базы"); } }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));

// eslint-disable-next-line import/first
import { devhubRouter } from "../src/routes/devhub";

function приложение() {
  const app = express();
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}

const исходныйFetch = globalThis.fetch;
let внешниеВызовы: string[] = [];

beforeEach(() => {
  внешниеВызовы = [];
  globalThis.fetch = (async (u: unknown) => {
    внешниеВызовы.push(String(u));
    throw new Error("внешний вызов запрещён в этом тесте");
  }) as never;
  process.env.ELEVENLABS_API_KEY = "ключ-для-теста";
  process.env.REPLICATE_API_TOKEN = "ключ-для-теста";
});
afterEach(() => {
  globalThis.fetch = исходныйFetch;
});

describe("смета до заказа", () => {
  test("цена называется и ни одного внешнего вызова не уходит", async () => {
    const r = await request(приложение())
      .post("/api/devhub/pipeline/quote")
      .send({ знаковКниги: 20000, озвучка: true, секундВидео: 60 });
    expect(r.status).toBe(200);
    expect(r.body.смета.итогоДолларов).toBeGreaterThan(11);
    expect(r.body.смета.строки.map((s: { шаг: string }) => s.шаг)).toEqual(["книга", "озвучка", "фильм"]);
    expect(внешниеВызовы, "ручка сметы полезла наружу").toEqual([]);
  });

  test("пустой замысел — честный отказ, а не смета на ноль", async () => {
    const r = await request(приложение()).post("/api/devhub/pipeline/quote").send({});
    expect(r.status).toBe(400);
  });

  test("заведомо огромный заказ обрезается до предела, а не считается как есть", async () => {
    const r = await request(приложение())
      .post("/api/devhub/pipeline/quote")
      .send({ знаковКниги: 99999999, секундВидео: 99999 });
    expect(r.body.замысел.знаковКниги).toBeLessThanOrEqual(500000);
    expect(r.body.замысел.секундВидео).toBeLessThanOrEqual(600);
  });

  test("про остаток счёта поставщика отвечаем «не знаю», а не «готово»", async () => {
    const r = await request(приложение())
      .post("/api/devhub/pipeline/quote")
      .send({ знаковКниги: 1000, секундВидео: 10 });
    // ключ есть, но денег на счёте отсюда не видно — это третий исход
    expect(r.body.каналы.готово).toBeNull();
    expect(String(r.body.каналы.причина)).toContain("остаток");
  });
});

describe("заказ ждёт человека", () => {
  test("без подтверждения заказ НЕ уходит в работу", async () => {
    const r = await request(приложение())
      .post("/api/devhub/pipeline/order")
      .send({ знаковКниги: 20000, озвучка: true, секундВидео: 60 });
    expect(r.status).toBe(201);
    expect(r.body.заказ.состояние).toBe("ждёт подтверждения");
    expect(String(r.body.дальше)).toContain("подтвержд");
    expect(внешниеВызовы).toEqual([]);
  });

  test("подтверждённый заказ несёт цену, с которой человек согласился", async () => {
    const r = await request(приложение())
      .post("/api/devhub/pipeline/order")
      .send({ знаковКниги: 20000, озвучка: true, секундВидео: 0, подтверждаю: true });
    expect(r.body.заказ.состояние).toBe("подтверждён");
    expect(r.body.заказ.итогоДолларов).toBeCloseTo(r.body.смета.итогоДолларов, 4);
    expect(внешниеВызовы).toEqual([]);
  });

  test("канал не настроен — заказ встаёт, а не начинается наполовину", async () => {
    delete process.env.REPLICATE_API_TOKEN;
    const r = await request(приложение())
      .post("/api/devhub/pipeline/order")
      .send({ знаковКниги: 5000, секундВидео: 30, подтверждаю: true });
    expect(r.body.заказ.состояние).toBe("ждёт пополнения");
    expect(String(r.body.каналы.причина)).toContain("REPLICATE");
    expect(внешниеВызовы).toEqual([]);
  });
});
