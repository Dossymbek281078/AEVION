/**
 * 🔴 ВЫБОР ПОСТАВЩИКА В ТЕЛЕ ЗАПРОСА — ТОЛЬКО ПО АДМИН-ТОКЕНУ.
 *
 * Зачем люк вообще. Сравнить поставщиков тренера честно можно лишь на
 * НАСТОЯЩЕМ системном тексте продукта (мерить на своей копии промпта мы уже
 * пробовали — вывод оказался ложным), а переключить предпочтение «чтобы
 * посмотреть» значит поставить опыт на живых людях: если поставщик отвечает
 * обрывками (так уже было — 79 знаков и не на том языке), это увидят они.
 *
 * Цена ошибки в другую сторону — чужие деньги: без замка любой посетитель мог
 * бы назвать самого дорогого поставщика на каждом вопросе.
 *
 * Поэтому проверяется поведение РУЧКИ, а не функция рядом:
 *   без токена поле `provider` игнорируется, идёт предпочтение по умолчанию;
 *   с верным токеном идёт названный поставщик;
 *   с неверным токеном — снова умолчание;
 *   `stub` назвать нельзя никогда: он вернул бы выдуманный ответ, и замер
 *   сравнивал бы наш же текст сам с собой.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

const обычный = vi.fn();
vi.mock("../src/services/qcoreai/providers", async (orig) => {
  const н = (await orig()) as Record<string, unknown>;
  return {
    ...н,
    callProvider: (...a: unknown[]) => обычный(...a),
    streamProvider: vi.fn(),
    isProviderOutOfService: () => false,
    listProviderOutages: () => [],
    noteProviderOutage: vi.fn(),
    providerOutageReason: () => null,
    /*
     * resolveProvider подменён НАМЕРЕННО, и вот почему — первая редакция его не
     * трогала и все семь проверок упали с «expected stub to be anthropic».
     * Подмена вывоза модуля не меняет его ВНУТРЕННИЕ вызовы: настоящий
     * resolveProvider спрашивает настоящий реестр, а в прогоне ключей нет, и
     * живым остаётся только stub. То есть проверялось окружение теста, а не люк.
     *
     * Здесь подменён ровно один шаг — «взять того, кого назвали». Предмет этой
     * проверки в том, КАКОЕ ИМЯ люк передаёт дальше; запасной переход, когда
     * названный поставщик закрыт, проверяется своим тестом по соседству
     * (coachFallbackUsesLiveProvider).
     */
    resolveProvider: (id?: string) => id ?? "anthropic",
    getProviders: () => [
      { id: "anthropic", name: "Anthropic", models: ["m"], defaultModel: "m",
        envKey: "ANTHROPIC_API_KEY", configured: true, free: false, tier: "flagship" },
      { id: "gemini", name: "Gemini", models: ["gemini-2.5-flash"], defaultModel: "gemini-2.5-flash",
        envKey: "GEMINI_API_KEY", configured: true, free: false, tier: "budget" },
      { id: "stub", name: "Stub", models: ["s"], defaultModel: "s",
        envKey: "", configured: true, free: true, tier: "stub" },
    ],
  };
});

import express from "express";
import request from "supertest";
import { coachRouter } from "../src/routes/coach";

const app = express();
app.use(express.json());
app.use("/api/coach", coachRouter);

// Значение ТОЛЬКО латиницей: в заголовок HTTP кириллица не лезет вовсе —
// первая редакция упала с «Invalid character in header content».
const ТОКЕН = "probe-token-12-10";
let былТокен: string | undefined;

const вопрос = {
  system: "Ты — Алексей, шахматный тренер внутри CyberChess by AEVION.",
  messages: [{ role: "user", content: "Зачем рокировка?" }],
};

/** Кого позвали на самом деле — первый довод callProvider. */
function кого(): string {
  expect(обычный, "ручка не дошла до вызова поставщика").toHaveBeenCalled();
  return обычный.mock.calls[0][0] as string;
}

beforeEach(() => {
  обычный.mockReset();
  обычный.mockResolvedValue({ reply: "Рокировка уводит короля из центра.", model: "m", usage: {} });
  былТокен = process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN = ТОКЕН;
});
afterEach(() => {
  if (былТокен === undefined) delete process.env.ADMIN_TOKEN;
  else process.env.ADMIN_TOKEN = былТокен;
});

describe("люк выбора поставщика", () => {
  test("🔴 БЕЗ токена поле provider игнорируется — поведение прежнее", async () => {
    const r = await request(app).post("/api/coach/chat").send({ ...вопрос, provider: "gemini" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(кого(), "посторонний смог выбрать поставщика").toBe("anthropic");
  });

  test("🔴 с НЕВЕРНЫМ токеном — тоже игнорируется", async () => {
    const r = await request(app).post("/api/coach/chat")
      .set("x-admin-token", ТОКЕН + "-wrong").send({ ...вопрос, provider: "gemini" });
    expect(r.status).toBe(200);
    expect(кого()).toBe("anthropic");
  });

  test("🔴 с ВЕРНЫМ токеном идёт названный поставщик — иначе замер невозможен", async () => {
    const r = await request(app).post("/api/coach/chat")
      .set("x-admin-token", ТОКЕН).send({ ...вопрос, provider: "gemini" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(кого()).toBe("gemini");
  });

  test("🔴 stub назвать нельзя даже с токеном — иначе замер сравнит наш текст сам с собой", async () => {
    const r = await request(app).post("/api/coach/chat")
      .set("x-admin-token", ТОКЕН).send({ ...вопрос, provider: "stub" });
    expect(r.status).toBe(200);
    expect(кого()).toBe("anthropic");
  });

  test("незнакомое имя поставщика не ломает ручку — молча берём умолчание", async () => {
    const r = await request(app).post("/api/coach/chat")
      .set("x-admin-token", ТОКЕН).send({ ...вопрос, provider: "выдуманный" });
    expect(r.status).toBe(200);
    expect(кого()).toBe("anthropic");
  });

  test("🔴 ADMIN_TOKEN не задан — люк закрыт для ВСЕХ, а не открыт для всех", async () => {
    delete process.env.ADMIN_TOKEN;
    const r = await request(app).post("/api/coach/chat")
      .set("x-admin-token", "anything").send({ ...вопрос, provider: "gemini" });
    expect(r.status).toBe(200);
    expect(кого(), "при незаданном токене люк открылся — это дыра, а не удобство").toBe("anthropic");
  });

  test("контроль прибора: без поля provider всё как раньше", async () => {
    const r = await request(app).post("/api/coach/chat").set("x-admin-token", ТОКЕН).send(вопрос);
    expect(r.status).toBe(200);
    expect(кого()).toBe("anthropic");
  });
});
