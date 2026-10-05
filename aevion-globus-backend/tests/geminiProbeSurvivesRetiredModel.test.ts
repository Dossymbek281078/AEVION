import { describe, test, expect } from "vitest";
import { запросGemini, классифицировать } from "../src/lib/providerSpendCheck";

/**
 * Проверка Gemini обязана пережить отставку имени модели.
 *
 * Повод — живой замер на проде 05.10.2026, через час после выкатки самой
 * проверки: `gemini → ответ не разобран [HTTP 404]`. Имя `gemini-2.0-flash`
 * у нашего ключа не существует. Отвечать «не знаю» вечно — это не проверка.
 *
 * Жёстко вписать другое имя нельзя: имена у Google уходят в отставку, и через
 * месяц сломается снова. Поэтому на 404 спрашиваем список моделей.
 */

type Ответ = { ok: boolean; status: number; text: () => Promise<string> };
const ответ = (status: number, body: string): Ответ => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
});

const СПИСОК = JSON.stringify({
  models: [
    { name: "models/embedding-001", supportedGenerationMethods: ["embedContent"] },
    { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
  ],
});

/** Поддельный fetch: отвечает по порядку обращений и записывает адреса. */
function поддельныйFetch(ответы: Ответ[]) {
  const адреса: string[] = [];
  const f = (async (url: string) => {
    адреса.push(String(url));
    const r = ответы.shift();
    if (!r) throw new Error("лишний вызов — ответов больше нет");
    return r;
  }) as unknown as typeof fetch;
  return { f, адреса };
}

const окружение = { GEMINI_API_KEY: "test-key" } as NodeJS.ProcessEnv;

describe("Gemini: имя модели может устареть, проверка — нет", () => {
  test("404 на имени модели → спрашиваем список и повторяем живой моделью", async () => {
    const { f, адреса } = поддельныйFetch([
      ответ(404, JSON.stringify({ error: { message: "models/gemini-flash-latest is not found" } })),
      ответ(200, СПИСОК),
      ответ(200, JSON.stringify({ candidates: [{ content: { parts: [{ text: "." }] } }] })),
    ]);
    const r = await запросGemini(окружение, f);
    expect(r.status).toBe(200);
    expect(классифицировать(r)).toBe("ok");
    // Повтор ушёл именно к той модели, что назвал список, и к generateContent.
    expect(адреса[2]).toContain("gemini-2.5-flash:generateContent");
    // Модель для эмбеддингов брать нельзя — она не умеет generateContent.
    expect(адреса[2]).not.toContain("embedding-001");
  });

  test("список не ответил → отдаём ПЕРВЫЙ ответ, а не выдуманный ok", async () => {
    const { f } = поддельныйFetch([
      ответ(404, "not found"),
      ответ(403, "no access to list"),
    ]);
    const r = await запросGemini(окружение, f);
    expect(r.status).toBe(404);
    // 404 значит «про деньги мы так и не спросили» — зелёным это красить нельзя.
    expect(классифицировать(r)).toBe("непонятно");
  });

  test("в списке нет ни одной модели с generateContent → не выдумываем имя", async () => {
    const { f, адреса } = поддельныйFetch([
      ответ(404, "not found"),
      ответ(200, JSON.stringify({ models: [{ name: "models/embedding-001", supportedGenerationMethods: ["embedContent"] }] })),
    ]);
    const r = await запросGemini(окружение, f);
    expect(r.status).toBe(404);
    expect(адреса.length).toBe(2); // третьего вызова быть не должно
  });

  test("обычный ответ НЕ тянет за собой лишних запросов", async () => {
    const { f, адреса } = поддельныйFetch([ответ(429, JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }))]);
    const r = await запросGemini(окружение, f);
    expect(r.status).toBe(429);
    expect(классифицировать(r)).toBe("предел");
    expect(адреса.length, "список моделей спрошен зря — это лишний сетевой вызов").toBe(1);
  });
});
