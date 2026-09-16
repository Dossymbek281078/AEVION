import { describe, it, expect } from "vitest";
import { gumroadPermalink, gumroadCheckoutUrl, GUMROAD_FALLBACK_URL, GUMROAD_PERMALINKS } from "../../frontend/src/lib/gumroad";

// Прямая индексация словаря находит и унаследованное: GUMROAD_PERMALINKS["constructor"]
// — функция Object, она истинна, и возвращалась ВМЕСТО permalink. Из неё собирался
// URL чекаута `gumroad.com/l/function Object() { [native code] }?wanted=true`.
//
// 15.09.2026 ссылки ПО УМОЛЧАНИЮ больше нет: незнакомый ключ уходит не в чужую
// подписку, а на нашу страницу цен (GUMROAD_FALLBACK_URL). Поэтому проверяем
// ровно это: ключ прототипа и незнакомый ключ дают null, а не адрес товара.

const PROTO_KEYS = ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"];

describe("gumroadPermalink — ключ прототипа не становится ссылкой на оплату", () => {
  it.each(PROTO_KEYS)("«%s» как key → не товар, а null", (k) => {
    expect(gumroadPermalink({ key: k })).toBeNull();
  });

  it.each(PROTO_KEYS)("«%s» как tier → не товар, а null", (k) => {
    expect(gumroadPermalink({ tier: k })).toBeNull();
  });

  it("незнакомый ключ ведёт на страницу цен, а не в чужую кассу", () => {
    for (const k of [...PROTO_KEYS, "zzz-unknown"]) {
      expect(gumroadCheckoutUrl({ key: k })).toBe(GUMROAD_FALLBACK_URL);
    }
  });

  it("КОНТРОЛЬ: настоящий разовый товар по-прежнему находится", () => {
    const known = Object.keys(GUMROAD_PERMALINKS)[0];
    expect(known, "в словаре не осталось ни одного товара — проверять нечего").toBeTruthy();
    expect(gumroadPermalink({ key: known })).toBe(GUMROAD_PERMALINKS[known]);
    expect(gumroadCheckoutUrl({ key: known })).toContain(GUMROAD_PERMALINKS[known]);
  });

  it("URL чекаута всегда строка без следов функции", () => {
    for (const k of PROTO_KEYS) {
      const url = gumroadCheckoutUrl({ key: k, tier: k });
      expect(typeof url).toBe("string");
      expect(url).not.toMatch(/native code|function\s+Object/);
    }
  });

  it("обычный неизвестный ключ ведёт себя так же — иначе проверялась бы не та причина", () => {
    expect(gumroadPermalink({ key: "zzz-unknown" })).toBe(gumroadPermalink({ key: "constructor" }));
  });
});
