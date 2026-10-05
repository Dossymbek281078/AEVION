import { describe, test, expect } from "vitest";
import { разборElevenLabs, этоОк } from "../src/lib/providerSpendCheck";

/**
 * У ElevenLabs остаток знаков виден прямо в ответе — и его надо читать.
 *
 * Замер прода 05.10.2026: панель писала `elevenlabs: ok — "key valid"`, глядя
 * только на HTTP 200. Числа `character_count` и `character_limit` лежали в том
 * же теле нетронутыми. То есть при исчерпанном пакете кружок остался бы
 * зелёным — ровно та слепота, из-за которой у OpenAI дважды прошёл 429.
 *
 * Платного вызова здесь не нужно: ответ бесплатен и точен.
 */

const тело = (o: unknown) => ({ status: 200, body: JSON.stringify(o) });

describe("ElevenLabs: остаток знаков — это ответ, а не украшение", () => {
  test("знаки есть → ok, и в подписи видно сколько", () => {
    const r = разборElevenLabs(тело({ character_count: 1000, character_limit: 10000 }));
    expect(r.состояние).toBe("ok");
    expect(этоОк(r.состояние)).toBe(true);
    expect(r.detail).toContain("9000");
  });

  test("знаки кончились → НЕ ok, хотя HTTP 200", () => {
    const r = разборElevenLabs(тело({ character_count: 10000, character_limit: 10000 }));
    expect(r.состояние).toBe("нет денег");
    expect(этоОк(r.состояние), "исчерпанный пакет не должен красить панель зелёным").toBe(false);
  });

  test("перерасход (счёт больше предела) — тоже нет денег", () => {
    expect(разборElevenLabs(тело({ character_count: 10500, character_limit: 10000 })).состояние).toBe("нет денег");
  });

  test("200 без чисел — это «не знаю», а не «всё хорошо»", () => {
    // Поставщик мог ответить другой формой. Выдать это за ok — значит завести
    // зелёный кружок, который ничего не измеряет.
    const r = разборElevenLabs(тело({ tier: "creator" }));
    expect(r.состояние).toBe("непонятно");
    expect(этоОк(r.состояние)).toBe(false);
  });

  test("тело не разобралось — «не знаю»", () => {
    expect(разборElevenLabs({ status: 200, body: "<html>" }).состояние).toBe("непонятно");
  });

  test("401 и 403 — ключ плох, а не деньги", () => {
    expect(разборElevenLabs({ status: 401, body: "" }).состояние).toBe("ключ плох");
    expect(разборElevenLabs({ status: 403, body: "" }).состояние).toBe("ключ плох");
  });

  test("500 — непонятно, и остаток не выдумывается", () => {
    const r = разборElevenLabs({ status: 500, body: "boom" });
    expect(r.состояние).toBe("непонятно");
    expect(r.detail).not.toMatch(/осталось/);
  });

  test("нулевой предел не делится и не врёт", () => {
    // Защита от деления на ноль и от «осталось -0 знаков» в подписи.
    expect(разборElevenLabs(тело({ character_count: 0, character_limit: 0 })).состояние).toBe("непонятно");
  });
});
