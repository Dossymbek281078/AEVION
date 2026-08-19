import { describe, it, expect } from "vitest";
import { gumroadPermalink, gumroadCheckoutUrl, GUMROAD_DEFAULT_PERMALINK } from "../../frontend/src/lib/gumroad";

// Прямая индексация словаря находит и унаследованное: GUMROAD_PERMALINKS["constructor"]
// — функция Object, она истинна, и возвращалась ВМЕСТО permalink. Из неё собирался
// URL чекаута `gumroad.com/l/function Object() { [native code] }?wanted=true`.
//
// Словарь сейчас ПУСТ, поэтому любой ключ уходит на ссылку по умолчанию — любой,
// кроме ключа прототипа. Пустой словарь вёл себя хуже отсутствующего ключа, и
// увидеть это можно было только на оплате.

const PROTO_KEYS = ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"];

describe("gumroadPermalink — ключ прототипа не становится ссылкой на оплату", () => {
  it.each(PROTO_KEYS)("«%s» как key → ссылка по умолчанию", (k) => {
    expect(gumroadPermalink({ key: k })).toBe(GUMROAD_DEFAULT_PERMALINK);
  });

  it.each(PROTO_KEYS)("«%s» как tier → ссылка по умолчанию", (k) => {
    expect(gumroadPermalink({ tier: k })).toBe(GUMROAD_DEFAULT_PERMALINK);
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
