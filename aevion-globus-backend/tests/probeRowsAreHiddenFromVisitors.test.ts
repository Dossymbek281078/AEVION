import { describe, test, expect } from "vitest";
import { похожеНаПробу, безПроб, просятПробы } from "../src/lib/probeRows";

/**
 * Правило скрывает НАШИ пробы и обязано пропускать настоящие работы. Контроли в
 * обе стороны здесь не украшение: слишком жадное правило прячет чужую работу, а
 * это дороже, чем показать пробу.
 */
describe("проба узнаётся по слову с разделителем", () => {
  test("наши пробы узнаются", () => {
    for (const s of ["smoke-music-1", "smoke ", "probe: idea", "test-42", "SMOKE-UP"]) {
      expect(похожеНаПробу({ title: s }), `${s} должна считаться пробой`).toBe(true);
    }
    expect(похожеНаПробу({ ref: "k1758300000000" })).toBe(true);
    expect(похожеНаПробу({ ref: "cert-test" })).toBe(true);
  });

  test("КОНТРОЛЬ: настоящие работы НЕ прячутся", () => {
    for (const s of ["Smokehouse chef", "Testament of a founder", "Probable cause", "Протокол испытаний"]) {
      expect(похожеНаПробу({ title: s }), `${s} — настоящая работа, прятать нельзя`).toBe(false);
    }
    expect(похожеНаПробу({ title: "", ref: "" })).toBe(false);
  });
});

describe("счёт скрытого возвращается наружу", () => {
  const строки = [{ title: "Smokehouse chef" }, { title: "smoke-1" }, { title: "smoke-2" }];

  test("посетителю — без проб, и число скрытого названо", () => {
    const r = безПроб(строки, false);
    expect(r.видимые).toHaveLength(1);
    expect(r.скрыто, "скрытое обязано быть ЧИСЛОМ в ответе, а не тишиной").toBe(2);
  });

  test("нашей проверке — всё, и скрыто ноль", () => {
    const r = безПроб(строки, true);
    expect(r.видимые).toHaveLength(3);
    expect(r.скрыто).toBe(0);
  });

  test("флаг читается только явный", () => {
    expect(просятПробы({ includeProbes: "1" })).toBe(true);
    expect(просятПробы({ includeProbes: "true" })).toBe(true);
    expect(просятПробы({ includeProbes: "0" })).toBe(false);
    expect(просятПробы({})).toBe(false);
    expect(просятПробы(undefined)).toBe(false);
  });
});
