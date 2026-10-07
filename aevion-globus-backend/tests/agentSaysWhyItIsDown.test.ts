import { describe, test, expect } from "vitest";
import { причинаОтказаАгента } from "../src/services/agentRuntime/anthropicClient";

/**
 * Агент, оставшийся на Anthropic, обязан сказать человеку, ПОЧЕМУ он молчит.
 *
 * Агенты намеренно не переведены на общий реестр: им нужны вызовы
 * инструментов, которых там нет (`tools` в `providers.ts` — 0 вхождений).
 * Значит деньги на счёте Anthropic — их единственная опора, а на 07.10.2026
 * там $8.93 и консоль пытается автопополнить $20.
 *
 * Замер состояния ДО правки: ручка не молчала — отдавала 502, но текстом
 * поставщика («Anthropic error 429: {…}»). То есть человек читал чужую
 * диагностику вместо ответа. Чинится не «добавить обработку ошибки» (она
 * была), а «назвать причину по-человечески».
 */

describe("причина отказа агента — для человека, а не из лога поставщика", () => {
  test("кончились деньги или лимит → говорим про объём, без кода и скобок", () => {
    const по429 = причинаОтказаАгента(new Error('Anthropic error 429: {"type":"rate_limit_error"}'));
    expect(по429).toMatch(/временно недоступен/i);
    expect(по429).toMatch(/объём|объем/i);
    expect(по429, "в тексте для человека осталась диагностика поставщика").not.toMatch(/Anthropic error|\{/);

    const поСловам = причинаОтказаАгента(new Error("Anthropic error 400: credit balance is too low"));
    expect(поСловам).toMatch(/объём|объем/i);
  });

  test("отказ по доступу → честно: это наша настройка, не ошибка человека", () => {
    for (const код of ["401", "403"]) {
      const т = причинаОтказаАгента(new Error(`Anthropic error ${код}: unauthorized`));
      expect(т).toMatch(/не принят/i);
      expect(т, "человека обвиняют в нашей настройке").toMatch(/не ваша ошибка/i);
    }
  });

  test("ключа нет вовсе → так и сказано, это другая причина", () => {
    // Порядок проверок важен: «нет ключа» и «кончились деньги» — разные
    // поломки, и лечатся они разными руками.
    const было = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect(причинаОтказаАгента(new Error("socket hang up"))).toMatch(/не задан доступ/i);
    } finally {
      if (было !== undefined) process.env.ANTHROPIC_API_KEY = было;
    }
  });

  test("🔴 любая другая поломка тоже получает человеческий текст, а не пустоту", () => {
    // Молчание и сырой стек — два способа не ответить. Оба хуже короткой фразы.
    process.env.ANTHROPIC_API_KEY = "test-key";
    const т = причинаОтказаАгента(new Error("socket hang up"));
    expect(т.length).toBeGreaterThan(20);
    expect(т).toMatch(/недоступен/i);
    expect(т).not.toMatch(/socket hang up/);
  });

  test("контроль: разные причины дают РАЗНЫЕ тексты", () => {
    // Иначе «человеческое сообщение» выродилось бы в одну заглушку на всё, и
    // отличить «кончились деньги» от «сеть легла» стало бы невозможно.
    const деньги = причинаОтказаАгента(new Error("Anthropic error 429: quota"));
    const доступ = причинаОтказаАгента(new Error("Anthropic error 403: forbidden"));
    process.env.ANTHROPIC_API_KEY = "test-key";
    const прочее = причинаОтказаАгента(new Error("ETIMEDOUT"));
    expect(new Set([деньги, доступ, прочее]).size).toBe(3);
  });
});
