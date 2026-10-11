import { describe, test, expect, vi, beforeEach } from "vitest";

/**
 * Модель, не принимающая `thinkingConfig`, не должна выглядеть мёртвой.
 *
 * Замер 09.10.2026, один ключ, один запрос:
 *   gemini-3.5-flash-lite  без thinkingConfig → 200
 *   gemini-3.5-flash-lite  с  thinkingConfig → 400 «invalid argument»
 *   gemini-2.5-flash / gemini-3.8-flash      → 200 в обоих случаях
 *
 * `gemini-3.5-flash-lite` объявлен у нас ЗАПАСОМ: в день, когда основной
 * поставщик откажет, запас упал бы с 400 — и по журналу это читалось бы как
 * «модель мертва», а сломана была НАША форма запроса.
 */

process.env.GEMINI_API_KEY = "test-gemini";

const { тела } = vi.hoisted(() => ({ тела: [] as Array<Record<string, unknown>> }));

vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

/** Поставщик: 400 на запрос С размышлением, 200 — без него. */
function сетьОтвергаетРазмышление() {
  тела.length = 0;
  global.fetch = (async (_url: string, init?: RequestInit) => {
    const тело = JSON.parse(String(init?.body ?? "{}"));
    тела.push(тело);
    const сРазмышлением = Boolean(тело?.generationConfig?.thinkingConfig);
    if (сРазмышлением) {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "Request contains an invalid argument." } }),
        text: async () => "{}",
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "Ответ модели." }] } }], usageMetadata: {} }),
      text: async () => "{}",
    };
  }) as unknown as typeof fetch;
}

const { callProvider } = await import("../src/services/qcoreai/providers");

const СООБЩЕНИЯ = [{ role: "user" as const, content: "Проверка" }];

describe("Gemini: отказ по форме запроса не выдаётся за мёртвую модель", () => {
  beforeEach(() => сетьОтвергаетРазмышление());

  test("🔴 модель не приняла thinkingConfig → повторяем без него и отвечаем человеку", async () => {
    const r = await callProvider("gemini", СООБЩЕНИЯ, "gemini-3.5-flash-lite", 0.3, undefined, 512);
    expect(r.reply, "ответа нет — значит повтора не было и запас упал").toContain("Ответ модели");
    expect(тела.length, "повтора не произошло").toBe(2);
    expect(тела[0]?.generationConfig).toHaveProperty("thinkingConfig");
    expect(
      тела[1]?.generationConfig,
      "в повторе thinkingConfig остался — поставщик откажет снова",
    ).not.toHaveProperty("thinkingConfig");
  });

  test("контроль: пока модель ПРИНИМАЕТ размышление, повтора нет", async () => {
    // Иначе правка превратилась бы в «всегда два вызова»: лишний запрос на
    // каждый ответ — это и деньги, и задержка.
    тела.length = 0;
    global.fetch = (async (_url: string, init?: RequestInit) => {
      тела.push(JSON.parse(String(init?.body ?? "{}")));
      return {
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: "Ответ." }] } }], usageMetadata: {} }),
        text: async () => "{}",
      };
    }) as unknown as typeof fetch;
    await callProvider("gemini", СООБЩЕНИЯ, "gemini-2.5-flash", 0.3, undefined, 512);
    expect(тела.length, "лишний повтор при исправном ответе").toBe(1);
  });

  test("🔴 контроль: НАСТОЯЩИЙ отказ модели повтором не маскируется", async () => {
    // Повтор нужен только для «наша форма неверна». Если модели нет вовсе,
    // ошибка обязана дойти до звонящего, а не утонуть во втором вызове.
    тела.length = 0;
    global.fetch = (async (_url: string, init?: RequestInit) => {
      тела.push(JSON.parse(String(init?.body ?? "{}")));
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: { message: "model is no longer available" } }),
        text: async () => "{}",
      };
    }) as unknown as typeof fetch;
    await expect(
      callProvider("gemini", СООБЩЕНИЯ, "выдуманная-модель", 0.3, undefined, 512, undefined, ["gemini"]),
    ).rejects.toThrow(/no longer available/);
    expect(тела.length, "на 404 сделан лишний повтор").toBe(1);
  });
});
