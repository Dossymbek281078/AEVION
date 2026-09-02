import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Бесплатный тариф отдаёт пять распознаваний речи в месяц — и шестое обязано
 * упереться в потолок.
 *
 * Замер 02.09.2026: у ПЯТИ платных ручек не было НИ ОДНОГО из четырёх
 * признаков — ни авторизации, ни опознания, ни квоты, ни списания. Звук,
 * клонирование голоса и его предпрослушка, распознавание речи, перевод.
 * Анонимный вызов платного поставщика, ограниченный только частотой: при
 * 30 в минуту это 43 200 вызовов в сутки с одного адреса.
 *
 * Сторож в devhubSpendAccountingRatchet проверяет, что проверка кредита СТОИТ
 * в обработчике. Он не проверяет, что она СРАБАТЫВАЕТ: оставь вызов и выкрути
 * лимит — сторож промолчит. Здесь проверяется следствие.
 *
 * Денег не тратит: и база, и поставщик подменены.
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
 * Каждому запросу свой адрес: у ручки стоит предел частоты, и поток из одного
 * процесса упёрся бы в него раньше месячной нормы — тест краснел бы по
 * неверной причине, а причина в отчёте выглядела бы правдоподобно.
 */
let ip = 0;
function makeApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use((req, _res, next) => {
    ip += 1;
    req.headers["x-forwarded-for"] = `10.7.${Math.floor(ip / 250) % 250}.${(ip % 250) + 1}`;
    next();
  });
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}

const okStt = {
  ok: true,
  status: 200,
  json: async () => ({ text: "привет", language_code: "ru", language_probability: 0.99 }),
  text: async () => "",
};

const телоЗапроса = { audioBase64: "aGVsbG8gd29ybGQ=", mimeType: "audio/mpeg" };

describe("месячная норма распознавания речи действительно останавливает", () => {
  const realFetch = global.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetDevHubStore();
    process.env.ELEVENLABS_API_KEY = "fake-for-test";
    fetchMock = vi.fn().mockResolvedValue(okStt);
    global.fetch = fetchMock as never;
  });

  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.ELEVENLABS_API_KEY;
  });

  test("пять проходят, шестое отвечает 402 с честными числами", async () => {
    const app = makeApp();

    for (let i = 0; i < 5; i++) {
      const r = await request(app).post("/api/devhub/media/stt").send(телоЗапроса);
      // Контроль прибора: без него дальше проверялся бы не потолок, а поломка
      // стенда, и красный цвет означал бы совсем другое.
      expect(r.status, `распознавание ${i + 1} не прошло: ${JSON.stringify(r.body).slice(0, 140)}`).toBe(200);
    }

    const шестое = await request(app).post("/api/devhub/media/stt").send(телоЗапроса);
    expect(шестое.status, "шестое распознавание прошло — норма не держит").toBe(402);
    expect(шестое.body.limit).toBe(5);
    expect(шестое.body.used).toBe(5);
  });

  test("отказ поставщика не съедает норму", async () => {
    // Иначе человек платит нормой за нашу неудачу: расшифровки нет, а
    // счётчик вырос. Списание стоит ПОСЛЕ успешного ответа именно поэтому.
    const app = makeApp();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "boom", json: async () => ({}) });
    const упало = await request(app).post("/api/devhub/media/stt").send(телоЗапроса);
    expect(упало.status, "ожидался отказ поставщика").not.toBe(200);

    fetchMock.mockResolvedValue(okStt);
    for (let i = 0; i < 5; i++) {
      const r = await request(app).post("/api/devhub/media/stt").send(телоЗапроса);
      expect(r.status, `после отказа поставщика распознавание ${i + 1} должно проходить`).toBe(200);
    }
  });

  test("неверный запрос не съедает норму: проверка тела идёт раньше кредита", async () => {
    // Порядок важен: квота, потраченная на отказ 400, — это норма, съеденная
    // опечаткой в клиенте.
    const app = makeApp();
    for (let i = 0; i < 8; i++) {
      const r = await request(app).post("/api/devhub/media/stt").send({});
      expect(r.status, "пустое тело должно давать 400").toBe(400);
    }
    const после = await request(app).post("/api/devhub/media/stt").send(телоЗапроса);
    expect(после.status, "восемь отказов 400 съели месячную норму").toBe(200);
  });
});
