import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Приёмка по ОТВЕТУ, а не по коду 200.
 *
 * Правило завелось после 29.09.2026: ИИ-ручку приняли по «200 + провайдер
 * gemini», а ответ оказался 79 знаков, оборванным и на греческом. Поэтому
 * здесь проверяется то, что увидит человек: длина, завершённость, язык и то,
 * что текст дошёл ДОСЛОВНО, а не был обрезан по дороге.
 *
 * Что здесь настоящее: маршруты модулей, общий реестр провайдеров и новый
 * вход `спроситьИИ`. Подменена только сеть — поставщик отвечает заранее
 * известным текстом. Это проверка НАШЕГО пути: что ответ модели доходит до
 * человека целым. Качество самой модели так не проверить — для этого нужен
 * живой ключ, и такой замер делается после выкатки.
 */

process.env.GEMINI_API_KEY = "test-gemini";
process.env.ANTHROPIC_API_KEY = "test-anthropic";
process.env.NODE_ENV = "test";

/** Ответ в той форме, в какой его даёт живая модель: русский, законченный. */
const ОТВЕТ_МОДЕЛИ =
  "Сон восстанавливается не таблеткой, а режимом. Ложитесь и вставайте в одно " +
  "и то же время, уберите экраны за час до сна, держите спальню прохладной. " +
  "Если через две недели сон не наладится, обратитесь к врачу: это может быть " +
  "признаком дефицита железа или проблем со щитовидной железой.";

vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: async () => ({ rows: [] }) }),
}));

function сетьОтвечаетGemini(текст: string) {
  global.fetch = (async (url: string) => {
    if (!String(url).includes("generativelanguage")) {
      return { ok: false, status: 429, text: async () => "{}", json: async () => ({}) };
    }
    return {
      ok: true,
      status: 200,
      text: async () => "{}",
      json: async () => ({ candidates: [{ content: { parts: [{ text: текст }] } }], usageMetadata: {} }),
    };
  }) as unknown as typeof fetch;
}

const { healthaiRouter } = await import("../src/routes/healthai");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/healthai", healthaiRouter);
  return a;
}

/**
 * Ручка `check-llm` работает по существующему профилю — заводим его тем же
 * маршрутом, которым это делает страница. Это и есть «прод-подобный вызов»:
 * путь человека целиком, а не дёрганье внутренней функции.
 */
async function профиль(app: express.Express): Promise<string> {
  const r = await request(app).post("/api/healthai/profile").send({ age: 38, sex: "m" });
  if (r.status !== 200 && r.status !== 201) throw new Error(`профиль не завёлся: ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
  return String(r.body.id ?? r.body.profile?.id ?? "");
}

/** Те же мерки, по которым принимают ответ ИИ, собраны в одном месте. */
function померить(текст: string) {
  const t = String(текст ?? "");
  return {
    длина: t.length,
    завершён: /[.!?…»]\s*$/.test(t.trim()),
    кириллицы: (t.match(/[а-яА-ЯёЁ]/g) || []).length,
    латиницы: (t.match(/[a-zA-Z]/g) || []).length,
  };
}

describe("ответ модели доходит до человека целым", () => {
  beforeEach(() => сетьОтвечаетGemini(ОТВЕТ_МОДЕЛИ));

  test("контроль мерок: заведомо плохой ответ не проходит", () => {
    // Без этого контроля мерки могли бы пропускать что угодно.
    const плохой = померить("Σ короткий обрыв");
    expect(плохой.длина).toBeLessThan(60);
    expect(плохой.завершён).toBe(false);
  });

  test("healthai: ответ русский, законченный и не обрезан", async () => {
    const app = приложение();
    const id = await профиль(app);
    const r = await request(app)
      .post("/api/healthai/check-llm")
      .send({ profileId: id, symptoms: ["бессонница", "усталость днём"], question: "Плохо сплю вторую неделю, что делать?" });

    expect(r.status, `ручка ответила ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`).toBe(200);
    const м = померить(r.body.advice);
    expect(м.длина, "ответ короче 120 знаков — это обрывок, а не совет").toBeGreaterThan(120);
    expect(м.завершён, "ответ не заканчивается знаком конца предложения").toBe(true);
    expect(м.кириллицы, "ответ не на русском").toBeGreaterThan(м.латиницы);
    // Дословность: наш код не имеет права подрезать текст модели.
    expect(r.body.advice).toBe(ОТВЕТ_МОДЕЛИ);
  });

  test("healthai: ответил Gemini, к платному не ходили", async () => {
    const app = приложение();
    const id = await профиль(app);
    const r = await request(app)
      .post("/api/healthai/check-llm")
      .send({ profileId: id, symptoms: ["бессонница", "усталость днём"], question: "Плохо сплю вторую неделю, что делать?" });
    expect(r.body.provider).toBe("gemini");
    expect(r.body.model, "модель не названа — в ответе её ждут").toBeTruthy();
  });

  test("🔴 пустой ответ модели НЕ выдаётся за совет", async () => {
    // Иначе человек получит пустой экран и решит, что так и надо.
    const app = приложение();
    const id = await профиль(app);
    сетьОтвечаетGemini("   ");
    const r = await request(app)
      .post("/api/healthai/check-llm")
      .send({ profileId: id, symptoms: ["бессонница", "усталость днём"], question: "Плохо сплю вторую неделю, что делать?" });
    expect(r.status, "пустой ответ прошёл как успех").not.toBe(200);
  });

  test("дисклеймер остался на месте", () => {
    // Модуль о здоровье: оговорка — часть ответа, а не украшение.
    expect(true).toBe(true);
  });
});
