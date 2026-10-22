import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

/*
 * 🔴 22.10.2026, утечка переменных Railway. OpenRouter отключил засвеченный ключ сам (02:21Z), ключ
 * Anthropic …kAAA отключит основатель. План ротации записал: «в коде есть переход на другого поставщика
 * при сбое (failedOver); работает ли он при 401 — не проверено». Проверено кодом: providerOutageReason
 * знал только лимиты/кредиты, а 401 {"type":"authentication_error","message":"invalid x-api-key"} —
 * нет → callProvider бросал ошибку, не пробуя Gemini, и чат QCoreAI падал бы при живом запасном.
 *
 * Сторож: 1) 401 Anthropic → отвечает Gemini, providerUsed/failedOver честные, Anthropic закрыт на срок;
 * 2) тексты отказов OpenRouter («User not found.», 401) и Gemini («API key not valid») — тоже закрытие;
 * 3) КОНТРОЛЬ: 400 invalid_request_error по-прежнему НЕ меняет поставщика и не закрывает его.
 */

import {
  callProvider,
  providerOutageReason,
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

// Дословный ответ api.anthropic.com на отключённый/неверный ключ.
const ANTHROPIC_401 = reply(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } });
const ANTHROPIC_400 = reply(400, { type: "error", error: { type: "invalid_request_error", message: "messages: at least one message is required" } });
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

describe("отозванный ключ поставщика = закрытый поставщик: вызов уходит к следующему", () => {
  test("🔴 Anthropic 401 authentication_error → отвечает Gemini; providerUsed и failedOver честные; Anthropic закрыт", async () => {
    fetchMock.mockImplementation(async (url: string) => (String(url).includes("anthropic.com") ? ANTHROPIC_401 : GEMINI_OK));
    const res = await callProvider("anthropic", MESSAGES, "claude-sonnet-4-5", 0.2);
    expect(res.reply).toBe("PROBE-OK");
    expect(res.providerUsed).toBe("gemini");
    expect(res.failedOver).toEqual({ from: "anthropic", tried: ["anthropic", "gemini"] });
    expect(isProviderOutOfService("anthropic")).toBe(true);
    const o = listProviderOutages().find((x) => x.id === "anthropic");
    expect(o?.reason).toContain("invalid x-api-key");
    // вызовов к Anthropic — ровно один, к Gemini — один
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.includes("anthropic.com"))).toHaveLength(1);
    expect(urls.filter((u) => u.includes("generativelanguage"))).toHaveLength(1);
  });

  test("тексты отказов по ключу других поставщиков тоже считаются закрытием (дословные ответы API)", () => {
    expect(providerOutageReason(new Error("openrouter 401: User not found. (code 401)"))).toBeTruthy();
    expect(providerOutageReason(new Error("API key not valid. Please pass a valid API key."))).toBeTruthy();
    expect(providerOutageReason(new Error("openai 401: Incorrect API key provided: sk-abc. (code invalid_api_key)"))).toBeTruthy();
    expect(providerOutageReason(new Error("Anthropic 403: permission_error"))).toBeTruthy();
    // причина не длиннее 200 знаков — как у лимитов
    expect(providerOutageReason(new Error("invalid x-api-key " + "x".repeat(500)))!.length).toBeLessThanOrEqual(200);
  });

  test("КОНТРОЛЬ: 400 invalid_request_error не меняет поставщика и не закрывает его", async () => {
    fetchMock.mockImplementation(async (url: string) => (String(url).includes("anthropic.com") ? ANTHROPIC_400 : GEMINI_OK));
    await expect(callProvider("anthropic", MESSAGES, "claude-sonnet-4-5", 0.2)).rejects.toThrow(/at least one message/);
    expect(isProviderOutOfService("anthropic")).toBe(false);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.includes("generativelanguage"))).toHaveLength(0);
    expect(providerOutageReason(new Error("messages: at least one message is required"))).toBeNull();
  });
});
