import { describe, test, expect } from "vitest";
import { verifyVerdict } from "./verifyVerdict";

/**
 * Главное утверждение набора одно: НИ ОДИН исход, кроме явного `valid: false`,
 * не имеет права стать «invalid». Обвинение в подделке выводится только из
 * ответа, который прямо это сказал.
 */
describe("вердикт проверки подписи различает три исхода", () => {
  test("явные ответы бэкенда", () => {
    expect(verifyVerdict(true, true)).toBe("valid");
    expect(verifyVerdict(true, false)).toBe("invalid");
  });

  test("«подтверждать нечего» — не «недействительна»", () => {
    // qsignV2 отдаёт ровно это в предварительном режиме.
    expect(verifyVerdict(true, null)).toBe("unknown");
  });

  test("ответ не дошёл — вердикта нет", () => {
    // 500, 404, прокси лёг: тело может быть каким угодно, включая valid:true.
    expect(verifyVerdict(false, null)).toBe("unknown");
    expect(verifyVerdict(false, true)).toBe("unknown");
    expect(verifyVerdict(false, false)).toBe("unknown");
  });

  test("поля нет вовсе — старая сборка бэкенда, а не подделка", () => {
    expect(verifyVerdict(true, undefined)).toBe("unknown");
  });

  test("мусор в поле не превращается в вердикт", () => {
    for (const junk of ["true", 1, 0, "", [], {}, NaN]) {
      expect(verifyVerdict(true, junk), `значение ${JSON.stringify(junk)}`).toBe("unknown");
    }
  });

  test("«invalid» достижим РОВНО одним способом", () => {
    // Перебор всей сетки: если однажды кто-то расширит функцию и «invalid»
    // начнёт возвращаться ещё откуда-то, этот тест назовёт откуда.
    const values: unknown[] = [true, false, null, undefined, "true", "false", 0, 1, "", [], {}];
    const invalidCases = values
      .flatMap((v) => [true, false].map((ok) => ({ ok, v })))
      .filter(({ ok, v }) => verifyVerdict(ok, v) === "invalid");

    expect(invalidCases).toEqual([{ ok: true, v: false }]);
  });
});
