import { describe, test, expect, vi, beforeEach } from "vitest";

// Учёт расхода в клиенте провайдера (назначение оркестратора 06.09.2026).
// Правила, закрепляемые делом: вызов с userId пишется в леджер с
// нормализованными токенами; вызов без метра попадает в СЧЁТЧИК неучтённых
// (хвост класса не слепнет молча); отказ леджера не роняет ответ.

vi.mock("../src/services/qcoreai/store", () => ({
  addTokenUsage: vi.fn(async () => {}),
}));

import { callProvider, tokensFromUsage, __unmeteredCallCounts } from "../src/services/qcoreai/providers";
import { addTokenUsage } from "../src/services/qcoreai/store";

beforeEach(() => {
  vi.mocked(addTokenUsage).mockClear();
});

describe("учёт в callProvider", () => {
  test("вызов с userId пишет леджер с токенами из usage", async () => {
    const res = await callProvider("stub", [{ role: "user", content: "привет" }], "m", 0.2, undefined, undefined, {
      userId: "u-meter-1", module: "test-module",
    });
    expect(res.reply.length).toBeGreaterThan(0);
    expect(addTokenUsage).toHaveBeenCalledTimes(1);
    const [uid, tin, tout, info] = vi.mocked(addTokenUsage).mock.calls[0];
    expect(uid).toBe("u-meter-1");
    expect(tin).toBe(40); // stub honestly reports usage
    expect(tout).toBeGreaterThan(0);
    expect(info).toEqual({ provider: "stub", model: "m" });
  });

  test("вызов БЕЗ метра не пишет леджер, но виден в счётчике неучтённых", async () => {
    const before = __unmeteredCallCounts().get("unknown") ?? 0;
    await callProvider("stub", [{ role: "user", content: "x" }], "m", 0.2);
    expect(addTokenUsage).not.toHaveBeenCalled();
    expect(__unmeteredCallCounts().get("unknown")).toBe(before + 1);
  });

  test("метр с именем модуля, но без userId — считается по имени", async () => {
    const before = __unmeteredCallCounts().get("qcoreai-widget") ?? 0;
    await callProvider("stub", [{ role: "user", content: "x" }], "m", 0.2, undefined, undefined, { module: "qcoreai-widget" });
    expect(__unmeteredCallCounts().get("qcoreai-widget")).toBe(before + 1);
  });

  test("отказ леджера не роняет ответ", async () => {
    vi.mocked(addTokenUsage).mockRejectedValueOnce(new Error("db down"));
    const res = await callProvider("stub", [{ role: "user", content: "x" }], "m", 0.2, undefined, undefined, {
      userId: "u-meter-2", module: "test-module",
    });
    expect(res.reply.length, "отказ учёта уронил ответ, ради которого его зовут").toBeGreaterThan(0);
  });
});

describe("учёт на НАСТОЯЩЕМ провайдерском пути (не только stub)", () => {
  // Первая мутация «убрать meterCall из основного пути» прошла незамеченной:
  // тесты крыли только stub-ветку, у которой свой вызов метра. Урок «мутируй
  // все ветви класса» — этот тест закрывает основную.
  test("openai-совместимый вызов с userId пишет леджер", async () => {
    const realFetch = globalThis.fetch;
    process.env.OPENAI_API_KEY = "fake";
    globalThis.fetch = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: "ответ" } }], usage: { prompt_tokens: 7, completion_tokens: 13 }, model: "gpt-x" }),
      text: async () => "",
    })) as unknown as typeof fetch;
    try {
      await callProvider("openai", [{ role: "user", content: "x" }], "gpt-x", 0.2, undefined, undefined, {
        userId: "u-meter-3", module: "test-real-path",
      });
      expect(addTokenUsage).toHaveBeenCalledTimes(1);
      const [, tin, tout] = vi.mocked(addTokenUsage).mock.calls[0];
      expect(tin).toBe(7);
      expect(tout).toBe(13);
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.OPENAI_API_KEY;
    }
  });
});

describe("нормализация usage трёх провайдеров", () => {
  test("anthropic / openai / gemini формы читаются одинаково", () => {
    expect(tokensFromUsage({ input_tokens: 10, output_tokens: 20 })).toEqual({ tin: 10, tout: 20 });
    expect(tokensFromUsage({ prompt_tokens: 11, completion_tokens: 21 })).toEqual({ tin: 11, tout: 21 });
    expect(tokensFromUsage({ promptTokenCount: 12, candidatesTokenCount: 22 })).toEqual({ tin: 12, tout: 22 });
    expect(tokensFromUsage(null)).toEqual({ tin: 0, tout: 0 });
  });
});
