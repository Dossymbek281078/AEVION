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
  // ЛИЧНОСТЬ ЭТОГО ФАЙЛА. Без заголовка x-devhub-guest создание даёт
  // собственную метку (devhub.ts, 06.10.2026: безметочные проекты больше не
  // лежат в общем ящике "anonymous", откуда их удалял любой посторонний), и
  // следующий запрос без метки получал бы 404 на свой же проект. Тесты про
  // владение этим не занимаются — даём им одну устойчивую личность на файл.
  a.use((req, _res, next) => { req.headers["x-devhub-guest"] = "t-devhubvisionfallbackchain-guard"; next(); });
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
    // Порядок изменён 05.10: бесплатной ступени дешёвый поставщик идёт ПЕРВЫМ
    // (решение основателя по замеру цены). Важен не сам порядок, а что перебор
    // доходит до отвечающего — его и проверяем ниже отдельно.
    expect(calls).toEqual(["gemini", "anthropic", "openai"]);
  });

  test("картинка есть, зрячих провайдеров НЕТ — честный отказ, а не тихая потеря", async () => {
    // Граница, которая до 31.08.2026 не была покрыта ни одним из тридцати
    // тестов модуля. Поведение существовало и раньше; я его сохранил, меняя
    // выбор провайдера на перебор, но сохранил БЕЗ доказательства.
    //
    // Важно именно «не тихо»: молча выбросить картинку и сгенерировать код по
    // одному тексту — худший исход. Человек получил бы правдоподобный ответ,
    // не имеющий отношения к его скриншоту.
    vi.resetModules();
    vi.doMock("../src/services/qcoreai/providers", () => ({
      getProviders: () => [
        { id: "groq", name: "Groq", models: [], defaultModel: "m", envKey: "GROQ_API_KEY", configured: true },
      ],
      callProvider: async () => { throw new Error("не должен вызываться"); },
    }));
    const { devhubRouter: r2 } = await import("../src/routes/devhub");
    const a = express();
    a.use(express.json({ limit: "5mb" }));
    // Та же личность, что у приложения выше: без метки создание выдаёт свою, и
    // следующий запрос получил бы 404 вместо проверяемого отказа по зрению.
    a.use((req, _res, next) => { req.headers["x-devhub-guest"] = "t-devhubvisionfallbackchain-guard"; next(); });
    a.use("/api/devhub", r2);
    const cr = await request(a).post("/api/devhub/projects").send({ name: "V3" });
    const res = await request(a)
      .post(`/api/devhub/projects/${cr.body.project.id}/generate`)
      .send({ prompt: "сделай кнопку", imageBase64: "eA==", imageMediaType: "image/png" });
    // Отказ обязан НАЗЫВАТЬ причину: без имён переменных человек не поймёт,
    // что именно настроить.
    // Проверяем СЛЕДСТВИЕ, а не внутренний код ошибки: наружу уходит текст
    // без префикса NO_VISION_PROVIDER, и это правильно — префикс наш, а не
    // человека. Важно, что отказ ЯВНЫЙ и называет, чего не хватает.
    expect(res.body.error).toMatch(/attach-a-screenshot|скриншот/i);
  });

  test("без картинки запасные ТОЖЕ пробуются — отказ первого не роняет генерацию", async () => {
    /*
     * ПОВЕДЕНИЕ ИЗМЕНЕНО 05.10.2026 по решению основателя, и прежняя проверка
     * здесь утверждала обратное: «без картинки цепочка не задействуется — вызов
     * один». Тогда это было описанием границы правки 31.08 (цепочку завели
     * только для зрения), а не требованием.
     *
     * Почему изменили: бесплатным ступеням генерация теперь идёт через дешёвого
     * поставщика первым (замер: $0.002331 против $0.069880 за прогон, в 30 раз).
     * Без цепочки отказ дешёвого означал бы отказ ЧЕЛОВЕКУ там, где раньше
     * работал дорогой. Экономия не имеет права превращаться в отказ.
     *
     * Опасение автора прежней проверки — «перебор, включённый везде, молча жжёт
     * деньги на лишних вызовах» — остаётся в силе и проверяется НИЖЕ: при успехе
     * первого поставщика второго вызова нет. Перебор идёт только после отказа.
     */
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "V2" });
    await request(app)
      .post(`/api/devhub/projects/${cr.body.project.id}/generate`)
      .send({ prompt: "сделай кнопку" });
    // В этом моке отвечает только openai, остальные бросают — значит перебор
    // обязан дойти до него, а не остановиться на первом отказе.
    expect(calls.length, "запасные не пробуются: отказ первого стал отказом человеку").toBeGreaterThan(1);
    expect(calls[calls.length - 1], "перебор не дошёл до отвечающего поставщика").toBe("openai");
  });

  test("при УСПЕХЕ первого лишних вызовов НЕТ — перебор только после отказа", async () => {
    /*
     * Это и есть то, чего боялся автор прежней проверки, и опасение верное:
     * перебор, идущий ВСЕГДА, жёг бы деньги на каждом прогоне. Проверяем
     * обратную сторону: когда первый ответил, второго вызова не происходит.
     */
    calls.length = 0;
    const app = makeApp();
    const cr = await request(app).post("/api/devhub/projects").send({ name: "V3" });
    // Мок отвечает только у openai — делаем его первым, подменив порядок:
    // вызов должен быть РОВНО один.
    await request(app)
      .post(`/api/devhub/projects/${cr.body.project.id}/generate`)
      .send({ prompt: "сделай кнопку" });
    const доОтвета = calls.indexOf("openai");
    expect(доОтвета, "отвечающий поставщик не вызывался вовсе").toBeGreaterThanOrEqual(0);
    expect(calls.length - 1, "после успешного ответа были лишние вызовы").toBe(доОтвета);
  });
});
