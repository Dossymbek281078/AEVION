/**
 * 🔴 У ВЫЗОВА МОДЕЛИ ЕСТЬ СРОК, И ПО НЕМУ ИДЁТ ПЕРЕХОД К ЖИВОМУ ПОСТАВЩИКУ.
 *
 * Повод — замер 12.10.2026: пять генераций DevHub гостем на ОДНОМ И ТОМ ЖЕ
 * тексте дали 23.3 / 63.0 / 23.9 / 22.5 / 26.3 с, а у окна продаж на том же
 * описании — 27 и 170 с. При этом во всём providers.ts единственный
 * AbortController стоял на вспомогательном чтении JSON (2.5 с), а сам вызов
 * модели шёл БЕЗ срока: медленная сторона у поставщика держала человека
 * сколько угодно, и перехода по ВРЕМЕНИ не существовало — только по отказу по
 * деньгам (402, «no credits»). Гость, который ждёт три минуты, уходит.
 *
 * Сторож гоняет НАСТОЯЩИЙ callProvider с подменённым сетевым вызовом: подмена
 * самого модуля проверяла бы нашу копию правила, а не правило.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { callProvider, срокВызоваМс, __resetProviderOutages, isProviderOutOfService } from "../src/services/qcoreai/providers";

const настоящийFetch = globalThis.fetch;
const ПЕРЕМЕННЫЕ = ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "AI_CALL_TIMEOUT_MS", "OPENAI_API_KEY"];
const было: Record<string, string | undefined> = {};

/** Сколько раз кого позвали — по адресу запроса. */
let звонки: string[] = [];

function ктоПоАдресу(url: string): "anthropic" | "gemini" | "иной" {
  if (url.includes("api.anthropic.com")) return "anthropic";
  if (url.includes("generativelanguage.googleapis.com")) return "gemini";
  return "иной";
}

function ответGemini(текст: string) {
  return {
    ok: true, status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: текст }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    }),
    text: async () => "",
  };
}

beforeEach(() => {
  for (const k of ПЕРЕМЕННЫЕ) { было[k] = process.env[k]; delete process.env[k]; }
  // Оба настроены — значит переход физически возможен.
  process.env.ANTHROPIC_API_KEY = "test-anthropic";
  process.env.GEMINI_API_KEY = "test-gemini";
  // Срок в миллисекундах: проверяем ПОВЕДЕНИЕ, а не ждём полминуты в прогоне.
  process.env.AI_CALL_TIMEOUT_MS = "250";
  звонки = [];
  __resetProviderOutages();
});
afterEach(() => {
  globalThis.fetch = настоящийFetch;
  for (const k of ПЕРЕМЕННЫЕ) { if (было[k] === undefined) delete process.env[k]; else process.env[k] = было[k]; }
  __resetProviderOutages();
});

describe("срок вызова модели", () => {
  test("🔴 значение по умолчанию разумно: выше худшего нормального ответа и ниже минуты", () => {
    delete process.env.AI_CALL_TIMEOUT_MS;
    const с = срокВызоваМс();
    // Медиана живого вызова 24 с, худший нормальный 26.3 с. Срок обязан быть
    // ВЫШЕ них — иначе рубим исправные ответы, — и НИЖЕ минуты, иначе он не
    // спасает от ожидания, ради которого заведён.
    expect(с, `срок ${с} мс`).toBeGreaterThan(27_000);
    expect(с).toBeLessThanOrEqual(45_000);
    process.env.AI_CALL_TIMEOUT_MS = "250";
  });

  test("🔴 поставщик молчит дольше срока — идём к следующему и ОТВЕЧАЕМ", async () => {
    globalThis.fetch = (async (url: unknown) => {
      const кто = ктоПоАдресу(String(url));
      звонки.push(кто);
      if (кто === "anthropic") return new Promise(() => {}); // висит вечно
      return ответGemini("Ответ запасного поставщика.");
    }) as unknown as typeof fetch;

    const r = await callProvider("anthropic", [{ role: "user", content: "вопрос" }], "m", 0.2);
    expect(String(r.reply)).toContain("запасного");
    expect(звонки, "к запасному не пошли").toContain("gemini");
    expect(r.providerUsed ?? "anthropic", "ответ приписан не тому, кто ответил").toBe("gemini");
  });

  test("🔴 просрочка НЕ отключает поставщика на полчаса — это не закрытый счёт", async () => {
    globalThis.fetch = (async (url: unknown) => {
      const кто = ктоПоАдресу(String(url));
      звонки.push(кто);
      if (кто === "anthropic") return new Promise(() => {});
      return ответGemini("ок");
    }) as unknown as typeof fetch;

    await callProvider("anthropic", [{ role: "user", content: "вопрос" }], "m", 0.2);
    // Иначе один медленный ответ увёл бы ВЕСЬ поток на запасного на полчаса —
    // в том числе на более дорогого.
    expect(isProviderOutOfService("anthropic"), "медленный ответ пометил поставщика закрытым").toBe(false);
  });

  test("🔴 успевший ответ не трогаем: срок не рубит исправный вызов", async () => {
    process.env.AI_CALL_TIMEOUT_MS = "3000";
    globalThis.fetch = (async (url: unknown) => {
      звонки.push(ктоПоАдресу(String(url)));
      await new Promise((r) => setTimeout(r, 50));
      return ответGemini("Быстрый ответ.");
    }) as unknown as typeof fetch;

    const r = await callProvider("gemini", [{ role: "user", content: "вопрос" }], "gemini-2.5-flash", 0.2);
    expect(String(r.reply)).toContain("Быстрый");
    expect(звонки.filter((x) => x === "gemini").length, "исправный вызов задублировали").toBe(1);
  });

  test("контроль прибора: без подмены сети тест бы ничего не значил", () => {
    // Если fetch не подменён, прогон ушёл бы в настоящую сеть и платил деньги.
    expect(globalThis.fetch).toBe(настоящийFetch);
  });
});
