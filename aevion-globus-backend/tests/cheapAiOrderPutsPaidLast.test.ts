import { describe, test, expect, vi, beforeEach } from "vitest";

/**
 * Общий вход в ИИ ставит платного поставщика ПОСЛЕДНИМ.
 *
 * Повод 07.10.2026: на счёте Anthropic $8.93, консоль пытается автопополнить
 * $20; у OpenAI деньги кончились (проверка на проде отвечает «КЛЮЧ ГОДЕН, НО
 * ДЕНЕГ НЕТ»); у Gemini деньги есть. При этом массив провайдеров в реестре
 * начинается с `anthropic`, то есть при первой же осечке звонок уходил бы
 * именно в платный и почти пустой счёт.
 *
 * Тест гоняет НАСТОЯЩИЙ `callProvider`; подменены только сетевые вызовы к
 * поставщикам.
 */

process.env.GEMINI_API_KEY = "test-gemini";
process.env.OPENAI_API_KEY = "test-openai";
process.env.ANTHROPIC_API_KEY = "test-anthropic";

const { звонки } = vi.hoisted(() => ({ звонки: [] as string[] }));

vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

/** Поддельная сеть: отвечает по хосту, записывает порядок обращений. */
function сетьОтвечает(план: Record<string, { ok: boolean; текст?: string }>) {
  global.fetch = (async (url: string) => {
    const u = String(url);
    const кто = u.includes("generativelanguage") ? "gemini" : u.includes("openai") ? "openai" : "anthropic";
    звонки.push(кто);
    const п = план[кто] ?? { ok: false };
    if (!п.ok) {
      return {
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: "insufficient_quota" } }),
        json: async () => ({ error: { message: "insufficient_quota" } }),
      };
    }
    const текст = п.текст ?? "ответ";
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({}),
      json: async () =>
        кто === "gemini"
          ? { candidates: [{ content: { parts: [{ text: текст }] } }], usageMetadata: {} }
          : кто === "anthropic"
            ? { content: [{ type: "text", text: текст }], usage: { input_tokens: 1, output_tokens: 1 } }
            : { choices: [{ message: { content: текст } }], usage: { prompt_tokens: 1, completion_tokens: 1 } },
    };
  }) as unknown as typeof fetch;
}

const { спроситьИИ, ПОРЯДОК_ДЕШЕВЛЕ_СНАЧАЛА } = await import("../src/lib/дешёвыйИИ");

describe("порядок поставщиков: платный последним", () => {
  beforeEach(() => { звонки.length = 0; });

  test("порядок объявлен явно и начинается не с Anthropic", () => {
    // Политика записана ЛИТЕРАЛОМ: если вывести ожидание из самой константы,
    // проверка станет тавтологией и пропустит любую перестановку.
    expect([...ПОРЯДОК_ДЕШЕВЛЕ_СНАЧАЛА]).toEqual(["gemini", "openrouter", "openai", "anthropic"]);
    expect(ПОРЯДОК_ДЕШЕВЛЕ_СНАЧАЛА[ПОРЯДОК_ДЕШЕВЛЕ_СНАЧАЛА.length - 1]).toBe("anthropic");
  });

  test("🔴 смысл порядка: все БЕСПЛАТНЫЕ раньше любого платного", async () => {
    // Литерал выше охраняет текущее решение, а эта проверка — ПРАВИЛО, по
    // которому его принимали. Без неё добавление нового поставщика в середину
    // прошло бы незамеченным: список совпал бы с другим литералом, а деньги
    // начали бы тратиться раньше, чем нужно.
    const { getProviders } = await import("../src/services/qcoreai/providers");
    const все = getProviders();
    const цена = ПОРЯДОК_ДЕШЕВЛЕ_СНАЧАЛА.map((id) => все.find((p) => p.id === id));
    expect(цена.every(Boolean), "в порядке есть имя, которого нет в реестре").toBe(true);
    const последнийБесплатный = цена.map((p) => p!.free).lastIndexOf(true);
    const первыйПлатный = цена.map((p) => p!.free).indexOf(false);
    expect(
      последнийБесплатный,
      `платный стоит раньше бесплатного: ${ПОРЯДОК_ДЕШЕВЛЕ_СНАЧАЛА.join(" → ")}`,
    ).toBeLessThan(первыйПлатный);
  });

  test("🔴 бесплатное звено запаса не пропущено: OpenRouter в порядке есть", () => {
    // Повод 08.10.2026. Прежний порядок кончался на Anthropic с остатком
    // $8.93, а рядом работало бесплатное звено, до которого эти модули НЕ
    // доходили — в отличие от тех, кто зовёт реестр без явного порядка.
    // Разница становится важной 12.10, когда у Gemini истекает срок
    // перехода на предоплату.
    expect(
      ПОРЯДОК_ДЕШЕВЛЕ_СНАЧАЛА,
      "из порядка убрали бесплатный запас — модули умрут на платном счёте",
    ).toContain("openrouter");
  });

  test("Gemini отвечает → к платному вообще не ходим", async () => {
    сетьОтвечает({ gemini: { ok: true, текст: "Короткий осмысленный ответ." } });
    const r = await спроситьИИ({ вопрос: "Проверка" });
    expect(r.текст).toContain("осмысленный");
    expect(звонки).toEqual(["gemini"]);
    expect(звонки, "сходили к Anthropic при живом Gemini — это деньги").not.toContain("anthropic");
  });

  test("🔴 Gemini отказал → идём в OpenAI, а НЕ в Anthropic", async () => {
    // Это и есть суть правки: порядок реестра поставил бы здесь anthropic.
    сетьОтвечает({ gemini: { ok: false }, openai: { ok: true, текст: "Ответ от запасного." } });
    const r = await спроситьИИ({ вопрос: "Проверка" });
    expect(r.текст).toContain("запасного");
    expect(звонки[0]).toBe("gemini");
    expect(звонки[1], "после Gemini ушли не в OpenAI — порядок не соблюдён").toBe("openai");
    expect(r.переключение).toBe(true);
  });

  test("оба бесплатных отказали → Anthropic как последний рубеж", async () => {
    сетьОтвечает({ gemini: { ok: false }, openai: { ok: false }, anthropic: { ok: true, текст: "Платный ответил." } });
    const r = await спроситьИИ({ вопрос: "Проверка" });
    expect(r.текст).toContain("Платный");
    expect(звонки).toEqual(["gemini", "openai", "anthropic"]);
  });

  test("отказали все → бросаем, а не возвращаем пустую строку", async () => {
    // Молчаливый пустой ответ — худший исход: модуль покажет человеку пустоту
    // и решит, что всё хорошо.
    сетьОтвечает({ gemini: { ok: false }, openai: { ok: false }, anthropic: { ok: false } });
    await expect(спроситьИИ({ вопрос: "Проверка" })).rejects.toThrow();
  });
});
