import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Перевод не умирает вместе с квотой DeepL (17.09.2026).
 *
 * Повод: на проде DeepL отвечал 456 (месячная квота исчерпана), возможность
 * «translate» стояла degraded, и все три ручки перевода DevHub были мертвы —
 * при том, что настроенная LLM в том же файле генерирует код и перевод ей по
 * силам. Сторож закрепляет ПОВЕДЕНИЕ запасного пути, а не его форму:
 *
 *  1. DeepL 456 + настроенная LLM → перевод есть, ответ честно называет
 *     provider и причину (fallbackFrom/fallbackReason).
 *  2. DeepL 456 + LLM нет → прежний честный отказ 456 с адресом кабинета.
 *  3. DeepL 456 + только «stub» → тот же отказ 456: заглушка под видом
 *     перевода — молчаливая ложь (§16), stub запасным не бывает.
 *  4. DeepL жив → переводит DeepL, LLM не зовётся вовсе (запасной путь —
 *     не замена).
 *  5. Ключа DeepL нет + LLM есть → перевод через LLM с причиной
 *     deepl_not_configured.
 *
 * Мутация «запасной путь выключен» (llmTranslateCandidate → null) обязана
 * красить 1 и 5; мутация «stub допущен» — красить 3.
 */

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));

const { providersState, callProviderMock } = vi.hoisted(() => ({
  providersState: { list: [] as Array<{ id: string; configured: boolean; defaultModel: string }> },
  callProviderMock: vi.fn(),
}));
vi.mock("../src/services/qcoreai/providers", () => ({
  getProviders: () => providersState.list,
  callProvider: callProviderMock,
  streamProviderResilient: vi.fn(),
}));
vi.mock("../src/lib/wranglerPagesDeploy", () => ({ deployViaWrangler: vi.fn() }));

// eslint-disable-next-line import/first
import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";
// eslint-disable-next-line import/first
import { __resetProviderHealth } from "../src/lib/providerHealth";

let ipCounter = 0;
function makeApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use((req, _res, next) => {
    ipCounter += 1;
    req.headers["x-forwarded-for"] = `10.9.${Math.floor(ipCounter / 250) % 250}.${(ipCounter % 250) + 1}`;
    next();
  });
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/devhub", devhubRouter);
  return app;
}

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

function deeplReply(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  __resetDevHubStore();
  __resetProviderHealth();
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  callProviderMock.mockReset();
  providersState.list = [];
  process.env.DEEPL_API_KEY = "key:fx";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.DEEPL_API_KEY;
});

const QUOTA = deeplReply(456, { message: "Quota exceeded" });

async function translate(app: express.Express) {
  return request(app).post("/api/devhub/media/translate").send({ text: "Hello world", targetLang: "de" });
}

describe("перевод DevHub не умирает вместе с квотой DeepL", () => {
  test("1. DeepL 456 + настроенная LLM → перевод есть и честно подписан", async () => {
    providersState.list = [{ id: "openai", configured: true, defaultModel: "gpt-test" }];
    callProviderMock.mockResolvedValue({ reply: "Hallo Welt", model: "gpt-test", usage: {} });
    fetchMock.mockResolvedValueOnce(QUOTA);

    const r = await translate(makeApp());
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.text).toBe("Hallo Welt");
    expect(r.body.provider).toBe("openai");
    expect(r.body.fallbackFrom).toBe("deepl");
    expect(r.body.fallbackReason).toBe("deepl_quota_exhausted");
    expect(callProviderMock).toHaveBeenCalledTimes(1);
    expect(callProviderMock.mock.calls[0][0]).toBe("openai");
    // Текст человека доходит до модели, а не пересказ.
    const messages = callProviderMock.mock.calls[0][1] as Array<{ role: string; content: string }>;
    expect(messages.some((m) => m.role === "user" && m.content === "Hello world")).toBe(true);
  });

  test("2. DeepL 456 + LLM нет → прежний честный отказ 456 с адресом кабинета", async () => {
    fetchMock.mockResolvedValueOnce(QUOTA);
    const r = await translate(makeApp());
    expect(r.status).toBe(456);
    expect(r.body.provider).toBe("deepl");
    expect(String(r.body.accountUrl)).toContain("deepl.com");
    expect(callProviderMock).not.toHaveBeenCalled();
  });

  test("3. DeepL 456 + только stub → отказ 456, заглушка переводом не прикидывается", async () => {
    providersState.list = [{ id: "stub", configured: true, defaultModel: "stub" }];
    callProviderMock.mockResolvedValue({ reply: "stubbed nonsense", model: "stub", usage: {} });
    fetchMock.mockResolvedValueOnce(QUOTA);

    const r = await translate(makeApp());
    expect(r.status).toBe(456);
    expect(callProviderMock).not.toHaveBeenCalled();
  });

  test("4. DeepL жив → переводит DeepL, LLM не зовётся", async () => {
    providersState.list = [{ id: "openai", configured: true, defaultModel: "gpt-test" }];
    callProviderMock.mockResolvedValue({ reply: "НЕ ЭТО", model: "gpt-test", usage: {} });
    fetchMock.mockResolvedValueOnce(deeplReply(200, { translations: [{ text: "Hallo Welt", detected_source_language: "EN" }] }));

    const r = await translate(makeApp());
    expect(r.status).toBe(200);
    expect(r.body.text).toBe("Hallo Welt");
    expect(r.body.provider).toBe("deepl");
    expect(r.body.fallbackFrom).toBeUndefined();
    expect(callProviderMock).not.toHaveBeenCalled();
  });

  test("5. ключа DeepL нет + LLM есть → перевод через LLM с причиной deepl_not_configured", async () => {
    delete process.env.DEEPL_API_KEY;
    providersState.list = [{ id: "anthropic", configured: true, defaultModel: "claude-test" }];
    callProviderMock.mockResolvedValue({ reply: "Hallo Welt", model: "claude-test", usage: {} });

    const r = await translate(makeApp());
    expect(r.status).toBe(200);
    expect(r.body.provider).toBe("anthropic");
    expect(r.body.fallbackReason).toBe("deepl_not_configured");
    // DeepL без ключа не зовётся вовсе.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
