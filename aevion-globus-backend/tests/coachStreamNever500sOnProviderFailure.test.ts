/**
 * Отказ поставщика не превращается в 500 и не выносит наружу наш счёт.
 *
 * 🔴 ЗАМЕР НА ПРОДЕ 4b63abc54010, волна 5. Пять вопросов подряд: четыре
 * ответа и ОДИН код 500. Пятый попал в момент, когда у openai истекла отметка
 * отключения: его выбрали заново, он снова ответил «429 no credits
 * remaining», переключение на запасного тоже не дало текста — и маршрут упал,
 * хотя обычный вызов к живому поставщику в ту же секунду работал.
 *
 * Причина: три `throw` при нуле выданных знаков перепрыгивали добор обычным
 * вызовом, который стоит НИЖЕ. То есть починка волны 5 существовала, но до
 * неё не доходило управление.
 *
 * И вторая беда того же 500: в теле ответа наружу уходил текст поставщика —
 * «You have no credits remaining». Это состояние нашего счёта, видимое любому
 * посетителю.
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

beforeEach(() => { поток.mockReset(); обычный.mockReset(); отключённые = []; });

describe("оба потока отказали", () => {
  test("🔴 это НЕ 500: ответ добирается обычным вызовом", async () => {
    // И основной, и запасной поток падают — ровно случай прода.
    поток.mockImplementation(async function* () { throw new Error("openai 429: no credits remaining"); });
    обычный.mockImplementation(async (кого: string) => {
      if (кого === "openai") throw new Error("openai 429: no credits remaining");
      return { reply: "Рокировка уводит короля из центра.", model: "gemini-2.5-flash", usage: {} };
    });

    const r = await request(app).post("/api/coach/chat/stream").send(вопрос);

    expect(r.status, "отказ поставщика превратился в 500 вместо ответа").toBe(200);
    expect(r.text).toContain("Рокировка уводит короля");
  });

  test("🔴 когда и добор не смог — 502 СВОИМИ словами, без текста поставщика", async () => {
    поток.mockImplementation(async function* () { throw new Error("openai 429: You have no credits remaining"); });
    обычный.mockRejectedValue(new Error("openai 429: You have no credits remaining"));

    const r = await request(app).post("/api/coach/chat/stream").send(вопрос);

    expect(r.status).toBe(502);
    expect(r.text).not.toContain("no credits");
    expect(r.text).not.toContain("429");
    expect(r.text, "человеку нужно понятное объяснение, а не молчание").toContain("Тренер");
  });

  test("контроль: исправный поток отдаёт текст и не трогает добор", async () => {
    поток.mockImplementation(async function* () {
      yield { kind: "text" as const, text: "Рокировка прячет короля." };
      yield { kind: "done" as const };
    });
    const r = await request(app).post("/api/coach/chat/stream").send(вопрос);
    expect(r.status).toBe(200);
    expect(r.text).toContain("Рокировка прячет короля");
    expect(обычный).not.toHaveBeenCalled();
  });
});
