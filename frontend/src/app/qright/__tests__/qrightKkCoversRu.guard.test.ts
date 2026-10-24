import { describe, test, expect } from "vitest";
import { QRIGHT_DICT, tq } from "../qrightI18n";

// 24.10.2026: у словаря /qright было 153 ключа ru и 12 kk — казахский гость
// видел страницу почти целиком по-английски (прод /kk/qright: «Protect Your
// Work», «Your author identity», «Restore from file», «First time? Start here.»).
describe("QRight: у каждого ключа ru есть kk", () => {
  test("набор ключей kk покрывает ru", () => {
    const ru = Object.keys(QRIGHT_DICT.ru ?? {});
    const kk = new Set(Object.keys(QRIGHT_DICT.kk ?? {}));
    expect(ru.length, "знаменатель").toBeGreaterThan(150);
    expect(ru.filter((k) => !kk.has(k))).toEqual([]);
  });
  test("kk — не английский и не русский исходник", () => {
    expect(tq("kk", "Protect Your Work")).not.toBe("Protect Your Work");
    expect(tq("kk", "Protect Your Work")).not.toBe(tq("ru", "Protect Your Work"));
    expect(tq("en", "Protect Your Work")).toBe("Protect Your Work");
  });
});
