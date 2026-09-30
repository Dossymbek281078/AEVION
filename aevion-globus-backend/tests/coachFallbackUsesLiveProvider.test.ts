/**
 * Добор ответа идёт к ЖИВОМУ поставщику, а не к тому, кто только что отказал.
 *
 * 🔴 ДЕФЕКТ В МОЕЙ ЖЕ ПОЧИНКЕ, найден на проде 30.09.2026 после волны 4.
 * Когда поток не выдал ни знака, маршрут добирает ответ обычным вызовом. Звал
 * он при этом `поставщик` — того, кого выбрали в НАЧАЛЕ запроса. Но к этому
 * месту он мог уже отвалиться: выше поток ловит отказ, помечает поставщика
 * отключённым и переключается на запасного. Добор упрямо шёл к первому и
 * получал тот же отказ.
 *
 * Живой замер: первые две пробы вернули 31 байт (пусто), потому что
 * выбирался openai с «429 no credits remaining», а добор снова звал openai.
 * Как только openai попал в список отключённых и выбор сместился на gemini,
 * ответ пошёл — 269 байт. То есть дефект бил по КАЖДОМУ, пока отключение не
 * записалось, и бил молча: код 200, корректный конец потока.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

const поток = vi.fn();
const обычный = vi.fn();
let отключённые: string[] = [];

vi.mock("../src/services/qcoreai/providers", async (orig) => {
  const н = (await orig()) as Record<string, unknown>;
  return {
    ...н,
    streamProvider: (...a: unknown[]) => поток(...a),
    callProvider: (...a: unknown[]) => обычный(...a),
    // Пока openai не помечен — он и выбирается; после пометки живым остаётся gemini.
    resolveProvider: () => (отключённые.includes("openai") ? "gemini" : "openai"),
    providerOutageReason: (e: unknown) =>
      String((e as Error)?.message || "").includes("429") ? "нет кредитов" : null,
    noteProviderOutage: (id: string) => { отключённые.push(id); },
    isProviderOutOfService: (id: string) => отключённые.includes(id),
    listProviderOutages: () => отключённые.map((id) => ({ id })),
    getProviders: () => [
      { id: "openai", name: "OpenAI", models: ["gpt-4o-mini"], defaultModel: "gpt-4o-mini",
        envKey: "OPENAI_API_KEY", configured: true, free: false, tier: "budget" },
      { id: "gemini", name: "Gemini", models: ["gemini-2.5-flash"], defaultModel: "gemini-2.5-flash",
        envKey: "GEMINI_API_KEY", configured: true, free: false, tier: "budget" },
    ],
  };
});

import express from "express";
import request from "supertest";
import { coachRouter } from "../src/routes/coach";

const app = express();
app.use(express.json());
app.use("/api/coach", coachRouter);

const вопрос = { system: "Ты тренер.", messages: [{ role: "user", content: "Зачем рокировка?" }] };

beforeEach(() => {
  поток.mockReset();
  обычный.mockReset();
  отключённые = [];
});

describe("поставщик отказал посреди запроса", () => {
  test("🔴 добор уходит к ЗАПАСНОМУ, и текст доходит", async () => {
    // Оба потока пусты: первый падает с 429, второй (запасной) молчит.
    поток.mockImplementation(async function* (кого: string) {
      if (кого === "openai") throw new Error("openai 429: no credits remaining");
      yield { kind: "done" as const };
    });
    // Обычный вызов работает ТОЛЬКО у живого поставщика.
    обычный.mockImplementation(async (кого: string) => {
      if (кого === "openai") throw new Error("openai 429: no credits remaining");
      return { reply: "Рокировка уводит короля из центра.", model: "gemini-2.5-flash", usage: {} };
    });

    const r = await request(app).post("/api/coach/chat/stream").send(вопрос);

    expect(r.status).toBe(200);
    expect(r.text, "ответ не дошёл — добор снова позвал отказавшего поставщика").toContain(
      "Рокировка уводит короля",
    );
    const кого = обычный.mock.calls.map((c) => c[0]);
    expect(кого, "добор обязан звать живого, а не отказавшего").toContain("gemini");
    expect(кого).not.toContain("openai");

    // И МОДЕЛЬ обязана быть от живого поставщика. Без этой проверки мутация
    // «поставщик живой, а модель от отказавшего» выживала: вызов ушёл бы в
    // gemini с именем модели gpt-4o-mini. Замечено мутацией, а не вычиткой.
    const модели = обычный.mock.calls.map((c) => c[2]);
    expect(модели, "модель взята у отказавшего поставщика").toContain("gemini-2.5-flash");
    expect(модели).not.toContain("gpt-4o-mini");
  });

  test("контроль: когда никто не отказывал, добор зовёт того же поставщика", async () => {
    // Здесь openai не падает, а просто отдаёт пустой поток — переключаться
    // не на кого и не за чем, добор должен идти к нему же.
    поток.mockImplementation(async function* () { yield { kind: "done" as const }; });
    обычный.mockResolvedValue({ reply: "Рокировка прячет короля.", model: "gpt-4o-mini", usage: {} });

    const r = await request(app).post("/api/coach/chat/stream").send(вопрос);

    expect(r.status).toBe(200);
    expect(r.text).toContain("Рокировка прячет короля");
    expect(обычный.mock.calls.map((c) => c[0])).toEqual(["openai"]);
  });
});
