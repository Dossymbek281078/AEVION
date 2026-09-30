/**
 * Пустой поток тренера не уходит к человеку пустым.
 *
 * 🔴 ПОВОД 30.09.2026, день запуска. Замер на живом проде: каждый запрос к
 * POST /api/coach/chat/stream возвращал ровно 31 байт — один `message_stop` и
 * ни одного кадра текста. Ошибки не было: исключения не бросалось, поставщик
 * (gemini-2.5-flash) закрывал поток без единой части с текстом, а тот же
 * поставщик по обычному пути /chat отвечал полным разбором. Неисправность
 * выглядела как успех: код 200 и корректный конец потока.
 *
 * Человек ответ всё же получал — фронт не засчитывал пустое и делал ВТОРОЙ
 * запрос. Цена: лишний мёртвый вызов и лишние секунды на каждый вопрос, и
 * ничего этого не видно снаружи.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

const поток = vi.fn();
const обычный = vi.fn();

vi.mock("../src/services/qcoreai/providers", async (orig) => {
  const настоящий = (await orig()) as Record<string, unknown>;
  return {
    ...настоящий,
    streamProvider: (...a: unknown[]) => поток(...a),
    callProvider: (...a: unknown[]) => обычный(...a),
    resolveProvider: () => "gemini",
    // Без этого маршрут отвечает 500 «no AI provider configured»: проверка
    // готовности спрашивает именно список поставщиков, а не resolveProvider.
    getProviders: () => [
      { id: "gemini", name: "Gemini", models: ["gemini-2.5-flash"], defaultModel: "gemini-2.5-flash",
        envKey: "GEMINI_API_KEY", configured: true, free: false, tier: "budget" },
    ],
    providerOutageReason: () => null,
    noteProviderOutage: () => {},
    isProviderOutOfService: () => false,
    listProviderOutages: () => [],
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
});

/** Поток, который заканчивается успешно и БЕЗ единого куска текста. */
async function* пустойПоток() {
  yield { kind: "done" as const };
}

describe("поток тренера закончился пустым", () => {
  test("🔴 ответ всё равно приходит — добран обычным вызовом в тот же поток", async () => {
    поток.mockImplementation(() => пустойПоток());
    обычный.mockResolvedValue({
      reply: "Рокировка уводит короля из центра и вводит ладью в игру.",
      model: "gemini-2.5-flash",
      usage: {},
    });
    const r = await request(app).post("/api/coach/chat/stream").send(вопрос);
    expect(r.status).toBe(200);
    expect(обычный, "обычный вызов не был сделан — человек получил пустоту").toHaveBeenCalled();
    expect(r.text).toContain("Рокировка уводит короля");
    expect(r.text).toContain("message_stop");
  });

  test("контроль: когда поток ОТДАЁТ текст, обычный вызов не делается", async () => {
    поток.mockImplementation(async function* () {
      yield { kind: "text" as const, text: "Рокировка прячет короля." };
      yield { kind: "done" as const };
    });
    const r = await request(app).post("/api/coach/chat/stream").send(вопрос);
    expect(r.status).toBe(200);
    expect(r.text).toContain("Рокировка прячет короля");
    expect(обычный, "лишний платный вызов при исправном потоке").not.toHaveBeenCalled();
  });

  test("🔴 добранный ответ судится тем же мерилом: чужой язык наружу не идёт", async () => {
    поток.mockImplementation(() => пустойПоток());
    обычный.mockResolvedValue({ reply: "Castling hides the king and connects the rooks.", model: "m", usage: {} });
    const r = await request(app).post("/api/coach/chat/stream").send(вопрос);
    // 🔴 ПЕРЕНАЦЕЛЕНО 30.09.2026. Раньше здесь ждали 200 с пустым потоком:
    // ответ отбракован, человеку молча ничего. Теперь в этом случае маршрут
    // говорит 502 своими словами — молчание было худшим из исходов, оно
    // выглядит как исправная работа. Главное утверждение прежнее и стоит
    // первым: чужой язык наружу НЕ уходит.
    expect(r.text).not.toContain("Castling hides");
    expect(r.status).toBe(502);
    expect(r.text).toContain("Тренер");
  });

  test("контроль: отказ обычного вызова не роняет ручку НЕОБЪЯСНИМО", async () => {
    поток.mockImplementation(() => пустойПоток());
    обычный.mockRejectedValue(new Error("провайдер лёг"));
    const r = await request(app).post("/api/coach/chat/stream").send(вопрос);
    // Прежде ждали 200 с пустым потоком. Это и был худший исход: снаружи
    // неотличимо от исправной работы. Ручка по-прежнему НЕ падает с 500 и не
    // выносит наружу текст поставщика, но теперь честно называет отказ.
    expect(r.status).toBe(502);
    expect(r.text).not.toContain("провайдер лёг");
    expect(r.text).toContain("Тренер");
  });
});
