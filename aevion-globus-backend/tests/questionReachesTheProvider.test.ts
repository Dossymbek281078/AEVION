import { describe, test, expect, vi, beforeEach } from "vitest";

/**
 * РЕШАЮЩИЙ ЗАМЕР: доходит ли вопрос человека до поставщика.
 *
 * Повод 07.10.2026, приёмка на проде: `/api/qgood/chat` отвечал НЕ НА ВОПРОС.
 * Контрольный вопрос «ответь одним словом: сколько будет два плюс два» дал
 * ответ про лень — то есть модель продолжала СИСТЕМНЫЙ промпт, а сообщения
 * человека не видела. По исходнику цепочка выглядела верной на четырёх
 * уровнях, поэтому читать её дальше бессмысленно: надо посмотреть, что
 * уходит в сеть.
 *
 * Здесь записывается фактическое ТЕЛО запроса к провайдеру.
 */

process.env.GEMINI_API_KEY = "test-gemini";

const { тела } = vi.hoisted(() => ({ тела: [] as Array<{ url: string; body: any }> }));

vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

global.fetch = (async (url: string, init?: RequestInit) => {
  let body: any = null;
  try { body = JSON.parse(String(init?.body ?? "{}")); } catch { body = String(init?.body ?? ""); }
  тела.push({ url: String(url), body });
  return {
    ok: true,
    status: 200,
    text: async () => "{}",
    json: async () => ({ candidates: [{ content: { parts: [{ text: "Ответ модели." }] } }], usageMetadata: {} }),
  };
}) as unknown as typeof fetch;

const { спроситьИИ } = await import("../src/lib/дешёвыйИИ");

const ВОПРОС = "Ответь одним словом: сколько будет два плюс два?";
const РОЛЬ = "Ты психолог AEVION. Пиши тепло и коротко.";

describe("вопрос человека доходит до поставщика", () => {
  beforeEach(() => { тела.length = 0; });

  test("🔴 текст вопроса присутствует в теле запроса", async () => {
    await спроситьИИ({ роль: РОЛЬ, вопрос: ВОПРОС, максТокенов: 512, температура: 0.7 });
    expect(тела.length, "в сеть не ушло ни одного запроса").toBe(1);
    const целиком = JSON.stringify(тела[0].body);
    expect(целиком, "вопроса человека нет в теле запроса — модель его не видит").toContain("два плюс два");
  });

  test("роль ушла как системная, а не вместо вопроса", async () => {
    await спроситьИИ({ роль: РОЛЬ, вопрос: ВОПРОС, максТокенов: 512 });
    const b = тела[0].body;
    const системное = JSON.stringify(b.systemInstruction ?? b.system ?? "");
    expect(системное, "системная роль не доехала").toContain("психолог");
    // И роль не должна подменять собой вопрос.
    const пользовательское = JSON.stringify(b.contents ?? b.messages ?? "");
    expect(пользовательское).toContain("два плюс два");
  });

  test("🔴 предел длины ответа доехал и он не крошечный", async () => {
    // Второй симптом с прода: обрыв на полуслове при заявленных 512 токенах.
    await спроситьИИ({ роль: РОЛЬ, вопрос: ВОПРОС, максТокенов: 512 });
    const b = тела[0].body;
    const предел =
      b?.generationConfig?.maxOutputTokens ?? b?.max_tokens ?? b?.max_completion_tokens ?? null;
    expect(предел, "предел длины вообще не передан — поставщик решает сам").not.toBe(null);
    expect(Number(предел), "в запрос ушёл предел меньше запрошенного").toBeGreaterThanOrEqual(512);
  });

  test("контроль прибора: записанное тело — настоящее", async () => {
    // Первая версия этого контроля стояла ПОСЛЕ beforeEach, который чистит
    // список, и падала на пустоте — проверяла не прибор, а порядок хуков.
    await спроситьИИ({ роль: РОЛЬ, вопрос: ВОПРОС });
    expect(тела.length).toBeGreaterThan(0);
    expect(тела[0].url).toContain("generativelanguage");
  });
});

describe("маленький бюджет ответа не уходит на размышление модели", () => {
  beforeEach(() => { тела.length = 0; });

  test("🔴 при 512 токенах размышление Gemini выключено", async () => {
    // Повод: `gemini-2.5-flash` берёт токены на внутреннее размышление из
    // того же `maxOutputTokens`. При 512 человеку доставался обрывок на
    // 60–95 знаков, часто посреди слова и мимо вопроса (замер приёмки на
    // проде 07.10: на «сколько будет два плюс два» — кусок про лень).
    await спроситьИИ({ роль: РОЛЬ, вопрос: ВОПРОС, максТокенов: 512 });
    const g = тела[0].body?.generationConfig;
    expect(g?.maxOutputTokens).toBe(512);
    expect(g?.thinkingConfig, "размышление не выключено — бюджет ответа съест оно").toEqual({ thinkingBudget: 0 });
  });

  test("большой бюджет размышление НЕ трогает", async () => {
    // Направление выбрано по цене ошибки: выключить размышление там, где оно
    // помещается и полезно, значит ухудшить ответы 23 модулям ради одного.
    await спроситьИИ({ роль: РОЛЬ, вопрос: ВОПРОС, максТокенов: 4096 });
    expect(тела[0].body?.generationConfig?.thinkingConfig).toBeUndefined();
  });

  test("бюджет не указан вовсе → поведение прежнее", async () => {
    await спроситьИИ({ роль: РОЛЬ, вопрос: ВОПРОС });
    const g = тела[0].body?.generationConfig;
    expect(g?.maxOutputTokens).toBe(4096);
    expect(g?.thinkingConfig).toBeUndefined();
  });
});
