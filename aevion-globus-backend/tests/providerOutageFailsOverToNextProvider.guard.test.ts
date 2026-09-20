import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Поставщик, закрытый по лимиту, не роняет ответ (20.09.2026, день запуска).
 *
 * На проде Anthropic ответил «You have reached your specified API usage limits.
 * You will regain access on 2026-10-01 at 00:00 UTC», OpenAI — «no credits
 * remaining». resolveProvider брал первого настроенного — Anthropic — и
 * /api/qcoreai/chat отвечал chat_failed при живом Gemini. Сторож закрепляет:
 *
 *  1. отказ по лимиту → ответ даёт следующий настроенный поставщик, и в
 *     результате честно стоит providerUsed;
 *  2. отключение ПОМНИТСЯ: следующий выбор по умолчанию минует закрытого сразу,
 *     без повторного вызова;
 *  3. срок берётся из текста поставщика («regain access on …»), иначе полчаса;
 *  4. пустой ответ с кодом 200 (бесплатный шлюз) — тоже повод идти дальше;
 *  5. ошибка ДРУГОГО рода (неверный запрос) не ведёт к смене поставщика и
 *     не закрывает его — иначе любая опечатка выключала бы Anthropic на полчаса.
 *
 * Мутация «выключить переход» (next → undefined) обязана красить 1 и 4.
 */

import {
  callProvider,
  streamProviderResilient,
  resolveProvider,
  isProviderOutOfService,
  listProviderOutages,
  __resetProviderOutages,
  type ChatMessage,
} from "../src/services/qcoreai/providers";

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}
const ANTHROPIC_LIMIT = reply(429, {
  type: "error",
  error: { type: "rate_limit_error", message: "You have reached your specified API usage limits. You will regain access on 2026-10-01 at 00:00 UTC." },
});
const GEMINI_OK = reply(200, { candidates: [{ content: { parts: [{ text: "PROBE-OK" }] } }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 } });
const MESSAGES: ChatMessage[] = [{ role: "user", content: "Reply with exactly: PROBE-OK" }];

beforeEach(() => {
  __resetProviderOutages();
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env.ANTHROPIC_API_KEY = "sk-ant-fake";
  process.env.GEMINI_API_KEY = "gm-fake";
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
});

describe("поставщик, закрытый по лимиту, не роняет ответ", () => {
  test("1. лимит у Anthropic → отвечает Gemini, и это видно в providerUsed", async () => {
    fetchMock.mockResolvedValueOnce(ANTHROPIC_LIMIT).mockResolvedValueOnce(GEMINI_OK);
    const r = await callProvider("anthropic", MESSAGES, "claude-opus-4-8", 0.2);
    expect(r.reply).toBe("PROBE-OK");
    expect(r.providerUsed).toBe("gemini");
    expect(r.failedOver?.from).toBe("anthropic");
    expect(String(fetchMock.mock.calls[1][0])).toContain("generativelanguage.googleapis.com");
  });

  test("2. отключение помнится: следующий выбор по умолчанию минует Anthropic без вызова", async () => {
    fetchMock.mockResolvedValueOnce(ANTHROPIC_LIMIT).mockResolvedValueOnce(GEMINI_OK);
    await callProvider("anthropic", MESSAGES, "claude-opus-4-8", 0.2);
    expect(isProviderOutOfService("anthropic")).toBe(true);
    expect(resolveProvider()).toBe("gemini");
    expect(resolveProvider("anthropic")).toBe("gemini");

    fetchMock.mockResolvedValueOnce(GEMINI_OK);
    const r = await callProvider(resolveProvider(), MESSAGES, "gemini-2.5-flash", 0.2);
    expect(r.providerUsed).toBeUndefined();
    // Три вызова сети всего: лимит, ответ, ответ — закрытого больше не трогали.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("3. срок закрытия берётся из текста поставщика", async () => {
    fetchMock.mockResolvedValueOnce(ANTHROPIC_LIMIT).mockResolvedValueOnce(GEMINI_OK);
    await callProvider("anthropic", MESSAGES, "claude-opus-4-8", 0.2);
    const o = listProviderOutages().find((x) => x.id === "anthropic");
    expect(o?.until).toBe("2026-10-01T00:00:00.000Z");
    // Уже наступивший срок — поставщик снова в строю.
    expect(isProviderOutOfService("anthropic", Date.parse("2026-10-01T00:00:01Z"))).toBe(false);
  });

  test("4. пустой ответ с кодом 200 — тоже повод идти к следующему", async () => {
    process.env.OPENROUTER_API_KEY = "or-fake";
    delete process.env.ANTHROPIC_API_KEY;
    fetchMock
      .mockResolvedValueOnce(reply(200, { choices: [{ message: { content: "" } }], model: "free" })) // openrouter
      .mockResolvedValueOnce(GEMINI_OK);
    const r = await callProvider("openrouter", MESSAGES, "free-model", 0.2);
    expect(r.reply).toBe("PROBE-OK");
    expect(r.providerUsed).toBe("gemini");
  });

  test("6. потоковый вызов роли не запускает закрытого поставщика — уходит к следующему сразу", async () => {
    // Консилиум 20.09: критику назначили Anthropic, чат уже знал, что тот закрыт.
    fetchMock.mockResolvedValueOnce(ANTHROPIC_LIMIT).mockResolvedValueOnce(GEMINI_OK);
    await callProvider("anthropic", MESSAGES, "claude-opus-4-8", 0.2);
    expect(isProviderOutOfService("anthropic")).toBe(true);

    // Поток: сеть «падает» — нам важен только АДРЕС первого вызова.
    fetchMock.mockRejectedValueOnce(new Error("network down (probe)"));
    const gen = streamProviderResilient("anthropic", MESSAGES, "claude-opus-4-8", 0.2);
    await expect((async () => { for await (const _ of gen) { /* пусто */ } })()).rejects.toThrow(/network down/);
    const streamCall = fetchMock.mock.calls[2];
    expect(String(streamCall[0])).toContain("generativelanguage.googleapis.com");
    expect(String(streamCall[0])).not.toContain("anthropic.com");
  });

  test("5. ошибка другого рода не меняет поставщика и не закрывает его", async () => {
    fetchMock.mockResolvedValueOnce(reply(400, { error: { type: "invalid_request_error", message: "messages: roles must alternate" } }));
    await expect(callProvider("anthropic", MESSAGES, "claude-opus-4-8", 0.2)).rejects.toThrow(/roles must alternate/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(isProviderOutOfService("anthropic")).toBe(false);
    expect(resolveProvider()).toBe("anthropic");
  });
});
