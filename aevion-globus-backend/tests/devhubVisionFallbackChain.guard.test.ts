import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

// Скриншот в код: при ТРЁХ настроенных ключах зрения запасных не было ни
// одного. Код брал первого подходящего провайдера через find(), и если тот
// отвечал ошибкой, второй не пробовался — а панель показывала возможность
// живой. Три ключа означали «любой годится, чтобы включить», а не «три
// запасных на случай отказа»; разница видна только в аварии.
//
// ⚠️ Наличие цепочки НЕЛЬЗЯ проверять по числу catch: у соседней возможности
// перехваты есть, но пробуют они запасные МОДЕЛИ одного провайдера и только
// на текст ошибки «модель устарела». Отвалится провайдер целиком — не
// поможет. Поэтому здесь считаются ВЫЗОВЫ разных провайдеров.

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn() }) }));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
  getDevHubDbError: () => null,
}));

const { calls } = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("../src/services/qcoreai/providers", () => ({
  getProviders: () => [
    { id: "anthropic", name: "A", models: [], defaultModel: "m1", envKey: "ANTHROPIC_API_KEY", configured: true },
    { id: "gemini", name: "G", models: [], defaultModel: "m2", envKey: "GEMINI_API_KEY", configured: true },
    { id: "openai", name: "O", models: [], defaultModel: "m3", envKey: "OPENAI_API_KEY", configured: true },
  ],
  callProvider: async (id: string) => {
    calls.push(id);
    if (id !== "openai") throw new Error(id + " недоступен");
    return { reply: JSON.stringify({ files: [{ path: "src/App.jsx", content: "x", language: "javascript" }] }), model: "m3", usage: {} };
  },
}));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";

function makeApp() {
  const a = express();
  a.use(express.json({ limit: "5mb" }));
  a.use("/api/devhub", devhubRouter);
  return a;
}

describe("скриншот в код: отказ провайдера не роняет возможность", () => {
  beforeEach(() => { calls.length = 0; __resetDevHubStore?.(); });

  test("после отказа первого зрячего пробуется следующий", async () => {
    // Картинка передаётся ОДНИМ полем imageBase64, а не массивом: первая
    // редакция теста послала массив, ручка его проигнорировала, и вызов был
    // один. Выглядело как «цепочка не работает» — а не работал тест.
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "V" });
    const r = await request(app)
      .post(`/api/devhub/projects/${cr.body.project.id}/generate`)
      .send({ prompt: "сделай кнопку", imageBase64: "eA==", imageMediaType: "image/png" });
    expect(r.status).toBe(200);
    // Считаем РАЗНЫХ провайдеров: два отказа и успех на третьем.
    expect(calls).toEqual(["anthropic", "gemini", "openai"]);
  });

  test("без картинки цепочка не задействуется — вызов один", async () => {
    // Контроль: без него перебор, включённый ВЕЗДЕ, прошёл бы первую проверку
    // и молча жёг деньги на лишних вызовах там, где запасной не нужен.
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "V2" });
    await request(app)
      .post(`/api/devhub/projects/${cr.body.project.id}/generate`)
      .send({ prompt: "сделай кнопку" });
    expect(calls).toHaveLength(1);
  });
});
