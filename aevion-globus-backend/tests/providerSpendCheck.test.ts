import { describe, test, expect, beforeEach } from "vitest";
import {
  классифицировать,
  проверитьРасход,
  забытьКэш,
  жизньКэшаМс,
  этоОк,
  подпись,
} from "../src/lib/providerSpendCheck";

/**
 * Сторож на мок-ответах: проверка обязана отличать «ключ годен» от «можно
 * тратить».
 *
 * Повод — живой замер 05.10.2026: в Sentry дважды
 * `openai 429 insufficient_quota`, а наша панель в это же время показывала
 * `openai: ok` с пометкой «billing not visible here». Признак отвечал на
 * другой вопрос, чем тот, который задаёт панель.
 *
 * Мок-ответы взяты в той форме, в какой их отдают сами поставщики.
 */

const ОТВЕТЫ = {
  openaiНетДенег: {
    status: 429,
    body: JSON.stringify({
      error: { message: "You exceeded your current quota, please check your plan and billing details.", type: "insufficient_quota", code: "insufficient_quota" },
    }),
  },
  openaiЧастота: {
    status: 429,
    body: JSON.stringify({ error: { message: "Rate limit reached for requests", type: "requests", code: "rate_limit_exceeded" } }),
  },
  anthropicНетДенег: {
    status: 400,
    body: JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } }),
  },
  geminiПредел: {
    status: 429,
    body: JSON.stringify({ error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "Resource has been exhausted (e.g. check quota)." } }),
  },
  ключПлох: { status: 401, body: JSON.stringify({ error: { message: "Incorrect API key provided", type: "invalid_request_error" } }) },
  запрещено: { status: 403, body: "forbidden" },
  норма: { status: 200, body: JSON.stringify({ choices: [{ message: { content: "." } }] }) },
  поломка: { status: 500, body: "internal error" },
};

describe("проверка расхода отличает деньги от ключа", () => {
  beforeEach(() => забытьКэш());

  test("429 с признаком квоты — это НЕТ ДЕНЕГ, а не ok", () => {
    expect(классифицировать(ОТВЕТЫ.openaiНетДенег)).toBe("нет денег");
    expect(этоОк(классифицировать(ОТВЕТЫ.openaiНетДенег)), "нет денег не должно красить панель зелёным").toBe(false);
  });

  test("429 про частоту — это ПРЕДЕЛ, а не нехватка денег", () => {
    // Иначе основателя позовут платить там, где надо просто подождать.
    expect(классифицировать(ОТВЕТЫ.openaiЧастота)).toBe("предел");
    expect(классифицировать(ОТВЕТЫ.geminiПредел)).toBe("предел");
  });

  test("Anthropic говорит о деньгах кодом 400 — и это тоже нет денег", () => {
    expect(классифицировать(ОТВЕТЫ.anthropicНетДенег)).toBe("нет денег");
  });

  test("401 и 403 — ключ плох, а не деньги", () => {
    expect(классифицировать(ОТВЕТЫ.ключПлох)).toBe("ключ плох");
    expect(классифицировать(ОТВЕТЫ.запрещено)).toBe("ключ плох");
  });

  test("200 — ok", () => {
    expect(классифицировать(ОТВЕТЫ.норма)).toBe("ok");
    expect(этоОк(классифицировать(ОТВЕТЫ.норма))).toBe(true);
  });

  test("непонятный ответ НЕ выдаётся за ok", () => {
    // Молчать или зеленеть на неизвестном — та самая слепота, из-за которой
    // 429 прошёл дважды незамеченным.
    expect(классифицировать(ОТВЕТЫ.поломка)).toBe("непонятно");
    expect(этоОк(классифицировать(ОТВЕТЫ.поломка))).toBe(false);
  });

  test("подпись называет состояние словами, а не кодом", () => {
    expect(подпись("нет денег")).toMatch(/ДЕНЕГ НЕТ/);
    expect(подпись("ok")).toMatch(/деньги есть/);
  });
});

describe("кэш бережёт деньги и время", () => {
  beforeEach(() => забытьКэш());

  test("второй заход в пределах срока НЕ зовёт поставщика", async () => {
    let звонков = 0;
    const запрос = async () => { звонков++; return ОТВЕТЫ.норма; };
    const первый = await проверитьРасход("openai", запрос, { сейчас: 1_000_000, жизньМс: 3600_000 });
    const второй = await проверитьРасход("openai", запрос, { сейчас: 1_000_000 + 60_000, жизньМс: 3600_000 });
    expect(звонков, "поставщика спросили дважды — деньги потрачены зря").toBe(1);
    expect(первый.изКэша).toBe(false);
    expect(второй.изКэша).toBe(true);
    expect(второй.состояние).toBe("ok");
  });

  test("после истечения срока спрашиваем заново", async () => {
    let звонков = 0;
    const запрос = async () => { звонков++; return ОТВЕТЫ.норма; };
    await проверитьРасход("openai", запрос, { сейчас: 0, жизньМс: 3600_000 });
    await проверитьРасход("openai", запрос, { сейчас: 3600_001, жизньМс: 3600_000 });
    expect(звонков).toBe(2);
  });

  test("у каждого поставщика свой кэш", async () => {
    let звонков = 0;
    const запрос = async () => { звонков++; return ОТВЕТЫ.норма; };
    await проверитьРасход("openai", запрос, { сейчас: 0 });
    await проверитьРасход("anthropic", запрос, { сейчас: 0 });
    expect(звонков, "ответ одного поставщика выдали за ответ другого").toBe(2);
  });

  test("упавшая сеть — это «не знаю», а не «ok» и не «нет денег»", async () => {
    const итог = await проверитьРасход("gemini", async () => { throw new Error("fetch failed"); }, { сейчас: 0 });
    expect(итог.состояние).toBe("непонятно");
    expect(этоОк(итог.состояние)).toBe(false);
    expect(итог.detail).toMatch(/fetch failed/);
  });

  test("срок жизни кэша берётся из переменной, умолчание 6 часов", () => {
    expect(жизньКэшаМс({} as NodeJS.ProcessEnv)).toBe(6 * 3600_000);
    expect(жизньКэшаМс({ PROVIDER_SPEND_CHECK_HOURS: "2" } as NodeJS.ProcessEnv)).toBe(2 * 3600_000);
    // Мусор в переменной не должен обнулять срок и жечь деньги на каждом заходе.
    expect(жизньКэшаМс({ PROVIDER_SPEND_CHECK_HOURS: "ноль" } as NodeJS.ProcessEnv)).toBe(6 * 3600_000);
    expect(жизньКэшаМс({ PROVIDER_SPEND_CHECK_HOURS: "-5" } as NodeJS.ProcessEnv)).toBe(6 * 3600_000);
  });
});
