import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Бесплатный тариф отдаёт 10 картинок в месяц — и одиннадцатую не отдаёт.
 *
 * Замер 29.08.2026: поведенческие проверки предела есть у озвучки, музыки и
 * публикации, а у КАРТИНКИ и ВИДЕО их нет. Непоследовательность внутри одного
 * набора — почти всегда недосмотр, а не решение: возможности платные, и если
 * учёт молча перестанет считать, мы узнаем об этом по счёту от поставщика.
 *
 * Структурный сторож (limitCheckedBeforeSpending) проверяет, что проверка
 * СТОИТ перед тратой. Он не проверяет, что она СРАБАТЫВАЕТ.
 */
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  // В памяти: тест про учёт, а не про хранилище.
  isDevHubDbReady: () => false,
}));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";

/**
 * Каждому запросу свой адрес: у платных ручек стоит предел частоты по адресу,
 * и двенадцать запросов подряд из одного процесса упёрлись бы в него, а не в
 * месячную норму — тест краснел бы по неверной причине.
 */
let ip = 0;
function makeApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use((req, _res, next) => {
    ip += 1;
    req.headers["x-forwarded-for"] = `10.9.${Math.floor(ip / 250) % 250}.${(ip % 250) + 1}`;
    next();
  });
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}

const okImage = {
  ok: true,
  status: 200,
  json: async () => ({ data: [{ url: "https://example.invalid/i.png" }] }),
  text: async () => "",
};

describe("месячная норма картинок действительно останавливает трату", () => {
  const realFetch = global.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetDevHubStore();
    process.env.OPENAI_API_KEY = "fake-for-test";
    fetchMock = vi.fn().mockResolvedValue(okImage);
    global.fetch = fetchMock as never;
  });

  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.OPENAI_API_KEY;
  });

  test("десять проходят, одиннадцатая отвечает 402 с честными числами", async () => {
    const app = makeApp();

    for (let i = 0; i < 10; i++) {
      const r = await request(app).post("/api/devhub/media/image").send({ prompt: "круг" });
      // Контроль прибора: если провайдер не отвечает как надо, дальше
      // проверялся бы не предел, а поломка стенда.
      expect(r.status, `картинка ${i + 1} не прошла: ${JSON.stringify(r.body).slice(0, 120)}`).toBe(200);
    }

    const eleventh = await request(app).post("/api/devhub/media/image").send({ prompt: "круг" });
    expect(eleventh.status, "одиннадцатая картинка прошла — норма не держит").toBe(402);
    expect(eleventh.body.limit).toBe(10);
    expect(eleventh.body.used).toBe(10);
    expect(eleventh.body.error).toMatch(/image limit/i);
  });

  test("отказ провайдера не съедает норму", async () => {
    // Иначе человек платит нормой за нашу неудачу: провайдер не ответил,
    // картинки нет, а счётчик вырос.
    const app = makeApp();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "boom", json: async () => ({}) });
    const failed = await request(app).post("/api/devhub/media/image").send({ prompt: "круг" });
    expect(failed.status, "ожидался отказ провайдера").not.toBe(200);

    fetchMock.mockResolvedValue(okImage);
    const after = await request(app).post("/api/devhub/media/image").send({ prompt: "круг" });
    expect(after.status).toBe(200);
    expect(after.body.used ?? 1, "неудача провайдера списала норму").toBeLessThanOrEqual(1);
  });
});

/**
 * Видео: три в месяц на бесплатном тарифе.
 *
 * Генерация тут асинхронная — ручка ставит задачу у Replicate и возвращает её
 * идентификатор, а результат забирают опросом. Для нормы это неважно: расход
 * списывается при ПОСТАНОВКЕ задачи, и проверка кредита стоит до вызова
 * провайдера. Значит и проверять надо постановку, а не готовое видео.
 */
describe("месячная норма видео действительно останавливает трату", () => {
  const realFetch = global.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetDevHubStore();
    process.env.REPLICATE_API_TOKEN = "fake-for-test";
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: "pred_1", status: "starting" }),
      text: async () => "",
    });
    global.fetch = fetchMock as never;
  });

  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.REPLICATE_API_TOKEN;
  });

  test("три проходят, четвёртое отвечает 402", async () => {
    const app = makeApp();
    for (let i = 0; i < 3; i++) {
      const r = await request(app)
        .post("/api/devhub/media/video")
        .send({ prompt: "кот на подоконнике", model: "google/veo-3-fast" });
      // Контроль прибора: иначе дальше проверялся бы не предел, а поломка стенда.
      expect(r.status, `видео ${i + 1}: ${JSON.stringify(r.body).slice(0, 140)}`).toBe(200);
    }

    const fourth = await request(app)
      .post("/api/devhub/media/video")
      .send({ prompt: "кот на подоконнике", model: "google/veo-3-fast" });
    expect(fourth.status, "четвёртое видео прошло — норма не держит").toBe(402);
    expect(fourth.body.limit).toBe(3);
    expect(fourth.body.used).toBe(3);
  });
});
