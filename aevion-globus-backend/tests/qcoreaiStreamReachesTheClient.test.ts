/**
 * Поток QCore AI доходит до человека, а не обрывается на первой итерации.
 *
 * 🔴 ТОТ ЖЕ ДЕФЕКТ, ЧТО У ТРЕНЕРА (30.09.2026). В маршруте стояло
 * `req.on("close", () => { aborted = true; ... })`, а в начале цикла выдачи —
 * `if (aborted) break`. В Node событие `close` у ЗАПРОСА срабатывает и при
 * обычном, полном его прочтении: у POST с телом это происходит раньше, чем
 * поставщик пришлёт первый токен.
 *
 * Замер этого поведения (отдельный опыт на голом express в этом же
 * окружении): POST с телом — reqClose=true уже через 60 мс, до первого кадра;
 * GET без тела — reqClose=false, срабатывает только в конце. Поэтому поражены
 * ровно POST-маршруты, и этот — один из них.
 *
 * Следствие здесь злее, чем у тренера: цикл рвётся на ПЕРВОЙ итерации,
 * totalText остаётся пустым, а ветка «пусто — сообщи об ошибке» закрыта тем же
 * флагом (`if (!aborted && totalText === "")`). То есть человек получает
 * пустой поток без единого признака неисправности.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

const поток = vi.fn();

vi.mock("../src/services/qcoreai/providers", async (orig) => {
  const н = (await orig()) as Record<string, unknown>;
  return {
    ...н,
    streamProviderResilient: (...a: unknown[]) => поток(...a),
    getProviders: () => [
      { id: "gemini", name: "Gemini", models: ["gemini-2.5-flash"], defaultModel: "gemini-2.5-flash",
        envKey: "GEMINI_API_KEY", configured: true, free: false, tier: "budget" },
    ],
    resolveProvider: () => "gemini",
    isProviderOutOfService: () => false,
    listProviderOutages: () => [],
  };
});

import express from "express";
import request from "supertest";
import { qcoreaiRouter } from "../src/routes/qcoreai";

const app = express();
app.use(express.json());
app.use("/api/qcoreai", qcoreaiRouter);

beforeEach(() => поток.mockReset());

describe("POST /chat-stream отдаёт текст", () => {
  test("🔴 текст поставщика доходит до клиента", async () => {
    поток.mockImplementation(async function* () {
      // Пауза обязательна: настоящий поставщик отвечает не мгновенно, и
      // именно в этот промежуток успевает сработать close у запроса. Без
      // паузы дефект НЕ воспроизводится — первая итерация проходит раньше
      // события, и тест зеленеет на сломанном коде.
      await new Promise((r) => setTimeout(r, 60));
      yield { kind: "text", text: "Первая часть. " };
      yield { kind: "text", text: "Вторая часть." };
      yield { kind: "done", tokensIn: 10, tokensOut: 20 };
    });
    const r = await request(app)
      .post("/api/qcoreai/chat-stream")
      .send({ messages: [{ role: "user", content: "привет" }] });

    expect(r.status).toBe(200);
    expect(r.text, "поток дошёл пустым — флаг «клиент ушёл» погас до первого кадра").toContain(
      "Первая часть.",
    );
    expect(r.text).toContain("Вторая часть.");
  });
});
